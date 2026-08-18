'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  CircleDot,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Scroll,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { Thesis, ThesisListResponse, ThesisCategory } from '@/lib/types/thesis'
import { THESIS_CATEGORIES } from '@/lib/types/thesis'

// ─── Constants ────────────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  economics: 'text-gold border-gold/40 bg-gold/10',
  politics: 'text-for-400 border-for-500/40 bg-for-500/10',
  technology: 'text-purple border-purple/40 bg-purple/10',
  science: 'text-emerald border-emerald/40 bg-emerald/10',
  ethics: 'text-against-400 border-against-500/40 bg-against-500/10',
  philosophy: 'text-surface-400 border-surface-400/40 bg-surface-300/20',
  culture: 'text-pink-400 border-pink-500/40 bg-pink-500/10',
  health: 'text-green-400 border-green-500/40 bg-green-500/10',
  environment: 'text-teal-400 border-teal-500/40 bg-teal-500/10',
  education: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
}

const STATUS_CONFIG = {
  active: {
    label: 'Active',
    icon: CircleDot,
    color: 'text-for-400',
    bg: 'bg-for-500/10 border-for-500/30',
  },
  vindicated: {
    label: 'Vindicated',
    icon: Trophy,
    color: 'text-gold',
    bg: 'bg-gold/10 border-gold/30',
  },
  refuted: {
    label: 'Refuted',
    icon: X,
    color: 'text-against-400',
    bg: 'bg-against-500/10 border-against-500/30',
  },
  expired: {
    label: 'Expired',
    icon: Clock,
    color: 'text-surface-500',
    bg: 'bg-surface-200 border-surface-300',
  },
}

type SortMode = 'newest' | 'oldest' | 'popular' | 'expiring'
type StatusFilter = 'active' | 'vindicated' | 'refuted' | 'expired'

// ─── Personal accuracy stats ──────────────────────────────────────────────────

interface MyStats {
  total: number
  active: number
  vindicated: number
  refuted: number
  expired: number
  accuracy: number | null
}

function computeStats(theses: Thesis[]): MyStats {
  const active = theses.filter((t) => t.status === 'active').length
  const vindicated = theses.filter((t) => t.status === 'vindicated').length
  const refuted = theses.filter((t) => t.status === 'refuted').length
  const expired = theses.filter((t) => t.status === 'expired').length
  const resolved = vindicated + refuted
  return {
    total: theses.length,
    active,
    vindicated,
    refuted,
    expired,
    accuracy: resolved > 0 ? Math.round((vindicated / resolved) * 100) : null,
  }
}

// ─── Thesis card (owner view) ─────────────────────────────────────────────────

