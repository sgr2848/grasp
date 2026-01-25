import { Link } from 'react-router-dom'
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { personaConfig, type Persona } from '@/lib/personas'

export default function Home() {
  const personaOrder: Persona[] = ['coach', 'professor', 'sergeant', 'hype', 'chill']

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <img
            src="/images/logo.svg"
            alt="Grasp logo"
            className="h-8 w-8"
          />
          <span className="text-sm font-medium text-neutral-900">Grasp</span>
        </Link>

        <div className="flex items-center gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="secondary" size="sm">
                Sign in
              </Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link to="/app">
              <Button variant="secondary" size="sm">
                Open app
              </Button>
            </Link>
            <UserButton />
          </SignedIn>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div>
            <Badge variant="info">Voice-based active recall</Badge>
            <h1 className="mt-5 text-balance text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
              Did you actually understand what you just read?
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-lg text-neutral-500">
              Paste a passage, explain it out loud, and get honest, point-by-point feedback on what stuck and what
              didn&apos;t.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <SignedOut>
                <SignInButton mode="modal">
                  <Button size="lg">Sign in to start</Button>
                </SignInButton>
                <Link to="/app">
                  <Button variant="secondary" size="lg">
                    Explore the flow
                  </Button>
                </Link>
              </SignedOut>

              <SignedIn>
                <Link to="/app">
                  <Button size="lg">Start training</Button>
                </Link>
                <Link to="/history">
                  <Button variant="secondary" size="lg">
                    View history
                  </Button>
                </Link>
              </SignedIn>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <Card className="p-5">
                <div className="text-xs font-medium text-neutral-400">Step 1</div>
                <div className="mt-2 text-sm font-medium text-neutral-900">Paste text</div>
                <p className="mt-2 text-sm text-neutral-500">
                  Anything you&apos;ve been reading: docs, articles, books, notes.
                </p>
              </Card>
              <Card className="p-5">
                <div className="text-xs font-medium text-neutral-400">Step 2</div>
                <div className="mt-2 text-sm font-medium text-neutral-900">Explain it</div>
                <p className="mt-2 text-sm text-neutral-500">
                  Speaking forces real recall—no "I kinda get it" vibes.
                </p>
              </Card>
              <Card className="p-5">
                <div className="text-xs font-medium text-neutral-400">Step 3</div>
                <div className="mt-2 text-sm font-medium text-neutral-900">Get scored</div>
                <p className="mt-2 text-sm text-neutral-500">
                  See covered vs missed points and what to revisit next.
                </p>
              </Card>
            </div>
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-neutral-900">Pick your feedback vibe</div>
              <Badge variant="neutral">Personas</Badge>
            </div>
            <p className="mt-2 text-sm text-neutral-500">
              Same scoring. Different delivery. Use whatever keeps you coming back.
            </p>

            <div className="mt-5 grid gap-3">
              {personaOrder.map((id) => {
                const config = personaConfig[id]
                return (
                  <div
                    key={id}
                    className="flex items-start justify-between gap-3 border border-neutral-100 bg-neutral-50 px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-neutral-900">{config.name}</div>
                      <div className="mt-1 text-sm text-neutral-500">{config.description}</div>
                    </div>
                    {config.isPaid ? <Badge variant="warning">Paid</Badge> : <Badge variant="success">Free</Badge>}
                  </div>
                )
              })}
            </div>

            <div className="mt-6 border border-neutral-100 bg-neutral-50 p-4">
              <div className="text-sm font-medium text-neutral-900">No multiple choice. No highlighting.</div>
              <p className="mt-2 text-sm text-neutral-500">
                Just you explaining it back, and a crisp breakdown of what you actually retained.
              </p>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
