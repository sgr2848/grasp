import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react'
import { getBook, getChapter, startChapterLoop, type BookWithChapters, type Chapter, type Precision } from '@/lib/api'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

// Reader settings
type ReaderTheme = 'light' | 'sepia' | 'dark'
type TextSize = 'sm' | 'md' | 'lg' | 'xl'

const TEXT_SIZE_CONFIG: Record<TextSize, { label: string; className: string; chars: number }> = {
  sm: { label: 'S', className: 'text-base leading-relaxed', chars: 2200 },
  md: { label: 'M', className: 'text-lg leading-relaxed', chars: 1800 },
  lg: { label: 'L', className: 'text-xl leading-relaxed', chars: 1400 },
  xl: { label: 'XL', className: 'text-2xl leading-loose', chars: 1000 },
}

const THEME_CONFIG: Record<ReaderTheme, { bg: string; text: string; muted: string; border: string; card: string }> = {
  light: {
    bg: 'bg-white',
    text: 'text-neutral-800',
    muted: 'text-neutral-400',
    border: 'border-neutral-200',
    card: 'bg-white',
  },
  sepia: {
    bg: 'bg-amber-50/50',
    text: 'text-amber-950',
    muted: 'text-amber-700/60',
    border: 'border-amber-200/50',
    card: 'bg-amber-50',
  },
  dark: {
    bg: 'bg-neutral-900',
    text: 'text-neutral-200',
    muted: 'text-neutral-500',
    border: 'border-neutral-700',
    card: 'bg-neutral-800',
  },
}

// Persist reader settings
const READER_SETTINGS_KEY = 'reader-settings'

function loadReaderSettings(): { theme: ReaderTheme; textSize: TextSize } {
  try {
    const saved = localStorage.getItem(READER_SETTINGS_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        theme: parsed.theme || 'sepia',
        textSize: parsed.textSize || 'md',
      }
    }
  } catch {}
  return { theme: 'sepia', textSize: 'md' }
}

function saveReaderSettings(settings: { theme: ReaderTheme; textSize: TextSize }) {
  try {
    localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(settings))
  } catch {}
}

