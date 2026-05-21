'use client'

import { useRef, useState } from 'react'
import { Check, ExternalLink, Loader2, MessageSquare, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { haptics } from '@/lib/hooks/useHaptics'
import { cn } from '@/lib/utils/cn'

const MIN_CHARS = 10
const MAX_CHARS = 500

type Side = 'blue' | 'red' | null

interface QuickArgueSheetProps {
  open: boolean
  onClose: () => void
  topicId: string
  topicStatement: string
  initialSide?: Side
}

export function QuickArgueSheet({
  open,
  onClose,
  topicId,
  topicStatement,
  initialSide = null,
}: QuickArgueSheetProps) {
  const [side, setSide] = useState<Side>(initialSide)
  const [content, setContent] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [showSourceUrl, setShowSourceUrl] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const remaining = MAX_CHARS - content.length
  const canSubmit = side !== null && content.trim().length >= MIN_CHARS && !submitting

  function handleClose() {
    if (submitting) return
    onClose()
    // Reset state after animation
    setTimeout(() => {
      setSide(initialSide)
      setContent('')
      setSourceUrl('')
      setShowSourceUrl(false)
      setError(null)
      setSubmitted(false)
    }, 300)
  }

  function handleSideSelect(chosen: 'blue' | 'red') {
    setSide(chosen)
    haptics.selection()
    // Focus textarea after picking side
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  async function handleSubmit() {
    if (!canSubmit || !side) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/topics/${topicId}/arguments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side,
          content: content.trim(),
          ...(sourceUrl.trim() ? { source_url: sourceUrl.trim() } : {}),
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Failed to post argument')
        setSubmitting(false)
        return
      }

      haptics.success()
      setSubmitted(true)
      setTimeout(() => handleClose(), 1500)
    } catch {
      setError('Network error — please try again')
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title="Add Argument" maxHeight="92dvh">
      <div className="px-4 pb-6 space-y-4">
        {/* Topic statement */}
        <div className="rounded-xl bg-surface-200 border border-surface-300 px-4 py-3">
          <p className="text-xs font-mono text-surface-500 mb-1 uppercase tracking-wider">Topic</p>
          <p className="text-sm font-mono text-white leading-snug line-clamp-3">
            {topicStatement}
          </p>
        </div>

        {/* Success state */}
        <AnimatePresence>
          {submitted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-8"
            >
              <div className={cn(
                'flex items-center justify-center h-14 w-14 rounded-full',
                side === 'blue' ? 'bg-for-500/20 border border-for-500/40' : 'bg-against-500/20 border border-against-500/40'
              )}>
                <Check className={cn('h-7 w-7', side === 'blue' ? 'text-for-400' : 'text-against-400')} />
              </div>
              <p className="font-mono font-semibold text-white text-lg">Argument posted!</p>
              <p className="text-sm text-surface-500 font-mono text-center max-w-xs">
                Your {side === 'blue' ? 'FOR' : 'AGAINST'} argument is now live on this debate.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {!submitted && (
          <>
            {/* Side selector */}
            <div>
              <p className="text-xs font-mono text-surface-500 mb-2 uppercase tracking-wider">Your position</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSideSelect('blue')}
                  className={cn(
                    'flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all font-mono text-sm font-semibold',
                    side === 'blue'
                      ? 'bg-for-500/20 border-for-500/60 text-for-300 ring-1 ring-for-500/30'
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-for-500/40 hover:text-for-400'
                  )}
                >
                  <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                  FOR
                </button>
                <button
                  onClick={() => handleSideSelect('red')}
                  className={cn(
                    'flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all font-mono text-sm font-semibold',
                    side === 'red'
                      ? 'bg-against-500/20 border-against-500/60 text-against-300 ring-1 ring-against-500/30'
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-against-500/40 hover:text-against-400'
                  )}
                >
                  <ThumbsDown className="h-4 w-4" aria-hidden="true" />
                  AGAINST
                </button>
              </div>
            </div>

            {/* Content textarea */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Your argument</p>
                <span className={cn(
                  'text-xs font-mono tabular-nums',
                  remaining < 50 ? 'text-against-400' : remaining < 100 ? 'text-gold' : 'text-surface-600'
                )}>
                  {remaining}
                </span>
              </div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_CHARS) setContent(e.target.value)
                }}
                placeholder={
                  side === 'blue'
                    ? 'Make the case FOR this proposal…'
                    : side === 'red'
                    ? 'Make the case AGAINST this proposal…'
                    : 'Pick a side above, then make your case…'
                }
                disabled={side === null || submitting}
                rows={4}
                className={cn(
                  'w-full rounded-xl bg-surface-200 border px-4 py-3',
                  'font-mono text-sm text-white placeholder:text-surface-500',
                  'resize-none focus:outline-none transition-colors',
                  side === 'blue'
                    ? 'border-surface-300 focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20'
                    : side === 'red'
                    ? 'border-surface-300 focus:border-against-500/60 focus:ring-1 focus:ring-against-500/20'
                    : 'border-surface-300',
                  'disabled:opacity-50'
                )}
              />
              {content.trim().length > 0 && content.trim().length < MIN_CHARS && (
                <p className="text-xs text-against-400 font-mono mt-1">
                  {MIN_CHARS - content.trim().length} more character{MIN_CHARS - content.trim().length === 1 ? '' : 's'} needed
                </p>
              )}
            </div>

            {/* Optional source URL */}
            <div>
              {!showSourceUrl ? (
                <button
                  onClick={() => setShowSourceUrl(true)}
                  className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-400 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Add source link (optional)
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://example.com/source"
                    className="flex-1 h-9 rounded-lg bg-surface-200 border border-surface-300 px-3 font-mono text-xs text-white placeholder:text-surface-500 focus:outline-none focus:border-surface-400"
                  />
                  <button
                    onClick={() => { setShowSourceUrl(false); setSourceUrl('') }}
                    className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors"
                    aria-label="Remove source URL"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-against-500/10 border border-against-500/20 text-against-400">
                <span className="text-xs font-mono">{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl',
                'font-mono font-semibold text-sm transition-all',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                canSubmit && side === 'blue'
                  ? 'bg-for-600 hover:bg-for-500 text-white'
                  : canSubmit && side === 'red'
                  ? 'bg-against-600 hover:bg-against-500 text-white'
                  : 'bg-surface-300 text-surface-500'
              )}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <MessageSquare className="h-4 w-4" />
                  Post {side === 'blue' ? 'FOR' : side === 'red' ? 'AGAINST' : ''} Argument
                </>
              )}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  )
}
