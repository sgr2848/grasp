import { Router } from 'express'
import multer from 'multer'
import { bookQueries, chapterQueries, userQueries, learningLoopQueries } from '../db/queries.js'
import { authMiddleware } from '../middleware/auth.js'
import { parseEpub } from '../services/epub.js'
import { extractConcepts } from '../services/llm.js'
import { syncLoopConcepts } from '../services/knowledge.js'
import { uploadEpub, uploadCoverImage, isStorageConfigured, deleteBookFiles } from '../services/storage.js'
import type { AuthRequest } from '../types/index.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

// POST /api/books/upload - Upload and parse EPUB file
// Accepts optional subjectId in form data or query param
router.post('/upload', authMiddleware, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    if (!req.file.originalname.toLowerCase().endsWith('.epub')) {
      res.status(400).json({ error: 'File must be an EPUB' })
      return
    }

    // Get optional subjectId from form data or query
    const subjectId = (req.body.subjectId || req.query.subjectId) as string | undefined

    // Ensure user exists
    await userQueries.upsert(req.userId!)

    // Parse the EPUB with smart chunking
    const parsed = await parseEpub(req.file.buffer)

    if (parsed.chunks.length === 0) {
      res.status(400).json({ error: 'No readable chapters found in EPUB' })
      return
    }

    // Create book record with subject link
    let book = await bookQueries.create({
      userId: req.userId!,
      subjectId: subjectId || undefined,
      title: parsed.title,
      author: parsed.author || undefined,
      description: parsed.description || undefined,
      totalChapters: parsed.chunks.length // Use chunks count (includes split chapters)
    })

    // Upload EPUB and cover to R2 (if configured)
    if (isStorageConfigured()) {
      try {
        // Upload original EPUB
        const epubResult = await uploadEpub(
          req.file.buffer,
          req.userId!,
          book.id,
          'book.epub'
        )

        // Upload cover image if found
        let coverResult = null
        if (parsed.cover) {
          coverResult = await uploadCoverImage(
            parsed.cover.data,
            req.userId!,
            book.id,
            parsed.cover.contentType
          )
        }

        // Update book with storage URLs
        if (epubResult || coverResult) {
          book = await bookQueries.updateCoverAndEpub(
            book.id,
            coverResult?.url,
            epubResult?.key
          ) || book
        }
      } catch (storageError) {
        // Log but don't fail - storage is optional
        console.error('Storage upload failed (continuing without storage):', storageError)
      }
    }

    // Create chapter/chunk records
    const chunksToCreate = parsed.chunks.map(chunk => ({
      bookId: book.id,
      chapterNumber: chunk.chapterNumber,
      chunkNumber: chunk.chunkNumber,
      totalChunks: chunk.totalChunks,
      title: chunk.title,
      content: chunk.content,
      wordCount: chunk.wordCount
    }))

    const chapters = await chapterQueries.createMany(chunksToCreate)

    res.status(201).json({
      ...book,
      chapters: chapters.map(ch => ({
        id: ch.id,
        chapterNumber: ch.chapterNumber,
        chunkNumber: ch.chunkNumber,
        totalChunks: ch.totalChunks,
        title: ch.title,
        wordCount: ch.wordCount
      }))
    })
  } catch (error) {
    console.error('EPUB upload error:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to parse EPUB' })
  }
})

// GET /api/books - List all user's books (optionally filtered by subjectId)
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const subjectId = req.query.subjectId as string | undefined
    const books = await bookQueries.findByUserId(req.userId!, subjectId)
    res.json(books)
  } catch (error) {
    console.error('Books fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch books' })
  }
})

