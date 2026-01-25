import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuth as useClerkAuth } from '@clerk/clerk-react'
import { getWorkspaces, getWorkspace, type Workspace, type Subject } from '@/lib/api'

interface WorkspaceContextValue {
  // Data
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  subjects: Subject[]
  currentSubject: Subject | null

  // Loading states
  isLoading: boolean

  // Actions
  selectWorkspace: (workspaceId: string | null) => void
  selectSubject: (subjectId: string | null) => void
  refreshWorkspaces: () => Promise<void>
  refreshSubjects: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

const STORAGE_KEY_WORKSPACE = 'rt_current_workspace'
const STORAGE_KEY_SUBJECT = 'rt_current_subject'

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useClerkAuth()

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [currentSubject, setCurrentSubject] = useState<Subject | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load workspaces on auth
  const refreshWorkspaces = useCallback(async () => {
    if (!isSignedIn) {
      setWorkspaces([])
      setCurrentWorkspace(null)
      setSubjects([])
      setCurrentSubject(null)
      setIsLoading(false)
      return
    }

    try {
      const data = await getWorkspaces()
      setWorkspaces(data)

      // Restore saved workspace or select first
      const savedId = localStorage.getItem(STORAGE_KEY_WORKSPACE)
      const saved = savedId ? data.find(w => w.id === savedId) : null

      if (saved) {
        setCurrentWorkspace(saved)
      } else if (data.length > 0) {
        setCurrentWorkspace(data[0])
        localStorage.setItem(STORAGE_KEY_WORKSPACE, data[0].id)
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err)
    } finally {
      setIsLoading(false)
    }
  }, [isSignedIn])

  // Load subjects when workspace changes
  const refreshSubjects = useCallback(async () => {
    if (!currentWorkspace) {
      setSubjects([])
      setCurrentSubject(null)
      return
    }

    try {
      const data = await getWorkspace(currentWorkspace.id)
      setSubjects(data.subjects)

      // Restore saved subject or clear
      const savedId = localStorage.getItem(STORAGE_KEY_SUBJECT)
      const saved = savedId ? data.subjects.find(s => s.id === savedId) : null

      if (saved) {
        setCurrentSubject(saved)
      } else {
        setCurrentSubject(null)
        localStorage.removeItem(STORAGE_KEY_SUBJECT)
      }
    } catch (err) {
      console.error('Failed to load subjects:', err)
      setSubjects([])
    }
  }, [currentWorkspace])

  // Initial load
  useEffect(() => {
    if (isLoaded) {
      void refreshWorkspaces()
    }
  }, [isLoaded, refreshWorkspaces])

  // Load subjects when workspace changes
  useEffect(() => {
    void refreshSubjects()
  }, [refreshSubjects])

  // Select workspace
  const selectWorkspace = useCallback((workspaceId: string | null) => {
    if (!workspaceId) {
      setCurrentWorkspace(null)
      setSubjects([])
      setCurrentSubject(null)
      localStorage.removeItem(STORAGE_KEY_WORKSPACE)
      localStorage.removeItem(STORAGE_KEY_SUBJECT)
      return
    }

    const workspace = workspaces.find(w => w.id === workspaceId)
    if (workspace) {
      setCurrentWorkspace(workspace)
      localStorage.setItem(STORAGE_KEY_WORKSPACE, workspaceId)
      // Clear subject when switching workspaces
      setCurrentSubject(null)
      localStorage.removeItem(STORAGE_KEY_SUBJECT)
    }
  }, [workspaces])

  // Select subject
  const selectSubject = useCallback((subjectId: string | null) => {
    if (!subjectId) {
      setCurrentSubject(null)
      localStorage.removeItem(STORAGE_KEY_SUBJECT)
      return
    }

    localStorage.setItem(STORAGE_KEY_SUBJECT, subjectId)
    const subject = subjects.find(s => s.id === subjectId)
    if (subject) {
      setCurrentSubject(subject)
    }
  }, [subjects])

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        subjects,
        currentSubject,
        isLoading,
        selectWorkspace,
        selectSubject,
        refreshWorkspaces,
        refreshSubjects,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}
