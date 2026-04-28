'use client'

/**
 * /capsule — Civic Time Capsules
 *
 * Users write time-locked messages or predictions tied to platform topics.
 * On the reveal date, prediction capsules are automatically scored against
 * the topic's outcome — correct predictions earn Clout.
 *
 * Distinct from /predictions (market-style staking) — this is a personal
 * journal + oracle: write your true belief, seal it, and see if history
 * proves you right.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Coins,
  ExternalLink,
  Hourglass,
  Lock,
  LockOpen,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Search,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Unlock,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CapsuleRow, CapsulesResponse } from '@/app/api/capsules/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_MSG = 500
const REVEAL_OPTIONS = [
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 91 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countdown(isoTarget: string): string {
  const diff = new Date(isoTarget).getTime() - Date.now()
  if (diff <= 0) return 'Now'
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function relativeDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
}

interface TopicResult {
  id: string
  statement: string
  category: string | null
  status: string
}

// ─── Topic search ─────────────────────────────────────────────────────────────

function TopicPicker({
  value,
  onChange,
}: {
  value: TopicResult | null
  onChange: (t: TopicResult | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TopicResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&type=topic&limit=8`
        )
        const d = await r.json()
        setResults(
          (d.topics ?? []).map((t: TopicResult) => ({
            id: t.id,
            statement: t.statement,
            category: t.category,
            status: t.status,
          }))
        )
      } catch {
        //
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query])

  if (value) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white leading-snug line-clamp-2">
            {value.statement}
          </p>
          <p className="text-[11px] text-surface-500 mt-0.5">
            {value.category ?? 'Uncategorized'} ·{' '}
            <span className="capitalize">{value.status}</span>
          </p>
        </div>
        <button
          onClick={() => onChange(null)}
          className="flex-shrink-0 h-5 w-5 rounded flex items-center justify-center text-surface-500 hover:text-white hover:bg-surface-300/60 transition-colors"
          aria-label="Remove linked topic"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-200/60 border border-surface-300/60 focus-within:border-surface-400">
        <Search className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
        <input
          type="text"
          placeholder="Search for a topic…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          className="flex-1 bg-transparent text-xs text-white placeholder:text-surface-500 outline-none"
        />
        {loading && <Loader2 className="h-3 w-3 text-surface-500 animate-spin" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-20 top-full mt-1 w-full rounded-xl border border-surface-300/60 bg-surface-100 shadow-xl overflow-hidden">
          {results.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                onChange(t)
                setQuery('')
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2.5 hover:bg-surface-200/60 transition-colors border-b border-surface-300/30 last:border-0"
            >
              <p className="text-xs font-medium text-white line-clamp-1">
                {t.statement}
              </p>
              <p className="text-[10px] text-surface-500 mt-0.5">
                {t.category ?? 'Uncategorized'} · <span className="capitalize">{t.status}</span>
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sealed capsule card ──────────────────────────────────────────────────────

function SealedCard({ capsule }: { capsule: CapsuleRow }) {
  const isReady = new Date(capsule.reveal_at) <= new Date()
  const [revealing, setRevealing] = useState(false)
  const [revealed, setRevealed] = useState(false)

  async function handleReveal() {
    setRevealing(true)
    try {
      const r = await fetch(`/api/capsules/${capsule.id}/reveal`, {
        method: 'PATCH',
      })
      if (r.ok) {
        setRevealed(true)
        window.location.reload()
      }
    } finally {
      setRevealing(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-4 transition-all',
        isReady
          ? 'border-gold/40 bg-gold/5 shadow-[0_0_20px_rgba(245,158,11,0.07)]'
          : 'border-surface-300/60 bg-surface-100'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl border',
            isReady
              ? 'bg-gold/15 border-gold/40 text-gold'
              : 'bg-surface-200 border-surface-300/60 text-surface-400'
          )}
        >
          {isReady ? (
            <Unlock className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isReady ? (
              <span className="text-[11px] font-mono font-semibold text-gold uppercase tracking-wider">
                Ready to open
              </span>
            ) : (
              <span className="text-[11px] font-mono font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-1">
                <Timer className="h-3 w-3" />
                {countdown(capsule.reveal_at)}
              </span>
            )}
            <span className="text-[10px] text-surface-600">·</span>
            <span className="text-[10px] text-surface-500">
              Sealed {relativeDate(capsule.created_at)}
            </span>
          </div>

          {/* Blurred message until revealed */}
          <div
            className={cn(
              'text-sm text-white leading-relaxed font-mono',
              !isReady && 'blur-[3px] select-none pointer-events-none'
            )}
          >
            {isReady ? `"${capsule.message}"` : capsule.message}
          </div>

          {capsule.topic && (
            <div className="mt-2 flex items-center gap-1.5">
              {capsule.prediction_side === 'pass' ? (
                <ThumbsUp className="h-3 w-3 text-for-400" />
              ) : capsule.prediction_side === 'fail' ? (
                <ThumbsDown className="h-3 w-3 text-against-400" />
              ) : (
                <Scale className="h-3 w-3 text-surface-500" />
              )}
              <span className="text-[11px] text-surface-400 line-clamp-1">
                {capsule.topic.statement.slice(0, 60)}
                {capsule.topic.statement.length > 60 ? '…' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {isReady && !revealed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 pt-3 border-t border-gold/20"
        >
          <button
            onClick={handleReveal}
            disabled={revealing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gold/20 border border-gold/40 text-gold text-sm font-semibold hover:bg-gold/30 transition-all disabled:opacity-50"
          >
            {revealing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LockOpen className="h-4 w-4" />
            )}
            Reveal Capsule
          </button>
        </motion.div>
      )}
    </motion.div>
  )
}

