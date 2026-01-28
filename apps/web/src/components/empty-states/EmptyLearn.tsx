import { Card } from '@/components/ui/Card'

export function EmptyLearn() {
  return (
    <Card className="border-dashed border-2 border-neutral-200 bg-neutral-50/50 p-10 text-center">
      <div className="mx-auto max-w-md">
        {/* Illustration */}
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-white border border-neutral-200">
          <svg
            className="h-10 w-10 text-neutral-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
            />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-neutral-900">Ready to Learn Something New?</h3>

        <p className="mt-3 text-sm text-neutral-500">
          The best way to remember something is to explain it. Here's how it works:
        </p>

        <div className="mt-6 grid gap-3 text-left">
          <div className="flex items-start gap-3 rounded-lg bg-white border border-neutral-100 p-4">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-neutral-900 text-xs font-bold text-white">1</span>
            <div>
              <div className="text-sm font-medium text-neutral-900">Paste your material</div>
              <p className="mt-0.5 text-xs text-neutral-500">Articles, books, notes, video transcripts</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg bg-white border border-neutral-100 p-4">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-neutral-900 text-xs font-bold text-white">2</span>
            <div>
              <div className="text-sm font-medium text-neutral-900">Explain it out loud</div>
              <p className="mt-0.5 text-xs text-neutral-500">In your own words, without looking</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg bg-white border border-neutral-100 p-4">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-neutral-900 text-xs font-bold text-white">3</span>
            <div>
              <div className="text-sm font-medium text-neutral-900">Fill the gaps</div>
              <p className="mt-0.5 text-xs text-neutral-500">Get guided help on what you missed</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg bg-white border border-neutral-100 p-4">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-xs font-bold text-white">4</span>
            <div>
              <div className="text-sm font-medium text-neutral-900">Master it</div>
              <p className="mt-0.5 text-xs text-neutral-500">Explain again until it sticks</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