function MyThesisCard({
  thesis,
  onResolve,
}: {
  thesis: Thesis
  onResolve: (id: string, status: 'vindicated' | 'refuted') => void
}) {
  const status = STATUS_CONFIG[thesis.status] ?? STATUS_CONFIG.expired
  const StatusIcon = status.icon
  const catColor =
    CAT_COLORS[thesis.category] ?? 'text-surface-400 border-surface-400/40 bg-surface-300/20'
  const [showResolve, setShowResolve] = useState(false)

  const daysLeft = thesis.resolution_date
    ? Math.ceil(
        (new Date(thesis.resolution_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null

  const total = thesis.agree_count + thesis.disagree_count
  const agreePct = total > 0 ? Math.round((thesis.agree_count / total) * 100) : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 p-5 transition-colors"
    >
      {/* Top row: category + status badges */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border capitalize',
            catColor
          )}
        >
          {thesis.category}
        </span>
        <div className="flex items-center gap-1.5">
          {daysLeft !== null && thesis.status === 'active' && (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-mono',
                daysLeft < 7
                  ? 'text-against-400'
                  : daysLeft < 30
                  ? 'text-gold'
                  : 'text-surface-500'
              )}
            >
              <Calendar className="h-2.5 w-2.5" />
              {daysLeft > 0 ? `${daysLeft}d left` : 'Overdue'}
            </span>
          )}
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
              status.bg,
              status.color
            )}
          >
            <StatusIcon className="h-2.5 w-2.5" />
            {status.label}
          </span>
        </div>
      </div>

      {/* Statement */}
      <p className="text-sm font-mono text-white leading-relaxed">{thesis.statement}</p>

      {/* Rationale */}
      {thesis.rationale && (
        <p className="text-xs font-mono text-surface-400 leading-relaxed line-clamp-2 mt-1.5">
          {thesis.rationale}
        </p>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5">
        <span className="text-[10px] font-mono text-surface-500">
          {new Date(thesis.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
        {thesis.resolved_at && thesis.status !== 'active' && (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500">
            <Check className="h-2.5 w-2.5" />
            Resolved{' '}
            {new Date(thesis.resolved_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        )}
        {thesis.related_topic_statement && (
          <Link
            href={`/topic/${thesis.related_topic_id}`}
            className="inline-flex items-center gap-1 text-[10px] font-mono text-purple hover:text-purple/80 transition-colors"
          >
            <Zap className="h-2.5 w-2.5" />
            <span className="truncate max-w-[160px]">
              {thesis.related_topic_statement.slice(0, 48)}
              {thesis.related_topic_statement.length > 48 ? '…' : ''}
            </span>
          </Link>
        )}
      </div>

      {/* Vote tally */}
      {total > 0 && (
        <div className="mt-3 space-y-1.5">
          {agreePct !== null && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-for-400 w-8 text-right">
                {agreePct}%
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-against-900/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-for-500 transition-all duration-500"
                  style={{ width: `${agreePct}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-against-400 w-8">
                {100 - agreePct}%
              </span>
            </div>
          )}
          <div className="flex gap-4 text-[11px] font-mono">
            <span className="text-for-400">
              <ThumbsUp className="h-3 w-3 inline mr-1" />
              {thesis.agree_count} agree
            </span>
            <span className="text-against-400">
              <ThumbsDown className="h-3 w-3 inline mr-1" />
              {thesis.disagree_count} disagree
            </span>
          </div>
        </div>
      )}

      {/* Resolve controls (only for active theses) */}
      {thesis.status === 'active' && (
        <div className="mt-3 pt-3 border-t border-surface-300">
          {showResolve ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono text-surface-500">Mark as:</span>
              <button
                onClick={() => {
                  onResolve(thesis.id, 'vindicated')
                  setShowResolve(false)
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gold/20 border border-gold/40 text-gold text-[11px] font-mono font-semibold hover:bg-gold/30 transition-colors"
              >
                <Trophy className="h-3 w-3" /> Vindicated
              </button>
              <button
                onClick={() => {
                  onResolve(thesis.id, 'refuted')
                  setShowResolve(false)
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-against-500/20 border border-against-500/40 text-against-400 text-[11px] font-mono font-semibold hover:bg-against-500/30 transition-colors"
              >
                <X className="h-3 w-3" /> Refuted
              </button>
              <button
                onClick={() => setShowResolve(false)}
                className="px-2 py-1.5 rounded-lg text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResolve(true)}
              className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <Scale className="h-3 w-3" />
              Mark as vindicated or refuted
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3 animate-pulse"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <div className="flex gap-4 pt-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Accuracy ring ────────────────────────────────────────────────────────────

function AccuracyRing({ pct }: { pct: number }) {
  const r = 20
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ

  return (
    <svg width={52} height={52} viewBox="0 0 52 52" className="-rotate-90">
      <circle cx={26} cy={26} r={r} fill="none" stroke="#1f2937" strokeWidth={5} />
      <circle
        cx={26}
        cy={26}
        r={r}
        fill="none"
        stroke={pct >= 70 ? '#f59e0b' : pct >= 50 ? '#3b82f6' : '#ef4444'}
        strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  )
}

// ─── Create thesis modal (same as main thesis page) ───────────────────────────

function CreateThesisModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (t: Thesis) => void
}) {
  const [statement, setStatement] = useState('')
  const [rationale, setRationale] = useState('')
  const [category, setCategory] = useState<ThesisCategory>('politics')
  const [resolutionDate, setResolutionDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const charLeft = 280 - statement.length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (statement.trim().length < 10) {
      setError('Thesis must be at least 10 characters.')
      return
    }
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
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Failed to publish thesis')
        return
      }
      const { thesis } = await res.json()
      onCreated(thesis)
      onClose()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-purple/20 border border-purple/30 flex items-center justify-center flex-shrink-0">
              <Scroll className="h-4 w-4 text-purple" />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold text-white">Publish a Thesis</h2>
              <p className="text-[11px] text-surface-500 font-mono">Stake your view on the future</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-lg bg-surface-200 hover:bg-surface-300 flex items-center justify-center text-surface-500 hover:text-white transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
              Thesis Statement *
            </label>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value.slice(0, 280))}
              placeholder="I believe that… / By 2030, … / Universal X will…"
              rows={3}
              className={cn(
                'w-full bg-surface-200 border rounded-xl px-4 py-3',
                'text-sm font-mono text-white placeholder:text-surface-500',
                'resize-none focus:outline-none focus:ring-2 focus:ring-purple/40 transition-all',
                charLeft < 20
                  ? 'border-against-500/50 focus:ring-against-500/40'
                  : 'border-surface-300'
              )}
            />
            <div className="flex justify-end">
              <span
                className={cn(
                  'text-[11px] font-mono',
                  charLeft < 20
                    ? charLeft < 5
                      ? 'text-against-400'
                      : 'text-gold'
                    : 'text-surface-500'
                )}
              >
                {charLeft} left
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
              Rationale{' '}
              <span className="normal-case font-normal text-surface-600">(optional)</span>
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value.slice(0, 1000))}
              placeholder="Why do you believe this? What evidence supports your view?"
              rows={2}
              className="w-full bg-surface-200 border border-surface-300 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-surface-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple/40 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
                Category
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ThesisCategory)}
                  className="w-full appearance-none bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-purple/40 pr-8 transition-all"
                >
                  {THESIS_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
                Resolve by{' '}
                <span className="normal-case font-normal text-surface-600">(optional)</span>
              </label>
              <input
                type="date"
                value={resolutionDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setResolutionDate(e.target.value)}
                className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-purple/40 transition-all [color-scheme:dark]"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs font-mono text-against-400 bg-against-500/10 border border-against-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-mono font-semibold bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || statement.trim().length < 10}
              className="flex-1 py-2.5 rounded-xl text-sm font-mono font-semibold bg-purple hover:bg-purple/90 text-white border border-purple/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Scroll className="h-3.5 w-3.5" />
                  Publish Thesis
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function MyThesesClient() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [theses, setTheses] = useState<Thesis[]>([])
  const [allTheses, setAllTheses] = useState<Thesis[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [sort, setSort] = useState<SortMode>('newest')
  const [category, setCategory] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const offsetRef = useRef(0)
  const hasMore = theses.length < total

  // Auth check
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!data.user) {
          router.replace('/sign-in?next=/thesis/my')
        } else {
          setUserId(data.user.id)
        }
        setAuthChecked(true)
      })
  }, [router])

  const load = useCallback(
    async (reset = true) => {
      if (!userId) return
      if (reset) {
        setLoading(true)
        offsetRef.current = 0
      } else {
        setLoadingMore(true)
      }
      try {
        const params = new URLSearchParams({
          author_id: userId,
          status: statusFilter,
          sort: sort === 'oldest' ? 'newest' : sort,
          limit: '20',
          offset: String(offsetRef.current),
        })
        if (category) params.set('category', category)

        const res = await fetch(`/api/thesis?${params}`)
        if (!res.ok) return
        const data: ThesisListResponse = await res.json()

        let items = data.theses
        if (sort === 'oldest') items = [...items].reverse()

        if (reset) {
          setTheses(items)
        } else {
          setTheses((prev) => [...prev, ...items])
          offsetRef.current += items.length
        }
        setTotal(data.total)
        if (reset) offsetRef.current = items.length
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [userId, statusFilter, sort, category]
  )

  // Load all theses once for stats computation (separate URLSearchParams per request)
  useEffect(() => {
    if (!userId) return
    async function loadAll() {
      const statuses: StatusFilter[] = ['active', 'vindicated', 'refuted', 'expired']
      const all: Thesis[] = []
      await Promise.all(
        statuses.map(async (s) => {
          const p = new URLSearchParams({
            author_id: userId!,
            status: s,
            limit: '60',
            offset: '0',
          })
          const res = await fetch(`/api/thesis?${p}`)
          if (!res.ok) return
          const data: ThesisListResponse = await res.json()
          all.push(...data.theses)
        })
      )
      setAllTheses(all)
    }
    loadAll()
  }, [userId])

  useEffect(() => {
    load(true)
  }, [load])

  async function handleResolve(id: string, status: 'vindicated' | 'refuted') {
    try {
      const res = await fetch(`/api/thesis/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) return
      const { thesis } = await res.json()
      setTheses((prev) => prev.map((t) => (t.id === id ? { ...t, ...thesis } : t)))
      setAllTheses((prev) => prev.map((t) => (t.id === id ? { ...t, ...thesis } : t)))
    } catch {
      // best-effort
    }
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-surface-500" />
      </div>
    )
  }

  const stats = computeStats(allTheses)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back nav */}
        <Link
          href="/thesis"
          className="inline-flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white mb-5 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          All theses
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-purple/20 border border-purple/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Scroll className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="text-xl font-mono font-bold text-white">My Theses</h1>
              <p className="text-xs font-mono text-surface-400 mt-0.5">
                Your civic predictions and their outcomes
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple/20 border border-purple/30 hover:bg-purple/30 text-purple text-sm font-mono font-semibold transition-colors flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Thesis</span>
          </button>
        </div>

        {/* Accuracy + stats panel */}
        {allTheses.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-5"
          >
            <div className="flex items-center gap-4">
              {/* Accuracy ring */}
              {stats.accuracy !== null ? (
                <div className="relative flex-shrink-0">
                  <AccuracyRing pct={stats.accuracy} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                      className={cn(
                        'text-sm font-mono font-bold leading-none',
                        stats.accuracy >= 70
                          ? 'text-gold'
                          : stats.accuracy >= 50
                          ? 'text-for-400'
                          : 'text-against-400'
                      )}
                    >
                      {stats.accuracy}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="h-[52px] w-[52px] rounded-full bg-surface-200 border border-surface-300 flex items-center justify-center flex-shrink-0">
                  <Scale className="h-5 w-5 text-surface-500" />
                </div>
              )}

              {/* Stats grid */}
              <div className="flex-1 grid grid-cols-4 gap-2">
                {[
                  { label: 'Active', value: stats.active, color: 'text-for-400' },
                  { label: 'Vindicated', value: stats.vindicated, color: 'text-gold' },
                  { label: 'Refuted', value: stats.refuted, color: 'text-against-400' },
                  { label: 'Expired', value: stats.expired, color: 'text-surface-500' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <div className={cn('text-lg font-mono font-bold', color)}>{value}</div>
                    <div className="text-[10px] font-mono text-surface-500">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {stats.accuracy !== null && (
              <p className="text-[11px] font-mono text-surface-500 mt-2">
                {stats.vindicated} of {stats.vindicated + stats.refuted} resolved theses confirmed
                correct.{' '}
                {stats.accuracy >= 70
                  ? 'Excellent track record.'
                  : stats.accuracy >= 50
                  ? 'Solid record.'
                  : 'Keep refining your predictions.'}
              </p>
            )}
          </motion.div>
        )}

        {/* Filters */}
        <div className="space-y-2.5 mb-5">
          {/* Status tabs */}
          <div className="flex gap-1 p-1 bg-surface-200 rounded-xl border border-surface-300 overflow-x-auto">
            {(
              [
                { id: 'active', label: 'Active', icon: CircleDot },
                { id: 'vindicated', label: 'Vindicated', icon: Trophy },
                { id: 'refuted', label: 'Refuted', icon: X },
                { id: 'expired', label: 'Expired', icon: Clock },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setStatusFilter(id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all whitespace-nowrap',
                  statusFilter === id
                    ? id === 'active'
                      ? 'bg-for-500/20 border border-for-500/40 text-for-400'
                      : id === 'vindicated'
                      ? 'bg-gold/20 border border-gold/40 text-gold'
                      : id === 'refuted'
                      ? 'bg-against-500/20 border border-against-500/40 text-against-400'
                      : 'bg-surface-300 border border-surface-400 text-surface-400'
                    : 'text-surface-500 hover:text-white'
                )}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Sort + category */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
                className="w-full appearance-none bg-surface-200 border border-surface-300 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-purple/40 pr-7 transition-all"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="popular">Most agreed</option>
                <option value="expiring">Expiring soon</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-surface-500 pointer-events-none" />
            </div>
            <div className="relative flex-1">
              <select
                value={category || ''}
                onChange={(e) => setCategory(e.target.value || null)}
                className="w-full appearance-none bg-surface-200 border border-surface-300 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-purple/40 pr-7 transition-all"
              >
                <option value="">All categories</option>
                {THESIS_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-surface-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <MySkeleton />
        ) : theses.length === 0 ? (
          <EmptyState
            icon={Scroll}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/30"
            title={
              statusFilter === 'active'
                ? 'No active theses'
                : `No ${statusFilter} theses`
            }
            description={
              statusFilter === 'active'
                ? 'Publish your first civic thesis and put your reputation on the line.'
                : statusFilter === 'vindicated'
                ? 'None of your resolved theses have been vindicated yet.'
                : statusFilter === 'refuted'
                ? 'No refuted theses — mark active ones as resolved when outcomes are clear.'
                : 'No expired theses.'
            }
            action={
              statusFilter === 'active'
                ? {
                    label: 'Publish a Thesis',
                    onClick: () => setShowCreate(true),
                    icon: Plus,
                  }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {theses.map((t) => (
                <MyThesisCard
                  key={t.id}
                  thesis={t}
                  onResolve={handleResolve}
                />
              ))}
            </AnimatePresence>

            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => load(false)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Load more
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />

      <AnimatePresence>
        {showCreate && (
          <CreateThesisModal
            onClose={() => setShowCreate(false)}
            onCreated={(t) => {
              setTheses((prev) => [t, ...prev])
              setAllTheses((prev) => [t, ...prev])
              setTotal((n) => n + 1)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
