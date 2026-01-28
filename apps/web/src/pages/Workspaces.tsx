import { useCallback, useEffect, useState } from 'react'
import { SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react'
import {
  getWorkspaces,
  getWorkspace,
  createWorkspace,
  deleteWorkspace,
  createSubject,
  deleteSubject,
  type Workspace,
  type Subject,
} from '@/lib/api'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

interface WorkspaceWithSubjects extends Workspace {
  subjects: Subject[]
}

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceWithSubjects | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false)
  const [isCreatingSubject, setIsCreatingSubject] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newSubjectName, setNewSubjectName] = useState('')

  const loadWorkspaces = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await getWorkspaces()
      setWorkspaces(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadWorkspace = useCallback(async (id: string) => {
    try {
      const data = await getWorkspace(id)
      setSelectedWorkspace(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace')
    }
  }, [])

  useEffect(() => {
    void loadWorkspaces()
  }, [loadWorkspaces])

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return

    try {
      setIsCreatingWorkspace(true)
      const workspace = await createWorkspace({ name: newWorkspaceName.trim() })
      setWorkspaces((prev) => [workspace, ...prev])
      setNewWorkspaceName('')
      void loadWorkspace(workspace.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace')
    } finally {
      setIsCreatingWorkspace(false)
    }
  }

  const handleDeleteWorkspace = async (id: string) => {
    try {
      await deleteWorkspace(id)
      setWorkspaces((prev) => prev.filter((w) => w.id !== id))
      if (selectedWorkspace?.id === id) {
        setSelectedWorkspace(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workspace')
    }
  }

  const handleCreateSubject = async () => {
    if (!selectedWorkspace || !newSubjectName.trim()) return

    try {
      setIsCreatingSubject(true)
      const subject = await createSubject(selectedWorkspace.id, { name: newSubjectName.trim() })
      setSelectedWorkspace((prev) =>
        prev ? { ...prev, subjects: [subject, ...prev.subjects] } : null
      )
      setNewSubjectName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create subject')
    } finally {
      setIsCreatingSubject(false)
    }
  }

  const handleDeleteSubject = async (subjectId: string) => {
    if (!selectedWorkspace) return

    try {
      await deleteSubject(selectedWorkspace.id, subjectId)
      setSelectedWorkspace((prev) =>
        prev ? { ...prev, subjects: prev.subjects.filter((s) => s.id !== subjectId) } : null
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete subject')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Workspaces</h1>
        <p className="text-sm text-neutral-500">
          Organize your learning by workspace and subject. Sessions can be linked to subjects.
        </p>
      </div>

      <SignedOut>
        <Card className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-neutral-900">Sign in to manage workspaces</div>
              <p className="mt-1 text-sm text-neutral-500">
                Workspaces help you organize your learning sessions by topic.
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
              <span className="text-sm text-neutral-500">Loading workspaces...</span>
            </div>
          </Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
            {/* Workspaces list */}
            <div className="space-y-4">
              <Card className="p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="New workspace..."
                    className="w-full flex-1 border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleCreateWorkspace()
                      if (e.key === 'Escape') setNewWorkspaceName('')
                    }}
                    disabled={isCreatingWorkspace}
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateWorkspace}
                    disabled={!newWorkspaceName.trim() || isCreatingWorkspace}
                    className="w-full sm:w-auto"
                  >
                    {isCreatingWorkspace ? <Spinner size="sm" /> : 'Add'}
                  </Button>
                </div>
              </Card>

              <div className="space-y-2">
                {workspaces.length === 0 ? (
                  <Card className="p-6">
                    <div className="text-center text-sm text-neutral-500">
                      No workspaces yet. Create one to get started.
                    </div>
                  </Card>
                ) : (
                  workspaces.map((workspace) => (
                    <button
                      key={workspace.id}
                      type="button"
                      onClick={() => loadWorkspace(workspace.id)}
                      className={cn(
                        'w-full border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-neutral-900/20',
                        selectedWorkspace?.id === workspace.id
                          ? 'border-neutral-900 bg-neutral-50'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50'
                      )}
                    >
                      <div className="text-sm font-medium text-neutral-900">{workspace.name}</div>
                      {workspace.description && (
                        <div className="mt-1 text-xs text-neutral-500">{workspace.description}</div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Selected workspace details */}
            <div>
              {selectedWorkspace ? (
                <Card className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-medium text-neutral-900">
                        {selectedWorkspace.name}
                      </div>
                      <div className="mt-1 text-sm text-neutral-500">
                        {selectedWorkspace.subjects.length} subject
                        {selectedWorkspace.subjects.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Delete workspace "${selectedWorkspace.name}" and all its subjects?`)) {
                          void handleDeleteWorkspace(selectedWorkspace.id)
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>

                  <div className="mt-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      placeholder="New subject..."
                      className="w-full flex-1 border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleCreateSubject()
                        if (e.key === 'Escape') setNewSubjectName('')
                      }}
                      disabled={isCreatingSubject}
                    />
                    <Button
                      size="sm"
                      onClick={handleCreateSubject}
                      disabled={!newSubjectName.trim() || isCreatingSubject}
                      className="w-full sm:w-auto"
                    >
                      {isCreatingSubject ? <Spinner size="sm" /> : 'Add subject'}
                    </Button>
                  </div>
                  </div>

                  <div className="mt-5 space-y-2">
                    {selectedWorkspace.subjects.length === 0 ? (
                      <div className="border border-neutral-100 bg-neutral-50 p-4 text-center text-sm text-neutral-500">
                        No subjects yet. Add one above.
                      </div>
                    ) : (
                      selectedWorkspace.subjects.map((subject) => (
                        <div
                          key={subject.id}
                          className="flex items-center justify-between gap-3 border border-neutral-200 bg-white p-4"
                        >
                          <div>
                            <div className="text-sm font-medium text-neutral-900">{subject.name}</div>
                            {subject.description && (
                              <div className="mt-0.5 text-xs text-neutral-500">
                                {subject.description}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="neutral">Subject</Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm(`Delete subject "${subject.name}"?`)) {
                                  void handleDeleteSubject(subject.id)
                                }
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              ) : (
                <Card className="p-10">
                  <div className="text-center text-sm text-neutral-500">
                    Select a workspace to view its subjects
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </SignedIn>
    </div>
  )
}
