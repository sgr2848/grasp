import AdmZip from 'adm-zip'
import { XMLParser } from 'fast-xml-parser'
import path from 'path'

// Target ~1500 words per chunk to stay within reasonable LLM context limits
const MAX_WORDS_PER_CHUNK = 1500
const MIN_WORDS_PER_CHUNK = 300

export interface ParsedChunk {
  chapterNumber: number
  chunkNumber: number
  totalChunks: number
  title: string
  content: string
  wordCount: number
}

export interface ParsedChapter {
  title: string
  content: string
  wordCount: number
}

export interface CoverImage {
  data: Buffer
  contentType: string
}

export interface ParsedEpub {
  title: string
  author: string | null
  description: string | null
  chapters: ParsedChapter[]
  chunks: ParsedChunk[] // Chapters split into manageable chunks
  cover: CoverImage | null
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
})

function stripHtml(html: string): string {
  // Remove script and style elements
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

  // Replace common block elements with newlines
  text = text.replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n')

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))

  // Clean up whitespace
  text = text.replace(/\n\s*\n/g, '\n\n')
  text = text.trim()

  return text
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length
}

function getTextContent(obj: unknown): string {
  if (typeof obj === 'string') return obj
  if (typeof obj === 'object' && obj !== null) {
    if ('#text' in obj) return String((obj as { '#text': unknown })['#text'])
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(getTextContent).join(' ')
    }
  }
  return ''
}

export async function parseEpub(buffer: Buffer): Promise<ParsedEpub> {
  const zip = new AdmZip(buffer)

  // 1. Find container.xml to locate content.opf
  const containerEntry = zip.getEntry('META-INF/container.xml')
  if (!containerEntry) {
    throw new Error('Invalid EPUB: missing META-INF/container.xml')
  }

  const containerXml = containerEntry.getData().toString('utf-8')
  const container = xmlParser.parse(containerXml)

  // Get rootfile path (usually content.opf or OEBPS/content.opf)
  const rootfile = container?.container?.rootfiles?.rootfile
  let opfPath: string

  if (Array.isArray(rootfile)) {
    opfPath = rootfile[0]['@_full-path']
  } else if (rootfile) {
    opfPath = rootfile['@_full-path']
  } else {
    throw new Error('Invalid EPUB: cannot find rootfile')
  }

  // 2. Parse content.opf for metadata and spine
  const opfEntry = zip.getEntry(opfPath)
  if (!opfEntry) {
    throw new Error(`Invalid EPUB: missing ${opfPath}`)
  }

  const opfXml = opfEntry.getData().toString('utf-8')
  const opf = xmlParser.parse(opfXml)

  const pkg = opf.package || opf['opf:package']
  const metadata = pkg?.metadata || pkg?.['opf:metadata']
  const manifest = pkg?.manifest || pkg?.['opf:manifest']
  const spine = pkg?.spine || pkg?.['opf:spine']

  // Extract metadata
  let title = 'Untitled'
  let author: string | null = null
  let description: string | null = null

  if (metadata) {
    // Title
    const dcTitle = metadata['dc:title'] || metadata.title
    if (dcTitle) {
      title = getTextContent(dcTitle)
    }

    // Author
    const dcCreator = metadata['dc:creator'] || metadata.creator
    if (dcCreator) {
      author = getTextContent(dcCreator)
    }

    // Description
    const dcDescription = metadata['dc:description'] || metadata.description
    if (dcDescription) {
      description = getTextContent(dcDescription)
    }
  }

  // Build manifest map (id -> {href, mediaType, properties})
  interface ManifestItem {
    href: string
    mediaType: string
    properties?: string
  }
  const manifestItems: Record<string, ManifestItem> = {}
  const items = manifest?.item
  if (Array.isArray(items)) {
    for (const item of items) {
      manifestItems[item['@_id']] = {
        href: item['@_href'],
        mediaType: item['@_media-type'] || '',
        properties: item['@_properties'] || ''
      }
    }
  } else if (items) {
    manifestItems[items['@_id']] = {
      href: items['@_href'],
      mediaType: items['@_media-type'] || '',
      properties: items['@_properties'] || ''
    }
  }

  // Get spine order (list of itemrefs)
  const spineItems: string[] = []
  const itemrefs = spine?.itemref
  if (Array.isArray(itemrefs)) {
    for (const ref of itemrefs) {
      spineItems.push(ref['@_idref'])
    }
  } else if (itemrefs) {
    spineItems.push(itemrefs['@_idref'])
  }

  // 3. Extract chapters in spine order
  const opfDir = path.dirname(opfPath)

  // Extract cover image (after opfDir is defined)
  const cover = extractCoverImage(zip, opfDir, manifestItems, metadata)

  const chapters: ParsedChapter[] = []

  for (const itemId of spineItems) {
    const item = manifestItems[itemId]
    if (!item) continue
    const href = item.href

    // Skip non-HTML files
    if (!href.endsWith('.html') && !href.endsWith('.xhtml') && !href.endsWith('.htm')) {
      continue
    }

    // Build full path
    const chapterPath = opfDir ? `${opfDir}/${href}` : href
    const chapterEntry = zip.getEntry(chapterPath)

    if (!chapterEntry) {
      // Try without directory prefix
      const altEntry = zip.getEntry(href)
      if (!altEntry) continue

      const html = altEntry.getData().toString('utf-8')
      const content = stripHtml(html)

      if (content.length < 100) continue // Skip very short chapters (likely nav/title pages)

      chapters.push({
        title: extractChapterTitle(html) || `Chapter ${chapters.length + 1}`,
        content,
        wordCount: countWords(content)
      })
      continue
    }

    const html = chapterEntry.getData().toString('utf-8')
    const content = stripHtml(html)

    if (content.length < 100) continue // Skip very short chapters

    chapters.push({
      title: extractChapterTitle(html) || `Chapter ${chapters.length + 1}`,
      content,
      wordCount: countWords(content)
    })
  }

  // Convert chapters to chunks for manageable learning
  const chunks = chapterToChunks(chapters)

  return {
    title,
    author,
    description,
    chapters,
    chunks,
    cover
  }
}

