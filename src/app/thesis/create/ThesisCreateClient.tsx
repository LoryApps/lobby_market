'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Loader2,
  Lock,
  Scroll,
  Globe,
  Sparkles,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import { THESIS_CATEGORIES } from '@/lib/types/thesis'
import type { ThesisCategory } from '@/lib/types/thesis'

const CAT_LABELS: Record<ThesisCategory, string> = {
  economics: 'Economics',
  politics: 'Politics',
  technology: 'Technology',
  science: 'Science',
  ethics: 'Ethics',
  philosophy: 'Philosophy',
  culture: 'Culture',
  health: 'Health',
  environment: 'Environment',
  education: 'Education',
}

const CAT_COLORS: Record<ThesisCategory, { text: string; bg: string; border: string }> = {
  economics: { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/40' },
  politics: { text: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/40' },
  technology: { text: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/40' },
  science: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/40' },
  ethics: { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/40' },
  philosophy: { text: 'text-surface-400', bg: 'bg-surface-300/20', border: 'border-surface-400/40' },
  culture: { text: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/40' },
  health: { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/40' },
  environment: { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/40' },
  education: { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/40' },
}

const STATEMENT_MAX = 280
const RATIONALE_MAX = 1200

export function ThesisCreateClient() {
  const router = useRouter()

  const [statement, setStatement] = useState('')
  const [rationale, setRationale] = useState('')
  const [category, setCategory] = useState<ThesisCategory>('politics')
  const [resolutionDate, setResolutionDate] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [showCatPicker, setShowCatPicker] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const statementLeft = STATEMENT_MAX - statement.length
  const rationaleLeft = RATIONALE_MAX - rationale.length
  const canSubmit = statement.trim().length >= 10 && !submitting

  const cat = CAT_COLORS[category]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/thesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statement: statement.trim(),
          rationale: rationale.trim() || undefined,
          category,
          resolution_date: resolutionDate || undefined,
          is_public: isPublic,
        }),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Failed to publish thesis')
        return
      }

      const { thesis } = await res.json()
      router.push(`/thesis/${thesis.id}`)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-4 pb-32">
        {/* Back nav */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-surface-500 hover:text-white transition-colors mb-6 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30">
              <Scroll className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white font-mono">Write a Thesis</h1>
              <p className="text-xs text-surface-500">
                Make a bold civic prediction and stake your reputation
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-200 border border-surface-300 text-xs text-surface-400 leading-relaxed">
            <span className="text-gold font-semibold">What is a thesis?</span> A civic thesis is a dated,
            falsifiable prediction about politics, economics, or society. Others can agree or disagree,
            and when the resolution date arrives you mark it Vindicated or Refuted — building your
            long-run accuracy record.
          </div>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Statement */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.3 }}
          >
            <label className="block text-sm font-semibold text-white mb-2">
              Thesis Statement
              <span className="text-against-400 ml-0.5">*</span>
            </label>
            <div className="relative">
              <textarea
                value={statement}
                onChange={(e) => setStatement(e.target.value.slice(0, STATEMENT_MAX))}
                placeholder="e.g. Interest rates will fall below 3% before 2027, restarting the housing boom."
                rows={4}
                className={cn(
                  'w-full bg-surface-100 border rounded-xl px-4 py-3 text-white placeholder-surface-500',
                  'text-sm resize-none focus:outline-none focus:ring-2 transition-colors',
                  statementLeft < 0
                    ? 'border-against-500 focus:ring-against-500/30'
                    : statementLeft < 30
                    ? 'border-gold/60 focus:ring-gold/20'
                    : 'border-surface-300 focus:ring-for-500/30',
                )}
              />
              <span
                className={cn(
                  'absolute bottom-2.5 right-3 text-xs tabular-nums',
                  statementLeft < 0
                    ? 'text-against-400'
                    : statementLeft < 30
                    ? 'text-gold'
                    : 'text-surface-500',
                )}
              >
                {statementLeft}
              </span>
            </div>
            <p className="text-xs text-surface-500 mt-1.5">
              Make it specific, falsifiable, and time-bounded. Min 10 characters.
            </p>
          </motion.div>

          {/* Category */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="relative"
          >
            <label className="block text-sm font-semibold text-white mb-2">Category</label>
            <button
              type="button"
              onClick={() => setShowCatPicker((p) => !p)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 rounded-xl',
                'border transition-colors text-sm',
                'bg-surface-100 hover:bg-surface-200',
                cat.border,
              )}
            >
              <span className={cn('font-semibold', cat.text)}>{CAT_LABELS[category]}</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-surface-500 transition-transform',
                  showCatPicker && 'rotate-180',
                )}
              />
            </button>

            {showCatPicker && (
              <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-surface-100 border border-surface-300 rounded-xl shadow-xl overflow-hidden">
                {THESIS_CATEGORIES.map((c) => {
                  const cc = CAT_COLORS[c]
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setCategory(c)
                        setShowCatPicker(false)
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left',
                        'hover:bg-surface-200 transition-colors',
                        c === category && 'bg-surface-200',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block w-2 h-2 rounded-full flex-shrink-0 border',
                          cc.border,
                          cc.bg,
                        )}
                      />
                      <span className={cn('font-medium', cc.text)}>{CAT_LABELS[c]}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </motion.div>

          {/* Rationale */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
          >
            <label className="block text-sm font-semibold text-white mb-2">
              Rationale
              <span className="text-surface-500 font-normal ml-1.5">(optional)</span>
            </label>
            <div className="relative">
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value.slice(0, RATIONALE_MAX))}
                placeholder="Explain your reasoning, cite evidence, or describe the conditions that would vindicate or refute this thesis…"
                rows={6}
                className={cn(
                  'w-full bg-surface-100 border border-surface-300 rounded-xl px-4 py-3',
                  'text-sm text-white placeholder-surface-500 resize-none',
                  'focus:outline-none focus:ring-2 focus:ring-for-500/30 transition-colors',
                )}
              />
              <span className="absolute bottom-2.5 right-3 text-xs text-surface-500 tabular-nums">
                {rationaleLeft}
              </span>
            </div>
          </motion.div>

          {/* Resolution Date */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <label className="block text-sm font-semibold text-white mb-2">
              Resolution Date
              <span className="text-surface-500 font-normal ml-1.5">(optional)</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
              <input
                type="date"
                value={resolutionDate}
                min={minDateStr}
                onChange={(e) => setResolutionDate(e.target.value)}
                className={cn(
                  'w-full bg-surface-100 border border-surface-300 rounded-xl pl-10 pr-4 py-3',
                  'text-sm text-white placeholder-surface-500',
                  'focus:outline-none focus:ring-2 focus:ring-for-500/30 transition-colors',
                  '[color-scheme:dark]',
                )}
              />
            </div>
            <p className="text-xs text-surface-500 mt-1.5">
              Set a date by which this thesis will be resolved as vindicated or refuted.
            </p>
          </motion.div>

          {/* Visibility */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.3 }}
          >
            <label className="block text-sm font-semibold text-white mb-2">Visibility</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={cn(
                  'flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm transition-all',
                  isPublic
                    ? 'bg-for-500/15 border-for-500/50 text-for-300'
                    : 'bg-surface-100 border-surface-300 text-surface-400 hover:border-surface-400',
                )}
              >
                <Globe className="h-4 w-4 flex-shrink-0" />
                <div className="text-left">
                  <p className="font-semibold">Public</p>
                  <p className="text-[11px] opacity-70">Everyone can see</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={cn(
                  'flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm transition-all',
                  !isPublic
                    ? 'bg-surface-300 border-surface-400 text-white'
                    : 'bg-surface-100 border-surface-300 text-surface-400 hover:border-surface-400',
                )}
              >
                <Lock className="h-4 w-4 flex-shrink-0" />
                <div className="text-left">
                  <p className="font-semibold">Private</p>
                  <p className="text-[11px] opacity-70">Only you</p>
                </div>
              </button>
            </div>
          </motion.div>

          {/* Error */}
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-against-400 bg-against-500/10 border border-against-500/30 rounded-xl px-4 py-3"
            >
              {error}
            </motion.p>
          )}

          {/* Submit */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="pt-2"
          >
            <Button
              type="submit"
              variant="gold"
              size="lg"
              disabled={!canSubmit}
              className="w-full font-mono font-bold"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publishing…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Publish Thesis
                </>
              )}
            </Button>

            <p className="text-center text-xs text-surface-500 mt-3">
              Your thesis will be visible on the{' '}
              <a href="/thesis" className="text-for-400 hover:underline">
                Thesis Board
              </a>{' '}
              {isPublic ? 'to all users' : 'only to you'}.
            </p>
          </motion.div>
        </form>
      </main>

      <BottomNav />
    </div>
  )
}
