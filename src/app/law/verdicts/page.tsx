'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  Gavel,
  MinusCircle,
  RefreshCw,
  Scale,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  GlobalVerdictsResponse,
  VerdictLawItem,
  VerdictOutcome,
} from '@/app/api/laws/verdicts/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const OUTCOME_CONFIG: Record<
  string,
  { label: string; icon: typeof CheckCircle2; color: string; bg: string; border: string; badge: string }
> = {
  all: {
    label: 'All outcomes',
    icon: Scale,
    color: 'text-surface-400',
    bg: 'bg-surface-300/50',
    border: 'border-surface-400',
    badge: 'bg-surface-300 text-white border-surface-400',
  },
  succeeded: {
    label: 'Judged successful',
    icon: CheckCircle2,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/40',
    badge: 'bg-emerald/20 text-emerald border-emerald/40',
  },
  mixed: {
    label: 'Mixed verdict',
    icon: MinusCircle,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    badge: 'bg-gold/20 text-gold border-gold/40',
  },
  failed: {
    label: 'Judged failure',
    icon: XCircle,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/40',
    badge: 'bg-against-500/20 text-against-300 border-against-500/40',
  },
}

const SORT_OPTIONS = [
  { value: 'votes', label: 'Most assessed' },
  { value: 'success', label: 'Most successful' },
  { value: 'failure', label: 'Most failed' },
  { value: 'contested', label: 'Most contested' },
  { value: 'recent', label: 'Recently established' },
]

const VERDICT_LABEL: Record<VerdictOutcome, string> = {
  succeeded: 'Succeeded',
  mostly_succeeded: 'Mostly succeeded',
  mixed: 'Mixed',
  mostly_failed: 'Mostly failed',
  failed: 'Failed',
}

const VERDICT_COLOR: Record<VerdictOutcome, string> = {
  succeeded: 'text-emerald',
  mostly_succeeded: 'text-emerald/70',
  mixed: 'text-gold',
  mostly_failed: 'text-against-300/70',
  failed: 'text-against-300',
}

const CATEGORIES = [
  'All',
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const m = Math.floor(d / 30)
  const y = Math.floor(m / 12)
  if (y >= 1) return `${y}y ago`
  if (m >= 1) return `${m}mo ago`
  return `${d}d ago`
}

// ─── Verdict bar ──────────────────────────────────────────────────────────────

