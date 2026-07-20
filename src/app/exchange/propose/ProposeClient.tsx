'use client'

/**
 * /exchange/propose — Submit a Market Proposal
 *
 * Multi-step form to propose a new civic prediction market.
 * Step 1: Market question (title)
 * Step 2: Category + resolution criteria + settlement date
 * Step 3: Description + review
 */

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Info,
  Lightbulb,
  Loader2,
  PenLine,
  Scale,
  Sparkles,
  Tag,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const TITLE_TIPS = [
  'Should the UK nationalise the railways?',
  'Will AI replace most white-collar jobs by 2030?',
  'Should voting be mandatory?',
  'Is nuclear energy essential for net-zero?',
  'Should social media platforms be regulated as utilities?',
]

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1 rounded-full flex-1 transition-all duration-300',
            i < step ? 'bg-for-500' : i === step ? 'bg-for-500/60' : 'bg-surface-300'
          )}
        />
      ))}
      <span className="text-xs text-surface-400 shrink-0 ml-1">
        {step + 1}/{total}
      </span>
    </div>
  )
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  title: string
  description: string
  category: string
  resolution_criteria: string
  estimated_settlement_date: string
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProposeClient() {
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    category: '',
    resolution_criteria: '',
    estimated_settlement_date: '',
  })

  const update = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const canAdvanceStep0 = form.title.trim().length >= 10
  const canSubmit = canAdvanceStep0

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/exchange/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          category: form.category || null,
          resolution_criteria: form.resolution_criteria.trim() || null,
          estimated_settlement_date: form.estimated_settlement_date || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to submit')
      }
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-lg mx-auto px-4 pt-20 pb-28">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-for-500/10 border border-for-500/30 mb-6">
              <CheckCircle2 className="w-8 h-8 text-for-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Proposal submitted!</h2>
            <p className="text-surface-400 text-sm leading-relaxed max-w-sm mx-auto mb-8">
              Your market proposal is now live. The community can upvote it — top proposals become live Exchange markets.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/exchange/proposals">
                <Button variant="for">
                  <Lightbulb className="w-4 h-4" />
                  View all proposals
                </Button>
              </Link>
              <Button
                variant="secondary"
                onClick={() => {
                  setSubmitted(false)
                  setStep(0)
                  setForm({ title: '', description: '', category: '', resolution_criteria: '', estimated_settlement_date: '' })
                }}
              >
                <PenLine className="w-4 h-4" />
                Propose another
              </Button>
            </div>
          </motion.div>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-lg mx-auto px-4 pt-20 pb-28">
        {/* Back */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/exchange/proposals" className="p-2 rounded-lg hover:bg-surface-200 transition-colors">
            <ArrowLeft className="w-4 h-4 text-surface-400" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-gold" />
              Propose a Market
            </h1>
            <p className="text-xs text-surface-400 mt-0.5">
              Suggest a new civic prediction market for the Exchange
            </p>
          </div>
        </div>

        <StepIndicator step={step} total={3} />

        <AnimatePresence mode="wait">
          {/* ── Step 0: The question ─────────────────────────────────────────── */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div>
                <label className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-for-400" />
                  The market question
                </label>
                <p className="text-xs text-surface-400 mb-3">
                  Frame it as a yes/no question about a real civic outcome. Be specific and unambiguous.
                </p>
                <textarea
                  value={form.title}
                  onChange={update('title')}
                  placeholder="Should the UK rejoin the EU single market?"
                  rows={3}
                  maxLength={200}
                  className="w-full bg-surface-100 border border-surface-200 rounded-xl px-4 py-3 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/20 resize-none transition-all"
                />
                <div className="flex justify-between mt-1">
                  <span className={cn(
                    'text-xs',
                    form.title.length < 10 ? 'text-surface-500' : 'text-for-400'
                  )}>
                    {form.title.length}/200 · min 10 chars
                  </span>
                  {form.title.length >= 10 && (
                    <span className="text-xs text-for-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Good
                    </span>
                  )}
                </div>
              </div>

              {/* Tips */}
              <div className="rounded-xl border border-surface-200 bg-surface-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-3.5 h-3.5 text-gold" />
                  <span className="text-xs font-semibold text-gold">Examples of good market questions</span>
                </div>
                <ul className="space-y-1">
                  {TITLE_TIPS.map((t) => (
                    <li key={t}>
                      <button
                        onClick={() => setForm((f) => ({ ...f, title: t }))}
                        className="text-xs text-surface-400 hover:text-white transition-colors text-left"
                      >
                        · {t}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                variant="for"
                className="w-full"
                disabled={!canAdvanceStep0}
                onClick={() => setStep(1)}
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {/* ── Step 1: Category + resolution + date ─────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              {/* Category */}
              <div>
                <label className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-for-400" />
                  Category <span className="text-surface-500 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowCategoryMenu((s) => !s)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border text-sm transition-all',
                      form.category
                        ? 'border-for-500/40 bg-for-500/10 text-for-400'
                        : 'border-surface-200 bg-surface-100 text-surface-500 hover:border-surface-300'
                    )}
                  >
                    {form.category || 'Select a category'}
                    <ChevronDown className={cn('w-4 h-4 transition-transform', showCategoryMenu && 'rotate-180')} />
                  </button>
                  <AnimatePresence>
                    {showCategoryMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute top-full left-0 right-0 mt-1 bg-surface-100 border border-surface-200 rounded-xl shadow-xl z-20 py-1 max-h-52 overflow-y-auto"
                      >
                        <button
                          onClick={() => { setForm((f) => ({ ...f, category: '' })); setShowCategoryMenu(false) }}
                          className="w-full text-left px-4 py-2 text-sm text-surface-400 hover:bg-surface-200"
                        >
                          No category
                        </button>
                        {CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => { setForm((f) => ({ ...f, category: cat })); setShowCategoryMenu(false) }}
                            className={cn(
                              'w-full text-left px-4 py-2 text-sm hover:bg-surface-200 transition-colors',
                              form.category === cat ? 'text-for-400' : 'text-surface-400'
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Resolution criteria */}
              <div>
                <label className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-for-400" />
                  Resolution criteria <span className="text-surface-500 font-normal">(optional)</span>
                </label>
                <p className="text-xs text-surface-400 mb-2">
                  When would this market settle YES? What event or threshold defines the outcome?
                </p>
                <textarea
                  value={form.resolution_criteria}
                  onChange={update('resolution_criteria')}
                  placeholder="Resolves YES if UK Parliament passes legislation rejoining the single market by 2027."
                  rows={3}
                  maxLength={500}
                  className="w-full bg-surface-100 border border-surface-200 rounded-xl px-4 py-3 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/20 resize-none transition-all"
                />
                <span className="text-xs text-surface-500 mt-1 block text-right">{form.resolution_criteria.length}/500</span>
              </div>

              {/* Settlement date */}
              <div>
                <label className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-for-400" />
                  Estimated settlement date <span className="text-surface-500 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={form.estimated_settlement_date}
                  onChange={update('estimated_settlement_date')}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full bg-surface-100 border border-surface-200 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/20 transition-all"
                />
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep(0)} className="flex-1">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button variant="for" onClick={() => setStep(2)} className="flex-1">
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Description + review ─────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              {/* Description */}
              <div>
                <label className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                  <PenLine className="w-4 h-4 text-for-400" />
                  Why should this be a market? <span className="text-surface-500 font-normal">(optional)</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={update('description')}
                  placeholder="This is a high-stakes policy question with a clear binary outcome and significant public interest. It directly affects..."
                  rows={4}
                  maxLength={1000}
                  className="w-full bg-surface-100 border border-surface-200 rounded-xl px-4 py-3 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/20 resize-none transition-all"
                />
                <span className="text-xs text-surface-500 mt-1 block text-right">{form.description.length}/1000</span>
              </div>

              {/* Review card */}
              <div className="rounded-xl border border-surface-200 bg-surface-100 p-4 space-y-3">
                <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                  Your proposal
                </h3>

                <div>
                  <p className="text-sm font-semibold text-white leading-snug">{form.title}</p>
                </div>

                {(form.category || form.estimated_settlement_date) && (
                  <div className="flex flex-wrap gap-3 text-xs text-surface-400">
                    {form.category && (
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {form.category}
                      </span>
                    )}
                    {form.estimated_settlement_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Settles {new Date(form.estimated_settlement_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                )}

                {form.resolution_criteria && (
                  <div className="rounded-md bg-surface-200 px-2.5 py-2 text-xs text-surface-400">
                    <span className="text-surface-500 font-medium">Resolves when: </span>
                    {form.resolution_criteria}
                  </div>
                )}

                {form.description && (
                  <p className="text-xs text-surface-400 leading-relaxed">{form.description}</p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-against-500/10 border border-against-500/20">
                  <X className="w-4 h-4 text-against-400 shrink-0" />
                  <p className="text-xs text-against-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setStep(1)} className="flex-1" disabled={loading}>
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
                <Button
                  variant="for"
                  onClick={handleSubmit}
                  disabled={loading || !canSubmit}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-4 h-4" />
                      Submit proposal
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
