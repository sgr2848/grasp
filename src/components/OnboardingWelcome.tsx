import { useNavigate } from 'react-router-dom'
import { useOnboarding } from '@/context/OnboardingContext'
import { Button } from '@/components/ui/Button'
import { SAMPLE_CONTENT } from '@/lib/sampleContent'

export function OnboardingWelcome() {
  const { showWelcome, skipTour } = useOnboarding()
  const navigate = useNavigate()

  if (!showWelcome) return null

  const handleTrySample = () => {
    // Store sample content in sessionStorage for Learn page to pick up
    sessionStorage.setItem('rt_sample_content', JSON.stringify(SAMPLE_CONTENT))
    skipTour()
    navigate('/learn')
  }

  const handleStartFresh = () => {
    skipTour()
    navigate('/learn')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-8 w-8 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-neutral-900">Welcome to Retention Trainer!</h2>
          <p className="mt-2 text-sm text-neutral-600">
            The best way to remember what you read is to explain it back.
          </p>
        </div>

        {/* How it works */}
        <div className="mt-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600">1</div>
            <div>
              <div className="text-sm font-medium text-neutral-900">Paste any text</div>
              <div className="text-xs text-neutral-500">Article, meeting notes, book chapter...</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600">2</div>
            <div>
              <div className="text-sm font-medium text-neutral-900">Explain it back</div>
              <div className="text-xs text-neutral-500">Record yourself explaining what you learned</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600">3</div>
            <div>
              <div className="text-sm font-medium text-neutral-900">Get smart feedback</div>
              <div className="text-xs text-neutral-500">AI scores what you covered vs. missed</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 space-y-2">
          <Button className="w-full" onClick={handleTrySample}>
            Try with sample content
          </Button>
          <Button variant="secondary" className="w-full" onClick={handleStartFresh}>
            Start with my own text
          </Button>
          <button
            onClick={skipTour}
            className="w-full py-2 text-sm text-neutral-500 hover:text-neutral-700"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
