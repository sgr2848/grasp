import { useCallback, useEffect, useRef, useState } from 'react'
import { useRecorder } from '@/hooks/useRecorder'
import { useTTS } from '@/context/TTSContext'
import { getConversation, sendChatMessage, startConversation, transcribeAudio, type ChatMessage } from '@/lib/api'
import { personaConfig, type Persona } from '@/lib/personas'
import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

interface ChatPanelProps {
  sessionId: string
  persona: Persona
  missedPoints: string[]
}

export function ChatPanel({ sessionId, persona, missedPoints }: ChatPanelProps) {
  const { speak, stop: stopSpeaking } = useTTS()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [remainingPoints, setRemainingPoints] = useState<string[]>(missedPoints)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const {
    state: recorderState,
    startRecording,
    stopRecording,
    reset: resetRecorder,
  } = useRecorder()

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    async function loadConversation() {
      try {
        const { messages: existingMessages, hasConversation } = await getConversation(sessionId)
        if (hasConversation && existingMessages.length > 0) {
          setMessages(existingMessages)
          setHasStarted(true)
        }
      } catch {
        // No existing conversation, that's fine
      }
    }
    void loadConversation()
  }, [sessionId])

  useEffect(() => {
    if (!hasStarted) return
    if (isLoading) return
    inputRef.current?.focus()
  }, [hasStarted, isLoading])

  const handleStart = useCallback(async () => {
    setIsStarting(true)
    setError(null)
    try {
      const result = await startConversation(sessionId)
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: result.message,
        timestamp: new Date().toISOString()
      }
      setMessages([assistantMessage])
      setHasStarted(true)
      stopSpeaking()
      void speak(result.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start conversation')
    } finally {
      setIsStarting(false)
    }
  }, [sessionId, speak, stopSpeaking])

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInputText('')
    setIsLoading(true)
    setError(null)

    try {
      const response = await sendChatMessage(sessionId, text.trim())
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.followUpQuestion
          ? `${response.reply}\n\n${response.followUpQuestion}`
          : response.reply,
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, assistantMessage])
      setRemainingPoints(response.remainingMissedPoints)
      stopSpeaking()
      void speak(assistantMessage.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, isLoading, speak, stopSpeaking])

  const handleVoiceInput = useCallback(async () => {
    if (recorderState === 'recording') {
      const result = await stopRecording()
      if (result?.blob) {
        setIsLoading(true)
        try {
          const transcript = await transcribeAudio(result.blob)
          await handleSend(transcript)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to transcribe')
          setIsLoading(false)
        }
      }
      resetRecorder()
    } else {
      await startRecording()
    }
  }, [recorderState, stopRecording, resetRecorder, startRecording, handleSend])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend(inputText)
    }
  }, [handleSend, inputText])

  if (!hasStarted) {
    const personaName = personaConfig[persona]?.name ?? persona

    return (
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-medium text-neutral-900">Continue the conversation</div>
            <p className="mt-1 text-sm text-neutral-500">
              Discuss the {missedPoints.length} missed point{missedPoints.length !== 1 ? 's' : ''} with {personaName}.
            </p>
          </div>
          <Button onClick={handleStart} disabled={isStarting || missedPoints.length === 0}>
            {isStarting ? (
              <>
                <Spinner className="border-white/30 border-t-white" />
                Starting...
              </>
            ) : missedPoints.length === 0 ? (
              'Nothing to discuss'
            ) : (
              'Start discussion'
            )}
          </Button>
        </div>
        {error && (
          <div className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}
      </Card>
    )
  }

  return (
    <Card className="flex flex-col p-0 text-neutral-900">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-neutral-900">Discussion</div>
          <Badge variant={remainingPoints.length === 0 ? 'success' : 'warning'}>
            {remainingPoints.length === 0 ? 'All covered' : `${remainingPoints.length} left`}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={stopSpeaking} aria-label="Stop voice playback">
          Stop voice
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ maxHeight: '400px' }}>
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[80%] px-4 py-3 text-sm',
                  msg.role === 'user'
                    ? 'bg-neutral-900 text-white'
                    : 'border border-neutral-200 bg-neutral-50 text-neutral-700'
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="border border-neutral-200 bg-neutral-50 px-4 py-3">
                <Spinner size="sm" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {error && (
        <div className="border-t border-red-200 bg-red-50 px-6 py-3 text-sm text-red-600">{error}</div>
      )}

      <div className="border-t border-neutral-200 p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your response..."
            className="flex-1 resize-none border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/20"
            rows={2}
            disabled={isLoading}
          />
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => void handleSend(inputText)}
              disabled={!inputText.trim() || isLoading}
              className="h-full"
            >
              Send
            </Button>
            <Button
              variant={recorderState === 'recording' ? 'danger' : 'secondary'}
              onClick={() => void handleVoiceInput()}
              disabled={isLoading}
              className="h-full"
              aria-label={recorderState === 'recording' ? 'Stop recording voice input' : 'Start recording voice input'}
              title={recorderState === 'recording' ? 'Stop recording' : 'Record'}
            >
              {recorderState === 'recording' ? (
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 animate-pulse bg-white" />
                  Stop
                </span>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              )}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          Press Enter to send, Shift+Enter for new line. Or use the mic button to speak.
        </p>
      </div>
    </Card>
  )
}
