'use client'

/**
 * /bills/introduce — Introduce a New Civic Bill
 *
 * A three-step form for formally introducing a bill to the Civic Parliament.
 * Step 1: Bill type (private member / opposition / government / lords)
 * Step 2: Title — short title + long title (preamble)
 * Step 3: Category + optional topic link + review
 *
 * On submit the bill enters at First Reading. The sponsor can then
 * request a Second Reading debate via the bill detail page.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Crown,
  FileText,
  Gavel,
  Loader2,
  ScrollText,
  Search,
  Shield,
  Users,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import type { IntroduceBillResponse } from '@/app/api/bills/route'

// ─── Constants ─────────────────────────────────────────────────────────────────

const BILL_TYPES: Array<{
  id: string
  label: string
  sublabel: string
  icon: React.ReactNode
  color: string
  border: string
  bg: string
}> = [
  {
    id: 'private_members',
    label: 'Private Member\'s Bill',
    sublabel: 'Introduced by an individual citizen — any member may sponsor legislation.',
    icon: <FileText className="h-5 w-5" />,
    color: 'text-purple',
    border: 'border-purple/40',
    bg: 'bg-purple/10',
  },
  {
    id: 'opposition',
    label: 'Opposition Bill',
    sublabel: 'Introduced by an opposition coalition challenging the governing stance.',
    icon: <Users className="h-5 w-5" />,
    color: 'text-against-400',
    border: 'border-against-700/50',
    bg: 'bg-against-900/20',
  },
  {
    id: 'government',
    label: 'Government Bill',
    sublabel: 'Official legislation from the governing coalition or a civic institution.',
    icon: <Shield className="h-5 w-5" />,
    color: 'text-for-400',
    border: 'border-for-700/50',
    bg: 'bg-for-900/20',
  },
  {
    id: 'lords',
    label: "Lords' Bill",
    sublabel: 'Introduced in the House of Lords by a distinguished Elder citizen.',
    icon: <Crown className="h-5 w-5" />,
    color: 'text-gold',
    border: 'border-gold/40',
    bg: 'bg-gold/10',
  },
]

const CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
  'Law', 'Other',
]

const CATEGORY_COLORS: Record<string, string> = {
  Politics:    'text-for-400',
  Economics:   'text-gold',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-for-300',
  Culture:     'text-pink-400',
  Health:      'text-red-400',
  Environment: 'text-emerald',
  Education:   'text-amber-400',
  Law:         'text-gold',
  Other:       'text-surface-400',
}

// ─── Step indicators ──────────────────────────────────────────────────────────

function StepBar({ step }: { step: number }) {
  const steps = ['Bill Type', 'Title', 'Details']
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => {
        const idx = i + 1
        const done = step > idx
        const active = step === idx
        return (
          <div key={label} className="flex items-center gap-2 flex-1 min-w-0">
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
              done  ? 'bg-for-600 text-white'
              : active ? 'bg-surface-700 border border-for-500 text-white'
              : 'bg-surface-800 border border-surface-700 text-surface-500'
            )}>
              {done ? <Check className="h-3 w-3" /> : idx}
            </div>
            <span className={cn(
              'text-xs truncate',
              active ? 'text-white font-medium' : done ? 'text-surface-400' : 'text-surface-600'
            )}>
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className={cn(
                'h-px flex-1 mx-1',
                step > idx ? 'bg-for-600' : 'bg-surface-700'
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Topic search ──────────────────────────────────────────────────────────────

interface TopicResult {
  id: string
  statement: string
  category: string
  status: string
}

function TopicSearch({
  value,
  onSelect,
  onClear,
}: {
  value: TopicResult | null
  onSelect: (t: TopicResult) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TopicResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/topics/browse?q=${encodeURIComponent(q)}&limit=6`)
      if (res.ok) {
        const data = await res.json() as { topics: TopicResult[] }
        setResults(data.topics ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  if (value) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-for-700/50 bg-for-900/20 p-3">
        <Gavel className="h-4 w-4 text-for-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium leading-snug">{value.statement}</p>
          <p className="text-xs text-surface-400 mt-0.5">{value.category} · {value.status}</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-surface-500 hover:text-white transition-colors"
          aria-label="Remove linked topic"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search topics by keyword…"
          className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-surface-800 border border-surface-700 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-for-500 transition-colors"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />
        )}
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-10 top-full mt-1 w-full rounded-lg border border-surface-700 bg-surface-900 shadow-xl overflow-hidden"
          >
            {results.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { onSelect(t); setQuery(''); setOpen(false); setResults([]) }}
                className="w-full text-left px-4 py-2.5 hover:bg-surface-800 transition-colors border-b border-surface-800 last:border-0"
              >
                <p className="text-sm text-white leading-snug line-clamp-1">{t.statement}</p>
                <p className="text-xs text-surface-500 mt-0.5">{t.category} · {t.status}</p>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IntroduceClient() {
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [billType, setBillType] = useState<string | null>(null)
  const [shortTitle, setShortTitle] = useState('')
  const [longTitle, setLongTitle] = useState('')
  const [category, setCategory] = useState('Politics')
  const [linkedTopic, setLinkedTopic] = useState<TopicResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const shortTitleLen = shortTitle.trim().length
  const longTitleLen = longTitle.trim().length

  const canGoStep2 = !!billType
  const canGoStep3 = shortTitleLen >= 5 && shortTitleLen <= 80 && longTitleLen >= 10 && longTitleLen <= 300

  async function submit() {
    if (!billType || !canGoStep3) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          short_title: shortTitle.trim(),
          long_title: longTitle.trim(),
          category,
          bill_type: billType,
          topic_id: linkedTopic?.id ?? null,
        }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to introduce bill')
      }
      const bill = await res.json() as IntroduceBillResponse
      setSuccess(true)
      setTimeout(() => router.push(`/bills/${bill.id}`), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-surface-950 flex flex-col">
        <TopBar />
        <main className="flex-1 flex items-center justify-center px-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center max-w-sm"
          >
            <div className="w-16 h-16 rounded-full bg-for-900/40 border border-for-700/50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-for-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Bill Introduced</h2>
            <p className="text-surface-400 text-sm">
              Your bill has been formally introduced at First Reading. Redirecting to the bill record…
            </p>
          </motion.div>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      <TopBar />

      <main className="flex-1 pb-24">
        <div className="max-w-xl mx-auto px-4 pt-4">

          {/* Back link */}
          <Link
            href="/bills"
            className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors mb-5"
          >
            <ArrowLeft className="h-4 w-4" />
            Civic Bills
          </Link>

          {/* Page header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
              <ScrollText className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Introduce a Bill</h1>
              <p className="text-xs text-surface-400">Formally table new legislation before the Civic Parliament</p>
            </div>
          </div>

          {/* Step bar */}
          <StepBar step={step} />

          {/* Step content */}
          <AnimatePresence mode="wait">
            {/* ── Step 1: Bill type ── */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
              >
                <h2 className="text-sm font-semibold text-white mb-1">What type of bill is this?</h2>
                <p className="text-xs text-surface-400 mb-4">
                  Bill type determines how it is introduced and who sponsors it in Parliament.
                </p>

                <div className="space-y-3">
                  {BILL_TYPES.map((bt) => (
                    <button
                      key={bt.id}
                      type="button"
                      onClick={() => setBillType(bt.id)}
                      className={cn(
                        'w-full text-left rounded-xl border p-4 transition-all flex items-start gap-3',
                        billType === bt.id
                          ? `${bt.border} ${bt.bg}`
                          : 'border-surface-700/50 bg-surface-900 hover:border-surface-600'
                      )}
                    >
                      <div className={cn('mt-0.5 shrink-0', bt.color)}>{bt.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn('text-sm font-semibold', billType === bt.id ? bt.color : 'text-white')}>
                            {bt.label}
                          </span>
                          {billType === bt.id && (
                            <Check className={cn('h-4 w-4 shrink-0', bt.color)} />
                          )}
                        </div>
                        <p className="text-xs text-surface-400 mt-0.5 leading-relaxed">{bt.sublabel}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={() => setStep(2)}
                    disabled={!canGoStep2}
                    className="flex items-center gap-2"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Titles ── */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                className="space-y-5"
              >
                <div>
                  <label className="block text-sm font-semibold text-white mb-1">
                    Short Title
                    <span className="ml-1 text-xs font-normal text-surface-500">(5–80 chars)</span>
                  </label>
                  <p className="text-xs text-surface-400 mb-2">
                    The official name of the bill — used in Parliament and on the order paper.
                    Example: <em className="text-surface-300">Universal Basic Infrastructure Bill</em>
                  </p>
                  <div className="relative">
                    <input
                      type="text"
                      value={shortTitle}
                      onChange={(e) => setShortTitle(e.target.value)}
                      placeholder="e.g. Digital Rights and Privacy Bill"
                      maxLength={80}
                      className={cn(
                        'w-full px-4 py-3 rounded-lg bg-surface-800 border text-sm text-white placeholder-surface-500 focus:outline-none transition-colors',
                        shortTitleLen > 0 && shortTitleLen < 5
                          ? 'border-against-700 focus:border-against-500'
                          : shortTitleLen >= 5
                          ? 'border-for-700/50 focus:border-for-500'
                          : 'border-surface-700 focus:border-for-500'
                      )}
                    />
                    <span className={cn(
                      'absolute right-3 bottom-3 text-xs',
                      shortTitleLen > 75 ? 'text-against-400' : 'text-surface-500'
                    )}>
                      {shortTitleLen}/80
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-1">
                    Long Title
                    <span className="ml-1 text-xs font-normal text-surface-500">(10–300 chars)</span>
                  </label>
                  <p className="text-xs text-surface-400 mb-2">
                    The formal preamble: what the bill will do and its purpose. Begins with{' '}
                    <em className="text-surface-300">&ldquo;A Bill to&hellip;&rdquo;</em>
                  </p>
                  <div className="relative">
                    <textarea
                      value={longTitle}
                      onChange={(e) => setLongTitle(e.target.value)}
                      placeholder="A Bill to establish universal minimum standards for digital infrastructure and ensure equitable access for all citizens regardless of location."
                      maxLength={300}
                      rows={4}
                      className={cn(
                        'w-full px-4 py-3 rounded-lg bg-surface-800 border text-sm text-white placeholder-surface-500 focus:outline-none transition-colors resize-none',
                        longTitleLen > 0 && longTitleLen < 10
                          ? 'border-against-700 focus:border-against-500'
                          : longTitleLen >= 10
                          ? 'border-for-700/50 focus:border-for-500'
                          : 'border-surface-700 focus:border-for-500'
                      )}
                    />
                    <span className={cn(
                      'absolute right-3 bottom-3 text-xs',
                      longTitleLen > 280 ? 'text-against-400' : 'text-surface-500'
                    )}>
                      {longTitleLen}/300
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <Button variant="secondary" onClick={() => setStep(1)} className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={!canGoStep3}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* ── Step 3: Details + review ── */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                className="space-y-5"
              >
                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs border transition-colors',
                          category === cat
                            ? 'bg-surface-700 text-white border-surface-600'
                            : 'border-surface-700/50 text-surface-400 hover:text-white hover:border-surface-600'
                        )}
                      >
                        <span className={category === cat ? CATEGORY_COLORS[cat] : ''}>{cat}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional topic link */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-1">
                    Link to a Topic
                    <span className="ml-1 text-xs font-normal text-surface-500">(optional)</span>
                  </label>
                  <p className="text-xs text-surface-400 mb-2">
                    Connect this bill to an existing civic debate. Topics that passed voting are prime candidates.
                  </p>
                  <TopicSearch
                    value={linkedTopic}
                    onSelect={setLinkedTopic}
                    onClear={() => setLinkedTopic(null)}
                  />
                </div>

                {/* Review summary */}
                <div className="rounded-xl border border-surface-700/50 bg-surface-900 p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Bill Summary</h3>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-surface-500 w-20 shrink-0">Type</span>
                      <span className="text-xs text-white font-medium">
                        {BILL_TYPES.find((bt) => bt.id === billType)?.label ?? billType}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-surface-500 w-20 shrink-0">Short title</span>
                      <span className="text-xs text-white">{shortTitle.trim()}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-surface-500 w-20 shrink-0">Long title</span>
                      <span className="text-xs text-surface-300 leading-relaxed line-clamp-3">{longTitle.trim()}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-surface-500 w-20 shrink-0">Category</span>
                      <span className={cn('text-xs font-medium', CATEGORY_COLORS[category])}>{category}</span>
                    </div>
                    {linkedTopic && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-surface-500 w-20 shrink-0">Topic</span>
                        <span className="text-xs text-surface-300 line-clamp-1">{linkedTopic.statement}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-surface-500 w-20 shrink-0">Stage</span>
                      <span className="text-xs text-surface-400">First Reading (introduction only — no vote)</span>
                    </div>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-against-700/50 bg-against-900/20 p-3">
                    <AlertCircle className="h-4 w-4 text-against-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-against-300">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <Button variant="secondary" onClick={() => setStep(2)} className="flex items-center gap-2" disabled={submitting}>
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={submit}
                    disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Introducing…
                      </>
                    ) : (
                      <>
                        <ScrollText className="h-4 w-4" />
                        Introduce Bill
                      </>
                    )}
                  </Button>
                </div>

                {/* Parliament note */}
                <p className="text-xs text-surface-500 text-center leading-relaxed">
                  By introducing this bill you agree to abide by Lobby Market&apos;s{' '}
                  <Link href="/guidelines" className="text-for-400 hover:text-for-300">Community Guidelines</Link>.
                  Bills must serve a genuine civic purpose.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Parliamentary note at bottom */}
          <div className="mt-8 rounded-lg border border-surface-800 bg-surface-900/50 p-4">
            <h3 className="text-xs font-semibold text-surface-300 mb-2 flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-surface-500" />
              What happens next?
            </h3>
            <ol className="space-y-1.5 text-xs text-surface-400 list-none pl-0">
              {[
                'Your bill is formally introduced at First Reading — the title is read, no vote takes place.',
                'Request a Second Reading debate from the bill detail page once introduced.',
                'Citizens vote FOR or AGAINST at Second and Third Reading.',
                'Successful bills pass to Committee, Report, then Third Reading.',
                'After Third Reading the Lords review — then Royal Assent.',
              ].map((note, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-surface-600 font-mono shrink-0">{i + 1}.</span>
                  {note}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
