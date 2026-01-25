import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import type { SocraticSession } from '@/lib/api'

interface SocraticChatProps {
  session: SocraticSession
  sourceText: string
  onSendMessage: (content: string) => Promise<void>
  onSkip: () => void
  isLoading: boolean
}

export function SocraticChat({ session, sourceText, onSendMessage, onSkip, isLoading }: SocraticChatProps) {
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const addressedCount = session.conceptsAddressed?.length ?? 0
  const totalCount = session.targetConcepts.length

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [session.messages])

  const handleSend = async () => {
    if (!input.trim() || isSending) return

    const message = input.trim()
    setInput('')
    setIsSending(true)

    try {
      await onSendMessage(message)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      {/* Chat Panel - Left */}
      <Card className="flex h-150 flex-col overflow-hidden text-neutral-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-6 py-4">
          <div>
            <div className="text-sm font-medium text-neutral-900">Fill in the Gaps</div>
            <p className="mt-0.5 text-sm text-neutral-500">
              Answer the questions to reinforce what you missed
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-emerald-600 font-medium">{addressedCount}</span>
            <span className="text-neutral-400">/</span>
            <span className="text-neutral-600">{totalCount}</span>
            <span className="text-neutral-400">addressed</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {session.messages.map((msg, index) => (
            <div
              key={index}
              className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-lg px-4 py-3 text-sm',
                  msg.role === 'user'
                    ? 'bg-neutral-900 text-white'
                    : 'bg-neutral-100 text-neutral-800'
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {(isSending || isLoading) && (
            <div className="flex justify-start">
              <div className="bg-neutral-100 rounded-lg px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-neutral-400 animate-bounce" />
                  <div className="h-2 w-2 rounded-full bg-neutral-400 animate-bounce [animation-delay:150ms]" />
                  <div className="h-2 w-2 rounded-full bg-neutral-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-neutral-100 bg-white p-4">
          <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer..."
            className="flex-1 resize-none border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
            rows={2}
            disabled={isSending || isLoading}
          />
            <Button
              onClick={() => void handleSend()}
              disabled={!input.trim() || isSending || isLoading}
              className="h-auto"
            >
              {isSending ? <Spinner className="border-white/30 border-t-white" /> : 'Send'}
            </Button>
          </div>

          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={onSkip}
              className="text-sm text-neutral-400 hover:text-neutral-600 transition"
            >
              Skip to second attempt →
            </button>
          </div>
        </div>
      </Card>

      {/* Context Panel - Right */}
      <div className="space-y-4">
        {/* Concepts to Address */}
        <Card className="overflow-hidden">
          <details open className="group">
            <summary className="flex cursor-pointer items-center justify-between bg-neutral-50 px-5 py-4 text-sm font-medium text-neutral-900 hover:bg-neutral-100 transition">
              <div className="flex items-center gap-3">
                <span>Concepts to Address</span>
                <span className="text-xs font-normal text-neutral-500">
                  {addressedCount}/{totalCount}
                </span>
              </div>
              <svg
                className="h-4 w-4 text-neutral-400 transition-transform group-open:rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>

            <div className="p-4 border-t border-neutral-100">
              {/* Progress bar */}
              <div className="h-2 bg-neutral-100 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${totalCount > 0 ? (addressedCount / totalCount) * 100 : 0}%` }}
                />
              </div>

              <ul className="space-y-2">
                {session.targetConcepts.map((concept, index) => {
                  const isAddressed = session.conceptsAddressed?.includes(concept)
                  return (
                    <li
                      key={index}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border transition',
                        isAddressed
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-amber-50 border-amber-200'
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs',
                          isAddressed
                            ? 'bg-emerald-500 text-white'
                            : 'bg-amber-400 text-white'
                        )}
                      >
                        {isAddressed ? '✓' : index + 1}
                      </span>
                      <span
                        className={cn(
                          'text-sm',
                          isAddressed ? 'text-emerald-700' : 'text-amber-700'
                        )}
                      >
                        {concept}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </details>
        </Card>

        {/* Source Material */}
        <Card className="overflow-hidden">
          <details className="group">
            <summary className="flex cursor-pointer items-center justify-between bg-neutral-50 px-5 py-4 text-sm font-medium text-neutral-900 hover:bg-neutral-100 transition">
              <span>Source Material</span>
              <svg
                className="h-4 w-4 text-neutral-400 transition-transform group-open:rotate-180"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>

            <div className="max-h-64 overflow-y-auto border-t border-neutral-100 p-4">
              <p className="text-sm text-neutral-600 whitespace-pre-wrap leading-relaxed">
                {sourceText}
              </p>
            </div>
          </details>
        </Card>
      </div>
    </div>
  )
}
