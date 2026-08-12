'use client'

/**
 * /laws-at-risk — Laws Under Scrutiny
 *
 * A risk-ranked view of established laws that are facing challenges,
 * poor review scores, or sustained community opposition. Aggregates
 * data from law_challenges, law_reviews, and law_endorsements into a
 * single "risk score" for each law.
 *
 * Risk levels:
 *   Critical (70+) — multiple upheld/open challenges + negative reviews
 *   High (45–69)   — active challenges with significant community support
 *   Moderate (20–44) — low review scores or a single challenge filed
 *   Low (<20)      — nominal signals only (not shown by default)
 *
 * Distinct from:
 *   /law/challenges  — raw list of formal challenges, not risk-ranked
 *   /law/conflicts   — laws in logical conflict with each other
 *   /law/health      — overall codex health (not per-law risk)
 *   /law/verdicts    — community verdict (did it succeed?) not challenge risk
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Filter,
  Heart,
  RefreshCw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  Users,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LawAtRisk, LawsAtRiskResponse, RiskLevel } from '@/app/api/laws/at-risk/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; text: string; bg: string; border: string; bar: string; icon: typeof AlertTriangle }
> = {
  critical: {
    label: 'Critical Risk',
    text: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/40',
    bar: 'bg-against-500',
    icon: ShieldAlert,
  },
  high: {
    label: 'High Risk',
    text: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    bar: 'bg-gold',
    icon: AlertTriangle,
  },
  moderate: {
    label: 'Moderate',
    text: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/40',
    bar: 'bg-purple',
    icon: Scale,
  },
  low: {
    label: 'Low Risk',
    text: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/40',
    bar: 'bg-for-500',
    icon: ShieldCheck,
  },
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-against-400',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Star display ─────────────────────────────────────────────────────────────

function Stars({ value }: { value: number | null }) {
  if (value === null) return null
  return (
    <span className="flex items-center gap-0.5">
      <Star className="h-3 w-3 text-gold" />
      <span className="text-xs font-mono text-surface-600">{value.toFixed(1)}</span>
    </span>
  )
}

// ─── Risk score ring ──────────────────────────────────────────────────────────

function RiskScore({ score, level }: { score: number; level: RiskLevel }) {
  const cfg = RISK_CONFIG[level]
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl px-3 py-2 flex-shrink-0',
        cfg.bg,
        'border',
        cfg.border,
        'min-w-[56px]',
      )}
    >
      <span className={cn('font-mono font-bold text-lg leading-none', cfg.text)}>{score}</span>
      <span className={cn('text-[9px] font-mono uppercase tracking-wide mt-0.5', cfg.text)}>
        risk
      </span>
    </div>
  )
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawCard({ law, index }: { law: LawAtRisk; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = RISK_CONFIG[law.risk_level]
  const RiskIcon = cfg.icon
  const catColor = CATEGORY_COLORS[law.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={cn(
        'rounded-2xl bg-surface-100 border p-5 transition-colors',
        law.risk_level === 'critical'
          ? 'border-against-500/30 hover:border-against-500/50'
          : law.risk_level === 'high'
          ? 'border-gold/30 hover:border-gold/50'
          : 'border-surface-300 hover:border-surface-400',
      )}
    >
      {/* Top row */}
      <div className="flex items-start gap-3">
        {/* Risk score */}
        <RiskScore score={law.risk_score} level={law.risk_level} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Labels */}
          <div className="flex items-center flex-wrap gap-1.5 mb-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border',
                cfg.text,
                cfg.bg,
                cfg.border,
              )}
            >
              <RiskIcon className="h-2.5 w-2.5" aria-hidden="true" />
              {cfg.label}
            </span>
            {law.category && (
              <span className={cn('text-[10px] font-mono', catColor)}>
                {law.category}
              </span>
            )}
          </div>

          {/* Statement */}
          <p className="text-sm font-medium text-surface-800 leading-snug line-clamp-2">
            {law.statement}
          </p>

          {/* Stats row */}
          <div className="flex items-center flex-wrap gap-3 mt-2.5">
            {law.open_challenges > 0 && (
              <span className="flex items-center gap-1 text-xs text-against-400">
                <AlertTriangle className="h-3 w-3" />
                {law.open_challenges} open challenge{law.open_challenges !== 1 ? 's' : ''}
              </span>
            )}
            {law.upheld_challenges > 0 && (
              <span className="flex items-center gap-1 text-xs text-against-300 font-medium">
                <ShieldAlert className="h-3 w-3" />
                {law.upheld_challenges} upheld
              </span>
            )}
            {law.avg_stars !== null && (
              <Stars value={law.avg_stars} />
            )}
            {law.endorsement_count > 0 && (
              <span className="flex items-center gap-1 text-xs text-surface-500">
                <Heart className="h-3 w-3 text-for-400" />
                {law.endorsement_count.toLocaleString()} endorsed
              </span>
            )}
            {law.total_votes && (
              <span className="flex items-center gap-1 text-xs text-surface-500">
                <Users className="h-3 w-3" />
                {law.total_votes.toLocaleString()} votes
              </span>
            )}
          </div>

          {/* Risk factors */}
          {law.risk_factors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {law.risk_factors.map((f) => (
                <span
                  key={f}
                  className="text-[10px] font-mono bg-surface-200/60 text-surface-500 px-2 py-0.5 rounded-full"
                >
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Latest challenge timestamp */}
      {law.latest_challenge_at && (
        <div className="mt-3 pt-3 border-t border-surface-300/40 flex items-center justify-between">
          <span className="text-[11px] font-mono text-surface-500">
            Last challenged {relTime(law.latest_challenge_at)}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded((x) => !x)}
              className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-surface-700 transition-colors"
              aria-expanded={expanded}
            >
              {expanded ? (
                <>Less <ChevronDown className="h-3 w-3" /></>
              ) : (
                <>Details <ChevronRight className="h-3 w-3" /></>
              )}
            </button>
            <Link
              href={`/law/${law.id}/challenges`}
              className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              View <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 mt-2 space-y-2">
              {/* Challenge vote breakdown */}
              {(law.total_challenge_support + law.total_challenge_oppose) > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
                    Challenge community vote
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-against-400">
                      <ThumbsUp className="h-3 w-3" />
                      {law.total_challenge_support} support
                    </span>
                    <span className="flex items-center gap-1 text-xs text-for-400">
                      <ThumbsDown className="h-3 w-3" />
                      {law.total_challenge_oppose} oppose
                    </span>
                  </div>
                </div>
              )}

              {/* Review breakdown */}
              {law.review_count > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
                    Community reviews
                  </p>
                  <div className="flex items-center gap-2">
                    <Stars value={law.avg_stars} />
                    <span className="text-xs text-surface-500">
                      from {law.review_count} review{law.review_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Link
                  href={`/law/${law.id}`}
                  className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
                >
                  View law <ArrowRight className="h-3 w-3" />
                </Link>
                <Link
                  href={`/law/${law.id}/challenge`}
                  className="text-xs font-mono text-against-400 hover:text-against-300 transition-colors flex items-center gap-1"
                >
                  File challenge <Scale className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* If no challenge timestamp, show actions inline */}
      {!law.latest_challenge_at && (
        <div className="mt-3 pt-3 border-t border-surface-300/40 flex items-center justify-end gap-3">
          <Link
            href={`/law/${law.id}`}
            className="text-xs font-mono text-surface-500 hover:text-for-400 transition-colors flex items-center gap-1"
          >
            View <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        </div>
      )}
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LawsAtRiskPage() {
  const [data, setData] = useState<LawsAtRiskResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [levelFilter, setLevelFilter] = useState<RiskLevel | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ limit: '60' })
      if (levelFilter) params.set('level', levelFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      const res = await fetch(`/api/laws/at-risk?${params}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json = (await res.json()) as LawsAtRiskResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [levelFilter, categoryFilter])

  useEffect(() => {
    load()
  }, [load])

  const summary = data?.summary

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <Link
            href="/law"
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-surface-700 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            The Codex
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
              <TrendingDown className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Laws at Risk
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Established laws facing challenges, poor reviews, or community opposition
              </p>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        {summary && !loading && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Critical', count: summary.critical, cfg: RISK_CONFIG.critical },
              { label: 'High Risk', count: summary.high, cfg: RISK_CONFIG.high },
              { label: 'Moderate', count: summary.moderate, cfg: RISK_CONFIG.moderate },
            ].map(({ label, count, cfg }) => (
              <div
                key={label}
                className={cn(
                  'rounded-xl border p-4 text-center cursor-pointer transition-all',
                  cfg.bg,
                  cfg.border,
                )}
              >
                <p className={cn('text-[10px] font-mono uppercase tracking-wide', cfg.text)}>
                  {label}
                </p>
                <p className={cn('font-mono font-bold text-2xl mt-1', cfg.text)}>
                  {count}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          {/* Level filters */}
          {([null, 'critical', 'high', 'moderate'] as (RiskLevel | null)[]).map((level) => {
            const isActive = levelFilter === level
            const cfg = level ? RISK_CONFIG[level] : null
            return (
              <button
                key={level ?? 'all'}
                onClick={() => setLevelFilter(level)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition-all',
                  isActive
                    ? cfg
                      ? cn(cfg.text, cfg.bg, cfg.border)
                      : 'bg-surface-300 text-white border-surface-400'
                    : 'text-surface-500 border-surface-300 hover:border-surface-400',
                )}
              >
                {level ? (
                  <>
                    {(() => {
                      const Icon = RISK_CONFIG[level].icon
                      return <Icon className="h-3 w-3" />
                    })()}
                    {RISK_CONFIG[level].label}
                  </>
                ) : (
                  'All Risks'
                )}
              </button>
            )
          })}

          {/* Category filter */}
          <div className="relative">
            <button
              onClick={() => setShowCategoryMenu((x) => !x)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition-all',
                categoryFilter
                  ? 'bg-surface-300 text-white border-surface-400'
                  : 'text-surface-500 border-surface-300 hover:border-surface-400',
              )}
            >
              <Filter className="h-3 w-3" />
              {categoryFilter ?? 'Category'}
              {categoryFilter && (
                <X
                  className="h-3 w-3 ml-0.5"
                  onClick={(e) => {
                    e.stopPropagation()
                    setCategoryFilter(null)
                    setShowCategoryMenu(false)
                  }}
                />
              )}
            </button>
            <AnimatePresence>
              {showCategoryMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 mt-1.5 z-20 bg-surface-100 border border-surface-300 rounded-xl shadow-xl p-2 min-w-[160px]"
                >
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setCategoryFilter(cat)
                        setShowCategoryMenu(false)
                      }}
                      className={cn(
                        'w-full text-left px-3 py-1.5 rounded-lg text-xs font-mono transition-colors',
                        categoryFilter === cat
                          ? 'bg-surface-300 text-white'
                          : 'text-surface-600 hover:bg-surface-200',
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-700 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-14 w-14 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <p className="text-surface-500 font-mono text-sm mb-3">Failed to load data</p>
            <button
              onClick={load}
              className="text-for-400 font-mono text-sm hover:text-for-300 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : !data || data.laws.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No laws at risk"
            description={
              levelFilter || categoryFilter
                ? 'No laws match your current filters. Try adjusting them.'
                : 'All established laws are currently in good standing — no significant challenges or poor reviews on record.'
            }
            action={
              (levelFilter || categoryFilter) ? (
                <button
                  onClick={() => { setLevelFilter(null); setCategoryFilter(null) }}
                  className="text-for-400 font-mono text-sm hover:text-for-300 transition-colors"
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <p className="text-xs font-mono text-surface-500 mb-3">
              {data.laws.length} law{data.laws.length !== 1 ? 's' : ''} under scrutiny
              {data.summary.total_assessed > data.laws.length
                ? ` (${data.summary.total_assessed} total assessed)`
                : ''}
            </p>
            <div className="space-y-3">
              {data.laws.map((law, i) => (
                <LawCard key={law.id} law={law} index={i} />
              ))}
            </div>

            {/* Footer links */}
            <div className="mt-8 pt-6 border-t border-surface-300/40 flex flex-wrap gap-4 text-xs font-mono text-surface-500">
              <Link href="/law/challenges" className="hover:text-for-400 flex items-center gap-1 transition-colors">
                All challenges <ArrowRight className="h-3 w-3" />
              </Link>
              <Link href="/law/health" className="hover:text-for-400 flex items-center gap-1 transition-colors">
                Codex health <ArrowRight className="h-3 w-3" />
              </Link>
              <Link href="/law/verdicts" className="hover:text-for-400 flex items-center gap-1 transition-colors">
                Community verdicts <ArrowRight className="h-3 w-3" />
              </Link>
              <Link href="/law/conflicts" className="hover:text-for-400 flex items-center gap-1 transition-colors">
                Law conflicts <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
