import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react'
import { useAuth as useClerkAuth } from '@clerk/clerk-react'
import { getBooks, getBook, type Book, type BookWithChapters } from '@/lib/api'

interface BooksContextValue {
  books: Book[]
  isLoading: boolean
  error: string | null
  // Cache management
  refreshBooks: (subjectId?: string) => Promise<void>
  getBookCached: (id: string) => Promise<BookWithChapters | null>
  invalidateCache: () => void
  // Current filter
  currentSubjectId: string | null
}

const BooksContext = createContext<BooksContextValue | null>(null)

// Cache expiry time (5 minutes)
const CACHE_TTL = 5 * 60 * 1000

interface CacheEntry<T> {
  data: T
  timestamp: number
}

export function BooksProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useClerkAuth()

  const [books, setBooks] = useState<Book[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentSubjectId, setCurrentSubjectId] = useState<string | null>(null)

  // Book details cache (by ID)
  const [bookCache, setBookCache] = useState<Map<string, CacheEntry<BookWithChapters>>>(new Map())

  // Books list cache (by subjectId, null = all)
  const [listCache, setListCache] = useState<Map<string | null, CacheEntry<Book[]>>>(new Map())

  const isCacheValid = useCallback((entry: CacheEntry<unknown> | undefined): boolean => {
    if (!entry) return false
    return Date.now() - entry.timestamp < CACHE_TTL
  }, [])

  const refreshBooks = useCallback(async (subjectId?: string) => {
    if (!isLoaded || !isSignedIn) return

    const cacheKey = subjectId ?? null

    // Check cache first
    const cached = listCache.get(cacheKey)
    if (isCacheValid(cached)) {
      setBooks(cached!.data)
      setCurrentSubjectId(cacheKey)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await getBooks(subjectId)
      setBooks(result)
      setCurrentSubjectId(cacheKey)

      // Update cache
      setListCache(prev => {
        const next = new Map(prev)
        next.set(cacheKey, { data: result, timestamp: Date.now() })
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load books')
    } finally {
      setIsLoading(false)
    }
  }, [isLoaded, isSignedIn, listCache, isCacheValid])

  const getBookCached = useCallback(async (id: string): Promise<BookWithChapters | null> => {
    // Check cache first
    const cached = bookCache.get(id)
    if (isCacheValid(cached)) {
      return cached!.data
    }

    try {
      const book = await getBook(id)

      // Update cache
      setBookCache(prev => {
        const next = new Map(prev)
        next.set(id, { data: book, timestamp: Date.now() })
        return next
      })

      return book
    } catch {
      return null
    }
  }, [bookCache, isCacheValid])

  const invalidateCache = useCallback(() => {
    setListCache(new Map())
    setBookCache(new Map())
  }, [])

  // Load books on mount if signed in
  useEffect(() => {
    if (isLoaded && isSignedIn && books.length === 0 && !isLoading) {
      void refreshBooks()
    }
  }, [isLoaded, isSignedIn, books.length, isLoading, refreshBooks])

  return (
    <BooksContext.Provider
      value={{
        books,
        isLoading,
        error,
        refreshBooks,
        getBookCached,
        invalidateCache,
        currentSubjectId,
      }}
    >
      {children}
    </BooksContext.Provider>
  )
}

export function useBooks() {
  const context = useContext(BooksContext)
  if (!context) {
    throw new Error('useBooks must be used within BooksProvider')
  }
  return context
}
