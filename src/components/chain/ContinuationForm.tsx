'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, Check, Sparkles } from 'lucide-react'
import type { Topic } from '@/lib/supabase/types'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

interface ContinuationFormProps {
  topicId: string
  topic: Topic
  connector?: 'but' | 'and'
  onSubmit?: () => void
  className?: string
}

const MAX_CHARS = 100

// Determine the default grammatical connector from the vote lean.
// 50-59%: "but" (partial disagreement with the stronger side)
// 60-66%: "and" (reinforcing the stronger side)
function resolveConnector(topic: Topic): 'but' | 'and' {
  const bluePct = topic.blue_pct
  const leading = bluePct >= 50 ? bluePct : 100 - bluePct
  return leading >= 60 ? 'and' : 'but'
}

export function ContinuationForm({
  topicId,
  topic,
  connector: connectorProp,
  onSubmit,
  className,
}: ContinuationFormProps) {
  const connector = useMemo(
    () => connectorProp ?? resolveConnector(topic),
    [connectorProp, topic]
  )

  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const trimmed = text.trim()
  const tooLong = trimmed.length > MAX_CHARS
  const canSubmit = trimmed.length > 0 && !tooLong && !submitting && !submitted

  // Only render when the topic is in an active continuation window.
  const windowActive = useMemo(() => {
    if (topic.status !== 'continued') return false
    if (!topic.continuation_window_ends_at) return false
    return new Date(topic.continuation_window_ends_at).getTime() > Date.now()
  }, [topic.status, topic.continuation_window_ends_at])

  if (!windowActive) return null

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/topics/${topicId}/continuations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, connector }),
      })

      if (res.status === 401) {
        setError('You must be signed in to submit a continuation.')
        return
      }
      if (res.status === 403) {
        setError('Only Debators can submit continuations.')
        return
      }
      if (res.status === 409) {
        setError('You already submitted a continuation for this topic.')
        return
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null
        setError(body?.error ?? 'Failed to submit continuation.')
        return
      }

      setSubmitted(true)
      setText('')
      onSubmit?.()
    } catch (err) {
      console.error('Continuation submit failed:', err)
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/15">
          <Sparkles className="h-3.5 w-3.5 text-gold" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gold">
            Author a continuation
          </p>
          <p className="text-[11px] text-surface-500">
            Refine the statement with <span className="font-semibold text-surface-600">&ldquo;...{connector}&rdquo;</span>
          </p>
        </div>
      </div>

      {/* Original statement */}
      <div className="rounded-xl border border-surface-300 bg-surface-50 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500 mb-1">
          Original
        </p>
        <p className="text-sm text-surface-700 leading-snug">
          {topic.statement}
        </p>
      </div>

      {/* Input area with prefix */}
      <div
        className={cn(
          'rounded-xl border bg-surface-50 transition-colors focus-within:border-gold/50',
          tooLong ? 'border-against-500/50' : 'border-surface-300'
        )}
      >
        <div className="flex items-start px-4 py-3 gap-2">
          <span className="text-sm font-mono font-semibold text-gold select-none pt-[1px]">
            ...{connector}
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              connector === 'but'
                ? 'not when it risks another person\u2019s life.'
                : 'only after 18 weeks with proper counselling.'
            }
            rows={2}
            disabled={submitting || submitted}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-surface-400 resize-none focus:outline-none disabled:opacity-50"
            maxLength={MAX_CHARS * 2}
          />
        </div>
        <div className="flex items-center justify-between border-t border-surface-300 px-4 py-2">
          <span className="text-[11px] text-surface-500">
            Max {MAX_CHARS} characters
          </span>
          <span
            className={cn(
              'text-xs font-mono tabular-nums',
              tooLong
                ? 'text-against-500 font-bold'
                : trimmed.length > MAX_CHARS * 0.8
                  ? 'text-gold'
                  : 'text-surface-500'
            )}
          >
            {trimmed.length}/{MAX_CHARS}
          </span>
        </div>
      </div>

      {/* Preview */}
      {trimmed.length > 0 && !tooLong && (
        <div className="rounded-xl bg-surface-200/40 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500 mb-1">
            Preview
          </p>
          <p className="text-sm text-white leading-snug">
            {topic.statement}{' '}
            <span className="text-gold font-semibold">...{connector}</span>{' '}
            <span className="text-surface-700">{trimmed}</span>
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-against-500/30 bg-against-500/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-against-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-against-400">{error}</p>
        </div>
      )}

      {/* Success */}
      {submitted && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald/30 bg-emerald/5 px-4 py-3">
          <Check className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" />
          <p className="text-xs text-emerald">
            Continuation submitted. It will appear below in the list.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end">
        <Button
          variant="gold"
          size="md"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {submitting
            ? 'Submitting...'
            : submitted
              ? 'Submitted'
              : 'Submit continuation'}
        </Button>
      </div>
    </div>
  )
}
