'use client'

/**
 * /analytics/reach — Civic Argument Reach Report
 *
 * Shows how far your arguments propagate through the social network beyond
 * your direct audience. Key insight: an argument upvoted by someone with
 * 1,000 followers has far more reach than one upvoted by someone with 10.
 *
 * Metrics:
 *   • Estimated network reach = own followers + upvoters + sum of their followers
 *   • Amplification multiplier = network reach ÷ direct upvoters
 *   • Top amplifiers = upvoters ranked by their follower count
 *   • Category reach = which debate areas spread your voice furthest
 *   • Monthly reach trend (SVG sparklines)
 *
 * Distinct from:
 *   /analytics/audience   — WHO upvotes you (their role, affinity, behaviour)
 *   /analytics/influence  — composite reputation score (not social spread)
 *   /analytics/resonance  — cross-partisan appeal (opposite-side upvoters)
 *   /analytics/cascade    — legislative chain propagation (topic chains, not social)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  ExternalLink,
  Globe,
  Radio,
  RefreshCw,
  Signal,
  Sparkles,
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
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  ReachResponse,
  TopAmplifier,
  CategoryReach,
  MonthlyReach,
} from '@/app/api/analytics/reach/route'

// ─── Tier config ───────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  local:           'text-surface-400',
  district:        'text-for-400',
  regional:        'text-emerald',
  national:        'text-gold',
  civic_broadcast: 'text-purple',
}

const TIER_BORDER: Record<string, string> = {
  local:           'border-surface-400/30',
  district:        'border-for-400/30',
  regional:        'border-emerald/30',
  national:        'border-gold/30',
  civic_broadcast: 'border-purple/30',
}

// ─── SVG Sparkline ─────────────────────────────────────────────────────────────

function Sparkline({
  data,
  width = 280,
  height = 56,
  color = '#3b82f6',
}: {
  data: number[]
  width?: number
  height?: number
  color?: string
}) {
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * width
    const y = height - (v / max) * (height - 8) - 4
    return `${x},${y}`
  })
  const pathD = pts.length > 0 ? `M ${pts.join(' L ')}` : ''
  const areaD = pts.length > 0
    ? `M ${pts[0]} L ${pts.join(' L ')} L ${(data.length - 1) / Math.max(data.length - 1, 1) * width},${height} L 0,${height} Z`
    : ''

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={`reach-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {areaD && (
        <path
          d={areaD}
          fill={`url(#reach-grad-${color.replace('#', '')})`}
        />
      )}
      {pathD && (
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'for',
  delay = 0,
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ElementType
  accent?: 'for' | 'emerald' | 'gold' | 'purple' | 'against'
  delay?: number
}) {
  const colors = {
    for:     { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/20',     icon: 'text-for-400' },
    emerald: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/20',     icon: 'text-emerald' },
    gold:    { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/20',        icon: 'text-gold' },
    purple:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/20',      icon: 'text-purple' },
    against: { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/20', icon: 'text-against-400' },
  }[accent]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={cn('rounded-2xl bg-surface-100 border p-5', colors.border)}
    >
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
        <Icon className={cn('h-3.5 w-3.5', colors.icon)} />
        {label}
      </div>
      <div className={cn('text-2xl font-mono font-bold tabular-nums', colors.text)}>
        {typeof value === 'number' ? (
          <AnimatedNumber value={value} />
        ) : (
          value
        )}
      </div>
      {sub && <div className="mt-1 text-xs font-mono text-surface-500">{sub}</div>}
    </motion.div>
  )
}

// ─── Amplifier row ─────────────────────────────────────────────────────────────

function AmplifierRow({ amp, rank, total }: { amp: TopAmplifier; rank: number; total: number }) {
  const barPct = total > 0 ? Math.round((amp.followers_count / total) * 100) : 0

  return (
    <Link
      href={`/profile/${amp.username}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-200/50 transition-colors group"
    >
      <span className="text-[10px] font-mono text-surface-500 w-5 text-right tabular-nums flex-shrink-0">
        {rank}
      </span>
      <Avatar
        src={amp.avatar_url}
        fallback={amp.username}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-mono font-medium text-white truncate group-hover:text-for-300 transition-colors">
            {amp.display_name ?? amp.username}
          </span>
          <Badge variant="person" className="text-[9px] shrink-0 capitalize">
            {amp.role}
          </Badge>
        </div>
        <div className="h-1 bg-surface-300 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${barPct}%` }}
            transition={{ duration: 0.5, delay: 0.05 * rank, ease: 'easeOut' }}
            className="h-full bg-for-500 rounded-full"
          />
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span className="text-xs font-mono font-bold text-for-400 tabular-nums">
          {amp.followers_count.toLocaleString()}
        </span>
        <span className="text-[10px] font-mono text-surface-500">followers</span>
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span className="text-xs font-mono font-bold text-emerald tabular-nums">
          {amp.upvotes_given}
        </span>
        <span className="text-[10px] font-mono text-surface-500">upvotes</span>
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-surface-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </Link>
  )
}

// ─── Category row ──────────────────────────────────────────────────────────────

function CategoryRow({ cat, maxReach }: { cat: CategoryReach; maxReach: number }) {
  const barPct = maxReach > 0 ? Math.round((cat.network_reach / maxReach) * 100) : 0

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-mono text-white">{cat.category}</span>
          <span className="text-[10px] font-mono text-surface-500">
            {cat.argument_count} arg{cat.argument_count !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${barPct}%` }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full"
          />
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0 w-20">
        <span className="text-xs font-mono font-bold text-for-400 tabular-nums">
          ~{cat.network_reach.toLocaleString()}
        </span>
        <span className="text-[10px] font-mono text-surface-500">est. reach</span>
      </div>
    </div>
  )
}

// ─── Monthly chart ─────────────────────────────────────────────────────────────

function MonthlyChart({ months }: { months: MonthlyReach[] }) {
  const networkData = months.map((m) => m.network_reach)
  const directData  = months.map((m) => m.direct_reach)
  const labels = months.map((m) => {
    const [, mo] = m.month.split('-')
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(mo) - 1]
  })
  const hasData = networkData.some((v) => v > 0)

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-20 text-xs font-mono text-surface-500">
        No data yet — write arguments to see your reach grow
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Sparkline data={networkData} color="#3b82f6" />
        <div className="absolute inset-0 pointer-events-none">
          <Sparkline data={directData} color="#10b981" height={56} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        {labels.map((l, i) => (
          <span key={i} className="text-[9px] font-mono text-surface-500">{l}</span>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-for-400 rounded" />
          <span className="text-[10px] font-mono text-surface-500">Network reach</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-emerald rounded" />
          <span className="text-[10px] font-mono text-surface-500">Direct upvoters</span>
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ReachPage() {
  const router = useRouter()
  const [data, setData] = useState<ReachResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/reach', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load reach data')
      const json = await res.json() as ReachResponse
      setData(json)
    } catch {
      setError('Could not load reach data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { fetchData() }, [fetchData])

  const tierColor  = data ? (TIER_COLORS[data.reach_tier]  ?? 'text-surface-400') : ''
  const tierBorder = data ? (TIER_BORDER[data.reach_tier] ?? 'border-surface-400/30') : ''
  const maxAmplifierFollowers = data?.top_amplifiers[0]?.followers_count ?? 1
  const maxCatReach = data?.category_reach[0]?.network_reach ?? 1

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24 pt-2">
        <div className="max-w-2xl mx-auto px-4 space-y-5">

          {/* ── Back nav ──────────────────────────────────────────── */}
          <div className="flex items-center gap-2 pt-2">
            <Link
              href="/analytics"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Analytics
            </Link>
            <span className="text-surface-600">/</span>
            <span className="text-xs font-mono text-surface-400">Civic Reach</span>
          </div>

          {/* ── Page header ────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-1"
          >
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-for-400" />
              <h1 className="text-xl font-mono font-bold text-white">Civic Reach</h1>
            </div>
            <p className="text-sm text-surface-500 font-mono">
              How far your arguments propagate through the civic network — beyond your direct audience.
            </p>
          </motion.div>

          {/* ── Loading ────────────────────────────────────────────── */}
          {loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                    <Skeleton className="h-3 w-20 mb-3" />
                    <Skeleton className="h-7 w-24 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <Skeleton className="h-4 w-32 mb-4" />
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-3 w-32 mb-2" />
                      <Skeleton className="h-1.5 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Error ──────────────────────────────────────────────── */}
          {!loading && error && (
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center space-y-3">
              <p className="text-sm font-mono text-surface-400">{error}</p>
              <button
                onClick={fetchData}
                className="flex items-center gap-2 mx-auto text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          )}

          {/* ── Content ────────────────────────────────────────────── */}
          <AnimatePresence>
            {!loading && !error && data && (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-5"
              >

                {/* Tier badge */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className={cn(
                    'rounded-2xl bg-surface-100 border p-5',
                    tierBorder
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-surface-200 flex-shrink-0">
                      <Signal className={cn('h-5 w-5', tierColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={cn('text-base font-mono font-bold', tierColor)}>
                          {data.reach_tier_label}
                        </span>
                        <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider px-2 py-0.5 rounded-full bg-surface-200">
                          Reach Tier
                        </span>
                      </div>
                      <p className="text-sm font-mono text-surface-400">{data.reach_tier_desc}</p>
                    </div>
                    <Link
                      href="/analytics"
                      className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1 flex-shrink-0"
                    >
                      <BarChart2 className="h-3 w-3" />
                      All analytics
                    </Link>
                  </div>
                </motion.div>

                {/* Stat cards */}
                {data.total_upvotes_received === 0 ? (
                  <EmptyState
                    icon={Radio}
                    title="No reach data yet"
                    description="Write arguments on topics to start building your civic reach. Every upvote expands your network reach."
                    action={{ label: 'Browse topics', href: '/' }}
                  />
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <StatCard
                        label="Est. Network Reach"
                        value={data.estimated_network_reach}
                        sub="total people potentially reached"
                        icon={Globe}
                        accent="for"
                        delay={0.1}
                      />
                      <StatCard
                        label="Amplification"
                        value={`${data.amplification_multiplier}×`}
                        sub="network ÷ direct upvoters"
                        icon={Zap}
                        accent="gold"
                        delay={0.15}
                      />
                      <StatCard
                        label="Direct Upvoters"
                        value={data.unique_amplifiers}
                        sub={`${data.total_upvotes_received} total upvotes`}
                        icon={Users}
                        accent="emerald"
                        delay={0.2}
                      />
                      <StatCard
                        label="Your Followers"
                        value={data.your_own_followers}
                        sub="baseline organic reach"
                        icon={Signal}
                        accent="purple"
                        delay={0.25}
                      />
                    </div>

                    {/* How reach is calculated */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="rounded-xl bg-surface-200/50 border border-surface-300 px-4 py-3"
                    >
                      <div className="flex items-start gap-3">
                        <Sparkles className="h-3.5 w-3.5 text-surface-500 mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
                          Network reach is estimated as: <span className="text-for-400">your followers</span>{' '}
                          + <span className="text-emerald">unique upvoters</span>{' '}
                          + <span className="text-gold">sum of upvoters&apos; follower counts</span>.{' '}
                          When a user with many followers upvotes your argument, your potential exposure multiplies.
                        </p>
                      </div>
                    </motion.div>

                    {/* Monthly reach chart */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 }}
                      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                    >
                      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                        <TrendingUp className="h-3.5 w-3.5 text-for-400" />
                        Monthly Reach Trend
                      </div>
                      <MonthlyChart months={data.monthly_reach} />
                    </motion.div>

                    {/* Top Amplifiers */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-4 py-4 border-b border-surface-300">
                        <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
                          <Zap className="h-3.5 w-3.5 text-gold" />
                          Top Amplifiers
                        </div>
                        <span className="text-[10px] font-mono text-surface-500">
                          ranked by their followers
                        </span>
                      </div>

                      {data.top_amplifiers.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm font-mono text-surface-500">
                          No amplifiers yet — keep writing arguments
                        </div>
                      ) : (
                        <div className="divide-y divide-surface-300/50">
                          {data.top_amplifiers.slice(0, 10).map((amp, i) => (
                            <AmplifierRow
                              key={amp.user_id}
                              amp={amp}
                              rank={i + 1}
                              total={maxAmplifierFollowers}
                            />
                          ))}
                        </div>
                      )}

                      {data.top_amplifiers.length > 10 && (
                        <div className="px-4 py-3 border-t border-surface-300 text-center">
                          <span className="text-xs font-mono text-surface-500">
                            +{data.top_amplifiers.length - 10} more amplifiers
                          </span>
                        </div>
                      )}
                    </motion.div>

                    {/* Category reach */}
                    {data.category_reach.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45 }}
                        className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-4 py-4 border-b border-surface-300">
                          <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
                            <Globe className="h-3.5 w-3.5 text-for-400" />
                            Reach by Category
                          </div>
                          <span className="text-[10px] font-mono text-surface-500">
                            est. network reach
                          </span>
                        </div>

                        <div className="divide-y divide-surface-300/50">
                          {data.category_reach.map((cat) => (
                            <CategoryRow
                              key={cat.category}
                              cat={cat}
                              maxReach={maxCatReach}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Reach-improving tips */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                    >
                      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                        <Sparkles className="h-3.5 w-3.5 text-purple" />
                        How to Grow Your Reach
                      </div>
                      <div className="space-y-3">
                        {[
                          {
                            title: 'Write in high-follower-count communities',
                            desc: 'Target topics followed by influential users — one upvote from a prominent debator multiplies your reach dramatically.',
                            href: '/leaderboard',
                            linkLabel: 'View leaderboard',
                          },
                          {
                            title: 'Post arguments on trending topics',
                            desc: 'Fresh arguments on active topics get seen by more users before the debate settles.',
                            href: '/trending',
                            linkLabel: 'Browse trending',
                          },
                          {
                            title: 'Gain followers by writing quality arguments',
                            desc: 'Your followers are your baseline reach — every new follower directly increases your network potential.',
                            href: '/analytics/audience',
                            linkLabel: 'See your audience',
                          },
                        ].map((tip, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-surface-200 flex items-center justify-center text-[10px] font-mono font-bold text-surface-500 mt-0.5">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-mono font-medium text-white mb-0.5">{tip.title}</div>
                              <div className="text-xs font-mono text-surface-500 mb-1">{tip.desc}</div>
                              <Link
                                href={tip.href}
                                className="inline-flex items-center gap-1 text-[10px] font-mono text-for-400 hover:text-for-300 transition-colors"
                              >
                                {tip.linkLabel}
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>

                    {/* Cross-links */}
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.55 }}
                      className="grid grid-cols-2 gap-3"
                    >
                      {[
                        { href: '/analytics/audience', label: 'Audience Profile', icon: Users, color: 'text-emerald' },
                        { href: '/analytics/resonance', label: 'Cross-Partisan Reach', icon: Globe, color: 'text-gold' },
                        { href: '/analytics/influence', label: 'Influence Score', icon: Zap, color: 'text-purple' },
                        { href: '/analytics/cascade', label: 'Influence Cascade', icon: TrendingUp, color: 'text-for-400' },
                      ].map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="flex items-center gap-2.5 rounded-xl bg-surface-100 border border-surface-300 px-3.5 py-3 hover:border-surface-200 hover:bg-surface-200/50 transition-colors group"
                        >
                          <link.icon className={cn('h-3.5 w-3.5 flex-shrink-0', link.color)} />
                          <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
                            {link.label}
                          </span>
                          <ChevronRight className="h-3 w-3 text-surface-600 ml-auto group-hover:text-surface-400 transition-colors" />
                        </Link>
                      ))}
                    </motion.div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
