'use client'

/**
 * /analytics/following — Civic Network Analytics
 *
 * Shows what your followed users are voting on, arguing about,
 * and where you agree or disagree with your civic network.
 *
 * Distinct from:
 *   /following           — list of who you follow
 *   /analytics/influence — YOUR influence on others
 *   /cohort              — finding users who think like you
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Flame,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  FollowingAnalyticsResponse,
  NetworkTopic,
  ActiveFollower,
  NetworkAgreement,
} from '@/app/api/analytics/following/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Law',
  failed: 'Failed',
}

const STATUS_COLOR: Record<string, string> = {
  proposed: 'text-surface-400',
  active: 'text-for-400',
  voting: 'text-gold',
  law: 'text-emerald',
  failed: 'text-against-400',
}

const ROLE_LABELS: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}
function catColor(c: string | null) { return c ? (CAT_COLOR[c] ?? 'text-surface-400') : 'text-surface-500' }

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  iconBg,
  animateValue,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  animateValue?: number
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 flex flex-col gap-2">
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div>
        <p className="font-mono text-xl font-bold text-white tabular-nums">
          {animateValue !== undefined ? <AnimatedNumber value={animateValue} /> : value}
        </p>
        {sub && <p className="text-[11px] font-mono text-surface-500 mt-0.5">{sub}</p>}
      </div>
      <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">{label}</p>
    </div>
  )
}

// ─── Network topic row ────────────────────────────────────────────────────────

function NetworkTopicRow({ topic }: { topic: NetworkTopic }) {
  const forPct = topic.network_for_pct
  const againstPct = topic.network_against_pct

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="flex flex-col gap-2 px-4 py-3 hover:bg-surface-200/50 transition-colors"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium leading-snug line-clamp-2">
            {topic.statement}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {topic.category && (
              <span className={cn('text-[11px] font-mono', catColor(topic.category))}>
                {topic.category}
              </span>
            )}
            <span className={cn('text-[11px] font-mono', STATUS_COLOR[topic.status] ?? 'text-surface-400')}>
              {STATUS_LABEL[topic.status] ?? topic.status}
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-xs font-mono text-surface-500">{topic.network_votes} votes</p>
          {topic.my_side !== null && (
            <div className={cn(
              'flex items-center gap-1 mt-0.5 text-[11px] font-mono font-semibold',
              topic.agrees_with_network ? 'text-emerald' : 'text-against-400'
            )}>
              {topic.agrees_with_network
                ? <><CheckCircle2 className="h-3 w-3" />aligned</>
                : <><XCircle className="h-3 w-3" />diverge</>
              }
            </div>
          )}
        </div>
      </div>

      {/* Network vote bar */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-for-400 w-8 text-right">{forPct}%</span>
        <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-for-500 rounded-full transition-all duration-500"
            style={{ width: `${forPct}%` }}
          />
        </div>
        <span className="text-[11px] font-mono text-against-400 w-8">{againstPct}%</span>
      </div>
    </Link>
  )
}

// ─── Follower row ─────────────────────────────────────────────────────────────