/**
 * Extract cover image from EPUB
 * Tries multiple strategies: cover-image property, cover meta, common cover IDs
 */
function extractCoverImage(
  zip: AdmZip,
  opfDir: string,
  manifestItems: Record<string, { href: string; mediaType: string; properties?: string }>,
  metadata: unknown
): CoverImage | null {
  // Strategy 1: Look for item with properties="cover-image" (EPUB 3)
  for (const [, item] of Object.entries(manifestItems)) {
    if (item.properties?.includes('cover-image')) {
      const coverData = getImageData(zip, opfDir, item.href, item.mediaType)
      if (coverData) return coverData
    }
  }

  // Strategy 2: Look for meta name="cover" pointing to manifest item (EPUB 2)
  if (metadata && typeof metadata === 'object') {
    const meta = (metadata as Record<string, unknown>).meta
    const metas = Array.isArray(meta) ? meta : meta ? [meta] : []

    for (const m of metas) {
      if (typeof m === 'object' && m !== null) {
        const metaObj = m as Record<string, string>
        if (metaObj['@_name'] === 'cover' && metaObj['@_content']) {
          const coverId = metaObj['@_content']
          const coverItem = manifestItems[coverId]
          if (coverItem && isImageType(coverItem.mediaType)) {
            const coverData = getImageData(zip, opfDir, coverItem.href, coverItem.mediaType)
            if (coverData) return coverData
          }
        }
      }
    }
  }

  // Strategy 3: Look for common cover IDs
  const commonCoverIds = ['cover', 'cover-image', 'coverimage', 'cover_image']
  for (const id of commonCoverIds) {
    const item = manifestItems[id]
    if (item && isImageType(item.mediaType)) {
      const coverData = getImageData(zip, opfDir, item.href, item.mediaType)
      if (coverData) return coverData
    }
  }

  // Strategy 4: Look for any image with "cover" in the filename
  for (const [, item] of Object.entries(manifestItems)) {
    if (isImageType(item.mediaType) && item.href.toLowerCase().includes('cover')) {
      const coverData = getImageData(zip, opfDir, item.href, item.mediaType)
      if (coverData) return coverData
    }
  }

  return null
}