function VerdictBar({ item }: { item: VerdictLawItem }) {
  const total = item.total_verdicts
  if (total === 0) return null

  const segments: { key: VerdictOutcome; count: number; color: string }[] = [
    { key: 'succeeded',        count: item.succeeded_count,        color: 'bg-emerald' },
    { key: 'mostly_succeeded', count: item.mostly_succeeded_count, color: 'bg-emerald/50' },
    { key: 'mixed',            count: item.mixed_count,            color: 'bg-gold/70' },
    { key: 'mostly_failed',    count: item.mostly_failed_count,    color: 'bg-against-500/50' },
    { key: 'failed',           count: item.failed_count,           color: 'bg-against-500' },
  ]

  return (
    <div className="flex h-1.5 w-full rounded-full overflow-hidden gap-px">
      {segments.map(({ key, count, color }) =>
        count > 0 ? (
          <div
            key={key}
            className={cn('h-full transition-all', color)}
            style={{ width: `${(count / total) * 100}%` }}
            title={`${VERDICT_LABEL[key]}: ${count}`}
          />
        ) : null
      )}
    </div>
  )
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function VerdictCard({ item }: { item: VerdictLawItem }) {
  const cfg = item.success_pct >= 50
    ? OUTCOME_CONFIG['succeeded']
    : item.failure_pct >= 50
    ? OUTCOME_CONFIG['failed']
    : OUTCOME_CONFIG['mixed']

  const Icon = cfg.icon

  return (
    <Link href={`/law/${item.law_id}/verdict`} className="group block">
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        transition={{ duration: 0.15 }}
        className={cn(
          'rounded-2xl border p-4 transition-all duration-200',
          'bg-surface-100/80 hover:bg-surface-100',
          'border-surface-300/60 hover:border-surface-400/60',
          'cursor-pointer',
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={cn('flex-shrink-0 mt-0.5 flex items-center justify-center h-7 w-7 rounded-lg', cfg.bg)}>
            <Icon className={cn('h-4 w-4', cfg.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
              {item.law_statement}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {item.law_category && (
                <span className="text-[11px] font-mono text-surface-500">{item.law_category}</span>
              )}
              {item.law_established_at && (
                <span className="text-[11px] font-mono text-surface-600">
                  est. {relTime(item.law_established_at)}
                </span>
              )}
              {item.user_verdict && (
                <span className={cn('text-[11px] font-mono font-semibold', VERDICT_COLOR[item.user_verdict])}>
                  You: {VERDICT_LABEL[item.user_verdict]}
                </span>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className={cn('text-base font-mono font-bold', cfg.color)}>
              {item.success_pct >= 50 ? item.success_pct : item.failure_pct}%
            </p>
            <p className="text-[10px] font-mono text-surface-500">
              {item.success_pct >= 50 ? 'success' : item.failure_pct >= 50 ? 'failure' : 'mixed'}
            </p>
          </div>
        </div>

        {/* Verdict bar */}
        <VerdictBar item={item} />

        {/* Footer stats */}
        <div className="flex items-center gap-4 mt-2.5">
          <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <ThumbsUp className="h-3 w-3 text-emerald/70" />
            <span>{item.succeeded_count + item.mostly_succeeded_count}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Scale className="h-3 w-3 text-gold/70" />
            <span>{item.mixed_count}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <ThumbsDown className="h-3 w-3 text-against-400/70" />
            <span>{item.failed_count + item.mostly_failed_count}</span>
          </div>
          <span className="ml-auto text-[11px] font-mono text-surface-600">
            {item.total_verdicts} {item.total_verdicts === 1 ? 'vote' : 'votes'}
          </span>
          {item.law_blue_pct != null && (
            <span className="text-[11px] font-mono text-for-400/60">
              {Math.round(item.law_blue_pct)}% FOR
            </span>
          )}
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function VerdictSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/60 bg-surface-100/50 p-4 space-y-3 animate-pulse">
      <div className="flex gap-3">
        <Skeleton className="h-7 w-7 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-3 w-1/3 rounded" />
        </div>
        <Skeleton className="h-8 w-10 rounded" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex gap-4">
        <Skeleton className="h-3 w-10 rounded" />
        <Skeleton className="h-3 w-10 rounded" />
        <Skeleton className="h-3 w-10 rounded" />
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LawVerdictsPage() {
  const [data, setData] = useState<GlobalVerdictsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [outcome, setOutcome] = useState<string>('all')
  const [category, setCategory] = useState<string>('All')
  const [sort, setSort] = useState<string>('votes')
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sort, limit: '60' })
      if (outcome !== 'all') params.set('outcome', outcome)
      if (category !== 'All') params.set('category', category)
      const res = await fetch(`/api/laws/verdicts?${params}`, { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [outcome, category, sort])

  useEffect(() => { load() }, [load])

  const outcomeKeys = ['all', 'succeeded', 'mixed', 'failed'] as const

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      {/* ── Nav strip ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-surface-100/95 backdrop-blur border-b border-surface-300">
        <div className="max-w-3xl mx-auto flex items-center h-14 px-4 gap-3">
          <Link
            href="/law"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
              'transition-colors',
            )}
            aria-label="Back to Codex"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <Scale className="h-4 w-4 text-gold flex-shrink-0" />
            <span className="text-sm font-mono text-surface-700 truncate">
              Codex · <span className="text-white font-semibold">Community Verdict Board</span>
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs font-mono text-surface-500 flex-shrink-0">
            {data && (
              <>
                <span>{data.total_laws_with_verdicts} laws</span>
                <span className="text-surface-600">·</span>
                <span>{data.total_verdict_votes.toLocaleString()} votes</span>
              </>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 space-y-4">
        {/* ── Hero stats ───────────────────────────────────────────────────── */}
        {!loading && data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-surface-300/60 bg-surface-100/50 p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Gavel className="h-4 w-4 text-gold" />
              <h1 className="text-sm font-mono font-bold text-white">Community Verdict Board</h1>
              <Badge variant="outline" className="ml-auto text-[10px]">RETROSPECTIVE</Badge>
            </div>
            <p className="text-xs font-mono text-surface-500 mb-4 leading-relaxed">
              Citizens retrospectively assess whether each established law succeeded in its civic purpose.
              Cast your verdict on any law — and see how the community judges the Codex.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[
                {
                  label: 'Total votes',
                  value: data.total_verdict_votes.toLocaleString(),
                  icon: BarChart2,
                  color: 'text-surface-400',
                },
                {
                  label: 'Succeeded',
                  value: `${data.by_outcome.succeeded + data.by_outcome.mostly_succeeded}`,
                  icon: ThumbsUp,
                  color: 'text-emerald',
                },
                {
                  label: 'Mixed',
                  value: `${data.by_outcome.mixed}`,
                  icon: Scale,
                  color: 'text-gold',
                },
                {
                  label: 'Failed',
                  value: `${data.by_outcome.failed + data.by_outcome.mostly_failed}`,
                  icon: ThumbsDown,
                  color: 'text-against-400',
                },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="text-center">
                  <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
                  <p className={cn('text-base font-mono font-bold', color)}>{value}</p>
                  <p className="text-[10px] font-mono text-surface-500">{label}</p>
                </div>
              ))}
            </div>
            {data.avg_success_pct > 0 && (
              <div className="mt-3 pt-3 border-t border-surface-300/50">
                <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                  <span className="text-surface-500">Avg. community success rating</span>
                  <span className={cn(
                    'font-bold',
                    data.avg_success_pct >= 60 ? 'text-emerald' :
                    data.avg_success_pct >= 40 ? 'text-gold' : 'text-against-400'
                  )}>{data.avg_success_pct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-300/50 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      data.avg_success_pct >= 60 ? 'bg-emerald' :
                      data.avg_success_pct >= 40 ? 'bg-gold' : 'bg-against-500',
                    )}
                    style={{ width: `${data.avg_success_pct}%` }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Controls bar ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          {/* Sort dropdown */}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className={cn(
                'appearance-none pl-3 pr-8 py-2 rounded-xl text-xs font-mono font-semibold border',
                'bg-surface-100 border-surface-300 text-surface-400 hover:text-white',
                'cursor-pointer transition-colors focus:outline-none',
              )}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowFilters((f) => !f)}
            aria-label="Toggle filters"
            className={cn(
              'ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold border transition-all',
              showFilters
                ? 'bg-gold/10 border-gold/40 text-gold'
                : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
          </button>

          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-xl border transition-all',
              'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
              loading && 'opacity-50 cursor-not-allowed',
            )}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Expanded filters ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                {/* Outcome filter */}
                <div>
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Filter className="h-3 w-3" />
                    Outcome
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {outcomeKeys.map((key) => {
                      const cfg = OUTCOME_CONFIG[key]
                      return (
                        <button
                          key={key}
                          onClick={() => setOutcome(key)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-all',
                            outcome === key
                              ? cn(cfg.badge)
                              : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white',
                          )}
                        >
                          {cfg.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                {/* Category filter */}
                <div>
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">Category</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-all',
                          category === cat
                            ? 'bg-surface-300 border-surface-400 text-white'
                            : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white',
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Outcome quick pills ───────────────────────────────────────────── */}
        {!showFilters && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {outcomeKeys.map((key) => {
              const cfg = OUTCOME_CONFIG[key]
              const Icon = cfg.icon
              return (
                <button
                  key={key}
                  onClick={() => setOutcome(key)}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold border transition-all',
                    outcome === key
                      ? cn(cfg.badge)
                      : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {cfg.label}
                </button>
              )
            })}
          </div>
        )}

        {/* ── List ─────────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => <VerdictSkeleton key={i} />)}
          </div>
        ) : !data || data.laws.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No verdicts yet"
            description={
              outcome !== 'all' || category !== 'All'
                ? 'No laws match your current filters. Try broadening them.'
                : 'Be the first to cast a retrospective verdict on an established law.'
            }
            action={
              outcome !== 'all' || category !== 'All'
                ? { label: 'Clear filters', onClick: () => { setOutcome('all'); setCategory('All') } }
                : { label: 'Browse the Codex', href: '/law' }
            }
          />
        ) : (
          <div className="space-y-3">
            {data.laws.map((item, i) => (
              <motion.div
                key={item.law_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <VerdictCard item={item} />
              </motion.div>
            ))}
          </div>
        )}

        {/* ── CTA: how verdicts work ────────────────────────────────────────── */}
        {!loading && data && data.laws.length > 0 && (
          <div className="mt-6 rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <h2 className="text-sm font-mono font-semibold text-white mb-2">How community verdicts work</h2>
            <p className="text-xs font-mono text-surface-500 leading-relaxed mb-3">
              After a topic becomes law, any citizen can cast a retrospective verdict — rating whether the
              law succeeded, mostly succeeded, produced mixed results, mostly failed, or failed outright.
              Verdicts are separate from the original debate vote and reflect real-world outcomes.
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/law"
                className="inline-flex items-center gap-2 text-xs font-mono text-emerald hover:text-emerald/80 transition-colors"
              >
                Browse the Codex <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/law/challenges"
                className="inline-flex items-center gap-2 text-xs font-mono text-against-400 hover:text-against-300 transition-colors"
              >
                View challenges <Zap className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