// ─── Revealed capsule card ────────────────────────────────────────────────────

function RevealedCard({ capsule }: { capsule: CapsuleRow }) {
  const outcome = capsule.outcome
  const hasPrediction = !!capsule.prediction_side

  const outcomeConfig = {
    correct: {
      icon: CheckCircle2,
      text: 'Correct prediction',
      color: 'text-emerald',
      bg: 'bg-emerald/10',
      border: 'border-emerald/30',
    },
    wrong: {
      icon: XCircle,
      text: 'Wrong prediction',
      color: 'text-against-400',
      bg: 'bg-against-500/10',
      border: 'border-against-500/30',
    },
    pending: {
      icon: Clock,
      text: 'Topic unresolved',
      color: 'text-surface-400',
      bg: 'bg-surface-200',
      border: 'border-surface-300/60',
    },
  }

  const oc = outcome ? outcomeConfig[outcome] : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-surface-300/40 bg-surface-100 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300/60 text-surface-400">
          <LockOpen className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] text-surface-500">
              Opened {relativeDate(capsule.reveal_at)}
            </span>
            {capsule.clout_awarded && (
              <span className="flex items-center gap-0.5 text-[10px] text-gold font-mono font-semibold">
                <Coins className="h-2.5 w-2.5" />+{capsule.clout_awarded} Clout
              </span>
            )}
          </div>

          <p className="text-sm text-white/80 leading-relaxed font-mono italic">
            &ldquo;{capsule.message}&rdquo;
          </p>

          {hasPrediction && capsule.topic && (
            <div className="mt-3 space-y-2">
              <Link
                href={`/topic/${capsule.topic.id}`}
                className="flex items-center gap-1.5 text-[11px] text-surface-400 hover:text-white transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                <span className="line-clamp-1">
                  {capsule.topic.statement.slice(0, 60)}
                  {capsule.topic.statement.length > 60 ? '…' : ''}
                </span>
              </Link>

              {oc && (
                <div
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold',
                    oc.color,
                    oc.bg,
                    oc.border
                  )}
                >
                  <oc.icon className="h-3 w-3" />
                  {oc.text}
                  {outcome === 'pending' && (
                    <span className="font-normal text-surface-500">
                      — check back later
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Compose modal ────────────────────────────────────────────────────────────

function ComposeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [message, setMessage] = useState('')
  const [revealDays, setRevealDays] = useState(30)
  const [topic, setTopic] = useState<TopicResult | null>(null)
  const [predictionSide, setPredictionSide] = useState<'pass' | 'fail' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Clear prediction side when topic is removed
  useEffect(() => {
    if (!topic) setPredictionSide(null)
  }, [topic])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    setSubmitting(true)
    setError(null)

    const reveal_at = new Date()
    reveal_at.setDate(reveal_at.getDate() + revealDays)

    try {
      const r = await fetch('/api/capsules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          reveal_at: reveal_at.toISOString(),
          topic_id: topic?.id ?? null,
          prediction_side: predictionSide,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        setError(d.error ?? 'Failed to seal capsule')
      } else {
        onCreated()
        onClose()
      }
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="w-full max-w-lg rounded-2xl border border-surface-300/60 bg-surface-50 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300/40">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-gold/15 border border-gold/30">
              <Lock className="h-4 w-4 text-gold" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Seal a Time Capsule</h2>
              <p className="text-[11px] text-surface-500">Write it. Lock it. See if you&apos;re right.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-surface-500 hover:text-white hover:bg-surface-300/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Message */}
          <div>
            <label className="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">
              Your message
            </label>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_MSG))}
              placeholder="Write a prediction, reflection, or message to your future self…"
              rows={4}
              className="w-full bg-surface-200/60 border border-surface-300/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-surface-500 outline-none resize-none focus:border-surface-400 transition-colors"
            />
            <div className="text-right mt-1">
              <span
                className={cn(
                  'text-[10px] font-mono',
                  message.length > MAX_MSG * 0.9
                    ? 'text-against-400'
                    : 'text-surface-500'
                )}
              >
                {message.length}/{MAX_MSG}
              </span>
            </div>
          </div>

          {/* Reveal date */}
          <div>
            <label className="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">
              Reveal in
            </label>
            <div className="flex gap-2">
              {REVEAL_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setRevealDays(opt.days)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                    revealDays === opt.days
                      ? 'bg-for-500/20 border-for-500/50 text-for-300'
                      : 'bg-surface-200/60 border-surface-300/60 text-surface-400 hover:border-surface-400/60'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional topic link */}
          <div>
            <label className="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">
              Link to a topic{' '}
              <span className="text-surface-600 font-normal normal-case">
                (optional)
              </span>
            </label>
            <TopicPicker value={topic} onChange={setTopic} />
          </div>

          {/* Prediction side (only if topic linked) */}
          {topic && (
            <div>
              <label className="block text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">
                Prediction
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPredictionSide(predictionSide === 'pass' ? null : 'pass')
                  }
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition-all',
                    predictionSide === 'pass'
                      ? 'bg-for-500/20 border-for-500/50 text-for-300'
                      : 'bg-surface-200/60 border-surface-300/60 text-surface-400 hover:border-surface-400/60'
                  )}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  Will Pass
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPredictionSide(
                      predictionSide === 'fail' ? null : 'fail'
                    )
                  }
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition-all',
                    predictionSide === 'fail'
                      ? 'bg-against-500/20 border-against-500/50 text-against-300'
                      : 'bg-surface-200/60 border-surface-300/60 text-surface-400 hover:border-surface-400/60'
                  )}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                  Will Fail
                </button>
              </div>
              {predictionSide && (
                <p className="text-[10px] text-surface-500 mt-1.5">
                  Correct predictions earn{' '}
                  <span className="text-gold font-semibold">15 Clout</span> on
                  reveal.
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-against-400 font-mono">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !message.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gold/20 border border-gold/40 text-gold font-semibold text-sm hover:bg-gold/30 transition-all disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            Seal Capsule
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CapsuleSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-surface-300/40 bg-surface-100 p-4"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CapsulePage() {
  const router = useRouter()
  const [data, setData] = useState<CapsulesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)
  const [tab, setTab] = useState<'sealed' | 'revealed'>('sealed')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/capsules')
      if (r.status === 401) {
        router.push('/login?redirect=/capsule')
        return
      }
      if (r.ok) {
        const d = await r.json()
        setData(d as CapsulesResponse)
      }
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const totalCapsules = (data?.sealed.length ?? 0) + (data?.revealed.length ?? 0)
  const correctCount = data?.revealed.filter((c) => c.outcome === 'correct').length ?? 0
  const pendingReveal = data?.sealed.filter(
    (c) => new Date(c.reveal_at) <= new Date()
  ).length ?? 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="h-8 w-8 flex items-center justify-center rounded-xl border border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gold/15 border border-gold/30">
              <Hourglass className="h-4 w-4 text-gold" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">
                Civic Time Capsules
              </h1>
              <p className="text-[11px] text-surface-500">
                Write it. Seal it. See if history proves you right.
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={load}
              className="h-8 w-8 flex items-center justify-center rounded-xl border border-surface-300/60 text-surface-500 hover:text-white transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
            <button
              onClick={() => setComposing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gold/20 border border-gold/40 text-gold text-xs font-semibold hover:bg-gold/30 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              New Capsule
            </button>
          </div>
        </div>

        {/* Stats strip */}
        {!loading && totalCapsules > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            <div className="rounded-xl border border-surface-300/40 bg-surface-100 p-3 text-center">
              <div className="text-lg font-bold text-white font-mono">
                {data?.sealed.length ?? 0}
              </div>
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mt-0.5">
                Sealed
              </div>
            </div>
            <div className="rounded-xl border border-surface-300/40 bg-surface-100 p-3 text-center">
              <div className="text-lg font-bold text-white font-mono">
                {data?.revealed.length ?? 0}
              </div>
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mt-0.5">
                Opened
              </div>
            </div>
            <div className="rounded-xl border border-emerald/20 bg-emerald/5 p-3 text-center">
              <div className="text-lg font-bold text-emerald font-mono">
                {correctCount}
              </div>
              <div className="text-[10px] text-surface-500 uppercase tracking-wider mt-0.5">
                Correct
              </div>
            </div>
          </motion.div>
        )}

        {/* Ready-to-reveal banner */}
        {pendingReveal > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-5 flex items-center gap-3 p-3.5 rounded-xl bg-gold/10 border border-gold/30"
          >
            <Unlock className="h-4 w-4 text-gold flex-shrink-0" />
            <p className="text-sm text-gold font-semibold flex-1">
              {pendingReveal === 1
                ? '1 capsule is ready to open!'
                : `${pendingReveal} capsules are ready to open!`}
            </p>
            <button
              onClick={() => setTab('sealed')}
              className="text-[11px] text-gold/70 font-mono hover:text-gold transition-colors"
            >
              View
            </button>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface-200/60 border border-surface-300/40 mb-5">
          {(
            [
              { id: 'sealed', label: 'Sealed', count: data?.sealed.length ?? 0 },
              { id: 'revealed', label: 'Opened', count: data?.revealed.length ?? 0 },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                tab === t.id
                  ? 'bg-surface-100 text-white border border-surface-300/60'
                  : 'text-surface-500 hover:text-white'
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className={cn(
                    'flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full text-[10px] font-mono',
                    tab === t.id
                      ? 'bg-surface-300/60 text-white'
                      : 'bg-surface-300/40 text-surface-500'
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <CapsuleSkeleton />
        ) : (
          <AnimatePresence mode="wait">
            {tab === 'sealed' && (
              <motion.div
                key="sealed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {(data?.sealed.length ?? 0) === 0 ? (
                  <EmptyState
                    icon={Lock}
                    iconColor="text-surface-400"
                    iconBg="bg-surface-200"
                    iconBorder="border-surface-300/60"
                    title="No sealed capsules"
                    description="Write a prediction or message to your future self. Seal it — the Lobby will hold it until it's time."
                    actions={[
                      {
                        label: 'Seal your first capsule',
                        onClick: () => setComposing(true),
                        variant: 'primary',
                        icon: Plus,
                      },
                    ]}
                  />
                ) : (
                  data!.sealed.map((c) => <SealedCard key={c.id} capsule={c} />)
                )}
              </motion.div>
            )}

            {tab === 'revealed' && (
              <motion.div
                key="revealed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {(data?.revealed.length ?? 0) === 0 ? (
                  <EmptyState
                    icon={LockOpen}
                    iconColor="text-surface-500"
                    iconBg="bg-surface-200"
                    iconBorder="border-surface-300/60"
                    title="No opened capsules yet"
                    description="Your revealed capsules will appear here, complete with prediction scores and Clout awards."
                  />
                ) : (
                  data!.revealed.map((c) => (
                    <RevealedCard key={c.id} capsule={c} />
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* How it works */}
        {!loading && totalCapsules === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 rounded-2xl border border-surface-300/30 bg-surface-100/50 p-5 space-y-4"
          >
            <h3 className="text-xs font-bold text-surface-400 uppercase tracking-wider">
              How it works
            </h3>
            <div className="space-y-3">
              {[
                {
                  icon: Lock,
                  color: 'text-gold',
                  bg: 'bg-gold/10 border-gold/20',
                  title: 'Write & seal',
                  desc: 'Write a message, reflection, or prediction. Choose when it unlocks — 1 week to 3 months.',
                },
                {
                  icon: Scale,
                  color: 'text-purple',
                  bg: 'bg-purple/10 border-purple/20',
                  title: 'Link to a debate',
                  desc: 'Optionally link to any active topic and predict whether it will pass or fail.',
                },
                {
                  icon: Zap,
                  color: 'text-emerald',
                  bg: 'bg-emerald/10 border-emerald/20',
                  title: 'Earn Clout for accuracy',
                  desc: 'Correct predictions earn 15 Clout on reveal. Wrong predictions? At least you tried.',
                },
              ].map((step) => (
                <div key={step.title} className="flex items-start gap-3">
                  <div
                    className={cn(
                      'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border',
                      step.bg
                    )}
                  >
                    <step.icon className={cn('h-4 w-4', step.color)} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {step.title}
                    </p>
                    <p className="text-[11px] text-surface-500 mt-0.5 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />

      {/* Compose modal */}
      <AnimatePresence>
        {composing && (
          <ComposeModal
            onClose={() => setComposing(false)}
            onCreated={load}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