function isImageType(mediaType: string): boolean {
  return mediaType.startsWith('image/')
}

function getImageData(
  zip: AdmZip,
  opfDir: string,
  href: string,
  mediaType: string
): CoverImage | null {
  // Try with opfDir prefix
  const fullPath = opfDir ? `${opfDir}/${href}` : href
  let entry = zip.getEntry(fullPath)

  // Try without prefix
  if (!entry) {
    entry = zip.getEntry(href)
  }

  if (!entry) {
    return null
  }

  return {
    data: entry.getData(),
    contentType: mediaType
  }
}

function extractChapterTitle(html: string): string | null {
  // Try to find title in h1, h2, or title tag
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/is)
  if (h1Match) {
    const title = stripHtml(h1Match[1]).trim()
    if (title && title.length < 200) return title
  }

  const h2Match = html.match(/<h2[^>]*>(.*?)<\/h2>/is)
  if (h2Match) {
    const title = stripHtml(h2Match[1]).trim()
    if (title && title.length < 200) return title
  }

  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is)
  if (titleMatch) {
    const title = stripHtml(titleMatch[1]).trim()
    if (title && title.length < 200) return title
  }

  return null
}

/**
 * Splits content into chunks of approximately MAX_WORDS_PER_CHUNK words,
 * trying to split at paragraph boundaries for better coherence.
 */
function splitIntoChunks(content: string, maxWords: number = MAX_WORDS_PER_CHUNK): string[] {
  const wordCount = countWords(content)

  // If content is short enough, return as single chunk
  if (wordCount <= maxWords) {
    return [content]
  }

  // Split by paragraphs (double newline)
  const paragraphs = content.split(/\n\n+/)
  const chunks: string[] = []
  let currentChunk: string[] = []
  let currentWordCount = 0

  for (const para of paragraphs) {
    const paraWordCount = countWords(para)

    // If adding this paragraph would exceed the limit
    if (currentWordCount + paraWordCount > maxWords && currentWordCount >= MIN_WORDS_PER_CHUNK) {
      // Save current chunk and start new one
      chunks.push(currentChunk.join('\n\n'))
      currentChunk = [para]
      currentWordCount = paraWordCount
    } else {
      // Add to current chunk
      currentChunk.push(para)
      currentWordCount += paraWordCount
    }
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    // If last chunk is too small, merge with previous
    if (currentWordCount < MIN_WORDS_PER_CHUNK && chunks.length > 0) {
      const lastChunk = chunks.pop()!
      chunks.push(lastChunk + '\n\n' + currentChunk.join('\n\n'))
    } else {
      chunks.push(currentChunk.join('\n\n'))
    }
  }

  return chunks
}

/**
 * Convert chapters into chunks, splitting long chapters
 */
export function chapterToChunks(chapters: ParsedChapter[]): ParsedChunk[] {
  const result: ParsedChunk[] = []

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i]
    const chapterNumber = i + 1
    const contentChunks = splitIntoChunks(chapter.content)
    const totalChunks = contentChunks.length

    for (let j = 0; j < contentChunks.length; j++) {
      const chunkContent = contentChunks[j]
      const chunkNumber = j + 1

      // Create title that indicates chunk position for multi-chunk chapters
      let title = chapter.title
      if (totalChunks > 1) {
        title = `${chapter.title} (Part ${chunkNumber}/${totalChunks})`
      }

      result.push({
        chapterNumber,
        chunkNumber,
        totalChunks,
        title,
        content: chunkContent,
        wordCount: countWords(chunkContent)
      })
    }
  }

  return result
}
