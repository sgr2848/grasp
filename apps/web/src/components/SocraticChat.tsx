import { useState, useRef, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import type { SocraticSession } from '@/lib/api'

const MARKDOWN_DETECTION_PATTERN =
  /(^|\n)\s{0,3}#{1,6}\s+|(^|\n)\s{0,3}(-|\*|\+)\s+|(^|\n)\s{0,3}\d+\.\s+|```|`[^`]+`|\[[^\]]+\]\([^)]+\)|(^|\n)\s{0,3}>\s+/m

const isLikelyMarkdown = (text: string) => MARKDOWN_DETECTION_PATTERN.test(text)

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
  const [isReaderOpen, setIsReaderOpen] = useState(false)
  const [isReaderVisible, setIsReaderVisible] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const addressedCount = session.conceptsAddressed?.length ?? 0
  const totalCount = session.targetConcepts.length
  const hasSourceText = sourceText.trim().length > 0
  const isMarkdown = useMemo(() => isLikelyMarkdown(sourceText), [sourceText])
  const plainParagraphs = useMemo(() => {
    if (!hasSourceText) return []
    return sourceText
      .trim()
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trimEnd())
      .filter(Boolean)
  }, [hasSourceText, sourceText])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [session.messages])

  useEffect(() => {
    if (isReaderOpen) {
      setIsReaderVisible(true)
      return
    }

    if (!isReaderVisible) return

    const timeout = window.setTimeout(() => setIsReaderVisible(false), 300)
    return () => window.clearTimeout(timeout)
  }, [isReaderOpen, isReaderVisible])

  useEffect(() => {
    if (!isReaderVisible) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isReaderVisible])

  useEffect(() => {
    if (!isReaderOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsReaderOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isReaderOpen])

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

  const readerContent = hasSourceText ? (
    isMarkdown ? (
      <div className="font-serif">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="mb-4 text-2xl font-bold text-neutral-900">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="mb-3 text-xl font-bold text-neutral-900">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="mb-2 text-lg font-semibold text-neutral-900">{children}</h3>
            ),
            p: ({ children }) => (
              <p className="mb-6 text-lg leading-relaxed text-neutral-800 last:mb-0">
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className="mb-6 list-disc space-y-2 pl-6 text-lg text-neutral-800">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-6 list-decimal space-y-2 pl-6 text-lg text-neutral-800">
                {children}
              </ol>
            ),
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="mb-6 border-l-2 border-neutral-200 pl-4 text-lg italic text-neutral-600">
                {children}
              </blockquote>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-600 underline decoration-emerald-200 underline-offset-4 transition hover:text-emerald-700"
              >
                {children}
              </a>
            ),
            code: ({ children, className }) => {
              const isBlock = className?.includes('language-')
              return isBlock ? (
                <code className="font-mono text-sm text-neutral-800">{children}</code>
              ) : (
                <code className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-sm font-mono text-neutral-700">
                  {children}
                </code>
              )
            },
            pre: ({ children }) => (
              <pre className="mb-6 overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-800">
                {children}
              </pre>
            ),
            hr: () => <hr className="my-6 border-neutral-200" />,
          }}
        >
          {sourceText}
        </ReactMarkdown>
      </div>
    ) : (
      <div className="space-y-6 font-serif">
        {plainParagraphs.map((paragraph, index) => (
          <p
            key={index}
            className="whitespace-pre-wrap text-lg leading-relaxed text-neutral-800 first-letter:text-2xl first-letter:font-bold"
          >
            {paragraph}
          </p>
        ))}
      </div>
    )
  ) : (
    <p className="text-sm text-neutral-500">No source material available for this session.</p>
  )

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
        {/* Source Material */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-neutral-900">Source Material</div>
              <p className="text-xs text-neutral-500">Reference as you answer</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={!hasSourceText}
              onClick={() => setIsReaderOpen(true)}
            >
              Open reader
            </Button>
          </div>
          <div className="p-4">
            {hasSourceText ? (
              <button
                type="button"
                onClick={() => setIsReaderOpen(true)}
                className="w-full rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-3 text-left text-sm text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                Tap to open the reader drawer
              </button>
            ) : (
              <p className="text-sm text-neutral-500">No source material available for this session.</p>
            )}
          </div>
        </Card>

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
      </div>

      {isReaderVisible && (
        <div className="fixed inset-0 z-50" aria-hidden={!isReaderOpen}>
          <div
            className={cn(
              'absolute inset-0 bg-neutral-900/20 backdrop-blur-[2px] transition-opacity duration-300',
              isReaderOpen ? 'opacity-100' : 'opacity-0'
            )}
            onClick={() => setIsReaderOpen(false)}
          />
          <div
            role="dialog"
            aria-modal={isReaderOpen}
            className={cn(
              'absolute inset-x-0 bottom-0 z-10 flex h-[80vh] flex-col overflow-hidden border-t border-neutral-200 bg-neutral-50 shadow-2xl transition-transform duration-300 ease-out',
              'lg:inset-y-0 lg:left-auto lg:h-full lg:w-1/2 lg:border-l lg:border-t-0',
              isReaderOpen
                ? 'translate-y-0 lg:translate-y-0 lg:translate-x-0'
                : 'translate-y-full lg:translate-y-0 lg:translate-x-full'
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 bg-white/95 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-neutral-900">Source Material</div>
                <p className="text-xs text-neutral-500">Reader view</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setIsReaderOpen(false)}>
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-8">
              <div className="mx-auto w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-10">
                {readerContent}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
