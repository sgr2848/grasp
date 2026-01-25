import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react'
import { getBook, type BookWithChapters, type ChapterSummary } from '@/lib/api'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

// Group chapters by chapterNumber for better organization
interface ChapterGroup {
  chapterNumber: number
  title: string
  parts: ChapterSummary[]
  totalWords: number
  completedParts: number
  status: 'not_started' | 'in_progress' | 'completed'
}

function PartStatusIcon({ status, size = 'md' }: { status: ChapterSummary['status']; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'
  const dotSize = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2'
  const checkSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'

  if (status === 'completed') {
    return (
      <div className={cn('flex items-center justify-center rounded-full bg-emerald-500/20', sizeClasses)}>
        <svg className={cn('text-emerald-500', checkSize)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    )
  }

  if (status === 'in_progress') {
    return (
      <div className={cn('flex items-center justify-center rounded-full bg-amber-500/20', sizeClasses)}>
        <div className={cn('rounded-full bg-amber-500', dotSize)} />
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-center rounded-full bg-neutral-200', sizeClasses)}>
      <div className={cn('rounded-full bg-neutral-400', dotSize)} />
    </div>
  )
}

export default function BookPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [book, setBook] = useState<BookWithChapters | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set())

  const loadBook = useCallback(async () => {
    if (!id) return

    try {
      setIsLoading(true)
      setError(null)
      const data = await getBook(id)
      setBook(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load book')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    void loadBook()
  }, [loadBook])

  // Group chapters by chapterNumber
  const chapterGroups = useMemo((): ChapterGroup[] => {
    if (!book) return []

    const groups = new Map<number, ChapterGroup>()

    for (const chapter of book.chapters) {
      const existing = groups.get(chapter.chapterNumber)
      if (existing) {
        existing.parts.push(chapter)
        existing.totalWords += chapter.wordCount
        if (chapter.status === 'completed') {
          existing.completedParts++
        }
      } else {
        groups.set(chapter.chapterNumber, {
          chapterNumber: chapter.chapterNumber,
          title: chapter.title,
          parts: [chapter],
          totalWords: chapter.wordCount,
          completedParts: chapter.status === 'completed' ? 1 : 0,
          status: 'not_started'
        })
      }
    }

    // Calculate overall status for each group
    for (const group of groups.values()) {
      if (group.completedParts === group.parts.length) {
        group.status = 'completed'
      } else if (group.completedParts > 0 || group.parts.some(p => p.status === 'in_progress')) {
        group.status = 'in_progress'
      }
    }

    return Array.from(groups.values()).sort((a, b) => a.chapterNumber - b.chapterNumber)
  }, [book])

  const toggleChapterExpanded = (chapterNumber: number) => {
    setExpandedChapters(prev => {
      const next = new Set(prev)
      if (next.has(chapterNumber)) {
        next.delete(chapterNumber)
      } else {
        next.add(chapterNumber)
      }
      return next
    })
  }

  const handlePartClick = (chapter: ChapterSummary) => {
    if (!book) return

    // If loop exists and in progress, navigate to continue the loop
    if (chapter.loopId && chapter.status === 'in_progress') {
      navigate(`/learn/${chapter.loopId}`)
      return
    }

    // Otherwise, go to the reader page
    navigate(`/books/${book.id}/read/${chapter.id}`)
  }

  const progress = book && book.totalChapters > 0
    ? Math.round((book.completedChapters / book.totalChapters) * 100)
    : 0

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back button */}
      <Link
        to="/books"
        className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Books
      </Link>

      <SignedOut>
        <Card className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-neutral-900">Sign in to view this book</div>
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
          <Card className="border-red-200 bg-red-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-red-600">{error}</div>
              <Button variant="secondary" size="sm" onClick={() => setError(null)}>
                Dismiss
              </Button>
            </div>
          </Card>
        )}

        {isLoading ? (
          <Card className="p-10">
            <div className="flex items-center justify-center gap-3">
              <Spinner size="lg" />
              <span className="text-sm text-neutral-500">Loading book...</span>
            </div>
          </Card>
        ) : !book ? (
          <Card className="p-10">
            <div className="text-center text-sm text-neutral-500">
              Book not found
            </div>
          </Card>
        ) : (
          <>
            {/* Book header */}
            <Card className="p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                    {book.title}
                  </h1>
                  {book.author && (
                    <p className="mt-1 text-base text-neutral-500">by {book.author}</p>
                  )}
                  {book.description && (
                    <p className="mt-3 text-sm text-neutral-400 line-clamp-3">
                      {book.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {progress === 100 && (
                    <Badge variant="success">Completed</Badge>
                  )}
                </div>
              </div>

              {/* Progress */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Progress</span>
                  <span className="text-neutral-700">
                    {book.completedChapters} / {book.totalChapters} chapters
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </Card>

            {/* Chapters list */}
            <div className="space-y-2">
              <h2 className="text-lg font-medium text-neutral-900">Chapters</h2>

              {chapterGroups.map((group) => {
                const hasParts = group.parts.length > 1
                const isExpanded = expandedChapters.has(group.chapterNumber)
                const firstPart = group.parts[0]

                // Single part chapter - render directly
                if (!hasParts) {
                  return (
                    <Card
                      key={group.chapterNumber}
                      className="cursor-pointer p-4 transition hover:bg-neutral-50"
                      onClick={() => handlePartClick(firstPart)}
                    >
                      <div className="flex items-center gap-4">
                        <PartStatusIcon status={firstPart.status} />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-neutral-400">
                              Ch. {group.chapterNumber}
                            </span>
                            <h3 className={cn(
                              'truncate text-sm font-medium',
                              firstPart.status === 'completed'
                                ? 'text-neutral-400'
                                : 'text-neutral-900'
                            )}>
                              {group.title}
                            </h3>
                          </div>
                          <p className="mt-0.5 text-xs text-neutral-400">
                            {group.totalWords.toLocaleString()} words
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {firstPart.status === 'in_progress' && (
                            <Badge variant="warning">In Progress</Badge>
                          )}
                          {firstPart.status === 'completed' && (
                            <Badge variant="success">Mastered</Badge>
                          )}

                          {firstPart.status === 'not_started' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/books/${book.id}/read/${firstPart.id}`)
                              }}
                            >
                              Read
                            </Button>
                          )}

                          {firstPart.status === 'in_progress' && firstPart.loopId && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/learn/${firstPart.loopId}`)
                              }}
                            >
                              Continue
                            </Button>
                          )}

                          {firstPart.status === 'completed' && firstPart.loopId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/learn/${firstPart.loopId}`)
                              }}
                            >
                              Review
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                }

                // Multi-part chapter - render with collapsible parts
                return (
                  <Card key={group.chapterNumber} className="overflow-hidden">
                    {/* Chapter header */}
                    <button
                      className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-neutral-50"
                      onClick={() => toggleChapterExpanded(group.chapterNumber)}
                    >
                      <PartStatusIcon status={group.status} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-neutral-400">
                            Ch. {group.chapterNumber}
                          </span>
                          <h3 className={cn(
                            'truncate text-sm font-medium',
                            group.status === 'completed'
                              ? 'text-neutral-400'
                              : 'text-neutral-900'
                          )}>
                            {group.title}
                          </h3>
                        </div>
                        <p className="mt-0.5 text-xs text-neutral-400">
                          {group.totalWords.toLocaleString()} words
                          <span className="mx-2">·</span>
                          <span className={cn(
                            group.completedParts === group.parts.length
                              ? 'text-emerald-600'
                              : group.completedParts > 0
                              ? 'text-amber-600'
                              : 'text-neutral-400'
                          )}>
                            {group.completedParts}/{group.parts.length} parts
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {group.status === 'in_progress' && (
                          <Badge variant="warning">In Progress</Badge>
                        )}
                        {group.status === 'completed' && (
                          <Badge variant="success">Mastered</Badge>
                        )}

                        <svg
                          className={cn(
                            'h-5 w-5 text-neutral-400 transition-transform',
                            isExpanded && 'rotate-180'
                          )}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* Parts list (collapsible) */}
                    {isExpanded && (
                      <div className="border-t border-neutral-100 bg-neutral-50/50">
                        {group.parts.map((part, index) => (
                          <button
                            key={part.id}
                            className={cn(
                              'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-neutral-100',
                              index !== group.parts.length - 1 && 'border-b border-neutral-100'
                            )}
                            onClick={() => handlePartClick(part)}
                          >
                            <div className="w-6" /> {/* Spacer for alignment */}
                            <PartStatusIcon status={part.status} size="sm" />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  'text-sm font-medium',
                                  part.status === 'completed'
                                    ? 'text-neutral-400'
                                    : 'text-neutral-700'
                                )}>
                                  Part {part.chunkNumber}
                                </span>
                                <span className="text-xs text-neutral-400">
                                  {part.wordCount.toLocaleString()} words
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {part.status === 'not_started' && (
                                <span className="text-xs text-neutral-500">Read</span>
                              )}
                              {part.status === 'in_progress' && (
                                <span className="text-xs text-amber-600">Continue</span>
                              )}
                              {part.status === 'completed' && (
                                <span className="text-xs text-emerald-600">Review</span>
                              )}
                              <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </>
        )}
      </SignedIn>
    </div>
  )
}
