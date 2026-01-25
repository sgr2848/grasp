import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import {
  uploadBook,
  deleteBook,
  getUserSubjects,
  type SubjectWithWorkspace,
} from "@/lib/api";
import { useBooks } from "@/context/BooksContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

// Placeholder for books without covers
function BookCoverPlaceholder({ title }: { title: string }) {
  const colors = [
    'from-emerald-200 to-emerald-300 text-emerald-800',
    'from-blue-200 to-blue-300 text-blue-800',
    'from-purple-200 to-purple-300 text-purple-800',
    'from-amber-200 to-amber-300 text-amber-800',
    'from-rose-200 to-rose-300 text-rose-800',
    'from-cyan-200 to-cyan-300 text-cyan-800',
  ];
  const colorIndex = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  const initials = title
    .split(' ')
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${colors[colorIndex]}`}>
      <span className="text-2xl font-bold tracking-tight">{initials}</span>
    </div>
  );
}

export default function BooksPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { books, isLoading, error: booksError, refreshBooks, invalidateCache } = useBooks();
  const [subjects, setSubjects] = useState<SubjectWithWorkspace[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const error = localError || booksError;

  const loadSubjects = useCallback(async () => {
    try {
      const data = await getUserSubjects();
      setSubjects(data);
    } catch (err) {
      console.error("Failed to load subjects:", err);
    }
  }, []);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  // Refresh books when subject filter changes
  useEffect(() => {
    void refreshBooks(selectedSubjectId ?? undefined);
  }, [selectedSubjectId, refreshBooks]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setLocalError(null);
      const book = await uploadBook(file, selectedSubjectId || undefined);
      // Invalidate cache and refresh
      invalidateCache();
      await refreshBooks(selectedSubjectId ?? undefined);
      navigate(`/books/${book.id}`);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to upload book");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteBook = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}" and all its chapters?`)) return;

    try {
      await deleteBook(id);
      invalidateCache();
      await refreshBooks(selectedSubjectId ?? undefined);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to delete book");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          Books
        </h1>
        <p className="text-sm text-neutral-500">
          Import EPUB books and practice chapters one at a time using the
          Feynman technique.
        </p>
      </div>

      <SignedOut>
        <Card className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-neutral-900">
                Sign in to import books
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                Upload EPUB files and practice each chapter to improve
                retention.
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setLocalError(null)}
              >
                Dismiss
              </Button>
            </div>
          </Card>
        )}

        {/* Subject filter */}
        {subjects.length > 0 && (
          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="text-sm font-medium text-neutral-700">
                Filter by subject
              </label>
              <select
                value={selectedSubjectId || ""}
                onChange={(e) => setSelectedSubjectId(e.target.value || null)}
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">All subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name} ({subject.workspaceName})
                  </option>
                ))}
              </select>
            </div>
          </Card>
        )}

        {/* Upload section */}
        <Card className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-neutral-900">
                Upload an EPUB book
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                We'll extract chapters so you can practice them one by one.
                {selectedSubjectId &&
                  subjects.find((s) => s.id === selectedSubjectId) && (
                    <span className="block mt-1 text-emerald-600">
                      Will be added to:{" "}
                      {subjects.find((s) => s.id === selectedSubjectId)?.name}
                    </span>
                  )}
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".epub"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Uploading...
                  </>
                ) : (
                  "Upload EPUB"
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Books list */}
        {isLoading ? (
          <Card className="p-10">
            <div className="flex items-center justify-center gap-3">
              <Spinner size="lg" />
              <span className="text-sm text-neutral-500">Loading books...</span>
            </div>
          </Card>
        ) : books.length === 0 ? (
          <Card className="p-10">
            <div className="text-center">
              <div className="text-lg font-medium text-neutral-900">
                No books yet
              </div>
              <p className="mt-2 text-sm text-neutral-500">
                Upload your first EPUB book to start learning chapter by
                chapter.
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {books.map((book, index) => {
              const progress =
                book.totalChapters > 0
                  ? Math.round(
                      (book.completedChapters / book.totalChapters) * 100,
                    )
                  : 0;

              return (
                <Card
                  key={book.id}
                  className="group cursor-pointer overflow-hidden animate-fade-in transition-all hover:shadow-elevated hover:-translate-y-0.5"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => navigate(`/books/${book.id}`)}
                >
                  {/* Book cover */}
                  <div className="aspect-[3/4] w-full overflow-hidden bg-neutral-100 relative">
                    {book.coverUrl ? (
                      <img
                        src={book.coverUrl}
                        alt={`Cover of ${book.title}`}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <BookCoverPlaceholder title={book.title} />
                    )}
                    {progress === 100 && (
                      <div className="absolute top-3 right-3">
                        <Badge variant="success">Complete</Badge>
                      </div>
                    )}
                  </div>

                  {/* Book info */}
                  <div className="p-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-neutral-900 group-hover:text-emerald-600 transition-colors">
                        {book.title}
                      </h3>
                      {book.author && (
                        <p className="mt-0.5 truncate text-xs text-neutral-500">
                          by {book.author}
                        </p>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
                        <span className="font-medium">{book.completedChapters}/{book.totalChapters} chapters</span>
                        <span className="tabular-nums">{progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-100">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
                      <span className="text-[11px] text-neutral-400 uppercase tracking-wider">
                        {formatDate(book.createdAt)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteBook(book.id, book.title);
                        }}
                        className="text-xs text-neutral-400 hover:text-red-500 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </SignedIn>
    </div>
  );
}
