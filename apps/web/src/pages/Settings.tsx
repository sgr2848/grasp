import { useEffect, useState } from 'react'
import { SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react'
import { usePreferences } from '@/context/PreferencesContext'
import { useTTS } from '@/context/TTSContext'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Switch } from '@/components/ui/Switch'
import { cn } from '@/lib/cn'
import { personaConfig, type Persona } from '@/lib/personas'
import { getUserUsageV2, type TTSVoice, type UsageStatsV2 } from '@/lib/api'
import type { TTSProvider } from '@/lib/tts'

const TTS_VOICES: { id: TTSVoice; label: string }[] = [
  { id: 'nova', label: 'Nova' },
  { id: 'alloy', label: 'Alloy' },
  { id: 'echo', label: 'Echo' },
  { id: 'fable', label: 'Fable' },
  { id: 'onyx', label: 'Onyx' },
  { id: 'shimmer', label: 'Shimmer' },
]

export default function Settings() {
  const { selectedPersona, ttsEnabled, isPaid, error, clearError, setSelectedPersona, setTTSEnabled } = usePreferences()
  const { provider, voice, setProvider, setVoice } = useTTS()
  const personaOrder: Persona[] = ['coach', 'professor', 'sergeant', 'hype', 'chill']
  const [usageStats, setUsageStats] = useState<UsageStatsV2 | null>(null)

  // Load usage stats
  useEffect(() => {
    getUserUsageV2()
      .then(setUsageStats)
      .catch(() => {}) // Silent fail
  }, [])

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Settings</h1>
        <p className="text-sm text-neutral-500">
          Tune the experience so it feels like a conversation, not a test.
        </p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-red-700">Couldn&apos;t save preferences</div>
              <div className="mt-1 text-sm text-red-600">{error}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={clearError}>
                Dismiss
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-medium text-neutral-900">Persona</div>
            <p className="mt-1 text-sm text-neutral-500">Choose how feedback is delivered.</p>
          </div>
          <div className="flex items-center gap-2">
            {isPaid ? <Badge variant="success">Paid unlocked</Badge> : <Badge variant="neutral">Free tier</Badge>}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {personaOrder.map((id) => {
            const config = personaConfig[id]
            const locked = config.isPaid && !isPaid
            const selected = selectedPersona === id

            return (
              <button
                key={id}
                type="button"
                disabled={locked}
                onClick={() => void setSelectedPersona(id)}
                className={cn(
                  'group relative overflow-hidden border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-neutral-900/20 disabled:cursor-not-allowed disabled:opacity-60',
                  selected ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 bg-white hover:bg-neutral-50',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-neutral-900">{config.name}</div>
                    <div className="mt-1 text-sm text-neutral-500">{config.description}</div>
                  </div>
                  {config.isPaid ? <Badge variant="warning">Paid</Badge> : <Badge variant="success">Free</Badge>}
                </div>

                {selected && (
                  <div className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-neutral-600">
                    <span className="inline-block h-2 w-2 bg-neutral-900" />
                    Selected
                  </div>
                )}

                {locked && (
                  <div className="pointer-events-none absolute inset-0 bg-neutral-100/50" />
                )}
              </button>
            )
          })}
        </div>

        {!isPaid && (
          <div className="mt-5 border border-neutral-100 bg-neutral-50 p-4">
            <div className="text-sm font-medium text-neutral-900">Paid personas</div>
            <p className="mt-1 text-sm text-neutral-500">
              Drill Sergeant, Hype Friend, and Chill Tutor are shown as locked for now. Hook up an upgrade flow when
              you&apos;re ready.
            </p>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-neutral-900">Voice feedback</div>
            <p className="mt-1 text-sm text-neutral-500">Speak results conversationally instead of just showing text.</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={ttsEnabled} onCheckedChange={(checked) => void setTTSEnabled(checked)} label="Enable voice" />
          </div>
        </div>

        {ttsEnabled && (
          <div className="mt-6 space-y-5">
            <div>
              <div className="text-xs font-medium text-neutral-500">Voice engine</div>
              <div className="mt-2 flex gap-2">
                {(['browser', 'openai'] as TTSProvider[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProvider(p)}
                    className={cn(
                      'border px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-neutral-900/20',
                      provider === p
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50',
                    )}
                  >
                    {p === 'browser' ? 'Browser (Free)' : 'OpenAI (Natural)'}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-neutral-400">
                {provider === 'browser'
                  ? 'Uses your browser\'s built-in speech synthesis. Free but sounds robotic.'
                  : 'Uses OpenAI\'s TTS API for natural-sounding voices. Requires sign-in.'}
              </p>
            </div>

            {provider === 'openai' && (
              <div>
                <div className="text-xs font-medium text-neutral-500">Voice</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TTS_VOICES.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVoice(v.id)}
                      className={cn(
                        'border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-neutral-900/20',
                        voice === v.id
                          ? 'border-neutral-900 bg-neutral-900 text-white'
                          : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50',
                      )}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Subscription Section */}
      <Card id="upgrade" className="p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-medium text-neutral-900">Subscription</div>
            <p className="mt-1 text-sm text-neutral-500">
              {usageStats?.tier === 'pro'
                ? 'You have full access to all features.'
                : 'Upgrade to unlock unlimited learning.'}
            </p>
          </div>
          <Badge variant={usageStats?.tier === 'pro' ? 'success' : 'neutral'}>
            {usageStats?.tier === 'pro' ? 'Pro' : 'Free'}
          </Badge>
        </div>

        {usageStats && (
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="p-3 bg-neutral-50 rounded-lg">
              <div className="text-xs text-neutral-500">Sessions this month</div>
              <div className="mt-1 text-lg font-bold">
                {usageStats.sessionsUsedThisMonth}
                <span className="text-sm font-normal text-neutral-400">
                  /{usageStats.limits.maxSessionsPerMonth === Infinity ? '∞' : usageStats.limits.maxSessionsPerMonth}
                </span>
              </div>
            </div>
            <div className="p-3 bg-neutral-50 rounded-lg">
              <div className="text-xs text-neutral-500">Books</div>
              <div className="mt-1 text-lg font-bold">
                {usageStats.booksCount}
                <span className="text-sm font-normal text-neutral-400">
                  /{usageStats.limits.maxBooks === Infinity ? '∞' : usageStats.limits.maxBooks}
                </span>
              </div>
            </div>
            <div className="p-3 bg-neutral-50 rounded-lg">
              <div className="text-xs text-neutral-500">Concepts</div>
              <div className="mt-1 text-lg font-bold">
                {usageStats.conceptsCount}
                <span className="text-sm font-normal text-neutral-400">
                  /{usageStats.limits.maxConcepts === Infinity ? '∞' : usageStats.limits.maxConcepts}
                </span>
              </div>
            </div>
          </div>
        )}

        {usageStats?.tier === 'free' && (
          <div className="mt-5 p-4 border border-emerald-200 bg-emerald-50 rounded-lg">
            <div className="font-medium text-emerald-900">Upgrade to Pro</div>
            <ul className="mt-2 text-sm text-emerald-700 space-y-1">
              <li>• Unlimited books</li>
              <li>• 50 sessions/month (soft cap)</li>
              <li>• Full knowledge graph (unlimited concepts)</li>
            </ul>
            <div className="mt-4 flex gap-2">
              <Button disabled title="Coming soon">
                $6/month
              </Button>
              <Button variant="secondary" disabled title="Coming soon">
                $60/year (save 17%)
              </Button>
            </div>
            <p className="mt-2 text-xs text-emerald-600">
              Payment integration coming soon. Contact support for early access.
            </p>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-neutral-900">Account</div>
            <p className="mt-1 text-sm text-neutral-500">Sign in to save sessions and sync preferences.</p>
          </div>
          <SignedOut>
            <SignInButton mode="modal">
              <Button>Sign in</Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Badge variant="success">Signed in</Badge>
          </SignedIn>
        </div>
      </Card>
    </div>
  )
}
