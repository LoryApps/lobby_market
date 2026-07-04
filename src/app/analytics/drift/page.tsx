'use client'

/**
 * /analytics/drift — Civic Drift Report
 *
 * Shows how a user's fixed vote positions compare to where current community
 * consensus stands.  "Drift" occurs when the consensus has moved (or always
 * was) against the user's vote.  Distinct from:
 *
 *   /analytics/evolution       — how the USER'S OWN opinions shift over time
 *   /analytics/consensus-shift — platform-wide consensus movement
 *   /analytics/calibration     — prediction accuracy grading
 *   /prescient                 — ideological alignment with current majority
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Compass,
  ExternalLink,
  Flame,
  Gavel,
  Hash,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { DriftResponse, DriftTopic, DriftBucket } from '@/app/api/analytics/drift/route'

// ─── Bucket config ─────────────────────────────────────────────────────────────

const BUCKET_CONFIG: Record<
  DriftBucket,
  { color: string; bg: string; border: string; bar: string; icon: typeof TrendingUp }
> = {
  strongly_aligned: {
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    bar: 'bg-emerald',
    icon: TrendingUp,
  },
  aligned: {
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    bar: 'bg-for-500',
    icon: ThumbsUp,
  },
  deadlocked: {
    color: 'text-surface-400',
    bg: 'bg-surface-300/20',
    border: 'border-surface-300/30',
    bar: 'bg-surface-400',
    icon: Scale,
  },
  contrarian: {
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    bar: 'bg-against-500',
    icon: ThumbsDown,
  },
  strongly_contrarian: {
    color: 'text-against-500',
    bg: 'bg-against-600/15',
    border: 'border-against-600/40',
    bar: 'bg-against-600',
    icon: TrendingDown,
  },
}

// ─── Alignment score label ──────────────────────────────────────────────────────

function scoreLabel(score: number): { label: string; color: string; glow: string } {
  if (score >= 80) return { label: 'Crowd Follower', color: 'text-emerald', glow: 'shadow-emerald/30' }
  if (score >= 65) return { label: 'Mainstream', color: 'text-for-400', glow: 'shadow-for-500/30' }
  if (score >= 50) return { label: 'Independent', color: 'text-gold', glow: 'shadow-gold/30' }
  if (score >= 35) return { label: 'Dissenter', color: 'text-against-400', glow: 'shadow-against-500/30' }
  return { label: 'Contrarian', color: 'text-against-500', glow: 'shadow-against-600/40' }
}

function statusBadge(status: string): 'proposed' | 'active' | 'law' | 'failed' {
  if (status === 'law') return 'law'
  if (status === 'failed') return 'failed'
  if (status === 'active' || status === 'voting') return 'active'
  return 'proposed'
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  animateVal,
  delay = 0,
}: {
  label: string
  value: string | number
  sub?: string
  icon: typeof TrendingUp
  color: string
  animateVal?: number
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 flex flex-col gap-2"
    >
      <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center bg-surface-200')}>
        <Icon className={cn('h-3.5 w-3.5', color)} />
      </div>
      <div>
        <p className="font-mono text-xl font-bold text-white tabular-nums">
          {animateVal !== undefined ? <AnimatedNumber value={animateVal} /> : value}
        </p>
        <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-surface-600 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  )
}

function TopicRow({ topic, highlight }: { topic: DriftTopic; highlight: 'contrarian' | 'aligned' }) {
  const cfg = BUCKET_CONFIG[topic.bucket]
  const Icon = cfg.icon
  const userSideLabel = topic.user_vote === 'blue' ? 'FOR' : 'AGAINST'
  const consensusPct = topic.user_vote === 'blue' ? topic.blue_pct : 100 - topic.blue_pct
  const showGap = highlight === 'contrarian'

  return (
    <Link
      href={`/topic/${topic.topic_id}`}
      className="flex items-start gap-3 px-4 py-4 hover:bg-surface-200/50 transition-colors group"
    >
      <div className={cn('mt-0.5 flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center', cfg.bg, cfg.border, 'border')}>
        <Icon className={cn('h-3 w-3', cfg.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white leading-snug line-clamp-2 group-hover:text-surface-100 transition-colors">
          {topic.statement}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {topic.category && (
            <span className="text-[10px] font-mono text-surface-500 flex items-center gap-0.5">
              <Hash className="h-2.5 w-2.5" />
              {topic.category}
            </span>
          )}
          <Badge variant={statusBadge(topic.status)} size="sm">
            {statusBadge(topic.status).charAt(0).toUpperCase() + statusBadge(topic.status).slice(1)}
          </Badge>
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <div className={cn('text-xs font-mono font-semibold', topic.user_vote === 'blue' ? 'text-for-400' : 'text-against-400')}>
          {userSideLabel}
        </div>
        <div className="text-[10px] font-mono text-surface-500 mt-0.5">
          {Math.round(consensusPct)}% agree
        </div>
        {showGap && (
          <div className="text-[10px] font-mono text-against-400 mt-0.5">
            −{topic.gap}pt gap
          </div>
        )}
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function DriftPage() {
  const router = useRouter()
  const [data, setData] = useState<DriftResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'contrarian' | 'aligned' | 'recent' | 'categories'>('contrarian')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/drift')
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load drift data')
      setData(await res.json())
    } catch {
      setError('Could not load your drift report. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const scoreInfo = data ? scoreLabel(data.alignment_score) : null
  const maxBucket = data ? Math.max(...data.buckets.map((b) => b.count)) || 1 : 1

  return (
    <div className="min-h-screen bg-surface-900 text-white pb-24">
      <TopBar />

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-2">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="h-9 w-9 rounded-lg bg-surface-200 flex items-center justify-center text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white leading-tight">Civic Drift Report</h1>
            <p className="text-xs text-surface-500 font-mono mt-0.5">
              Your votes vs current community consensus
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="h-9 w-9 rounded-lg bg-surface-200 flex items-center justify-center text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 rounded-xl border border-against-500/30 bg-against-600/10 px-4 py-3 text-sm text-against-400"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="space-y-4">
            <Skeleton className="h-36 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        )}

        {/* Content */}
        {data && !loading && (
          <>
            {/* Empty state */}
            {data.total_voted === 0 ? (
              <EmptyState
                icon={Compass}
                title="No votes yet"
                description="Cast your first votes to see how your positions compare to community consensus."
                action={{ label: 'Browse topics', href: '/' }}
              />
            ) : (
              <div className="space-y-4">

                {/* Score card */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                >
                  <div className="flex items-start gap-4">
                    <Avatar
                      src={data.user.avatar_url}
                      fallback={data.user.username}
                      size="md"
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">
                        {data.user.display_name ?? data.user.username}
                      </p>
                      <p className="text-xs text-surface-500 font-mono">
                        @{data.user.username}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Compass className={cn('h-4 w-4', scoreInfo!.color)} />
                        <span className={cn('text-lg font-bold', scoreInfo!.color)}>
                          {scoreInfo!.label}
                        </span>
                      </div>
                      <p className="text-xs text-surface-500 mt-0.5">
                        Aligned on {data.alignment_score}% of your voted topics
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className={cn('text-3xl font-mono font-bold', scoreInfo!.color)}>
                        <AnimatedNumber value={data.alignment_score} />
                        <span className="text-base">%</span>
                      </div>
                      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mt-0.5">
                        alignment
                      </p>
                    </div>
                  </div>

                  {/* Alignment bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] font-mono text-surface-500 mb-1">
                      <span>CONTRARIAN</span>
                      <span>MAINSTREAM</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${data.alignment_score}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                        className={cn(
                          'h-full rounded-full',
                          data.alignment_score >= 65
                            ? 'bg-gradient-to-r from-for-600 to-emerald'
                            : data.alignment_score >= 40
                            ? 'bg-gradient-to-r from-gold to-for-500'
                            : 'bg-gradient-to-r from-against-600 to-against-400'
                        )}
                      />
                    </div>
                  </div>
                </motion.div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard
                    label="Votes Cast"
                    value={data.total_voted}
                    animateVal={data.total_voted}
                    icon={Activity}
                    color="text-surface-400"
                    delay={0.05}
                  />
                  <StatCard
                    label="Aligned"
                    value={data.aligned_count}
                    animateVal={data.aligned_count}
                    sub="with consensus"
                    icon={TrendingUp}
                    color="text-emerald"
                    delay={0.1}
                  />
                  <StatCard
                    label="Contrarian"
                    value={data.contrarian_count}
                    animateVal={data.contrarian_count}
                    sub="against consensus"
                    icon={TrendingDown}
                    color="text-against-400"
                    delay={0.15}
                  />
                  <StatCard
                    label="Deadlocked"
                    value={data.deadlocked_count}
                    animateVal={data.deadlocked_count}
                    sub="near 50/50 split"
                    icon={Scale}
                    color="text-surface-400"
                    delay={0.2}
                  />
                </div>

                {/* Bucket breakdown */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart2 className="h-4 w-4 text-surface-400" />
                    <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wide font-mono">
                      Position Distribution
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {data.buckets.map((bucket) => {
                      const cfg = BUCKET_CONFIG[bucket.bucket]
                      const Icon = cfg.icon
                      const pct = Math.round((bucket.count / maxBucket) * 100)
                      return (
                        <div key={bucket.bucket}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
                              <span className={cn('text-xs font-mono font-medium', cfg.color)}>
                                {bucket.label}
                              </span>
                            </div>
                            <span className="text-xs font-mono text-surface-500 tabular-nums">
                              {bucket.count}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.5, delay: 0.3 }}
                              className={cn('h-full rounded-full', cfg.bar)}
                            />
                          </div>
                          <p className="text-[10px] text-surface-600 mt-0.5">{bucket.description}</p>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>

                {/* Tabs */}
                <div className="flex gap-1 bg-surface-200/60 rounded-xl p-1">
                  {(
                    [
                      { key: 'contrarian', label: 'Most Contrarian', icon: TrendingDown },
                      { key: 'aligned', label: 'Most Aligned', icon: TrendingUp },
                      { key: 'categories', label: 'By Category', icon: Hash },
                      { key: 'recent', label: 'Recent', icon: Activity },
                    ] as const
                  ).map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[11px] font-mono font-medium transition-colors',
                        tab === key
                          ? 'bg-surface-100 text-white shadow-sm'
                          : 'text-surface-500 hover:text-surface-300'
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>

                {/* Tab panels */}
                <AnimatePresence mode="wait">
                  {tab === 'contrarian' && (
                    <motion.div
                      key="contrarian"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-surface-300/60">
                        <p className="text-xs text-surface-500 font-mono">
                          Topics where your vote most diverges from current consensus — highest drift gap first
                        </p>
                      </div>
                      {data.most_contrarian.length === 0 ? (
                        <div className="px-4 py-8 text-center text-surface-500 text-sm">
                          No contrarian positions yet — you&apos;re aligned with the crowd!
                        </div>
                      ) : (
                        <div className="divide-y divide-surface-300/40">
                          {data.most_contrarian.map((t) => (
                            <TopicRow key={t.topic_id} topic={t} highlight="contrarian" />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {tab === 'aligned' && (
                    <motion.div
                      key="aligned"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-surface-300/60">
                        <p className="text-xs text-surface-500 font-mono">
                          Topics where your vote most closely matches where the community stands
                        </p>
                      </div>
                      {data.most_aligned.length === 0 ? (
                        <div className="px-4 py-8 text-center text-surface-500 text-sm">
                          No aligned positions found — you&apos;re a true contrarian!
                        </div>
                      ) : (
                        <div className="divide-y divide-surface-300/40">
                          {data.most_aligned.map((t) => (
                            <TopicRow key={t.topic_id} topic={t} highlight="aligned" />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {tab === 'categories' && (
                    <motion.div
                      key="categories"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-surface-300/60">
                        <p className="text-xs text-surface-500 font-mono">
                          Alignment score by category — which topics you tend to agree or disagree with the crowd on
                        </p>
                      </div>
                      {data.category_drift.length === 0 ? (
                        <div className="px-4 py-8 text-center text-surface-500 text-sm">
                          Vote on more topics to see category breakdown.
                        </div>
                      ) : (
                        <div className="divide-y divide-surface-300/40">
                          {data.category_drift.map((cat, i) => (
                            <div key={cat.category} className="flex items-center gap-3 px-4 py-3">
                              <span className="text-xs font-mono text-surface-500 w-5 text-right flex-shrink-0">
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{cat.category}</p>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${cat.score}%` }}
                                      transition={{ duration: 0.5, delay: i * 0.05 }}
                                      className={cn(
                                        'h-full rounded-full',
                                        cat.score >= 65 ? 'bg-emerald' : cat.score >= 45 ? 'bg-gold' : 'bg-against-500'
                                      )}
                                    />
                                  </div>
                                  <span
                                    className={cn(
                                      'text-xs font-mono font-semibold tabular-nums flex-shrink-0',
                                      cat.score >= 65
                                        ? 'text-emerald'
                                        : cat.score >= 45
                                        ? 'text-gold'
                                        : 'text-against-400'
                                    )}
                                  >
                                    {cat.score}%
                                  </span>
                                </div>
                                <p className="text-[10px] text-surface-600 mt-0.5">
                                  {cat.aligned} aligned · {cat.contrarian} contrarian
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {tab === 'recent' && (
                    <motion.div
                      key="recent"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-surface-300/60">
                        <p className="text-xs text-surface-500 font-mono">
                          Your 20 most recent votes and their current consensus alignment
                        </p>
                      </div>
                      {data.recent_topics.length === 0 ? (
                        <div className="px-4 py-8 text-center text-surface-500 text-sm">
                          No recent votes found.
                        </div>
                      ) : (
                        <div className="divide-y divide-surface-300/40">
                          {data.recent_topics.map((t) => (
                            <TopicRow key={t.topic_id} topic={t} highlight="contrarian" />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Related links */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-xl bg-surface-100 border border-surface-300/60 p-4"
                >
                  <p className="text-xs font-mono text-surface-500 uppercase tracking-wide mb-3">
                    Related Reports
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Opinion Evolution', href: '/analytics/evolution', icon: TrendingUp, color: 'text-for-400' },
                      { label: 'Consensus Shift', href: '/analytics/consensus-shift', icon: Zap, color: 'text-gold' },
                      { label: 'Calibration', href: '/analytics/calibration', icon: Flame, color: 'text-purple' },
                      { label: 'Perspective Lens', href: '/analytics/lens', icon: Compass, color: 'text-emerald' },
                      { label: 'Law Analytics', href: '/analytics/laws', icon: Gavel, color: 'text-gold' },
                    ].map(({ label, href, icon: Icon, color }) => (
                      <Link
                        key={href}
                        href={href}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 text-xs font-mono text-surface-400 hover:bg-surface-300 hover:text-white transition-colors"
                      >
                        <Icon className={cn('h-3 w-3', color)} />
                        {label}
                        <ChevronRight className="h-3 w-3 text-surface-600" />
                      </Link>
                    ))}
                  </div>
                </motion.div>

              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