// GET /api/books/:id - Get book with chapters/chunks
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string
    const book = await bookQueries.findById(id, req.userId!)
    if (!book) {
      res.status(404).json({ error: 'Book not found' })
      return
    }

    const chapters = await chapterQueries.findByBookId(book.id)

    // Get loop status for each chapter/chunk
    const chaptersWithProgress = await Promise.all(
      chapters.map(async (ch) => {
        let status: 'not_started' | 'in_progress' | 'completed' = 'not_started'

        if (ch.loopId) {
          const loop = await learningLoopQueries.findById(ch.loopId)
          if (loop) {
            status = loop.status === 'mastered' ? 'completed' : 'in_progress'
          }
        }

        return {
          id: ch.id,
          chapterNumber: ch.chapterNumber,
          chunkNumber: ch.chunkNumber,
          totalChunks: ch.totalChunks,
          title: ch.title,
          wordCount: ch.wordCount,
          loopId: ch.loopId,
          status
        }
      })
    )

    res.json({
      ...book,
      chapters: chaptersWithProgress
    })
  } catch (error) {
    console.error('Book fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch book' })
  }
})

// GET /api/books/:id/chapters/:chapterId - Get chapter content
router.get('/:id/chapters/:chapterId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string
    const chapterId = req.params.chapterId as string
    const book = await bookQueries.findById(id, req.userId!)
    if (!book) {
      res.status(404).json({ error: 'Book not found' })
      return
    }

    const chapter = await chapterQueries.findById(chapterId)
    if (!chapter || chapter.bookId !== book.id) {
      res.status(404).json({ error: 'Chapter not found' })
      return
    }

    res.json(chapter)
  } catch (error) {
    console.error('Chapter fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch chapter' })
  }
})

// POST /api/books/:id/chapters/:chapterId/start-loop - Create a learning loop for a chapter/chunk
// Accepts optional precision in request body
router.post('/:id/chapters/:chapterId/start-loop', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string
    const chapterId = req.params.chapterId as string
    const { precision } = req.body as { precision?: 'essential' | 'balanced' | 'precise' }

    const book = await bookQueries.findById(id, req.userId!)
    if (!book) {
      res.status(404).json({ error: 'Book not found' })
      return
    }

    const chapter = await chapterQueries.findById(chapterId)
    if (!chapter || chapter.bookId !== book.id) {
      res.status(404).json({ error: 'Chapter not found' })
      return
    }

    // Update last read chapter for reading progress
    await bookQueries.updateLastRead(book.id, chapter.id)

    // Check if loop already exists
    if (chapter.loopId) {
      const existingLoop = await learningLoopQueries.findById(chapter.loopId)
      if (existingLoop) {
        res.json({ loop: existingLoop, chapter })
        return
      }
    }

    // Create a new learning loop for this chapter/chunk
    // Inherits the book's subjectId for organization
    const initialPhase = chapter.chapterNumber === 1 && chapter.chunkNumber === 1
      ? 'prior_knowledge'
      : 'first_attempt'

    const loop = await learningLoopQueries.create({
      userId: req.userId!,
      subjectId: book.subjectId || undefined, // Inherit subject from book
      title: `${book.title} - ${chapter.title}`,
      sourceText: chapter.content,
      sourceType: 'book',
      precision,
      initialPhase
    })

    // Extract concepts in background
    extractConcepts(chapter.content, loop.precision)
      .then(async ({ concepts, conceptMap }) => {
        await learningLoopQueries.updateConcepts(loop.id, concepts, conceptMap)
        await syncLoopConcepts(loop.id)
      })
      .catch(err => console.error('Failed to extract concepts for book loop:', err))

    // Link the loop to the chapter
    await chapterQueries.linkLoop(chapter.id, loop.id)

    res.status(201).json({ loop, chapter })
  } catch (error) {
    console.error('Start loop error:', error)
    res.status(500).json({ error: 'Failed to start learning loop' })
  }
})

// DELETE /api/books/:id - Delete book
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string

    // Try to clean up storage files (non-blocking)
    if (isStorageConfigured()) {
      deleteBookFiles(req.userId!, id).catch(err => {
        console.error('Failed to delete storage files:', err)
      })
    }

    const deleted = await bookQueries.delete(id, req.userId!)
    if (!deleted) {
      res.status(404).json({ error: 'Book not found' })
      return
    }
    res.status(204).send()
  } catch (error) {
    console.error('Book delete error:', error)
    res.status(500).json({ error: 'Failed to delete book' })
  }
})

export default router
