'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookmarkPlus,
  Compass,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  Sparkles,
  Tag,
  Users,
  Zap,
  ChevronRight,
  Shield,
  Swords,
  Target,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { getTopicSignal, SIGNAL_PILL_CLASSES } from '@/lib/utils/topic-signal'
import type { RecommendedTopic, RecommendedTopicsResponse } from '@/app/api/topics/recommended/route'
import type { RecommendedCoalition, RecommendedCoalitionsResponse } from '@/app/api/coalitions/recommended/route'
import type { KinProfile, KinResponse } from '@/app/api/analytics/kin/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

// ─── Reason badge ─────────────────────────────────────────────────────────────

const REASON_STYLE: Record<
  RecommendedTopic['reason'],
  { icon: typeof Sparkles; cls: string }
> = {
  category_match: { icon: Tag, cls: 'text-for-400 bg-for-500/10 border-for-500/25' },
  trending: { icon: Flame, cls: 'text-against-400 bg-against-500/10 border-against-500/25' },
  coalition_stance: { icon: Shield, cls: 'text-emerald bg-emerald/10 border-emerald/25' },
  near_law: { icon: Gavel, cls: 'text-gold bg-gold/10 border-gold/25' },
  near_threshold: { icon: Zap, cls: 'text-purple bg-purple/10 border-purple/25' },
}

