import { useEffect, useId, useRef, useState } from 'react'
import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'
import { usePreferences } from '@/context/PreferencesContext'
import { useWorkspace } from '@/context/WorkspaceContext'
import { createSubject } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { Spinner } from '@/components/ui/Spinner'
import { FirstTimeUserRedirect } from '@/components/FirstTimeUserRedirect'
import { cn } from '@/lib/cn'

const mainNavItems = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
      </svg>
    ),
  },
  {
    path: '/learn',
    label: 'Learn',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    path: '/app',
    label: 'Test',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    path: '/history',
    label: 'History',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    path: '/knowledge',
    label: 'Knowledge',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
  },
  {
    path: '/books',
    label: 'Books',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

const mobileNavPaths = ['/dashboard', '/learn', '/history', '/knowledge', '/settings']
const mobileNavItems = mainNavItems.filter((item) => mobileNavPaths.includes(item.path))

export default function Layout() {
  const navigate = useNavigate()
  const { ttsEnabled, setTTSEnabled } = usePreferences()
  const {
    workspaces,
    currentWorkspace,
    subjects,
    currentSubject,
    isLoading,
    selectWorkspace,
    selectSubject,
    refreshSubjects,
  } = useWorkspace()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false)
  const [showNewSubject, setShowNewSubject] = useState(false)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [isCreatingSubject, setIsCreatingSubject] = useState(false)

  const workspaceDropdownId = useId()
  const workspaceDropdownRef = useRef<HTMLDivElement>(null)
  const newSubjectInputId = useId()

  const handleCreateSubject = async () => {
    if (!currentWorkspace || !newSubjectName.trim()) return

    setIsCreatingSubject(true)
    try {
      const created = await createSubject(currentWorkspace.id, { name: newSubjectName.trim() })
      selectSubject(created.id)
      await refreshSubjects()
      setNewSubjectName('')
      setShowNewSubject(false)
    } catch (err) {
      console.error('Failed to create subject:', err)
    } finally {
      setIsCreatingSubject(false)
    }
  }

  useEffect(() => {
    // Close/create-subject UI resets when switching workspaces
    setShowNewSubject(false)
    setNewSubjectName('')
  }, [currentWorkspace?.id])

  useEffect(() => {
    if (!workspaceDropdownOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      const container = workspaceDropdownRef.current
      if (!container) return
      if (container.contains(target)) return
      setWorkspaceDropdownOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [workspaceDropdownOpen])

  useEffect(() => {
    if (!sidebarOpen && !workspaceDropdownOpen && !showNewSubject) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setWorkspaceDropdownOpen(false)
      setShowNewSubject(false)
      setSidebarOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [sidebarOpen, showNewSubject, workspaceDropdownOpen])

  useEffect(() => {
    if (!sidebarOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [sidebarOpen])

  // Show actions panel when a subject is selected OR when viewing "All subjects"
  const showActionsPanel = currentWorkspace !== null

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Redirect first-time users to /learn */}
      <FirstTimeUserRedirect />

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Two-panel sidebar */}
      <aside
        id="app-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex transform transition-transform duration-200 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Primary Panel - Workspaces & Subjects */}
        <div className="flex h-full w-56 flex-col border-r border-neutral-200 bg-white">
          {/* Logo */}
          <div className="flex h-14 items-center gap-2 border-b border-neutral-100 px-4">
            <Link to="/" className="flex items-center gap-2">
              <img
                src="/images/logo.svg"
                alt="Grasp logo"
                className="h-7 w-7"
              />
              <span className="text-sm font-semibold text-neutral-900">Grasp</span>
            </Link>
          </div>

          {/* Workspace Selector */}
          <div className="border-b border-neutral-100 p-3">
            <div ref={workspaceDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
                aria-haspopup="menu"
                aria-expanded={workspaceDropdownOpen}
                aria-controls={workspaceDropdownId}
                className="flex w-full items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-left text-sm transition hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:ring-inset"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <svg className="h-4 w-4 shrink-0 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="truncate font-medium text-neutral-900">
                    {isLoading ? 'Loading...' : currentWorkspace?.name || 'Select workspace'}
                  </span>
                </div>
                <svg
                  className={cn('h-4 w-4 shrink-0 text-neutral-400 transition', workspaceDropdownOpen && 'rotate-180')}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Workspace Dropdown */}
              {workspaceDropdownOpen && (
                <div
                  id={workspaceDropdownId}
                  role="menu"
                  aria-label="Workspace selector"
                  className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-neutral-200 bg-white shadow-lg"
                >
                  <div className="max-h-64 overflow-y-auto p-1">
                    {workspaces.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-neutral-500">
                        No workspaces yet
                      </div>
                    ) : (
                      workspaces.map((workspace) => (
                        <button
                          key={workspace.id}
                          type="button"
                          onClick={() => {
                            selectWorkspace(workspace.id)
                            setWorkspaceDropdownOpen(false)
                          }}
                          role="menuitem"
                          className={cn(
                            'flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:ring-inset',
                            workspace.id === currentWorkspace?.id
                              ? 'bg-neutral-100 text-neutral-900'
                              : 'text-neutral-600 hover:bg-neutral-50'
                          )}
                        >
                          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          <span className="truncate">{workspace.name}</span>
                          {workspace.id === currentWorkspace?.id && (
                            <svg className="ml-auto h-4 w-4 text-neutral-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                  <div className="border-t border-neutral-100 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setWorkspaceDropdownOpen(false)
                        navigate('/workspaces')
                      }}
                      role="menuitem"
                      className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-neutral-600 transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:ring-inset"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Manage workspaces</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Subjects List */}
          <div className="flex-1 overflow-y-auto">
            {currentWorkspace ? (
              <div className="p-2">
                <div className="mb-2 flex items-center justify-between px-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                    Subjects
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNewSubject(!showNewSubject)}
                    aria-label={showNewSubject ? 'Cancel new subject' : 'Add subject'}
                    aria-expanded={showNewSubject}
                    aria-controls={newSubjectInputId}
                    className="rounded p-0.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:ring-offset-2"
                    title="Add subject"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                {/* New subject input */}
                {showNewSubject && (
                  <div className="mb-2 px-2">
                    <div className="flex gap-1">
                      <input
                        id={newSubjectInputId}
                        type="text"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleCreateSubject()
                          if (e.key === 'Escape') {
                            setShowNewSubject(false)
                            setNewSubjectName('')
                          }
                        }}
                        placeholder="Subject name..."
                        className="flex-1 rounded border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
                        autoFocus
                        disabled={isCreatingSubject}
                      />
                      <button
                        type="button"
                        onClick={() => void handleCreateSubject()}
                        disabled={!newSubjectName.trim() || isCreatingSubject}
                        className="rounded bg-neutral-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {isCreatingSubject ? '...' : 'Add'}
                      </button>
                    </div>
                  </div>
                )}

                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner />
                  </div>
                ) : subjects.length === 0 && !showNewSubject ? (
                  <div className="px-2 py-3 text-center text-sm text-neutral-500">
                    No subjects yet
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {/* All subjects option */}
                    <button
                      type="button"
                      onClick={() => {
                        selectSubject(null)
                        setSidebarOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:ring-inset',
                        currentSubject === null
                          ? 'bg-neutral-900 font-medium text-white'
                          : 'text-neutral-600 hover:bg-neutral-100'
                      )}
                    >
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      <span>All subjects</span>
                    </button>

                    {subjects.map((subject) => (
                      <button
                        key={subject.id}
                        type="button"
                        onClick={() => {
                          selectSubject(subject.id)
                          setSidebarOpen(false)
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:ring-inset',
                          subject.id === currentSubject?.id
                            ? 'bg-neutral-900 font-medium text-white'
                            : 'text-neutral-600 hover:bg-neutral-100'
                        )}
                      >
                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate">{subject.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-neutral-500">
                Select a workspace to see subjects
              </div>
            )}
          </div>

          {/* User section */}
          <div className="border-t border-neutral-100 p-3">
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="secondary" size="sm" className="w-full">
                  Sign in
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <div className="flex items-center gap-3">
                <UserButton />
                <span className="text-sm text-neutral-600">Account</span>
              </div>
            </SignedIn>
          </div>
        </div>

        {/* Secondary Panel - Actions (only visible when workspace is selected) */}
        {showActionsPanel && (
          <div className="flex h-full w-48 flex-col border-r border-neutral-200 bg-neutral-50">
            {/* Context header */}
            <div className="flex h-14 items-center border-b border-neutral-100 px-4">
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-neutral-500">
                  {currentWorkspace?.name}
                </div>
                <div className="truncate text-sm font-medium text-neutral-900">
                  {currentSubject?.name || 'All subjects'}
                </div>
              </div>
            </div>

            {/* Actions Navigation */}
            <nav className="flex-1 overflow-y-auto p-3">
              <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
                Actions
              </div>
              <ul className="space-y-0.5">
                {mainNavItems.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:ring-inset',
                          isActive
                            ? 'bg-white text-neutral-900 shadow-sm'
                            : 'text-neutral-600 hover:bg-white hover:text-neutral-900'
                        )
                      }
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Voice toggle */}
            <div className="border-t border-neutral-100 p-3">
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
                <span className="text-sm text-neutral-600">Voice</span>
                <Switch
                  checked={ttsEnabled}
                  onCheckedChange={(checked) => void setTTSEnabled(checked)}
                  label="Voice feedback"
                />
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className={cn(
        'transition-[padding-left] duration-200',
        showActionsPanel ? 'lg:pl-[26rem]' : 'lg:pl-56'
      )}>
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            aria-controls="app-sidebar"
            className="rounded-lg p-2 text-neutral-600 transition hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:ring-offset-2"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2 text-sm">
            {currentWorkspace && (
              <span className="font-medium text-neutral-600 truncate max-w-[100px]">
                {currentWorkspace.name}
              </span>
            )}
            {currentSubject && (
              <>
                <span className="text-neutral-300">/</span>
                <span className="text-neutral-500 truncate max-w-[80px]">
                  {currentSubject.name}
                </span>
              </>
            )}
          </div>

          <SignedIn>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="secondary" size="sm">
                Sign in
              </Button>
            </SignInButton>
          </SignedOut>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <div className="mx-auto max-w-5xl">
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur lg:hidden">
          <div className="mx-auto grid max-w-5xl grid-cols-5 gap-1 px-2 pb-[env(safe-area-inset-bottom)] pt-2">
            {mobileNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition',
                    isActive ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'
                  )
                }
              >
                <span className="text-current">{item.icon}</span>
                <span className="leading-none">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
