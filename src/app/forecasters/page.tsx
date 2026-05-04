'use client'

/**
 * /forecasters — The Oracle Board
 *
 * A dedicated prediction-accuracy leaderboard. Unlike the general leaderboard's
 * "Predictors" tab (accuracy + total), this page gives forecasters their own
 * spotlight with:
 *   • Oracle tier badges  (Novice → Analyst → Forecaster → Oracle → Prophet)
 *   • Brier score (proper scoring rule — lower = better calibration)
 *   • Category breakdown  (which policy areas each user predicts best)
 *   • Average confidence  (bold vs. hedged predictions)
 *   • Four sort modes     (accuracy / total / brier / breadth)
 *
 * Distinct from /predictions (your own prediction history) and /leaderboard
 * (general reputation board with a small predictors sub-tab).
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Brain,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Crown,
  Eye,
  Globe,
  RefreshCw,
  Star,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ForecasterEntry,
  ForecasterSortBy,
  ForecastersResponse,
  OracleTier,
} from '@/app/api/forecasters/route'

// ─── Oracle tier config ───────────────────────────────────────────────────────

const TIER_CONFIG: Record<OracleTier, {
  label: string
  color: string
  bg: string
  border: string
  icon: typeof Crown
  description: string
}> = {
  Novice: {
    label: 'Novice',
    color: 'text-surface-500',
    bg: 'bg-surface-300/20',
    border: 'border-surface-500/40',
    icon: Target,
    description: 'Building a track record',
  },
  Analyst: {
    label: 'Analyst',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: BarChart2,
    description: '≥55% accuracy with 5+ predictions',
  },
  Forecaster: {
    label: 'Forecaster',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    icon: TrendingUp,
    description: '≥65% accuracy with 8+ predictions',
  },
  Oracle: {
    label: 'Oracle',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Eye,
    description: '≥72% accuracy with 12+ predictions',
  },
  Prophet: {
    label: 'Prophet',
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    icon: Crown,
    description: '≥80% accuracy with 20+ predictions',
  },
}

// ─── Category colors ──────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

// ─── Sort options ─────────────────────────────────────────────────────────────

const SORT_OPTIONS: { id: ForecasterSortBy; label: string; sublabel: string; icon: typeof TrendingUp }[] = [
  { id: 'accuracy',  label: 'Accuracy',    sublabel: '% correct',       icon: Target },
  { id: 'total',     label: 'Volume',      sublabel: 'most predictions', icon: BarChart2 },
  { id: 'brier',     label: 'Calibration', sublabel: 'Brier score ↓',   icon: TrendingUp },
  { id: 'breadth',   label: 'Breadth',     sublabel: 'categories covered', icon: Globe },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function fmtBrier(b: number): string {
  return b.toFixed(3)
}

function rankMedal(rank: number): string | null {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return null
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300">
      <Skeleton className="h-5 w-5 rounded" />
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-6 w-16 rounded-lg" />
    </div>
  )
}

// ─── Global stats strip ───────────────────────────────────────────────────────

function StatsStrip({ stats }: { stats: ForecastersResponse['globalStats'] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        { label: 'Total Predictions', value: stats.totalPredictions.toLocaleString(), icon: Target, color: 'text-for-400' },
        { label: 'Community Accuracy', value: `${stats.globalAccuracy}%`, icon: TrendingUp, color: 'text-emerald' },
        { label: 'Avg Brier Score', value: fmtBrier(stats.avgBrier), icon: BarChart2, color: 'text-purple' },
        { label: 'Qualified Oracles', value: stats.qualifiedForecasters.toLocaleString(), icon: Users, color: 'text-gold' },
      ].map((s) => (
        <div
          key={s.label}
          className="rounded-xl bg-surface-100 border border-surface-300 p-3 flex items-center gap-3"
        >
          <s.icon className={cn('h-5 w-5 flex-shrink-0', s.color)} />
          <div className="min-w-0">
            <p className={cn('text-sm font-mono font-bold', s.color)}>{s.value}</p>
            <p className="text-[11px] text-surface-500 truncate">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tier legend ──────────────────────────────────────────────────────────────

function TierLegend({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const tiers = Object.entries(TIER_CONFIG) as [OracleTier, typeof TIER_CONFIG[OracleTier]][]
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-200/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-gold" />
          <span className="text-sm font-mono text-surface-700">Oracle Tiers</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-surface-500" /> : <ChevronDown className="h-4 w-4 text-surface-500" />}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tiers.map(([tier, cfg]) => {
                const Icon = cfg.icon
                return (
                  <div
                    key={tier}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-xl border',
                      cfg.bg, cfg.border
                    )}
                  >
                    <Icon className={cn('h-4 w-4 flex-shrink-0', cfg.color)} />
                    <div className="min-w-0">
                      <p className={cn('text-xs font-mono font-bold', cfg.color)}>{cfg.label}</p>
                      <p className="text-[11px] text-surface-500">{cfg.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Category mini-bar ────────────────────────────────────────────────────────

function CategoryBar({ stats }: { stats: ForecasterEntry['categoryStats'] }) {
  if (stats.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {stats.slice(0, 4).map((cs) => (
        <span
          key={cs.category}
          className={cn(
            'text-[10px] font-mono px-1.5 py-0.5 rounded',
            'bg-surface-200 border border-surface-400/60',
            CATEGORY_COLOR[cs.category] ?? 'text-surface-500'
          )}
        >
          {cs.category.slice(0, 4)} {cs.accuracy}%
        </span>
      ))}
    </div>
  )
}

// ─── Forecaster row ───────────────────────────────────────────────────────────

function ForecasterRow({
  entry,
  sort,
}: {
  entry: ForecasterEntry
  sort: ForecasterSortBy
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = TIER_CONFIG[entry.tier]
  const TierIcon = cfg.icon
  const medal = rankMedal(entry.rank)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border transition-colors cursor-pointer select-none',
        expanded
          ? 'bg-surface-200 border-surface-400'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400',
      )}
      onClick={() => setExpanded((e) => !e)}
    >
      {/* ── Main row ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 p-4">
        {/* Rank */}
        <div className="w-7 flex-shrink-0 text-center">
          {medal ? (
            <span className="text-base">{medal}</span>
          ) : (
            <span className="text-xs font-mono text-surface-500">#{entry.rank}</span>
          )}
        </div>

        {/* Avatar */}
        <Link
          href={`/profile/${entry.username}`}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0"
        >
          <Avatar
            src={entry.avatar_url}
            fallback={entry.display_name || entry.username}
            size="md"
          />
        </Link>

        {/* Name + tier + category bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/profile/${entry.username}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
            >
              {entry.display_name || entry.username}
            </Link>
            <span
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono flex-shrink-0',
                cfg.bg, cfg.border, cfg.color
              )}
            >
              <TierIcon className="h-3 w-3" />
              {cfg.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-surface-500 mt-0.5">
            <span>@{entry.username}</span>
            <span>·</span>
            <span>{entry.total} predictions</span>
            <span>·</span>
            <span>{entry.categoryBreadth} {entry.categoryBreadth === 1 ? 'category' : 'categories'}</span>
          </div>
          {!expanded && <CategoryBar stats={entry.categoryStats} />}
        </div>

        {/* Primary metric */}
        <div className="flex-shrink-0 text-right">
          {sort === 'brier' ? (
            <div>
              <p className="text-lg font-mono font-bold text-emerald">{fmtBrier(entry.avgBrier)}</p>
              <p className="text-[10px] text-surface-500 font-mono">Brier</p>
            </div>
          ) : sort === 'breadth' ? (
            <div>
              <p className="text-lg font-mono font-bold text-purple">{entry.categoryBreadth}</p>
              <p className="text-[10px] text-surface-500 font-mono">topics</p>
            </div>
          ) : sort === 'total' ? (
            <div>
              <p className="text-lg font-mono font-bold text-for-400">{entry.total}</p>
              <p className="text-[10px] text-surface-500 font-mono">calls</p>
            </div>
          ) : (
            <div>
              <p className={cn('text-lg font-mono font-bold', entry.accuracy >= 70 ? 'text-emerald' : entry.accuracy >= 55 ? 'text-gold' : 'text-surface-500')}>
                {entry.accuracy}%
              </p>
              <p className="text-[10px] text-surface-500 font-mono">accuracy</p>
            </div>
          )}
        </div>

        {/* Expand chevron */}
        <div className="flex-shrink-0 ml-1">
          {expanded
            ? <ChevronUp className="h-4 w-4 text-surface-500" />
            : <ChevronDown className="h-4 w-4 text-surface-500" />}
        </div>
      </div>

      {/* ── Expanded detail ────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-surface-300 pt-3 space-y-3">
              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Accuracy',    value: `${entry.accuracy}%`,           color: 'text-emerald' },
                  { label: 'Correct',     value: `${entry.correct}/${entry.total}`, color: 'text-for-400' },
                  { label: 'Brier Score', value: fmtBrier(entry.avgBrier),        color: 'text-purple' },
                  { label: 'Avg Confidence', value: `${entry.avgConfidence}%`,    color: 'text-gold' },
                  { label: 'Clout Earned',   value: `+${entry.cloutEarned}`,      color: 'text-gold' },
                  { label: 'Breadth',     value: `${entry.categoryBreadth} cats`, color: 'text-surface-500' },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-surface-200/60 border border-surface-400/60 p-2 text-center">
                    <p className={cn('text-sm font-mono font-bold', s.color)}>{s.value}</p>
                    <p className="text-[10px] text-surface-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Category stats */}
              {entry.categoryStats.length > 0 && (
                <div>
                  <p className="text-[11px] font-mono text-surface-500 mb-2">Category breakdown</p>
                  <div className="space-y-1.5">
                    {entry.categoryStats.slice(0, 5).map((cs) => (
                      <div key={cs.category} className="flex items-center gap-2">
                        <span className={cn('text-[10px] font-mono w-20 flex-shrink-0', CATEGORY_COLOR[cs.category] ?? 'text-surface-500')}>
                          {cs.category}
                        </span>
                        <div className="flex-1 relative h-1.5 rounded-full bg-surface-300 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${cs.accuracy}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            className={cn(
                              'absolute inset-y-0 left-0 rounded-full',
                              cs.accuracy >= 70 ? 'bg-emerald' : cs.accuracy >= 55 ? 'bg-gold' : 'bg-surface-500'
                            )}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-surface-500 w-12 text-right flex-shrink-0">
                          {cs.accuracy}% ({cs.correct}/{cs.total})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <Link
                  href={`/profile/${entry.username}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                >
                  View profile <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ForecastersPage() {
  const [sort, setSort] = useState<ForecasterSortBy>('accuracy')
  const [data, setData] = useState<ForecastersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [legendOpen, setLegendOpen] = useState(false)

  const load = useCallback(async (s: ForecasterSortBy) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/forecasters?sort=${s}&limit=50`)
      if (!res.ok) throw new Error('Failed to load')
      const json: ForecastersResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load forecaster data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(sort) }, [load, sort])

  function handleSort(s: ForecasterSortBy) {
    if (s === sort) return
    setSort(s)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <Link
            href="/predictions"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0 mt-0.5',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Back to predictions"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Brain className="h-5 w-5 text-gold flex-shrink-0" />
              <h1 className="font-mono text-xl font-bold text-white">The Oracle Board</h1>
              {data && (
                <Badge variant="gold" className="text-[10px]">
                  {data.total} forecasters
                </Badge>
              )}
            </div>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Ranked by prediction accuracy on topic outcomes
            </p>
          </div>
          <button
            onClick={() => load(sort)}
            disabled={loading}
            aria-label="Refresh"
            className={cn(
              'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
              'disabled:opacity-40',
            )}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Global stats ────────────────────────────────────────── */}
        {data && !loading && (
          <StatsStrip stats={data.globalStats} />
        )}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        )}

        {/* ── Tier legend ─────────────────────────────────────────── */}
        <TierLegend expanded={legendOpen} onToggle={() => setLegendOpen((o) => !o)} />

        {/* ── Sort tabs ────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {SORT_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const active = sort === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => handleSort(opt.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono whitespace-nowrap flex-shrink-0',
                  'transition-all',
                  active
                    ? 'bg-for-500/20 border-for-500/40 text-for-300'
                    : 'bg-surface-200 border-surface-400/60 text-surface-500 hover:text-white hover:border-surface-500',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{opt.label}</span>
                {active && <span className="text-surface-600">— {opt.sublabel}</span>}
              </button>
            )
          })}
        </div>

        {/* ── Body ─────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <p className="text-sm text-against-400 mb-3">{error}</p>
            <button
              onClick={() => load(sort)}
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        ) : data && data.forecasters.length === 0 ? (
          <EmptyState
            icon={Brain}
            title="No forecasters yet"
            description="Be the first to make at least 5 predictions on topic outcomes and get ranked here."
            action={{ label: 'Make a prediction', href: '/predictions' }}
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {(data?.forecasters ?? []).map((entry) => (
                <ForecasterRow key={entry.user_id} entry={entry} sort={sort} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Footer links ─────────────────────────────────────────── */}
        {data && data.forecasters.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-surface-300 text-xs font-mono text-surface-500">
            <span>Updated {relativeTime(data.generatedAt)}</span>
            <div className="flex items-center gap-3">
              <Link href="/predictions" className="hover:text-white transition-colors flex items-center gap-1">
                My predictions <ChevronRight className="h-3 w-3" />
              </Link>
              <Link href="/leaderboard" className="hover:text-white transition-colors flex items-center gap-1">
                Leaderboard <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}

        {/* ── How tiers work ───────────────────────────────────────── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-for-400" />
            <p className="text-sm font-mono text-white">How to rank here</p>
          </div>
          <ul className="space-y-1.5 text-xs text-surface-500">
            <li className="flex items-start gap-2">
              <span className="text-for-400 flex-shrink-0">01</span>
              <span>Make at least 5 predictions on topics currently in active voting.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-for-400 flex-shrink-0">02</span>
              <span>Predictions are resolved when the topic closes (becomes Law or fails). Correct predictions earn Clout.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-for-400 flex-shrink-0">03</span>
              <span>Your Brier score measures calibration — a lower score means your confidence levels match your actual accuracy.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-for-400 flex-shrink-0">04</span>
              <span>Reach 80%+ accuracy with 20+ predictions to achieve Prophet status.</span>
            </li>
          </ul>
          <Link
            href="/predictions"
            className="inline-flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors mt-1"
          >
            Start predicting <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
