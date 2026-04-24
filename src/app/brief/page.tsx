'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  Gavel,
  Mic,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { BriefData, BriefTopic, BriefLaw, BriefDebate } from '@/app/api/brief/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const m = Math.round(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 60) return `in ${m}m`
  if (h < 24) return `in ${h}h`
  return `in ${d}d`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const DEBATE_TYPE_LABEL: Record<string, string> = {
  quick: '15m',
  grand: '45m',
  tribunal: '60m',
  oxford: 'Oxford',
  town_hall: 'Town Hall',
}

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; badge: 'proposed' | 'active' | 'law' | 'failed' }
> = {
  proposed: { label: 'Proposed', dot: 'bg-surface-400', badge: 'proposed' },
  active: { label: 'Active', dot: 'bg-for-500', badge: 'active' },
  voting: { label: 'Voting', dot: 'bg-purple', badge: 'active' },
  law: { label: 'LAW', dot: 'bg-gold', badge: 'law' },
  failed: { label: 'Failed', dot: 'bg-against-500', badge: 'failed' },
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  title: string
  subtitle?: string
  href?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-lg border flex-shrink-0',
            iconBg
          )}
        >
          <Icon className={cn('h-4 w-4', iconColor)} aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-mono text-sm font-bold text-white">{title}</h2>
          {subtitle && (
            <p className="text-[11px] font-mono text-surface-500 leading-none mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
        >
          See all
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

function TopicRow({ topic }: { topic: BriefTopic }) {
  const cfg = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.proposed
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="group flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200/60 transition-all"
    >
      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs font-semibold text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors mb-1.5">
          {topic.statement}
        </p>
        <div className="h-1 w-full rounded-full overflow-hidden bg-surface-300 mb-1.5">
          <div className="flex h-full">
            <div className="bg-for-500 h-full" style={{ width: `${forPct}%` }} />
            <div className="bg-against-500 h-full" style={{ width: `${againstPct}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono">
            <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
            <span
              className={cn(
                topic.status === 'voting'
                  ? 'text-purple'
                  : topic.status === 'active'
                  ? 'text-for-400'
                  : 'text-surface-500'
              )}
            >
              {cfg.label}
            </span>
          </span>
          <span className="text-[10px] font-mono text-surface-500">
            <span className="text-for-400">{forPct}%</span>
            {' / '}
            <span className="text-against-400">{againstPct}%</span>
          </span>
          {topic.category && (
            <span className="text-[10px] font-mono text-surface-600">{topic.category}</span>
          )}
          {topic.voting_ends_at && (
            <span className="ml-auto text-[10px] font-mono text-surface-500 flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {timeUntil(topic.voting_ends_at)}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="flex-shrink-0 h-3.5 w-3.5 text-surface-500 group-hover:text-surface-300 transition-colors" />
    </Link>
  )
}

function NearLawRow({ topic }: { topic: BriefTopic }) {
  const forPct = Math.round(topic.blue_pct ?? 50)

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="group flex items-center gap-3 p-3 rounded-xl bg-gold/[0.04] border border-gold/20 hover:border-gold/40 hover:bg-gold/[0.07] transition-all"
    >
      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs font-semibold text-white leading-snug line-clamp-2 group-hover:text-gold transition-colors mb-1">
          {topic.statement}
        </p>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-gold font-bold">
            <TrendingUp className="h-2.5 w-2.5" />
            {forPct}% FOR
          </span>
          <span className="text-[10px] font-mono text-surface-500">
            {topic.total_votes.toLocaleString()} votes
          </span>
          {topic.category && (
            <span className="text-[10px] font-mono text-surface-600">{topic.category}</span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <div className="text-[10px] font-mono text-gold font-semibold">Near Law</div>
        <div className="text-[10px] font-mono text-surface-600">{100 - forPct}% short</div>
      </div>
    </Link>
  )
}

function LawRow({ law }: { law: BriefLaw }) {
  const forPct = Math.round(law.blue_pct ?? 0)

  return (
    <Link
      href={`/law/${law.id}`}
      className="group flex items-start gap-2.5 p-3 rounded-xl bg-emerald/[0.04] border border-emerald/20 hover:border-emerald/40 transition-all"
    >
      <Gavel className="h-3.5 w-3.5 text-emerald mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs font-semibold text-white leading-snug line-clamp-2 group-hover:text-emerald transition-colors">
          {law.statement}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-mono text-emerald font-bold">
            {forPct}% FOR
          </span>
          <span className="text-[10px] font-mono text-surface-500">
            {timeAgo(law.established_at)}
          </span>
          {law.category && (
            <span className="text-[10px] font-mono text-surface-600">{law.category}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

function DebateRow({ debate }: { debate: BriefDebate }) {
  const isLive = debate.status === 'live'

  return (
    <Link
      href={`/debate/${debate.id}`}
      className={cn(
        'group flex items-start gap-2.5 p-3 rounded-xl border transition-all',
        isLive
          ? 'bg-against-500/[0.04] border-against-500/20 hover:border-against-500/40'
          : 'bg-surface-100 border border-surface-300 hover:border-surface-400'
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        {isLive ? (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-against-500 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-against-500" />
          </span>
        ) : (
          <Mic className="h-3.5 w-3.5 text-for-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'font-mono text-xs font-semibold leading-snug line-clamp-2',
            isLive
              ? 'text-white group-hover:text-against-300'
              : 'text-white group-hover:text-for-300',
            'transition-colors'
          )}
        >
          {debate.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {isLive ? (
            <span className="text-[10px] font-mono font-bold text-against-400 uppercase tracking-wider">
              Live now
            </span>
          ) : (
            <span className="text-[10px] font-mono text-surface-500">
              {timeUntil(debate.scheduled_at)}
            </span>
          )}
          {debate.type && (
            <span className="text-[10px] font-mono text-surface-600">
              {DEBATE_TYPE_LABEL[debate.type] ?? debate.type}
            </span>
          )}
          {debate.viewer_count > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-surface-500">
              <Users className="h-2.5 w-2.5" />
              {debate.viewer_count}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

function PulseCard({
  icon: Icon,
  value,
  label,
  color,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  value: number
  label: string
  color: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1.5 bg-surface-100 border border-surface-300 rounded-xl px-3 py-3 hover:border-surface-400 transition-colors group"
    >
      <Icon className={cn('h-4 w-4', color)} />
      <span className={cn('text-xl font-mono font-bold', color)}>
        {value.toLocaleString()}
      </span>
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
        {label}
      </span>
    </Link>
  )
}

function BriefSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="flex gap-3 pt-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 flex-1 rounded-xl" />
          ))}
        </div>
      </div>
      {/* Sections */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center gap-2.5 mb-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-32" />
          </div>
          {[0, 1, 2].map((j) => (
            <Skeleton key={j} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Streak badge ─────────────────────────────────────────────────────────────

function StreakBadge({ streak }: { streak: number }) {
  if (streak < 1) return null
  const tier =
    streak >= 30
      ? { label: 'Legendary', color: 'text-gold', border: 'border-gold/40', bg: 'bg-gold/10' }
      : streak >= 14
      ? { label: 'Epic', color: 'text-purple', border: 'border-purple/40', bg: 'bg-purple/10' }
      : streak >= 7
      ? { label: 'Rare', color: 'text-for-400', border: 'border-for-500/40', bg: 'bg-for-500/10' }
      : { label: null, color: 'text-surface-400', border: 'border-surface-400/40', bg: 'bg-surface-300/20' }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-semibold',
        tier.color,
        tier.border,
        tier.bg
      )}
    >
      <Flame className="h-3.5 w-3.5" />
      {streak} day streak
      {tier.label && (
        <span className={cn('text-[10px] font-mono uppercase tracking-wider opacity-70')}>
          · {tier.label}
        </span>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BriefPage() {
  const [data, setData] = useState<BriefData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/brief', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      const json: BriefData = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const greeting = getGreeting()
  const hasHot = (data?.hotTopics.length ?? 0) > 0
  const hasNearLaw = (data?.nearLawTopics.length ?? 0) > 0
  const hasLaws = (data?.recentLaws.length ?? 0) > 0
  const hasDebates = (data?.todayDebates.length ?? 0) > 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* ── Page header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <Sparkles className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white leading-tight">
                Daily Brief
              </h1>
              {data && (
                <p className="text-xs font-mono text-surface-500 mt-0.5">{data.date}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            aria-label="Refresh brief"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </button>
        </div>

        {loading ? (
          <BriefSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30">
              <Activity className="h-7 w-7 text-against-400" />
            </div>
            <div>
              <p className="font-mono font-semibold text-white">Could not load your brief</p>
              <p className="text-sm font-mono text-surface-500 mt-1">Check your connection and try again.</p>
            </div>
            <button
              onClick={() => load()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : data ? (
          <AnimatePresence mode="wait">
            <motion.div
              key="brief-content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-7"
            >
              {/* ── Hero: greeting + profile stats ──────────────────────────── */}
              <section
                aria-label="Your daily summary"
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="font-mono text-lg font-bold text-white">
                      {data.profile
                        ? `${greeting}, ${data.profile.display_name ?? data.profile.username}`
                        : `${greeting}`}
                    </h2>
                    <p className="text-xs font-mono text-surface-500 mt-0.5">
                      Here&apos;s what&apos;s happening in the Lobby today.
                    </p>
                  </div>
                  {data.unreadNotifications > 0 && (
                    <Link
                      href="/notifications"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple/10 border border-purple/30 text-purple text-xs font-mono font-semibold hover:bg-purple/20 transition-colors flex-shrink-0"
                    >
                      <Bell className="h-3 w-3" />
                      {data.unreadNotifications} new
                    </Link>
                  )}
                </div>

                {/* Streak */}
                {data.profile && data.profile.vote_streak > 0 && (
                  <div className="mb-4">
                    <StreakBadge streak={data.profile.vote_streak} />
                  </div>
                )}

                {/* Platform pulse */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <PulseCard
                    icon={Zap}
                    value={data.platformPulse.activeTopics}
                    label="Active debates"
                    color="text-for-400"
                    href="/?status=active"
                  />
                  <PulseCard
                    icon={Scale}
                    value={data.platformPulse.votingTopics}
                    label="In voting"
                    color="text-purple"
                    href="/?status=voting"
                  />
                  <PulseCard
                    icon={Mic}
                    value={data.platformPulse.liveDebates}
                    label="Live debates"
                    color="text-against-400"
                    href="/debate"
                  />
                  <PulseCard
                    icon={Gavel}
                    value={data.platformPulse.lawsThisWeek}
                    label="Laws this week"
                    color="text-emerald"
                    href="/law"
                  />
                </div>
              </section>

              {/* ── Hot Topics ───────────────────────────────────────────────── */}
              {hasHot && (
                <section aria-labelledby="hot-topics-heading">
                  <SectionHeader
                    icon={Flame}
                    iconColor="text-against-400"
                    iconBg="bg-against-500/10 border-against-500/20"
                    title="Hot right now"
                    subtitle={
                      data.profile?.category_preferences?.length
                        ? `Based on your interests`
                        : 'Active debates by momentum'
                    }
                    href="/"
                  />
                  <div className="space-y-2">
                    {data.hotTopics.map((t) => (
                      <TopicRow key={t.id} topic={t} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Near-Law Topics ──────────────────────────────────────────── */}
              {hasNearLaw && (
                <section aria-labelledby="near-law-heading">
                  <SectionHeader
                    icon={Target}
                    iconColor="text-gold"
                    iconBg="bg-gold/10 border-gold/20"
                    title="Approaching consensus"
                    subtitle="Topics with strong majority — close to law"
                  />
                  <div className="space-y-2">
                    {data.nearLawTopics.map((t) => (
                      <NearLawRow key={t.id} topic={t} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Recent Laws ──────────────────────────────────────────────── */}
              {hasLaws && (
                <section aria-labelledby="recent-laws-heading">
                  <SectionHeader
                    icon={CheckCircle2}
                    iconColor="text-emerald"
                    iconBg="bg-emerald/10 border-emerald/20"
                    title="Laws established today"
                    subtitle="New consensus reached in the last 24 hours"
                    href="/law"
                  />
                  <div className="space-y-2">
                    {data.recentLaws.map((l) => (
                      <LawRow key={l.id} law={l} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Today's Debates ──────────────────────────────────────────── */}
              {hasDebates && (
                <section aria-labelledby="debates-heading">
                  <SectionHeader
                    icon={Calendar}
                    iconColor="text-for-400"
                    iconBg="bg-for-500/10 border-for-500/20"
                    title="Debates today"
                    subtitle="Live and scheduled in the next 48 hours"
                    href="/debate"
                  />
                  <div className="space-y-2">
                    {data.todayDebates.map((d) => (
                      <DebateRow key={d.id} debate={d} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Empty state when nothing active ─────────────────────────── */}
              {!hasHot && !hasNearLaw && !hasLaws && !hasDebates && (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300">
                    <Sparkles className="h-7 w-7 text-surface-500" />
                  </div>
                  <div>
                    <p className="font-mono font-semibold text-white">Quiet day in the Lobby</p>
                    <p className="text-sm font-mono text-surface-500 mt-1 max-w-xs">
                      No active debates or recent laws yet. Be the first to propose a topic.
                    </p>
                  </div>
                  <Link
                    href="/topic/create"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-for-600 text-white text-sm font-mono font-medium hover:bg-for-500 transition-colors"
                  >
                    Propose a Topic
                  </Link>
                </div>
              )}

              {/* ── Quick actions ─────────────────────────────────────────────── */}
              <nav
                aria-label="Quick actions"
                className="bg-surface-100 border border-surface-300 rounded-xl p-4"
              >
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-3">
                  Jump to
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { href: '/', label: 'Full Feed', icon: Activity },
                    { href: '/trending', label: 'Trending', icon: TrendingUp },
                    { href: '/challenge', label: "Today's Challenge", icon: Zap },
                    { href: '/surge', label: 'Surge', icon: Flame },
                    { href: '/digest', label: 'Weekly Digest', icon: Calendar },
                    { href: '/floor', label: 'The Floor', icon: Scale },
                    { href: '/debate', label: 'All Debates', icon: Mic },
                    { href: '/law', label: 'Law Codex', icon: Gavel },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
                    >
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                      {label}
                    </Link>
                  ))}
                </div>
              </nav>

              <p className="text-center text-[10px] font-mono text-surface-600">
                Brief refreshes on each visit · Lobby Market
              </p>
            </motion.div>
          </AnimatePresence>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
