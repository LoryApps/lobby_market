'use client'

/**
 * /leaderboard/theses — The Civic Oracle Leaderboard
 *
 * Ranks users by their civic thesis accuracy — the fraction of their
 * publicly-staked predictions that were marked Vindicated vs Refuted.
 *
 * Three views:
 *   By Accuracy  — highest vindication rate (min 1 resolved thesis)
 *   By Volume    — most theses published (all users)
 *   Recently Resolved — latest theses marked vindicated / refuted / expired
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Coins,
  Crown,
  Eye,
  RefreshCw,
  Scroll,
  Sparkles,
  Target,
  XCircle,
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
  ThesisOracle,
  RecentlyResolvedThesis,
  ThesisLeaderboardResponse,
} from '@/app/api/leaderboard/theses/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CATEGORY_COLOR: Record<string, string> = {
  economics: 'text-gold',
  politics: 'text-for-400',
  technology: 'text-purple',
  science: 'text-emerald',
  ethics: 'text-against-300',
  philosophy: 'text-for-300',
  culture: 'text-gold',
  health: 'text-against-400',
  environment: 'text-emerald',
  education: 'text-for-400',
}

// ─── Medal helpers ────────────────────────────────────────────────────────────

function medal(rank: number): { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; border: string } | null {
  if (rank === 1) return { icon: Crown, color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' }
  if (rank === 2) return { icon: Crown, color: 'text-surface-300', bg: 'bg-surface-300/10', border: 'border-surface-300/30' }
  if (rank === 3) return { icon: Crown, color: 'text-against-400', bg: 'bg-against-400/10', border: 'border-against-400/30' }
  return null
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: 'vindicated' | 'refuted' | 'expired' }) {
  if (status === 'vindicated') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald/10 border border-emerald/30 text-[10px] font-mono font-semibold text-emerald">
        <CheckCircle2 className="h-3 w-3" /> Vindicated
      </span>
    )
  }
  if (status === 'refuted') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-against-500/10 border border-against-500/30 text-[10px] font-mono font-semibold text-against-400">
        <XCircle className="h-3 w-3" /> Refuted
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-200 border border-surface-300 text-[10px] font-mono font-semibold text-surface-500">
      <Eye className="h-3 w-3" /> Expired
    </span>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-surface-300 bg-surface-100 p-3">
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2.5 w-48" />
          </div>
          <Skeleton className="h-6 w-12 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

// ─── Oracle row ───────────────────────────────────────────────────────────────

function OracleRow({
  oracle,
  view,
  isTop3,
}: {
  oracle: ThesisOracle
  view: 'accuracy' | 'volume'
  isTop3: boolean
}) {
  const m = medal(oracle.rank)
  const accuracyColor =
    oracle.accuracy_pct >= 80
      ? 'text-emerald'
      : oracle.accuracy_pct >= 60
        ? 'text-gold'
        : oracle.accuracy_pct >= 40
          ? 'text-for-400'
          : 'text-against-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(oracle.rank * 0.04, 0.4) }}
    >
      <Link
        href={`/profile/${oracle.username}`}
        className={cn(
          'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:border-surface-400/60',
          isTop3
            ? 'bg-surface-100/80 border-surface-300'
            : 'bg-surface-100/40 border-surface-300/60'
        )}
      >
        {/* Rank */}
        <div className="w-7 flex-shrink-0 text-center">
          {m ? (
            <m.icon className={cn('h-4 w-4 mx-auto', m.color)} />
          ) : (
            <span className="text-xs font-mono font-bold text-surface-500 tabular-nums">
              {oracle.rank}
            </span>
          )}
        </div>

        {/* Avatar */}
        <Avatar
          src={oracle.avatar_url}
          fallback={oracle.display_name || oracle.username}
          size="sm"
          className="flex-shrink-0"
        />

        {/* Name + stats */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">
              {oracle.display_name || oracle.username}
            </span>
            {oracle.role !== 'citizen' && (
              <Badge variant="active" className="text-[10px] py-0 px-1.5">
                {oracle.role}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] font-mono text-surface-500">
              @{oracle.username}
            </span>
            {view === 'accuracy' && (
              <>
                <span className="text-[11px] font-mono text-emerald">
                  {oracle.vindicated}V
                </span>
                <span className="text-[11px] font-mono text-against-400">
                  {oracle.refuted}R
                </span>
                <span className="text-[11px] font-mono text-surface-500">
                  of {oracle.total_resolved}
                </span>
              </>
            )}
            {view === 'volume' && (
              <>
                <span className="text-[11px] font-mono text-for-400">
                  {oracle.total_theses} theses
                </span>
                <span className="text-[11px] font-mono text-surface-500">
                  {oracle.active_theses} active
                </span>
              </>
            )}
          </div>
        </div>

        {/* Primary metric */}
        <div className="flex-shrink-0 text-right">
          {view === 'accuracy' && (
            <p className={cn('text-sm font-mono font-bold tabular-nums', accuracyColor)}>
              {oracle.accuracy_pct}%
            </p>
          )}
          {view === 'volume' && (
            <p className="text-sm font-mono font-bold text-purple tabular-nums">
              {fmtNum(oracle.total_theses)}
            </p>
          )}
          <div className="flex items-center gap-0.5 justify-end mt-0.5">
            <Coins className="h-2.5 w-2.5 text-gold" />
            <span className="text-[11px] font-mono text-gold tabular-nums">
              {fmtNum(oracle.clout)}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Recently resolved card ───────────────────────────────────────────────────

function ResolvedCard({ thesis }: { thesis: RecentlyResolvedThesis }) {
  const catColor = CATEGORY_COLOR[thesis.category] ?? 'text-surface-500'
  return (
    <Link
      href={`/thesis/${thesis.id}`}
      className="flex items-start gap-3 rounded-xl border border-surface-300/60 bg-surface-100/40 px-3 py-2.5 hover:border-surface-400/60 transition-colors"
    >
      <Avatar
        src={thesis.author_avatar_url}
        fallback={thesis.author_display_name || thesis.author_username}
        size="sm"
        className="flex-shrink-0 mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-mono font-semibold text-surface-300">
            @{thesis.author_username}
          </span>
          <StatusPill status={thesis.status} />
          <span className={cn('text-[10px] font-mono capitalize', catColor)}>
            {thesis.category}
          </span>
        </div>
        <p className="text-xs text-white leading-snug line-clamp-2">
          &ldquo;{thesis.statement}&rdquo;
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[10px] font-mono text-surface-500">
            {relativeTime(thesis.resolved_at)}
          </span>
          <span className="text-[10px] font-mono text-emerald">{thesis.agree_count} agree</span>
          <span className="text-[10px] font-mono text-against-400">{thesis.disagree_count} disagree</span>
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 mt-1" />
    </Link>
  )
}

// ─── Tab config ───────────────────────────────────────────────────────────────

type ViewId = 'accuracy' | 'volume'

const RANK_TABS: Array<{
  id: ViewId
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}> = [
  {
    id: 'accuracy',
    label: 'By Accuracy',
    icon: Target,
    description: 'Ranked by vindication rate. Minimum 1 resolved thesis to qualify.',
  },
  {
    id: 'volume',
    label: 'By Volume',
    icon: BookOpen,
    description: 'Ranked by total theses published. All public thesis authors shown.',
  },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ThesisLeaderboardPage() {
  const [data, setData] = useState<ThesisLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewId>('accuracy')
  const [showResolved, setShowResolved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leaderboard/theses', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const currentList = data
    ? view === 'accuracy'
      ? data.topByAccuracy
      : data.topByVolume
    : []

  const activeTab = RANK_TABS.find((t) => t.id === view)!

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/leaderboard"
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-surface-300 bg-surface-100 hover:border-surface-400 transition-colors flex-shrink-0"
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-lg font-bold text-white leading-tight">
              Civic Oracle Leaderboard
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Who predicts the future of civic society best?
            </p>
          </div>
          <button
            onClick={() => load()}
            disabled={loading}
            aria-label="Refresh"
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-surface-300 bg-surface-100 hover:border-surface-400 transition-colors flex-shrink-0"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-400', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Platform stats strip ─────────────────────────────────────────── */}
        {data && (
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[
              {
                label: 'Oracles',
                value: fmtNum(data.platformStats.total_oracle_users),
                icon: Eye,
                color: 'text-purple',
              },
              {
                label: 'Theses',
                value: fmtNum(data.platformStats.total_theses),
                icon: Scroll,
                color: 'text-for-400',
              },
              {
                label: 'Vindicated',
                value: fmtNum(data.platformStats.vindicated),
                icon: CheckCircle2,
                color: 'text-emerald',
              },
              {
                label: 'Platform Acc.',
                value: `${data.platformStats.platform_accuracy_pct}%`,
                icon: Sparkles,
                color:
                  data.platformStats.platform_accuracy_pct >= 60
                    ? 'text-emerald'
                    : 'text-gold',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-2.5 text-center"
              >
                <stat.icon className={cn('h-3.5 w-3.5 mx-auto mb-1', stat.color)} />
                <p className="font-mono text-sm font-bold text-white tabular-nums">{stat.value}</p>
                <p className="text-xs font-mono text-surface-500 mt-0.5 leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-100 border border-surface-300 mb-5">
          {RANK_TABS.map((tab) => {
            const Icon = tab.icon
            const active = view === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-semibold transition-colors',
                  active
                    ? 'bg-purple/20 text-purple border border-purple/40'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ── Tab description ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-100 border border-surface-300 mb-4">
          <Zap className="h-3.5 w-3.5 text-purple flex-shrink-0" />
          <p className="text-xs font-mono text-surface-400">{activeTab.description}</p>
          {data && currentList.length > 0 && (
            <span className="ml-auto text-xs font-mono text-surface-600 flex-shrink-0">
              {currentList.length} ranked
            </span>
          )}
        </div>

        {/* ── Main ranked list ─────────────────────────────────────────────── */}
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-against-500/30 bg-against-500/5 p-6 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              onClick={() => load()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : currentList.length === 0 ? (
          <EmptyState
            icon={Scroll}
            title="No theses resolved yet"
            description={
              view === 'accuracy'
                ? 'Publish a thesis and resolve it as Vindicated or Refuted to appear here.'
                : 'No public theses have been published yet.'
            }
            action={{ label: 'Write a thesis', href: '/thesis' }}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {currentList.map((o) => (
                <OracleRow
                  key={o.user_id}
                  oracle={o}
                  view={view}
                  isTop3={o.rank <= 3}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Recently resolved ────────────────────────────────────────────── */}
        {data && data.recentResolutions.length > 0 && !loading && !error && (
          <div className="mt-8">
            <button
              onClick={() => setShowResolved((v) => !v)}
              className="flex items-center gap-2 w-full text-left mb-3 group"
            >
              <h2 className="font-mono text-sm font-bold text-surface-300 group-hover:text-white transition-colors">
                Recently Resolved
              </h2>
              <span className="text-xs font-mono text-surface-600 bg-surface-200 px-1.5 py-0.5 rounded">
                {data.recentResolutions.length}
              </span>
              <ChevronRight
                className={cn(
                  'h-3.5 w-3.5 text-surface-500 ml-auto transition-transform',
                  showResolved && 'rotate-90'
                )}
              />
            </button>

            <AnimatePresence>
              {showResolved && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2">
                    {data.recentResolutions.map((t) => (
                      <ResolvedCard key={t.id} thesis={t} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── CTA strip ───────────────────────────────────────────────────── */}
        {!loading && !error && (
          <div className="mt-8 grid grid-cols-2 gap-2">
            <Link
              href="/thesis"
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-purple/10 border border-purple/30 hover:bg-purple/20 transition-colors"
            >
              <div>
                <p className="text-xs font-mono font-semibold text-purple">Thesis Board</p>
                <p className="text-xs font-mono text-surface-500 mt-0.5">Browse all theses</p>
              </div>
              <ArrowRight className="h-4 w-4 text-purple flex-shrink-0" />
            </Link>

            <Link
              href="/analytics/thesis"
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-for-500/10 border border-for-500/30 hover:bg-for-500/20 transition-colors"
            >
              <div>
                <p className="text-xs font-mono font-semibold text-for-400">My Analytics</p>
                <p className="text-xs font-mono text-surface-500 mt-0.5">Track your theses</p>
              </div>
              <ArrowRight className="h-4 w-4 text-for-400 flex-shrink-0" />
            </Link>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
