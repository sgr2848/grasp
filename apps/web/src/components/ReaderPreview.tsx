import { useMemo, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/cn'

type ChildrenProps = { children?: ReactNode }
type AnchorProps = { href?: string; children?: ReactNode }
type CodeProps = { children?: ReactNode; className?: string }

const MARKDOWN_DETECTION_PATTERN =
  /(^|\n)\s{0,3}#{1,6}\s+|(^|\n)\s{0,3}(-|\*|\+)\s+|(^|\n)\s{0,3}\d+\.\s+|```|`[^`]+`|\[[^\]]+\]\([^)]+\)|(^|\n)\s{0,3}>\s+/m

const isLikelyMarkdown = (text: string) => MARKDOWN_DETECTION_PATTERN.test(text)

interface ReaderPreviewProps {
  text: string
  title?: string
  className?: string
}

export function ReaderPreview({ text, title, className }: ReaderPreviewProps) {
  const hasText = text.trim().length > 0
  const isMarkdown = useMemo(() => isLikelyMarkdown(text), [text])
  const plainParagraphs = useMemo(() => {
    if (!hasText) return []
    return text
      .trim()
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trimEnd())
      .filter(Boolean)
  }, [hasText, text])

  if (!hasText) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center text-neutral-400">
          <svg
            className="mx-auto h-12 w-12 text-neutral-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-3 text-sm">Paste text to see preview</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('h-full overflow-y-auto', className)}>
      <div className="mx-auto max-w-2xl px-6 py-8 sm:px-8 sm:py-10">
        {/* Optional title */}
        {title && (
          <div className="mb-6 pb-4 border-b border-neutral-200">
            <h1 className="text-xl font-bold text-neutral-900 font-serif">{title}</h1>
          </div>
        )}

        {/* Content */}
        {isMarkdown ? (
          <div className="font-serif">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }: ChildrenProps) => (
                  <h1 className="mb-4 text-2xl font-bold text-neutral-900">{children}</h1>
                ),
                h2: ({ children }: ChildrenProps) => (
                  <h2 className="mb-3 text-xl font-bold text-neutral-900">{children}</h2>
                ),
                h3: ({ children }: ChildrenProps) => (
                  <h3 className="mb-2 text-lg font-semibold text-neutral-900">{children}</h3>
                ),
                p: ({ children }: ChildrenProps) => (
                  <p className="mb-5 text-base leading-relaxed text-neutral-700 last:mb-0">
                    {children}
                  </p>
                ),
                ul: ({ children }: ChildrenProps) => (
                  <ul className="mb-5 list-disc space-y-1.5 pl-5 text-base text-neutral-700">
                    {children}
                  </ul>
                ),
                ol: ({ children }: ChildrenProps) => (
                  <ol className="mb-5 list-decimal space-y-1.5 pl-5 text-base text-neutral-700">
                    {children}
                  </ol>
                ),
                li: ({ children }: ChildrenProps) => <li className="leading-relaxed">{children}</li>,
                blockquote: ({ children }: ChildrenProps) => (
                  <blockquote className="mb-5 border-l-2 border-neutral-200 pl-4 text-base italic text-neutral-600">
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }: AnchorProps) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 underline decoration-emerald-200 underline-offset-4 transition hover:text-emerald-700"
                  >
                    {children}
                  </a>
                ),
                code: ({ children, className }: CodeProps) => {
                  const isBlock = className?.includes('language-')
                  return isBlock ? (
                    <code className="font-mono text-sm text-neutral-800">{children}</code>
                  ) : (
                    <code className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-sm font-mono text-neutral-700">
                      {children}
                    </code>
                  )
                },
                pre: ({ children }: ChildrenProps) => (
                  <pre className="mb-5 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-800">
                    {children}
                  </pre>
                ),
                hr: () => <hr className="my-6 border-neutral-200" />,
              }}
            >
              {text}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="space-y-5 font-serif">
            {plainParagraphs.map((paragraph, index) => (
              <p
                key={index}
                className="whitespace-pre-wrap text-base leading-relaxed text-neutral-700 first-letter:text-xl first-letter:font-semibold"
              >
                {paragraph}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
