'use client'

import { useEffect, useState } from 'react'
import { Ban, CheckCircle, EyeOff, Loader2, Shield, X } from 'lucide-react'
import type { Report, ReportAction, Profile } from '@/lib/supabase/types'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

type ReportWithReporter = Report & {
  reporter?: Pick<
    Profile,
    'id' | 'username' | 'display_name' | 'avatar_url' | 'role'
  > | null
}

interface ReportReviewModalProps {
  open: boolean
  report: ReportWithReporter | null
  onClose: () => void
  onResolved?: (resolved: Report) => void
}

const actions: Array<{
  id: ReportAction
  label: string
  icon: React.ComponentType<{ className?: string }>
  tone: 'gold' | 'for' | 'emerald' | 'against'
  blurb: string
}> = [
  {
    id: 'dismiss',
    label: 'Dismiss',
    icon: CheckCircle,
    tone: 'emerald',
    blurb: 'Report is unfounded — no action taken',
  },
  {
    id: 'warn',
    label: 'Warn User',
    icon: Shield,
    tone: 'gold',
    blurb: 'Send a formal warning',
  },
  {
    id: 'hide',
    label: 'Hide Content',
    icon: EyeOff,
    tone: 'for',
    blurb: 'Take the content down',
  },
  {
    id: 'escalate',
    label: 'Escalate',
    icon: Shield,
    tone: 'gold',
    blurb: 'Kick to Elder review',
  },
  {
    id: 'ban',
    label: 'Ban User',
    icon: Ban,
    tone: 'against',
    blurb: 'Suspend account',
  },
]

const toneClasses: Record<string, string> = {
  emerald:
    'border-emerald/30 bg-emerald/10 text-emerald hover:bg-emerald/20 hover:border-emerald/50',
  gold: 'border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 hover:border-gold/50',
  for: 'border-for-500/30 bg-for-500/10 text-for-400 hover:bg-for-500/20 hover:border-for-500/50',
  against:
    'border-against-500/30 bg-against-500/10 text-against-400 hover:bg-against-500/20 hover:border-against-500/50',
}

export function ReportReviewModal({
  open,
  report,
  onClose,
  onResolved,
}: ReportReviewModalProps) {
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState<ReportAction | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setNote('')
    setSelected(null)
    setError(null)
  }, [open, report?.id])

  if (!open || !report) return null

  const handleSubmit = async () => {
    if (!selected) {
      setError('Choose an action')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: selected,
          resolution_note: note.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to resolve report')
      }
      const data = await res.json()
      onResolved?.(data.report)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className={cn(
          'relative w-full max-w-lg rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto',
          'bg-surface-100 border border-emerald/30 shadow-2xl'
        )}
      >
        <div className="sticky top-0 z-10 bg-surface-100 px-6 py-5 border-b border-surface-300/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald" />
            <h2 className="font-mono text-base font-semibold text-white">
              Review Report
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="rounded-xl border border-surface-300 bg-surface-200 p-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-surface-500">
              Reported {report.reported_content_type}
            </div>
            <div className="mt-1 font-mono text-sm text-white font-semibold">
              {report.reason}
            </div>
            {report.description && (
              <p className="mt-2 font-mono text-xs text-surface-600 leading-relaxed whitespace-pre-wrap">
                {report.description}
              </p>
            )}
            <div className="mt-3 pt-3 border-t border-surface-300/60 font-mono text-[11px] text-surface-500">
              Filed by @{report.reporter?.username ?? 'anonymous'} ·{' '}
              {new Date(report.created_at).toLocaleString()}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-surface-500 mb-2">
              Choose Action
            </div>
            <div className="grid grid-cols-1 gap-2">
              {actions.map((action) => {
                const Icon = action.icon
                const isSelected = selected === action.id
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => setSelected(action.id)}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                      toneClasses[action.tone],
                      isSelected && 'ring-2 ring-offset-0 ring-current'
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs font-semibold">
                        {action.label}
                      </div>
                      <div className="font-mono text-[10px] text-surface-500 mt-0.5">
                        {action.blurb}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-surface-500 mb-2">
              Resolution Note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Explain the decision for transparency…"
              className={cn(
                'w-full rounded-xl px-4 py-3 font-mono text-xs',
                'bg-surface-200 border border-surface-300 text-white',
                'placeholder:text-surface-500 resize-y',
                'focus:outline-none focus:border-emerald/50 focus:ring-2 focus:ring-emerald/20'
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
              variant="gold"
              size="md"
              onClick={handleSubmit}
              disabled={submitting || !selected}
              className="flex-1"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resolving…
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  Submit Decision
                </>
              )}
            </Button>
            <Button variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
