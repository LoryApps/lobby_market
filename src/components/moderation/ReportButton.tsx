'use client'

import { useState } from 'react'
import { Flag, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

interface ReportButtonProps {
  contentType: 'topic' | 'message' | 'argument' | 'lobby' | 'continuation'
  contentId: string
  reportedUserId?: string | null
  label?: string
  compact?: boolean
}

const COMMON_REASONS = [
  'Spam',
  'Harassment',
  'Misinformation',
  'Hate speech',
  'Off-topic',
  'Other',
]

export function ReportButton({
  contentType,
  contentId,
  reportedUserId = null,
  label = 'Report',
  compact = false,
}: ReportButtonProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(COMMON_REASONS[0])
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filed, setFiled] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_type: contentType,
          content_id: contentId,
          reason,
          description: description.trim() || undefined,
          reported_user_id: reportedUserId,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to file report')
      }
      setFiled(true)
      setTimeout(() => {
        setOpen(false)
        setFiled(false)
        setDescription('')
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg transition-colors font-mono text-[11px]',
          compact
            ? 'h-7 w-7 justify-center bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-against-400'
            : 'px-2.5 py-1.5 bg-surface-200 text-surface-500 hover:text-against-400'
        )}
        aria-label="Report content"
      >
        <Flag className="h-3.5 w-3.5" />
        {!compact && <span>{label}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className={cn(
              'relative w-full max-w-md rounded-2xl overflow-hidden',
              'bg-surface-100 border border-against-500/30 shadow-2xl'
            )}
          >
            <div className="px-6 py-5 border-b border-surface-300/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-against-400" />
                <h2 className="font-mono text-base font-semibold text-white">
                  File Report
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {filed ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald/10 text-emerald mb-3">
                    <Flag className="h-6 w-6" />
                  </div>
                  <p className="font-mono text-sm text-white">
                    Report filed
                  </p>
                  <p className="font-mono text-xs text-surface-500 mt-1">
                    A Troll Catcher will review it
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-surface-500 mb-2">
                      Reason
                    </label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className={cn(
                        'w-full rounded-xl px-4 py-3 font-mono text-sm',
                        'bg-surface-200 border border-surface-300 text-white',
                        'focus:outline-none focus:border-against-500/50 focus:ring-2 focus:ring-against-500/20',
                        'appearance-none'
                      )}
                    >
                      {COMMON_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-surface-500 mb-2">
                      Details (optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      placeholder="What happened? Include context where possible."
                      className={cn(
                        'w-full rounded-xl px-4 py-3 font-mono text-xs',
                        'bg-surface-200 border border-surface-300 text-white',
                        'placeholder:text-surface-500 resize-y',
                        'focus:outline-none focus:border-against-500/50 focus:ring-2 focus:ring-against-500/20'
                      )}
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg border border-against-500/30 bg-against-500/10 px-3 py-2 text-xs font-mono text-against-400">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="against"
                      size="md"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Filing…
                        </>
                      ) : (
                        <>
                          <Flag className="h-4 w-4" />
                          Submit Report
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={() => setOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
