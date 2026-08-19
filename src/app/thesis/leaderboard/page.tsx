'use client'

/**
 * /thesis/leaderboard — Civic Thesis Leaderboard
 *
 * Ranks the top civic predictors on the platform by:
 *   - Accuracy rate (vindicated / resolved, min 3 resolved theses)
 *   - Total agrees earned across all theses
 *
 * Also surfaces the most agreed-upon theses platform-wide.
 *
 * Distinct from:
 *   /thesis/analytics  — personal thesis stats for the logged-in user
 *   /leaderboard       — overall platform leaderboard (votes, rep, etc.)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Crown,
  Flame,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ThesisLeaderboardResponse, ThesisPredictorRow, ThesisMostAgreedRow } from '@/app/api/thesis/leaderboard/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d < 1) return 'today'
  if (d === 1) return '1d ago'
  if (d < 30) return `${d}d ago`
  const m = Math.floor(d / 30)
  if (m < 12) return `${m}mo ago`
  return `${Math.floor(m / 12)}y ago`
}

const CATEGORY_COLORS: Record<string, string> = {
  economics:   'text-gold border-gold/30 bg-gold/10',
  politics:    'text-for-400 border-for-400/30 bg-for-400/10',
  technology:  'text-purple border-purple/30 bg-purple/10',
  science:     'text-emerald border-emerald/30 bg-emerald/10',
  ethics:      'text-against-400 border-against-400/30 bg-against-400/10',
  philosophy:  'text-indigo-400 border-indigo-400/30 bg-indigo-400/10',
  culture:     'text-orange-400 border-orange-400/30 bg-orange-400/10',
  health:      'text-pink-400 border-pink-400/30 bg-pink-400/10',
  environment: 'text-green-400 border-green-400/30 bg-green-400/10',
  education:   'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
}

function categoryPill(cat: string) {
  return (
    <span className={cn(
      'text-[10px] font-mono px-1.5 py-0.5 rounded-full border capitalize',
      CATEGORY_COLORS[cat.toLowerCase()] ?? 'text-surface-500 border-surface-500/30 bg-surface-500/10'
    )}>
      {cat}
    </span>
  )
}

// ─── Predictor row ────────────────────────────────────────────────────────────

function PredictorCard({ row, rank }: { row: ThesisPredictorRow; rank: number }) {
  const resolved = row.vindicated + row.refuted
  const hasAccuracy = row.accuracy_pct !== null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: rank * 0.04 }}
      className={cn(
        'rounded-2xl border p-4 flex items-center gap-4 transition-colors',
        'bg-surface-100 border-surface-300 hover:border-surface-400',
        rank === 0 && 'border-gold/40 bg-gold/5',
        rank === 1 && 'border-surface-400/60 bg-surface-200/30',
        rank === 2 && 'border-against-400/30 bg-against-400/5',
      )}
    >
      {/* Rank */}
      <div className={cn(
        'flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center text-sm font-mono font-bold',
        rank === 0 && 'bg-gold/20 text-gold',
        rank === 1 && 'bg-surface-300 text-surface-600',
        rank === 2 && 'bg-against-400/20 text-against-400',
        rank >= 3 && 'bg-surface-200 text-surface-500',
      )}>
        {rank === 0 ? <Crown className="h-4 w-4" /> : `#${rank + 1}`}
      </div>

      {/* Avatar */}
      <Link href={`/profile/${row.username}`} className="flex-shrink-0">
        <Avatar
          src={row.avatar_url}
          username={row.username}
          size="md"
          className="transition-opacity hover:opacity-80"
        />
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/profile/${row.username}`}
            className="font-semibold text-white text-sm hover:text-for-300 transition-colors truncate"
          >
            {row.display_name ?? `@${row.username}`}
          </Link>
          {rank < 3 && (
            <Trophy className={cn(
              'h-3.5 w-3.5 flex-shrink-0',
              rank === 0 ? 'text-gold' : rank === 1 ? 'text-surface-500' : 'text-against-400'
            )} />
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs font-mono text-surface-500 flex-wrap">
          <span>{row.total_theses} thesis{row.total_theses !== 1 ? 'es' : ''}</span>
          {resolved > 0 && (
            <>
              <span className="text-emerald flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {row.vindicated}
              </span>
              <span className="text-against-400 flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                {row.refuted}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Accuracy badge */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        {hasAccuracy ? (
          <div className={cn(
            'text-base font-mono font-bold',
            (row.accuracy_pct ?? 0) >= 70 ? 'text-emerald' :
            (row.accuracy_pct ?? 0) >= 50 ? 'text-gold' : 'text-against-400'
          )}>
            {row.accuracy_pct}%
          </div>
        ) : (
          <div className="text-xs font-mono text-surface-500">—</div>
        )}
        <div className="text-[10px] font-mono text-surface-500 flex items-center gap-1">
          <ThumbsUp className="h-2.5 w-2.5" />
          {row.total_agrees.toLocaleString()}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Most agreed thesis row ───────────────────────────────────────────────────

function ThesisRow({ thesis, rank }: { thesis: ThesisMostAgreedRow; rank: number }) {
  const netAgreement = thesis.agree_count - thesis.disagree_count
  const isPositive = netAgreement > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: rank * 0.03 }}
    >
      <Link
        href={`/thesis/${thesis.id}`}
        className={cn(
          'flex items-start gap-3 py-3 px-1 rounded-lg group',
          'hover:bg-surface-200/50 transition-colors -mx-1',
        )}
      >
        {/* Rank number */}
        <span className="flex-shrink-0 text-xs font-mono text-surface-500 w-5 pt-0.5">
          {rank + 1}
        </span>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
            {thesis.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {categoryPill(thesis.category)}
            {thesis.status === 'vindicated' && (
              <span className="text-[10px] font-mono text-emerald flex items-center gap-0.5">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Vindicated
              </span>
            )}
            {thesis.status === 'refuted' && (
              <span className="text-[10px] font-mono text-against-400 flex items-center gap-0.5">
                <XCircle className="h-2.5 w-2.5" />
                Refuted
              </span>
            )}
            <span className="text-[10px] font-mono text-surface-500">
              @{thesis.author_username}
            </span>
            <span className="text-[10px] font-mono text-surface-600">
              {relTime(thesis.created_at)}
            </span>
          </div>
        </div>

        {/* Agreement stat */}
        <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
          <div className={cn(
            'text-sm font-mono font-bold',
            isPositive ? 'text-emerald' : 'text-against-400',
          )}>
            +{thesis.agree_count}
          </div>
          {thesis.disagree_count > 0 && (
            <div className="text-[10px] font-mono text-surface-500">
              −{thesis.disagree_count}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton loading state ───────────────────────────────────────────────────

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-12 flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

// ─── Tab ─────────────────────────────────────────────────────────────────────

type Tab = 'predictors' | 'agreed'

const TABS: { id: Tab; label: string; icon: typeof Trophy }[] = [
  { id: 'predictors', label: 'Top Predictors', icon: Trophy },
  { id: 'agreed',     label: 'Most Agreed',    icon: ThumbsUp },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ThesisLeaderboardPage() {
  const [tab, setTab] = useState<Tab>('predictors')
  const [data, setData] = useState<ThesisLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/thesis/leaderboard', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as ThesisLeaderboardResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const accuracyPredictors = data?.predictors.filter((p) => p.accuracy_pct !== null) ?? []
  const allPredictors = data?.predictors ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/thesis"
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
                'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
              )}
              aria-label="Back to Thesis Board"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Trophy className="h-5 w-5 text-gold" />
                Thesis Leaderboard
              </h1>
              <p className="text-sm text-surface-500 mt-0.5">
                Top civic predictors ranked by accuracy and community agreement
              </p>
            </div>
          </div>

          {/* Stats strip */}
          {data && (
            <div className="flex items-center gap-4 text-xs font-mono text-surface-500 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {allPredictors.length} predictor{allPredictors.length !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-emerald" />
                {accuracyPredictors.length} with scored accuracy
              </span>
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-for-400" />
                {data.most_agreed.length} featured theses
              </span>
              <button
                onClick={load}
                className="ml-auto flex items-center gap-1 text-surface-500 hover:text-white transition-colors"
                aria-label="Refresh leaderboard"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>
          )}
        </div>

        {/* Accuracy legend */}
        <div className="mb-4 rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <BarChart2 className="h-3.5 w-3.5 text-surface-400" />
            <span className="text-surface-500">Accuracy =</span>
            <span className="text-white">vindicated / (vindicated + refuted)</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono flex-wrap">
            <span className="flex items-center gap-1 text-emerald"><CheckCircle2 className="h-3 w-3" /> ≥70% stellar</span>
            <span className="flex items-center gap-1 text-gold"><Award className="h-3 w-3" /> 50–69% solid</span>
            <span className="flex items-center gap-1 text-against-400"><XCircle className="h-3 w-3" /> &lt;50% needs work</span>
          </div>
          <span className="text-[11px] font-mono text-surface-500 ml-auto">min 3 resolved to score</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-surface-200 rounded-xl p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium transition-colors',
                tab === id
                  ? 'bg-surface-100 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-700',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LeaderboardSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={Shield}
                iconColor="text-against-400"
                iconBg="bg-against-400/10"
                iconBorder="border-against-400/30"
                title="Failed to load"
                description="Could not fetch leaderboard data. Please try again."
                action={{ label: 'Retry', onClick: load }}
              />
            </motion.div>
          ) : tab === 'predictors' ? (
            <motion.div
              key="predictors"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {allPredictors.length === 0 ? (
                <EmptyState
                  icon={Trophy}
                  iconColor="text-gold"
                  iconBg="bg-gold/10"
                  iconBorder="border-gold/30"
                  title="No predictors yet"
                  description="Be the first to publish a thesis and stake your civic reputation."
                  action={{ label: 'Create thesis', href: '/thesis/create' }}
                />
              ) : (
                <div className="space-y-2">
                  {allPredictors.map((row, i) => (
                    <PredictorCard key={row.user_id} row={row} rank={i} />
                  ))}
                </div>
              )}

              {/* CTA */}
              {allPredictors.length > 0 && (
                <div className="mt-8 text-center">
                  <Link
                    href="/thesis/create"
                    className={cn(
                      'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium',
                      'bg-for-500 hover:bg-for-400 text-white transition-colors',
                    )}
                  >
                    <Sparkles className="h-4 w-4" />
                    Publish your thesis
                  </Link>
                  <p className="text-xs text-surface-500 mt-2">
                    Stake your civic reputation on a prediction and climb the leaderboard.
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="agreed"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {data?.most_agreed.length === 0 ? (
                <EmptyState
                  icon={ThumbsUp}
                  iconColor="text-for-400"
                  iconBg="bg-for-400/10"
                  iconBorder="border-for-400/30"
                  title="No agreed theses yet"
                  description="Published theses that earn community agreement will appear here."
                  action={{ label: 'Browse theses', href: '/thesis' }}
                />
              ) : (
                <div className="divide-y divide-surface-300">
                  {data?.most_agreed.map((thesis, i) => (
                    <ThesisRow key={thesis.id} thesis={thesis} rank={i} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Links to related pages */}
        <div className="mt-10 grid grid-cols-2 gap-3">
          {[
            { href: '/thesis', label: 'Thesis Board', icon: BookOpen, color: 'text-for-400' },
            { href: '/thesis/analytics', label: 'My Analytics', icon: BarChart2, color: 'text-purple' },
            { href: '/thesis/hot', label: 'Hot Theses', icon: Flame, color: 'text-against-400' },
            { href: '/leaderboard', label: 'Full Leaderboard', icon: Trophy, color: 'text-gold' },
          ].map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium',
                'bg-surface-100 border border-surface-300 hover:border-surface-400',
                'text-surface-500 hover:text-white transition-colors',
              )}
            >
              <Icon className={cn('h-4 w-4', color)} />
              {label}
              <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-50" />
            </Link>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
