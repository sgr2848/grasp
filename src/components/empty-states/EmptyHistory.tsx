import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export function EmptyHistory() {
  return (
    <Card className="p-10 text-center">
      <div className="mx-auto max-w-md">
        {/* Illustration */}
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-neutral-100">
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
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-neutral-900">Your Learning Journey Starts Here</h3>

        <p className="mt-3 text-sm text-neutral-500">
          After you complete loops, they'll appear here so you can:
        </p>

        <ul className="mt-4 space-y-2 text-sm text-neutral-600">
          <li className="flex items-center justify-center gap-2">
            <span className="text-emerald-500">•</span>
            Track your progress over time
          </li>
          <li className="flex items-center justify-center gap-2">
            <span className="text-emerald-500">•</span>
            See which topics need review
          </li>
          <li className="flex items-center justify-center gap-2">
            <span className="text-emerald-500">•</span>
            Celebrate your improvements
          </li>
        </ul>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/learn">
            <Button size="lg">Start Learning</Button>
          </Link>
          <Link to="/app">
            <Button variant="secondary" size="lg">Quick Test</Button>
          </Link>
        </div>
      </div>
    </Card>
  )
}