export default function Reader() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>()
  const navigate = useNavigate()
  const [book, setBook] = useState<BookWithChapters | null>(null)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isStartingLoop, setIsStartingLoop] = useState(false)
  const [precision, setPrecision] = useState<Precision>('balanced')
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [isFlipping, setIsFlipping] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)

  // Reader appearance settings
  const [readerSettings, setReaderSettings] = useState(loadReaderSettings)
  const { theme, textSize } = readerSettings
  const themeStyles = THEME_CONFIG[theme]
  const textConfig = TEXT_SIZE_CONFIG[textSize]

  const updateSettings = (updates: Partial<{ theme: ReaderTheme; textSize: TextSize }>) => {
    setReaderSettings(prev => {
      const next = { ...prev, ...updates }
      saveReaderSettings(next)
      return next
    })
  }

  useEffect(() => {
    if (!bookId || !chapterId) return

    const loadData = async () => {
      try {
        setIsLoading(true)
        setCurrentPage(0)
        const [bookData, chapterData] = await Promise.all([
          getBook(bookId),
          getChapter(bookId, chapterId)
        ])
        setBook(bookData)
        setChapter(chapterData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load chapter')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [bookId, chapterId])

  // Split content into pages (adjusts based on text size)
  const pages = useMemo(() => {
    if (!chapter) return []

    const charsPerPage = textConfig.chars
    const paragraphs = chapter.content.split('\n\n').filter(p => p.trim())
    const result: string[][] = []
    let currentPageParagraphs: string[] = []
    let currentCharCount = 0

    for (const paragraph of paragraphs) {
      if (currentCharCount + paragraph.length > charsPerPage && currentPageParagraphs.length > 0) {
        result.push(currentPageParagraphs)
        currentPageParagraphs = [paragraph]
        currentCharCount = paragraph.length
      } else {
        currentPageParagraphs.push(paragraph)
        currentCharCount += paragraph.length
      }
    }

    if (currentPageParagraphs.length > 0) {
      result.push(currentPageParagraphs)
    }

    // Add an extra "page" for the learning section
    result.push([])

    return result
  }, [chapter, textConfig.chars])

  const totalPages = pages.length
  const isLastPage = currentPage === totalPages - 1
  const isFirstPage = currentPage === 0

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages - 1 && !isFlipping) {
      setIsFlipping(true)
      setCurrentPage(p => p + 1)
      setTimeout(() => setIsFlipping(false), 200)
    }
  }, [currentPage, totalPages, isFlipping])

  const goToPrevPage = useCallback(() => {
    if (currentPage > 0 && !isFlipping) {
      setIsFlipping(true)
      setCurrentPage(p => p - 1)
      setTimeout(() => setIsFlipping(false), 200)
    }
  }, [currentPage, isFlipping])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        goToNextPage()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPrevPage()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToNextPage, goToPrevPage])

  const handleStartLearning = async () => {
    if (!bookId || !chapterId) return

    try {
      setIsStartingLoop(true)
      const { loop } = await startChapterLoop(bookId, chapterId, precision)
      navigate(`/learn/${loop.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start learning')
      setIsStartingLoop(false)
    }
  }

  // Find next/prev parts and chapters
  const getNavigation = () => {
    if (!book || !chapter) return { nextPart: null, prevPart: null, nextChapter: null, prevChapter: null }

    const currentIndex = book.chapters.findIndex(ch => ch.id === chapter.id)
    const next = currentIndex < book.chapters.length - 1 ? book.chapters[currentIndex + 1] : null
    const prev = currentIndex > 0 ? book.chapters[currentIndex - 1] : null

    // Determine if next/prev is a part of the same chapter or a different chapter
    const nextPart = next && next.chapterNumber === chapter.chapterNumber ? next : null
    const prevPart = prev && prev.chapterNumber === chapter.chapterNumber ? prev : null
    const nextChapter = next && next.chapterNumber !== chapter.chapterNumber ? next : null
    const prevChapter = prev && prev.chapterNumber !== chapter.chapterNumber ? prev : null

    // If we're on the last part of a chapter, get the next chapter
    const nextChapterAfterParts = !nextPart && next ? next : null

    return {
      nextPart,
      prevPart,
      nextChapter: nextChapter || nextChapterAfterParts,
      prevChapter
    }
  }

  const { nextPart, prevPart, nextChapter, prevChapter } = getNavigation()

  const progressPercent = totalPages > 1 ? Math.round((currentPage / (totalPages - 1)) * 100) : 0

  return (
    <div className="mx-auto max-w-4xl">
      <SignedOut>
        <Card className="p-6 m-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-neutral-900">Sign in to read</div>
              <p className="mt-1 text-sm text-neutral-500">
                You need to be signed in to access your books.
              </p>
            </div>
            <SignInButton mode="modal">
              <Button>Sign in</Button>
            </SignInButton>
          </div>
        </Card>
      </SignedOut>

      <SignedIn>
        {error && (
          <Card className="border-red-200 bg-red-50 p-4 m-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-red-600">{error}</div>
              <Button variant="secondary" size="sm" onClick={() => setError(null)}>
                Dismiss
              </Button>
            </div>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-[600px]">
            <div className="flex items-center gap-3">
              <Spinner size="lg" />
              <span className="text-sm text-neutral-500">Loading chapter...</span>
            </div>
          </div>
        ) : !chapter || !book ? (
          <div className="flex items-center justify-center h-[600px]">
            <div className="text-center text-sm text-neutral-500">
              Chapter not found
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* Top bar */}
            <div className={cn(
              "flex items-center justify-between px-4 py-3 border-b",
              themeStyles.card,
              themeStyles.border
            )}>
              <Link
                to={`/books/${book.id}`}
                className={cn("inline-flex items-center gap-2 text-sm", themeStyles.muted, "hover:opacity-80")}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close
              </Link>

              <div className="text-center">
                <div className={cn("text-sm font-medium truncate max-w-[200px] sm:max-w-none", themeStyles.text)}>
                  {chapter.title}
                </div>
                {chapter.totalChunks > 1 && (
                  <div className={cn("text-xs", themeStyles.muted)}>
                    Part {chapter.chunkNumber} of {chapter.totalChunks}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className={cn("text-sm", themeStyles.muted)}>
                  {currentPage + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={cn(
                    "p-1.5 rounded-lg transition",
                    showSettings
                      ? theme === 'dark' ? 'bg-neutral-700' : 'bg-neutral-200'
                      : theme === 'dark' ? 'hover:bg-neutral-700' : 'hover:bg-neutral-100'
                  )}
                  aria-label="Reader settings"
                >
                  <svg className={cn("h-5 w-5", themeStyles.muted)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Settings panel */}
            {showSettings && (
              <div className={cn(
                "px-4 py-3 border-b flex flex-wrap items-center justify-center gap-6",
                themeStyles.card,
                themeStyles.border
              )}>
                {/* Theme selector */}
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-medium", themeStyles.muted)}>Theme</span>
                  <div className="flex rounded-lg overflow-hidden border border-neutral-300 dark:border-neutral-600">
                    {(['light', 'sepia', 'dark'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => updateSettings({ theme: t })}
                        className={cn(
                          "px-3 py-1.5 text-xs font-medium transition",
                          theme === t
                            ? t === 'dark'
                              ? 'bg-neutral-700 text-white'
                              : t === 'sepia'
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-neutral-900 text-white'
                            : theme === 'dark'
                            ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                            : 'bg-white text-neutral-600 hover:bg-neutral-50'
                        )}
                      >
                        {t === 'light' ? 'Light' : t === 'sepia' ? 'Sepia' : 'Dark'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text size selector */}
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-medium", themeStyles.muted)}>Size</span>
                  <div className="flex rounded-lg overflow-hidden border border-neutral-300 dark:border-neutral-600">
                    {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          updateSettings({ textSize: size })
                          setCurrentPage(0) // Reset to first page when size changes
                        }}
                        className={cn(
                          "w-9 py-1.5 text-xs font-medium transition",
                          textSize === size
                            ? theme === 'dark'
                              ? 'bg-neutral-700 text-white'
                              : 'bg-neutral-900 text-white'
                            : theme === 'dark'
                            ? 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                            : 'bg-white text-neutral-600 hover:bg-neutral-50'
                        )}
                      >
                        {TEXT_SIZE_CONFIG[size].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Progress bar */}
            <div className={cn("h-1", theme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-100')}>
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Book page container */}
            <div className={cn("relative min-h-[600px] select-none", themeStyles.bg)}>
              {/* Page content */}
              <div
                ref={pageRef}
                className={cn(
                  "px-8 sm:px-16 py-10 min-h-[600px] transition-opacity duration-200",
                  themeStyles.text,
                  isFlipping && "opacity-0"
                )}
              >
                {isLastPage ? (
                  // Learning section on last page
                  <div className="flex flex-col items-center justify-center min-h-[500px] text-center">
                    <div className={cn(
                      "w-16 h-16 rounded-full flex items-center justify-center mb-6",
                      theme === 'dark' ? 'bg-emerald-900/50' : 'bg-emerald-100'
                    )}>
                      <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>

                    <h2 className={cn("text-2xl font-bold mb-2", themeStyles.text)}>
                      Finished Reading!
                    </h2>
                    <p className={cn("mb-8 max-w-md", themeStyles.muted)}>
                      Ready to test your understanding? Start the learning phase to practice the Feynman technique.
                    </p>

                    {/* Precision selector */}
                    <div className="w-full max-w-sm mb-6">
                      <div className={cn("text-sm font-medium mb-3", themeStyles.text)}>Detail level</div>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { id: 'essential', label: 'Essential', desc: 'Core ideas' },
                          { id: 'balanced', label: 'Balanced', desc: 'Recommended' },
                          { id: 'precise', label: 'Precise', desc: 'All details' },
                        ] as const).map((level) => (
                          <button
                            key={level.id}
                            type="button"
                            onClick={() => setPrecision(level.id)}
                            className={cn(
                              'flex flex-col border rounded-lg px-3 py-2 text-center text-sm transition',
                              precision === level.id
                                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-500'
                                : theme === 'dark'
                                ? 'border-neutral-600 bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                                : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                            )}
                          >
                            <span className="font-medium">{level.label}</span>
                            <span className={cn("text-xs", themeStyles.muted)}>{level.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button
                      size="lg"
                      onClick={handleStartLearning}
                      disabled={isStartingLoop}
                      className="mb-8"
                    >
                      {isStartingLoop ? (
                        <>
                          <Spinner className="border-white/30 border-t-white" />
                          Starting...
                        </>
                      ) : (
                        'Start Learning'
                      )}
                    </Button>

                    {/* Part/Chapter navigation */}
                    <div className="flex flex-col items-center gap-3">
                      {/* Part navigation (within same chapter) */}
                      {(nextPart || prevPart) && (
                        <div className="flex items-center gap-4 text-sm">
                          {prevPart && (
                            <Link
                              to={`/books/${book.id}/read/${prevPart.id}`}
                              className={cn("inline-flex items-center gap-1", themeStyles.muted, "hover:opacity-80")}
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                              Part {prevPart.chunkNumber}
                            </Link>
                          )}
                          {nextPart && (
                            <Link
                              to={`/books/${book.id}/read/${nextPart.id}`}
                              className={cn(
                                "inline-flex items-center gap-1 px-4 py-2 rounded-lg font-medium",
                                theme === 'dark'
                                  ? 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600'
                                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                              )}
                            >
                              Continue to Part {nextPart.chunkNumber}
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          )}
                        </div>
                      )}

                      {/* Chapter navigation */}
                      {(nextChapter || prevChapter) && (
                        <div className="flex items-center gap-4 text-sm">
                          {prevChapter && (
                            <Link
                              to={`/books/${book.id}/read/${prevChapter.id}`}
                              className={cn(themeStyles.muted, "hover:opacity-80")}
                            >
                              Previous Chapter
                            </Link>
                          )}
                          {nextChapter && !nextPart && (
                            <Link
                              to={`/books/${book.id}/read/${nextChapter.id}`}
                              className={cn(themeStyles.muted, "hover:opacity-80")}
                            >
                              Next Chapter
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // Regular content page
                  <article className="max-w-2xl mx-auto">
                    {/* Chapter title on first page */}
                    {currentPage === 0 && (
                      <div className={cn("mb-8 pb-6 border-b", themeStyles.border)}>
                        <div className={cn("text-sm mb-2", themeStyles.muted)}>
                          {book.title} {book.author && `· ${book.author}`}
                        </div>
                        <h1 className={cn("text-2xl font-serif font-bold", themeStyles.text)}>
                          {chapter.title}
                        </h1>
                        {chapter.totalChunks > 1 && (
                          <div className={cn("text-sm mt-2", themeStyles.muted)}>
                            Part {chapter.chunkNumber} of {chapter.totalChunks}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Page paragraphs */}
                    <div className="space-y-6 font-serif">
                      {pages[currentPage]?.map((paragraph, index) => (
                        <p
                          key={index}
                          className={cn(
                            textConfig.className,
                            themeStyles.text,
                            "first-letter:text-2xl first-letter:font-bold"
                          )}
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </article>
                )}
              </div>

              {/* Page flip zones */}
              {!isLastPage && (
                <button
                  onClick={goToNextPage}
                  className={cn(
                    "absolute right-0 top-0 bottom-0 w-1/4 cursor-e-resize transition-colors",
                    theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-neutral-900/5'
                  )}
                  aria-label="Next page"
                />
              )}
              {!isFirstPage && (
                <button
                  onClick={goToPrevPage}
                  className={cn(
                    "absolute left-0 top-0 bottom-0 w-1/4 cursor-w-resize transition-colors",
                    theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-neutral-900/5'
                  )}
                  aria-label="Previous page"
                />
              )}

              {/* Page indicators */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                {!isFirstPage && (
                  <button
                    onClick={goToPrevPage}
                    className={cn(
                      "p-2 rounded-full shadow-md transition",
                      theme === 'dark'
                        ? 'bg-neutral-800 hover:bg-neutral-700'
                        : 'bg-white hover:bg-neutral-50'
                    )}
                    aria-label="Previous page"
                  >
                    <svg className={cn("w-5 h-5", themeStyles.muted)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}

                <div className={cn(
                  "px-4 py-2 rounded-full shadow-md text-sm",
                  theme === 'dark' ? 'bg-neutral-800 text-neutral-300' : 'bg-white text-neutral-600'
                )}>
                  Page {currentPage + 1} of {totalPages}
                </div>

                {!isLastPage && (
                  <button
                    onClick={goToNextPage}
                    className={cn(
                      "p-2 rounded-full shadow-md transition",
                      theme === 'dark'
                        ? 'bg-neutral-800 hover:bg-neutral-700'
                        : 'bg-white hover:bg-neutral-50'
                    )}
                    aria-label="Next page"
                  >
                    <svg className={cn("w-5 h-5", themeStyles.muted)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Keyboard hint */}
            <div className={cn(
              "text-center py-3 text-xs border-t",
              themeStyles.card,
              themeStyles.muted,
              themeStyles.border
            )}>
              Use arrow keys or click the edges to flip pages
            </div>
          </div>
        )}
      </SignedIn>
    </div>
  )
}
