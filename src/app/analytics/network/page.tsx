'use client'

/**
 * /analytics/network — Civic Network Topology
 *
 * Analyzes the structure and health of your social graph:
 *   • Network size & 2nd-degree reach
 *   • Echo Chamber Score — are you only hearing what you already believe?
 *   • Ideological Diversity Index — how varied are the views in your network?
 *   • Bridge Score — do you connect different communities?
 *   • Per-category divergence between your votes and your network's votes
 *   • Suggested follows to improve network diversity
 *
 * Distinct from:
 *   /analytics/following  — what your network is voting on right now
 *   /analytics/kin        — who agrees/disagrees with you most
 *   /analytics/influence  — how influential you are in the network
 *   /network              — platform-wide social graph explorer
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  GitBranch,
  Globe,
  Info,
  Network,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { NetworkAnalyticsResponse, CategoryDiversity, NetworkMember } from '@/app/api/analytics/network/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Score gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({
  score,
  label,
  colorClass,
  inverse = false,
}: {
  score: number
  label: string
  colorClass: string
  inverse?: boolean
}) {
  // If inverse, a HIGH score is BAD (echo chamber)
  const displayScore = score
  const fillPct = Math.min(100, Math.max(0, score))

  const colorFill = inverse
    ? score > 70
      ? 'from-against-600 to-against-500'
      : score > 40
      ? 'from-amber-600 to-amber-500'
      : 'from-emerald to-emerald/80'
    : score > 60
    ? 'from-for-600 to-for-500'
    : score > 30
    ? 'from-amber-600 to-amber-500'
    : 'from-against-500 to-against-400'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">
          {label}
        </span>
        <span className={cn('text-xl font-mono font-bold', colorClass)}>
          {displayScore}
          <span className="text-xs text-surface-500 ml-0.5">/100</span>
        </span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden bg-surface-300">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fillPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          className={cn('h-full rounded-full bg-gradient-to-r', colorFill)}
        />
      </div>
    </div>
  )
}

// ─── Category divergence bar ──────────────────────────────────────────────────

function DivergenceBar({ item }: { item: CategoryDiversity }) {
  const myPct = item.my_pct_for
  const netPct = item.network_avg_pct_for
  const divergence = item.divergence

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-surface-600">{item.category}</span>
        <span
          className={cn(
            'text-[10px] font-mono font-semibold',
            divergence > 25 ? 'text-against-400' : divergence > 10 ? 'text-amber-400' : 'text-emerald'
          )}
        >
          {divergence > 0 ? `±${divergence}%` : 'aligned'}
        </span>
      </div>
      <div className="relative h-5 rounded-lg overflow-hidden bg-surface-300">
        {/* My bar */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${myPct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 bg-for-600/70 rounded-l-lg"
        />
        {/* Network bar */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${netPct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
          className="absolute inset-y-0 left-0 h-full border-r-2 border-white/40"
          style={{ opacity: 0 }}
        />
        {/* Network marker line */}
        <motion.div
          initial={{ left: '50%' }}
          animate={{ left: `${netPct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
          className="absolute inset-y-0 w-0.5 bg-white/60"
        />
        <div className="absolute inset-0 flex items-center px-2 gap-2">
          <span className="text-[9px] font-mono text-white/70 flex-1 truncate">
            You: {myPct}% FOR
          </span>
          <span className="text-[9px] font-mono text-white/50 flex-shrink-0">
            Net: {netPct}%
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Member card ──────────────────────────────────────────────────────────────

function MemberCard({ member, showBridge = false }: { member: NetworkMember; showBridge?: boolean }) {
  return (
    <Link
      href={`/profile/${member.username}`}
      className="flex items-center gap-3 rounded-xl px-3.5 py-3 border border-surface-300 bg-surface-100 hover:bg-surface-200 transition-colors group"
    >
      <Avatar
        src={member.avatar_url}
        alt={member.display_name ?? member.username}
        size="sm"
        className="flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-mono font-semibold text-white truncate">
            {member.display_name ?? member.username}
          </span>
          {showBridge && member.is_bridge && (
            <span className="text-[9px] font-mono font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded px-1 py-0.5 flex-shrink-0">
              BRIDGE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-mono text-surface-500">@{member.username}</span>
          {member.agreement_pct !== null && (
            <span
              className={cn(
                'text-[10px] font-mono',
                member.agreement_pct >= 60 ? 'text-for-400' : member.agreement_pct >= 40 ? 'text-amber-400' : 'text-against-400'
              )}
            >
              {member.agreement_pct}% agree
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Zap className="h-3 w-3 text-gold" />
        <span className="text-xs font-mono text-gold">{member.clout.toLocaleString()}</span>
        <ChevronRight className="h-3 w-3 text-surface-500 group-hover:text-white transition-colors ml-1" />
      </div>
    </Link>
  )
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28 rounded-2xl" />
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NetworkAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<NetworkAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/analytics/network', { cache: 'no-store' })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as NetworkAnalyticsResponse
      setData(json)
    } catch {
      setError('Could not load your network data. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const hasNetwork = data && (data.following_count > 0 || data.followers_count > 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Network className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white leading-tight">
                Network Topology
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Echo chamber, diversity &amp; bridge analysis
              </p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 hover:bg-surface-300 disabled:opacity-50 transition-colors flex-shrink-0"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4 text-white', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-against-500/30 bg-against-600/10 p-4 mb-4 text-sm font-mono text-against-400">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && <PageSkeleton />}

        {/* No network */}
        {!loading && !error && !hasNetwork && (
          <EmptyState
            icon={Users}
            title="No network yet"
            description="Follow other citizens to unlock your civic network analysis."
            action={{ label: 'Discover people', href: '/discover' }}
          />
        )}

        {/* Data */}
        <AnimatePresence>
          {!loading && !error && hasNetwork && data && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >

              {/* Network size stats */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-5">
                  <Network className="h-3.5 w-3.5 text-for-400" />
                  Network Size
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-mono font-bold text-white">
                      <AnimatedNumber value={data.following_count} />
                    </div>
                    <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-1">
                      Following
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-mono font-bold text-white">
                      <AnimatedNumber value={data.followers_count} />
                    </div>
                    <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-1">
                      Followers
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-mono font-bold text-gold">
                      <AnimatedNumber value={data.second_degree_reach} />
                    </div>
                    <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-1">
                      2nd-Degree
                    </div>
                  </div>
                </div>

                {data.overlapping_topics > 0 && (
                  <div className="mt-4 pt-4 border-t border-surface-300 text-xs font-mono text-surface-500 text-center">
                    Analysed across{' '}
                    <span className="text-white font-semibold">{data.overlapping_topics}</span>{' '}
                    shared topics
                  </div>
                )}
              </div>

              {/* Score gauges */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-5">
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
                  <Target className="h-3.5 w-3.5 text-purple" />
                  Network Health Scores
                </div>

                <ScoreGauge
                  score={data.echo_chamber_score}
                  label="Echo Chamber Score"
                  colorClass={
                    data.echo_chamber_score > 70
                      ? 'text-against-400'
                      : data.echo_chamber_score > 40
                      ? 'text-amber-400'
                      : 'text-emerald'
                  }
                  inverse
                />

                {data.echo_chamber_score > 70 && (
                  <div className="flex items-start gap-2 rounded-xl bg-against-600/10 border border-against-500/20 p-3">
                    <Info className="h-3.5 w-3.5 text-against-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] font-mono text-against-400">
                      Your network agrees with you on most topics. Consider following citizens with different views to challenge your thinking.
                    </p>
                  </div>
                )}

                {data.echo_chamber_score <= 40 && data.overlapping_topics >= 5 && (
                  <div className="flex items-start gap-2 rounded-xl bg-emerald/10 border border-emerald/20 p-3">
                    <Shield className="h-3.5 w-3.5 text-emerald mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] font-mono text-emerald">
                      Your network actively challenges your views. You are exposed to a healthy diversity of civic opinion.
                    </p>
                  </div>
                )}

                <ScoreGauge
                  score={data.diversity_index}
                  label="Diversity Index"
                  colorClass={
                    data.diversity_index > 50 ? 'text-emerald' : data.diversity_index > 25 ? 'text-amber-400' : 'text-against-400'
                  }
                />

                <ScoreGauge
                  score={data.bridge_score}
                  label="Bridge Score"
                  colorClass={
                    data.bridge_score > 50 ? 'text-for-400' : data.bridge_score > 20 ? 'text-amber-400' : 'text-surface-500'
                  }
                />

                {data.bridge_score > 0 && (
                  <div className="flex items-start gap-2 rounded-xl bg-for-600/10 border border-for-500/20 p-3">
                    <GitBranch className="h-3.5 w-3.5 text-for-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] font-mono text-for-400">
                      You follow <strong className="text-for-300">{data.top_bridge_members.length}</strong> citizens who vote very differently from you — these bridges strengthen civic discourse.
                    </p>
                  </div>
                )}
              </div>

              {/* Category divergence */}
              {data.category_diversity.length > 0 && (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-5">
                    <Activity className="h-3.5 w-3.5 text-amber-400" />
                    Category Divergence
                    <span className="ml-auto text-[10px] text-surface-600">Your vote vs network avg</span>
                  </div>
                  <div className="space-y-3">
                    {data.category_diversity.map((item) => (
                      <DivergenceBar key={item.category} item={item} />
                    ))}
                  </div>
                  {data.category_diversity.length === 0 && (
                    <p className="text-xs font-mono text-surface-500 text-center py-4">
                      Cast more votes to see category divergence.
                    </p>
                  )}
                </div>
              )}

              {/* Bridge members */}
              {data.top_bridge_members.length > 0 && (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                    <GitBranch className="h-3.5 w-3.5 text-for-400" />
                    Your Bridge Connections
                    <span className="text-[10px] text-for-400 ml-auto">disagree with you most</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {data.top_bridge_members.map((m) => (
                      <MemberCard key={m.id} member={m} showBridge />
                    ))}
                  </div>
                </div>
              )}

              {/* Top network members */}
              {data.top_members.length > 0 && (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                    <Users className="h-3.5 w-3.5 text-emerald" />
                    Top Network Members
                    <span className="text-[10px] text-surface-600 ml-auto">by clout</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {data.top_members.map((m) => (
                      <MemberCard key={m.id} member={m} />
                    ))}
                  </div>
                  <Link
                    href="/following"
                    className="mt-4 flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                  >
                    View full network
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}

              {/* Diversity suggestions */}
              {data.diversity_suggestions.length > 0 && (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-gold" />
                    Expand Your Perspective
                  </div>
                  <p className="text-[11px] font-mono text-surface-500 mb-4">
                    Citizens outside your network who vote differently on topics you care about.
                  </p>
                  <div className="flex flex-col gap-2">
                    {data.diversity_suggestions.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 rounded-xl px-3.5 py-3 border border-surface-300 bg-surface-100 hover:bg-surface-200 transition-colors group"
                      >
                        <Avatar
                          src={s.avatar_url}
                          alt={s.display_name ?? s.username}
                          size="sm"
                          className="flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-mono font-semibold text-white truncate">
                            {s.display_name ?? s.username}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-surface-500">@{s.username}</span>
                            <span
                              className={cn(
                                'text-[10px] font-mono',
                                s.agreement_pct < 40 ? 'text-against-400' : s.agreement_pct < 55 ? 'text-amber-400' : 'text-for-400'
                              )}
                            >
                              {s.agreement_pct}% agree
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-surface-600 mt-0.5 italic">
                            {s.why}
                          </div>
                        </div>
                        <Link
                          href={`/profile/${s.username}`}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-for-600/20 border border-for-600/30 text-for-400 text-[10px] font-mono font-semibold hover:bg-for-600/30 transition-colors flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <UserPlus className="h-3 w-3" />
                          View
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Related analytics links */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Related Analytics
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { href: '/analytics/following', label: 'Network Activity', icon: Activity },
                    { href: '/analytics/kin', label: 'Political Kin', icon: Users },
                    { href: '/analytics/influence', label: 'Your Influence', icon: Globe },
                    { href: '/diversity', label: 'Diversity Score', icon: Globe },
                    { href: '/following', label: 'Following List', icon: UserPlus },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors text-xs font-mono text-surface-500 hover:text-white"
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Generated at */}
              <p className="text-[10px] font-mono text-surface-600 text-center">
                Generated {relativeTime(data.generatedAt)}
              </p>

            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
