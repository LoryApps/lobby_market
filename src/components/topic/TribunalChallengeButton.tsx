'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, Loader2, Scale } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const REASONS = [
  { value: 'misleading',  label: 'Misleading',  desc: 'Contains false or deceptive claims' },
  { value: 'fallacious',  label: 'Fallacious',  desc: 'Uses logical fallacies' },
  { value: 'irrelevant',  label: 'Off-topic',   desc: 'Not relevant to the debate' },
  { value: 'spam',        label: 'Spam',         desc: 'Low effort or promotional' },
] as const

type Reason = (typeof REASONS)[number]['value']

interface Props {
  argumentId: string
  disabled?: boolean
}

export function TribunalChallengeButton({ argumentId, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Reason | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    if (!selected || submitting) return
    setSubmitting(true)
    setErr('')
    try {
      const res = await fetch('/api/tribunal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ argument_id: argumentId, reason: selected, note: note.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErr(json.error ?? 'Could not submit challenge')
        return
      }
      setDone(true)
      setOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <span
        title="Challenge submitted — 3 challenges triggers a Tribunal case"
        className="flex items-center justify-center p-1.5 rounded-lg text-gold"
      >
        <Check className="h-3 w-3" />
      </span>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => { if (!disabled) setOpen((o) => !o) }}
        disabled={disabled}
        title="Challenge this argument (send to Tribunal if 3 challenges)"
        aria-label="Challenge argument"
        className={cn(
          'flex items-center justify-center p-1.5 rounded-lg transition-all',
          'text-surface-600 hover:text-gold hover:bg-gold/10',
          disabled && 'opacity-40 cursor-not-allowed'
        )}
      >
        <Scale className="h-3 w-3" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-8 z-50 w-64 rounded-xl bg-surface-100 border border-surface-300 shadow-xl overflow-hidden"
            >
              <div className="px-3 py-2.5 border-b border-surface-300">
                <p className="text-xs font-mono font-semibold text-white flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-gold" />
                  Challenge Argument
                </p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                  3 challenges opens a Tribunal case
                </p>
              </div>

              <div className="p-2 space-y-1">
                {REASONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setSelected(r.value)}
                    className={cn(
                      'w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-colors',
                      selected === r.value
                        ? 'bg-gold/10 border border-gold/30'
                        : 'hover:bg-surface-200/60'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 h-3.5 w-3.5 rounded-full border-2 flex-shrink-0 transition-colors',
                        selected === r.value
                          ? 'border-gold bg-gold'
                          : 'border-surface-400'
                      )}
                    />
                    <div>
                      <p className={cn('text-xs font-mono font-medium', selected === r.value ? 'text-gold' : 'text-white')}>
                        {r.label}
                      </p>
                      <p className="text-[10px] font-mono text-surface-500">{r.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="px-3 pb-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 280))}
                  placeholder="Optional note (max 280 chars)"
                  rows={2}
                  className="w-full text-xs font-mono bg-surface-200 border border-surface-300 rounded-lg px-2.5 py-2 text-white placeholder:text-surface-600 resize-none focus:outline-none focus:border-gold/50"
                />
              </div>

              {err && (
                <p className="px-3 pb-1.5 text-[10px] font-mono text-against-400">{err}</p>
              )}

              <div className="px-3 pb-3 flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-mono text-surface-500 bg-surface-200 border border-surface-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={!selected || submitting}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                    'disabled:opacity-50 flex items-center justify-center gap-1',
                    selected
                      ? 'bg-gold/10 border-gold/30 text-gold hover:bg-gold/20'
                      : 'bg-surface-200 border-surface-300 text-surface-600'
                  )}
                >
                  {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Submit
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