function FollowerRow({ follower, rank }: { follower: ActiveFollower; rank: number }) {
  return (
    <Link
      href={`/profile/${follower.username}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-200/50 transition-colors"
    >
      <span className="text-xs font-mono text-surface-600 w-4 text-center">{rank}</span>
      <Avatar
        src={follower.avatar_url}
        fallback={follower.display_name ?? follower.username}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {follower.display_name ?? follower.username}
        </p>
        <p className="text-[11px] font-mono text-surface-500">
          {ROLE_LABELS[follower.role] ?? follower.role}
        </p>
      </div>
      <div className="flex items-center gap-3 text-right">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs font-mono text-for-400">{follower.votes_30d}v</span>
          <span className="text-[11px] font-mono text-surface-500">{follower.args_30d}a</span>
        </div>
        <div className="flex items-center gap-1 text-xs font-mono text-gold">
          <Zap className="h-3 w-3" />
          {follower.clout.toLocaleString()}
        </div>
      </div>
    </Link>
  )
}

// ─── Agreement row ────────────────────────────────────────────────────────────

function AgreementRow({ item }: { item: NetworkAgreement }) {
  return (
    <Link
      href={`/topic/${item.topic_id}`}
      className="flex items-start gap-3 px-4 py-3 hover:bg-surface-200/50 transition-colors"
    >
      <div className={cn(
        'flex-shrink-0 h-5 w-5 mt-0.5 rounded-full flex items-center justify-center',
        item.agrees ? 'bg-emerald/20' : 'bg-against-500/20'
      )}>
        {item.agrees
          ? <ThumbsUp className="h-3 w-3 text-emerald" />
          : <ThumbsDown className="h-3 w-3 text-against-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white leading-snug line-clamp-2">{item.statement}</p>
        <div className="flex items-center gap-2 mt-1">
          {item.category && (
            <span className={cn('text-[11px] font-mono', catColor(item.category))}>
              {item.category}
            </span>
          )}
          <span className="text-[11px] font-mono text-surface-500">
            You:{' '}
            <span className={item.my_side === 'blue' ? 'text-for-400' : 'text-against-400'}>
              {item.my_side === 'blue' ? 'For' : 'Against'}
            </span>
            {' · '}Network:{' '}
            <span className={item.network_for_pct >= 50 ? 'text-for-400' : 'text-against-400'}>
              {item.network_for_pct >= 50
                ? `${item.network_for_pct}% For`
                : `${100 - item.network_for_pct}% Against`}
            </span>
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 space-y-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 divide-y divide-surface-300">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3 px-4 py-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FollowingAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<FollowingAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState<'hot' | 'active' | 'align'>('hot')

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch('/api/analytics/following', { cache: 'no-store' })
      .then((r) => {
        if (r.status === 401) { router.push('/login'); return null }
        if (!r.ok) throw new Error('fetch failed')
        return r.json()
      })
      .then((d) => { if (d) setData(d as FollowingAnalyticsResponse) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => { load() }, [load])

  const agreementRateLabel = (rate: number | null) => {
    if (rate === null) return '—'
    if (rate >= 75) return `${rate}% · Highly aligned`
    if (rate >= 55) return `${rate}% · Mostly aligned`
    if (rate >= 45) return `${rate}% · Balanced`
    if (rate >= 25) return `${rate}% · Often diverge`
    return `${rate}% · Independent thinker`
  }

  const TABS = [
    { key: 'hot' as const, label: 'Hot Topics', icon: Flame },
    { key: 'active' as const, label: 'Most Active', icon: Users },
    { key: 'align' as const, label: 'Alignment', icon: Scale },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6 flex items-start gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0 mt-0.5"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
                <UserCheck className="h-5 w-5 text-for-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Network Analytics</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  What your civic network is debating
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={load}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Refresh"
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <p className="text-surface-500 font-mono text-sm mb-4">Failed to load network analytics</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 text-for-400 hover:text-for-300 text-sm font-mono transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        ) : !data ? null : data.following_count === 0 ? (
          <EmptyState
            icon={Users}
            iconColor="text-for-400"
            iconBg="bg-for-500/10"
            iconBorder="border-for-500/30"
            title="No one to track yet"
            description="Follow civic citizens to see their voting activity, top topics, and how your stances compare."
            actions={[
              { label: 'Find citizens', href: '/citizens', variant: 'primary' },
              { label: 'Explore cohort', href: '/cohort', variant: 'secondary' },
            ]}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Following"
                  value={data.following_count.toLocaleString()}
                  animateValue={data.following_count}
                  sub="civic citizens"
                  icon={UserCheck}
                  iconColor="text-for-400"
                  iconBg="bg-for-500/10"
                />
                <StatCard
                  label="Network Votes"
                  value={data.network_votes_30d.toLocaleString()}
                  animateValue={data.network_votes_30d}
                  sub="last 30 days"
                  icon={TrendingUp}
                  iconColor="text-emerald"
                  iconBg="bg-emerald/10"
                />
                <StatCard
                  label="Network Args"
                  value={data.network_args_30d.toLocaleString()}
                  animateValue={data.network_args_30d}
                  sub="last 30 days"
                  icon={MessageSquare}
                  iconColor="text-purple"
                  iconBg="bg-purple/10"
                />
                <StatCard
                  label="Agreement Rate"
                  value={data.agreement_rate !== null ? `${data.agreement_rate}%` : '—'}
                  sub={
                    data.agreement_rate !== null
                      ? `${data.overlapping_topics} shared topics`
                      : 'vote to compare'
                  }
                  icon={Scale}
                  iconColor="text-gold"
                  iconBg="bg-gold/10"
                />
              </div>

              {/* Agreement rate summary pill */}
              {data.agreement_rate !== null && (
                <div className={cn(
                  'rounded-xl border px-4 py-3 flex items-center gap-3',
                  data.agreement_rate >= 75
                    ? 'bg-emerald/5 border-emerald/30'
                    : data.agreement_rate >= 45
                    ? 'bg-for-500/5 border-for-500/30'
                    : 'bg-against-500/5 border-against-500/30'
                )}>
                  <div className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                    data.agreement_rate >= 75 ? 'bg-emerald/20' : data.agreement_rate >= 45 ? 'bg-for-500/20' : 'bg-against-500/20'
                  )}>
                    <Scale className={cn(
                      'h-4 w-4',
                      data.agreement_rate >= 75 ? 'text-emerald' : data.agreement_rate >= 45 ? 'text-for-400' : 'text-against-400'
                    )} />
                  </div>
                  <div>
                    <p className="text-sm font-mono font-semibold text-white">
                      {agreementRateLabel(data.agreement_rate)}
                    </p>
                    <p className="text-xs font-mono text-surface-500">
                      Based on {data.overlapping_topics} topics you and your network both voted on
                    </p>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-1 bg-surface-200 rounded-xl p-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-medium transition-all',
                      activeTab === tab.key
                        ? 'bg-surface-50 text-white shadow-sm'
                        : 'text-surface-500 hover:text-white'
                    )}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Hot Topics tab */}
                  {activeTab === 'hot' && (
                    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-300">
                        <Flame className="h-4 w-4 text-against-400" />
                        <h2 className="text-sm font-mono font-semibold text-white">
                          Hot in your network
                        </h2>
                        <span className="ml-auto text-[11px] font-mono text-surface-500">
                          last 30 days
                        </span>
                      </div>
                      {data.hot_topics.length === 0 ? (
                        <div className="px-4 py-10 text-center">
                          <p className="text-sm font-mono text-surface-500">
                            Your network has not voted on any topics recently.
                          </p>
                          <Link href="/" className="mt-3 inline-flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors">
                            Browse topics <ChevronRight className="h-3 w-3" />
                          </Link>
                        </div>
                      ) : (
                        <div className="divide-y divide-surface-300/60">
                          {data.hot_topics.map((topic) => (
                            <NetworkTopicRow key={topic.id} topic={topic} />
                          ))}
                        </div>
                      )}
                      <div className="px-4 py-3 border-t border-surface-300 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-surface-600">
                          Network vote split shown · Your position indicated
                        </span>
                        <Link
                          href="/following"
                          className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                        >
                          Manage following <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Most Active tab */}
                  {activeTab === 'active' && (
                    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-300">
                        <Users className="h-4 w-4 text-purple" />
                        <h2 className="text-sm font-mono font-semibold text-white">
                          Most active followers
                        </h2>
                        <span className="ml-auto text-[11px] font-mono text-surface-500">
                          votes (v) · args (a)
                        </span>
                      </div>
                      {data.most_active.length === 0 ? (
                        <div className="px-4 py-10 text-center">
                          <p className="text-sm font-mono text-surface-500">
                            None of your followers are active yet.
                          </p>
                        </div>
                      ) : (
                        <div className="divide-y divide-surface-300/60">
                          {data.most_active.map((follower, i) => (
                            <FollowerRow key={follower.id} follower={follower} rank={i + 1} />
                          ))}
                        </div>
                      )}
                      <div className="px-4 py-3 border-t border-surface-300">
                        <Link
                          href="/citizens"
                          className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                        >
                          Find more active citizens <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Alignment tab */}
                  {activeTab === 'align' && (
                    <div className="space-y-4">
                      {/* Agreements */}
                      <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-300">
                          <CheckCircle2 className="h-4 w-4 text-emerald" />
                          <h2 className="text-sm font-mono font-semibold text-white">
                            Where you align
                          </h2>
                          <span className="ml-auto text-[11px] font-mono text-emerald">
                            {data.agreements.length} topics
                          </span>
                        </div>
                        {data.agreements.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <p className="text-sm font-mono text-surface-500">
                              Vote on more topics to see where you align with your network.
                            </p>
                          </div>
                        ) : (
                          <div className="divide-y divide-surface-300/60">
                            {data.agreements.map((item) => (
                              <AgreementRow key={item.topic_id} item={item} />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Disagreements */}
                      <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-300">
                          <XCircle className="h-4 w-4 text-against-400" />
                          <h2 className="text-sm font-mono font-semibold text-white">
                            Where you diverge
                          </h2>
                          <span className="ml-auto text-[11px] font-mono text-against-400">
                            {data.disagreements.length} topics
                          </span>
                        </div>
                        {data.disagreements.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <p className="text-sm font-mono text-surface-500">
                              {data.overlapping_topics === 0
                                ? 'Vote on topics your network is discussing to find divergences.'
                                : 'You\'re fully aligned with your network on shared topics!'}
                            </p>
                          </div>
                        ) : (
                          <div className="divide-y divide-surface-300/60">
                            {data.disagreements.map((item) => (
                              <AgreementRow key={item.topic_id} item={item} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Footer nav */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Link
                  href="/analytics"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 text-xs font-mono transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" /> Analytics hub
                </Link>
                <Link
                  href="/cohort"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-600/20 border border-for-600/30 text-for-400 hover:bg-for-600/30 text-xs font-mono transition-colors"
                >
                  <Users className="h-3 w-3" /> Find your tribe
                </Link>
                <Link
                  href="/compare-users"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 text-xs font-mono transition-colors"
                >
                  <Scale className="h-3 w-3" /> Compare users
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