function ReasonPill({ reason, label }: { reason: RecommendedTopic['reason']; label: string }) {
  const { icon: Icon, cls } = REASON_STYLE[reason]
  return (
    <span className={cn('flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border', cls)}>
      <Icon className="h-2.5 w-2.5 flex-shrink-0" aria-hidden="true" />
      {label}
    </span>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({ topic, index }: { topic: RecommendedTopic; index: number }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const signal = getTopicSignal({
    status: topic.status,
    blue_pct: topic.blue_pct,
    total_votes: topic.total_votes,
    support_count: topic.support_count,
    activation_threshold: topic.activation_threshold,
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.5) }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className="block rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 hover:bg-surface-200/50 transition-colors group"
      >
        <div className="p-4">
          {/* Top row: badges */}
          <div className="flex items-center gap-2 flex-wrap mb-2.5">
            <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
              {STATUS_LABEL[topic.status] ?? topic.status}
            </Badge>
            {topic.category && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                <Tag className="h-2.5 w-2.5" aria-hidden="true" />
                {topic.category}
              </span>
            )}
            {signal && (
              <span className={cn('text-[10px] font-mono font-semibold', SIGNAL_PILL_CLASSES[signal.color])}>
                {signal.label}
              </span>
            )}
            <span className="ml-auto flex-shrink-0">
              <ReasonPill reason={topic.reason} label={topic.reason_label} />
            </span>
          </div>

          {/* Statement */}
          <p className="text-sm font-medium text-white leading-snug line-clamp-2 mb-3 group-hover:text-for-300 transition-colors">
            {topic.statement}
          </p>

          {/* Vote bar */}
          {(topic.status === 'active' || topic.status === 'voting') && topic.total_votes > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                <span className="text-for-400">{forPct}% For</span>
                <span className="text-against-400">{againstPct}% Against</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className="h-full bg-for-500 rounded-full transition-all"
                  style={{ width: `${forPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Proposed: support bar */}
          {topic.status === 'proposed' && topic.activation_threshold > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                <span className="text-purple">{topic.support_count} supports</span>
                <span className="text-surface-500">need {topic.activation_threshold}</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className="h-full bg-purple rounded-full transition-all"
                  style={{ width: `${Math.min((topic.support_count / topic.activation_threshold) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
            <span>{topic.total_votes.toLocaleString()} votes</span>
            <span>·</span>
            <span>{relativeTime(topic.created_at)}</span>
            <ChevronRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-60 transition-opacity" aria-hidden="true" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Coalition card ───────────────────────────────────────────────────────────

function CoalitionCard({ coalition, index }: { coalition: RecommendedCoalition; index: number }) {
  const winRate =
    coalition.wins + coalition.losses > 0
      ? Math.round((coalition.wins / (coalition.wins + coalition.losses)) * 100)
      : null

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.06, 0.4) }}
    >
      <Link
        href={`/coalitions/${coalition.id}`}
        className="flex items-center gap-3 p-3 rounded-xl border border-surface-300 bg-surface-100 hover:border-emerald/40 hover:bg-surface-200/50 transition-colors group"
      >
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
          <Shield className="h-5 w-5 text-emerald" aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-white truncate">{coalition.name}</span>
            {coalition.alignment_pct > 0 && (
              <span className="text-[10px] font-mono text-emerald bg-emerald/10 border border-emerald/25 px-1.5 py-0.5 rounded-full flex-shrink-0">
                {Math.round(coalition.alignment_pct)}% aligned
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
            <span className="flex items-center gap-1">
              <Users className="h-2.5 w-2.5" aria-hidden="true" />
              {coalition.member_count}/{coalition.max_members}
            </span>
            <span className="flex items-center gap-1">
              <Zap className="h-2.5 w-2.5" aria-hidden="true" />
              {Math.round(coalition.coalition_influence)} influence
            </span>
            {winRate !== null && (
              <span className="flex items-center gap-1">
                <Swords className="h-2.5 w-2.5" aria-hidden="true" />
                {winRate}% win rate
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
      </Link>
    </motion.div>
  )
}

// ─── Kin card ─────────────────────────────────────────────────────────────────

const ROLE_STYLE: Record<string, string> = {
  elder: 'text-gold',
  troll_catcher: 'text-emerald',
  debator: 'text-for-400',
  person: 'text-surface-500',
}
const ROLE_LABEL: Record<string, string> = {
  elder: 'Elder',
  troll_catcher: 'Troll Catcher',
  debator: 'Debator',
  person: 'Citizen',
}

function KinCard({ person, index }: { person: KinProfile; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.06, 0.4) }}
    >
      <Link
        href={`/profile/${person.username}`}
        className="flex items-center gap-3 p-3 rounded-xl border border-surface-300 bg-surface-100 hover:border-for-500/40 hover:bg-surface-200/50 transition-colors group"
      >
        <Avatar
          src={person.avatar_url}
          fallback={person.display_name ?? person.username}
          size="md"
          className="flex-shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-white truncate">
              {person.display_name ?? person.username}
            </span>
            <span className="text-[10px] font-mono text-for-400 bg-for-500/10 border border-for-500/25 px-1.5 py-0.5 rounded-full flex-shrink-0">
              {Math.round(person.agreement_pct)}% aligned
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
            <span className={cn('font-semibold', ROLE_STYLE[person.role] ?? 'text-surface-500')}>
              {ROLE_LABEL[person.role] ?? 'Citizen'}
            </span>
            <span>·</span>
            <span>{person.common_topics} shared votes</span>
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
      </Link>
    </motion.div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  count,
}: {
  icon: typeof Sparkles
  iconColor: string
  iconBg: string
  title: string
  description: string
  count?: number
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className={cn('flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0', iconBg)}>
        <Icon className={cn('h-4.5 w-4.5', iconColor)} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-mono font-bold text-white">{title}</h2>
          {count !== undefined && count > 0 && (
            <span className="text-xs font-mono text-surface-500">({count})</span>
          )}
        </div>
        <p className="text-xs font-mono text-surface-500 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function TopicSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-20 rounded" />
        <Skeleton className="h-5 w-24 rounded-full ml-auto" />
      </div>
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-3/4 rounded" />
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  )
}

function SideCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-surface-300 bg-surface-100">
      <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-3 w-24 rounded" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface AllData {
  topics: RecommendedTopicsResponse | null
  coalitions: RecommendedCoalitionsResponse | null
  kin: KinResponse | null
}

export default function RecommendedPage() {
  const [data, setData] = useState<AllData>({ topics: null, coalitions: null, kin: null })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const [topicsRes, coalitionsRes, kinRes] = await Promise.allSettled([
        fetch('/api/topics/recommended', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/coalitions/recommended', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/analytics/kin', { cache: 'no-store' }).then((r) => r.json()),
      ])

      setData({
        topics: topicsRes.status === 'fulfilled' ? (topicsRes.value as RecommendedTopicsResponse) : null,
        coalitions: coalitionsRes.status === 'fulfilled' ? (coalitionsRes.value as RecommendedCoalitionsResponse) : null,
        kin: kinRes.status === 'fulfilled' ? (kinRes.value as KinResponse) : null,
      })
    } catch {
      setError('Failed to load recommendations.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const topicList = data.topics?.topics ?? []
  const coalitionList = data.coalitions?.coalitions ?? []
  const kinList = data.kin?.kin ?? []
  const personalized = data.topics?.personalized ?? false

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
                <Sparkles className="h-5 w-5 text-for-400" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  For You
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  {personalized
                    ? 'Personalized debates based on your preferences'
                    : 'Top debates happening right now'}
                </p>
              </div>
            </div>

            <button
              onClick={() => load(true)}
              disabled={loading || refreshing}
              aria-label="Refresh recommendations"
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-mono',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-colors',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden="true" />
              Refresh
            </button>
          </div>

          {/* Personalization notice */}
          {!loading && personalized && data.topics?.categories_used && data.topics.categories_used.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-for-500/8 border border-for-500/20"
            >
              <Target className="h-3.5 w-3.5 text-for-400 flex-shrink-0" aria-hidden="true" />
              <p className="text-xs font-mono text-for-300">
                Tailored to:{' '}
                <span className="text-for-400 font-semibold">
                  {data.topics.categories_used.join(', ')}
                </span>
                {' · '}
                <Link href="/settings" className="underline hover:text-for-200 transition-colors">
                  Edit preferences
                </Link>
              </p>
            </motion.div>
          )}

          {!loading && !personalized && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300"
            >
              <Compass className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" aria-hidden="true" />
              <p className="text-xs font-mono text-surface-500">
                Set category preferences in{' '}
                <Link href="/settings" className="text-for-400 underline hover:text-for-300 transition-colors">
                  Settings
                </Link>{' '}
                to get personalized recommendations.
              </p>
            </motion.div>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/10 p-4 text-sm font-mono text-against-400 mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Topics (2/3 width) ──────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            <SectionHeader
              icon={Flame}
              iconColor="text-against-400"
              iconBg="bg-against-500/10 border border-against-500/25"
              title="Debates for You"
              description="Topics you haven't voted on yet, matched to your interests"
              count={loading ? undefined : topicList.length}
            />

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <TopicSkeleton key={i} />
                ))}
              </div>
            ) : topicList.length === 0 ? (
              <EmptyState
                icon={BookmarkPlus}
                title="All caught up"
                description="You've voted on all active debates. Check back soon for new topics."
                actions={[{ label: 'Browse all topics', href: '/' }]}
              />
            ) : (
              <AnimatePresence mode="wait">
                <div className="space-y-3">
                  {topicList.map((topic, i) => (
                    <TopicCard key={topic.id} topic={topic} index={i} />
                  ))}
                </div>
              </AnimatePresence>
            )}
          </div>

          {/* ── Sidebar (1/3 width) ─────────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Coalitions */}
            <div>
              <SectionHeader
                icon={Shield}
                iconColor="text-emerald"
                iconBg="bg-emerald/10 border border-emerald/25"
                title="Coalitions"
                description="Groups aligned with your voting patterns"
                count={loading ? undefined : coalitionList.length}
              />

              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <SideCardSkeleton key={i} />
                  ))}
                </div>
              ) : coalitionList.length === 0 ? (
                <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 text-center">
                  <Users className="h-8 w-8 text-surface-500 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-xs font-mono text-surface-500">
                    Vote on more topics to find aligned coalitions.
                  </p>
                  <Link
                    href="/coalitions"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                  >
                    Browse coalitions
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {coalitionList.slice(0, 5).map((c, i) => (
                    <CoalitionCard key={c.id} coalition={c} index={i} />
                  ))}
                  {coalitionList.length > 5 && (
                    <Link
                      href="/coalitions"
                      className="flex items-center justify-center gap-1.5 py-2 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      View all coalitions
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Kin (political allies) */}
            <div>
              <SectionHeader
                icon={Users}
                iconColor="text-for-400"
                iconBg="bg-for-500/10 border border-for-500/25"
                title="Political Allies"
                description="Citizens who vote like you do"
                count={loading ? undefined : kinList.length}
              />

              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <SideCardSkeleton key={i} />
                  ))}
                </div>
              ) : kinList.length === 0 ? (
                <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 text-center">
                  <Compass className="h-8 w-8 text-surface-500 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-xs font-mono text-surface-500">
                    Vote on more topics to find your political allies.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {kinList.slice(0, 5).map((person, i) => (
                    <KinCard key={person.id} person={person} index={i} />
                  ))}
                  {kinList.length > 5 && (
                    <Link
                      href="/analytics"
                      className="flex items-center justify-center gap-1.5 py-2 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      See full analysis
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Quick links */}
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
              <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">Explore More</p>
              <div className="space-y-1">
                {[
                  { href: '/surge', label: 'Surge — Near-critical topics', icon: Zap, color: 'text-against-400' },
                  { href: '/pulse', label: 'Pulse — Top arguments', icon: Scale, color: 'text-gold' },
                  { href: '/compass', label: 'Your Civic Compass', icon: Compass, color: 'text-purple' },
                  { href: '/categories', label: 'Browse by Category', icon: Tag, color: 'text-for-400' },
                ].map(({ href, label, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:bg-surface-200 hover:text-white transition-colors"
                  >
                    <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} aria-hidden="true" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
