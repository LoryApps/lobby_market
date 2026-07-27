'use client'

/**
 * /front-page — The Lobby Market Daily Front Page
 *
 * A newspaper-inspired daily summary of what's happening on the platform:
 *   - Hero topic: the most actively debated issue right now
 *   - Headline argument: the most compelling case made in the last 24h
 *   - Latest law: the most recent topic to achieve legal status
 *   - Upcoming debate: the next live debate scheduled
 *   - Secondary topics: 4 other active debates
 *   - Live stats: votes, arguments, laws
 *
 * Designed to be screenshot-friendly and shareable on social media.
 * Refreshes automatically every 10 minutes.
 * Publicly accessible — no login required.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gavel,
  Layers,
  MessageSquare,
  Mic,
  RefreshCw,
  Scale,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { FrontPageResponse, FrontPageTopic, FrontPageArgument, FrontPageLaw } from '@/app/api/front-page/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 10 * 60 * 1000

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'VOTING',
  law: 'LAW',
  failed: 'Failed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'starting now'
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `in ${d}d ${h % 24}h`
  if (h > 0) return `in ${h}h ${m % 60}m`
  return `in ${m}m`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Skeleton shapes ──────────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-4/5" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-3 w-full rounded-full" />
    </div>
  )
}

function SidebarItemSkeleton() {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, label, color }: { icon: React.ComponentType<{ className?: string }>; label: string; color: string }) {
  return (
    <div className={cn('flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest mb-3', color)}>
      <Icon className="h-3 w-3" />
      {label}
    </div>
  )
}

// ─── Hero topic card ──────────────────────────────────────────────────────────

function HeroTopicCard({ topic }: { topic: FrontPageTopic }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-500'
  const isVoting = topic.status === 'voting'

  return (
    <Link href={`/topic/${topic.id}`} className="group block">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={cn(
          'rounded-2xl border p-6 transition-all',
          'bg-gradient-to-br from-surface-100 to-surface-200/60',
          isVoting
            ? 'border-purple/40 hover:border-purple/60'
            : 'border-surface-300 hover:border-for-500/40',
        )}
      >
        <SectionLabel
          icon={TrendingUp}
          label={isVoting ? 'LIVE VOTE' : 'TOP DEBATE'}
          color={isVoting ? 'text-purple' : 'text-for-400'}
        />

        {/* Headline */}
        <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug mb-4 group-hover:text-for-300 transition-colors">
          {topic.statement}
        </h2>

        {/* Meta */}
        <div className="flex items-center flex-wrap gap-3 mb-4 text-xs font-mono">
          <Badge
            variant={topic.status === 'law' ? 'law' : topic.status === 'voting' ? 'active' : (topic.status as 'proposed' | 'active')}
            size="sm"
          >
            {STATUS_LABEL[topic.status] ?? topic.status}
          </Badge>
          {topic.category && (
            <span className={catColor}>{topic.category}</span>
          )}
          <span className="text-surface-500 flex items-center gap-1">
            <Users className="h-3 w-3" />
            {topic.total_votes.toLocaleString()} votes
          </span>
          {topic.argument_count > 0 && (
            <span className="text-surface-500 flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {topic.argument_count} arguments
            </span>
          )}
        </div>

        {/* Vote bar */}
        <div className="space-y-1">
          <div className="w-full h-2 rounded-full bg-surface-300 overflow-hidden flex">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${forPct}%` }}
              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
              className="h-full bg-for-500 rounded-l-full"
            />
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${againstPct}%` }}
              transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
              className="h-full bg-against-500 rounded-r-full"
            />
          </div>
          <div className="flex justify-between text-[11px] font-mono">
            <span className="text-for-400 flex items-center gap-1">
              <ThumbsUp className="h-2.5 w-2.5" />
              {forPct}% FOR
            </span>
            <span className="text-against-400 flex items-center gap-1">
              {againstPct}% AGAINST
              <ThumbsDown className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>

        {/* CTA */}
        <div className={cn(
          'mt-4 flex items-center gap-1.5 text-xs font-semibold',
          isVoting ? 'text-purple' : 'text-for-400',
        )}>
          <Vote className="h-3.5 w-3.5" />
          {isVoting ? 'Cast your vote now' : 'Read and vote'}
          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Headline argument card ───────────────────────────────────────────────────

function HeadlineArgumentCard({ argument }: { argument: FrontPageArgument }) {
  const isFor = argument.side === 'blue'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
    >
      <SectionLabel
        icon={Award}
        label="ARGUMENT OF THE DAY"
        color="text-gold"
      />

      {/* Quote */}
      <blockquote className={cn(
        'text-sm leading-relaxed mb-4 pl-3 border-l-2',
        isFor ? 'border-for-500/60 text-for-100' : 'border-against-500/60 text-against-100',
      )}>
        &ldquo;{argument.content.slice(0, 240)}{argument.content.length > 240 ? '…' : ''}&rdquo;
      </blockquote>

      {/* Author + topic */}
      <div className="flex items-start justify-between gap-3">
        {argument.author && (
          <Link href={`/profile/${argument.author.username}`} className="flex items-center gap-2 group">
            <Avatar
              src={argument.author.avatar_url}
              fallback={argument.author.display_name || argument.author.username}
              size="xs"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate group-hover:text-for-300 transition-colors">
                {argument.author.display_name || argument.author.username}
              </p>
              <p className="text-[10px] font-mono text-surface-500">
                <span className={isFor ? 'text-for-400' : 'text-against-400'}>
                  {isFor ? 'FOR' : 'AGAINST'}
                </span>
                {' · '}
                {relativeTime(argument.created_at)}
              </p>
            </div>
          </Link>
        )}

        <div className="flex items-center gap-1 text-gold text-xs font-mono shrink-0">
          <Zap className="h-3 w-3" />
          {argument.upvotes} upvotes
        </div>
      </div>

      {argument.topic && (
        <Link
          href={`/topic/${argument.topic_id}`}
          className="mt-3 flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-surface-300 transition-colors line-clamp-1"
        >
          <Scale className="h-3 w-3 shrink-0" />
          {argument.topic.statement.slice(0, 70)}{argument.topic.statement.length > 70 ? '…' : ''}
        </Link>
      )}
    </motion.div>
  )
}

// ─── Latest law card ──────────────────────────────────────────────────────────

function LatestLawCard({ law }: { law: FrontPageLaw }) {
  const forPct = Math.round(law.blue_pct ?? 50)
  const catColor = CATEGORY_COLOR[law.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
    >
      <Link href={`/topic/${law.id}`} className="group block rounded-xl bg-gold/8 border border-gold/25 hover:border-gold/40 p-4 transition-all">
        <SectionLabel icon={Gavel} label="LATEST LAW" color="text-gold" />

        <p className="text-sm font-semibold text-white leading-snug mb-2 group-hover:text-gold/90 transition-colors line-clamp-3">
          {law.statement}
        </p>

        <div className="flex items-center gap-2 text-[10px] font-mono text-surface-500">
          {law.category && <span className={catColor}>{law.category}</span>}
          <span className="flex items-center gap-0.5">
            <Users className="h-2.5 w-2.5" />
            {law.total_votes.toLocaleString()}
          </span>
          <span>{forPct}% FOR</span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Secondary topic card ─────────────────────────────────────────────────────

function SecondaryTopicCard({ topic, idx }: { topic: FrontPageTopic; idx: number }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 + idx * 0.05 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className="group flex items-start gap-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 p-3 transition-all"
      >
        <div className="shrink-0 w-8 text-center">
          <span className="text-[11px] font-mono font-bold text-surface-500">#{idx + 2}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
            {topic.statement}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-surface-500">
            {topic.category && <span className={catColor}>{topic.category}</span>}
            <span className="text-for-400">{forPct}%</span>
            <span className="text-against-400">{100 - forPct}%</span>
          </div>
          <div className="mt-1 w-full h-1 bg-surface-300 rounded-full overflow-hidden flex">
            <div className="h-full bg-for-500/60 rounded-l-full" style={{ width: `${forPct}%` }} />
            <div className="h-full bg-against-500/60 rounded-r-full" style={{ width: `${100 - forPct}%` }} />
          </div>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-300 shrink-0 self-center transition-colors" />
      </Link>
    </motion.div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: FrontPageResponse['stats'] }) {
  const items = [
    { label: 'Votes Today', value: stats.votes_today.toLocaleString(), icon: Vote, color: 'text-for-400' },
    { label: 'Arguments Today', value: stats.arguments_today.toLocaleString(), icon: MessageSquare, color: 'text-purple' },
    { label: 'Active Topics', value: stats.active_topics.toLocaleString(), icon: Layers, color: 'text-emerald' },
    { label: 'Laws Passed', value: stats.laws_all_time.toLocaleString(), icon: Gavel, color: 'text-gold' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {items.map(({ label, value, icon: Icon, color }, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className="rounded-xl bg-surface-100 border border-surface-300 p-3 flex items-center gap-3"
        >
          <div className={cn('flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center bg-surface-200', color.replace('text-', 'text-') + '/20')}>
            <Icon className={cn('h-4 w-4', color)} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white font-mono tabular-nums">{value}</p>
            <p className="text-[10px] text-surface-500 truncate">{label}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Debate card ──────────────────────────────────────────────────────────────

function UpcomingDebateCard({ debate }: { debate: FrontPageResponse['upcomingDebate'] }) {
  if (!debate) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.2 }}
    >
      <Link
        href={`/debate/${debate.id}`}
        className="group block rounded-xl bg-purple/8 border border-purple/25 hover:border-purple/40 p-4 transition-all"
      >
        <SectionLabel icon={Mic} label="NEXT DEBATE" color="text-purple" />

        <p className="text-sm font-semibold text-white leading-snug mb-2 line-clamp-2 group-hover:text-purple/90 transition-colors">
          {debate.title}
        </p>

        <div className="flex items-center gap-2 text-[10px] font-mono text-surface-500">
          <span className="flex items-center gap-0.5 text-purple">
            <Clock className="h-2.5 w-2.5" />
            {timeUntil(debate.starts_at)}
          </span>
          {debate.participant_count > 0 && (
            <span className="flex items-center gap-0.5">
              <Users className="h-2.5 w-2.5" />
              {debate.participant_count}
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Share panel ──────────────────────────────────────────────────────────────

function ShareButton() {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleCopy() {
    const url = `${window.location.origin}/front-page`
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      aria-label="Copy link to front page"
      className={cn(
        'flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-mono transition-colors',
        copied
          ? 'bg-emerald/15 border-emerald/40 text-emerald'
          : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
      )}
    >
      {copied ? (
        <><CheckCircle2 className="h-3.5 w-3.5" /> Copied!</>
      ) : (
        <><Share2 className="h-3.5 w-3.5" /> Share</>
      )}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function FrontPageClient() {
  const [data, setData] = useState<FrontPageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/front-page')
      if (!res.ok) throw new Error('Failed')
      const json: FrontPageResponse = await res.json()
      setData(json)
      setLastRefreshed(new Date())
    } catch {
      // keep existing data on refresh failure
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
    intervalRef.current = setInterval(() => void fetchData(), REFRESH_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchData])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Masthead */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-5 w-5 text-for-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">The Front Page</h1>
                <p className="text-xs font-mono text-surface-500">
                  {data ? formatDate(data.date) : 'Lobby Market Daily'}
                  {data ? ` · Edition #${data.edition.toLocaleString()}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ShareButton />
              <button
                onClick={() => void fetchData()}
                aria-label="Refresh front page"
                disabled={loading}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

          {lastRefreshed && (
            <p className="text-[10px] font-mono text-surface-600 pl-12">
              Updated {relativeTime(lastRefreshed.toISOString())} · auto-refreshes every 10 min
            </p>
          )}

          {/* Divider */}
          <div className="mt-4 border-t border-surface-300" />
        </div>

        {/* Stats bar */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3">
                <Skeleton className="h-4 w-12 mb-1.5" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : data ? (
          <StatsBar stats={data.stats} />
        ) : null}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column — hero + argument */}
          <div className="lg:col-span-2 space-y-4">
            {/* Hero topic */}
            {loading ? (
              <HeroSkeleton />
            ) : data?.heroTopic ? (
              <HeroTopicCard topic={data.heroTopic} />
            ) : null}

            {/* Headline argument */}
            {loading ? (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-3">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <div className="flex items-center gap-2 mt-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ) : data?.headlineArgument ? (
              <HeadlineArgumentCard argument={data.headlineArgument} />
            ) : null}

            {/* Secondary topics (mobile: shown here, desktop: sidebar) */}
            {!loading && data && data.secondaryTopics.length > 0 && (
              <div className="lg:hidden space-y-2">
                <p className="text-[11px] font-mono text-surface-500 uppercase tracking-widest flex items-center gap-1.5">
                  <BarChart2 className="h-3 w-3" />
                  Also Today
                </p>
                {data.secondaryTopics.map((topic, i) => (
                  <SecondaryTopicCard key={topic.id} topic={topic} idx={i} />
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Latest law */}
            {loading ? (
              <SidebarItemSkeleton />
            ) : data?.latestLaw ? (
              <LatestLawCard law={data.latestLaw} />
            ) : null}

            {/* Upcoming debate */}
            {loading ? (
              <SidebarItemSkeleton />
            ) : data?.upcomingDebate ? (
              <UpcomingDebateCard debate={data.upcomingDebate} />
            ) : null}

            {/* Secondary topics (desktop only) */}
            {!loading && data && data.secondaryTopics.length > 0 && (
              <div className="hidden lg:block space-y-2">
                <p className="text-[11px] font-mono text-surface-500 uppercase tracking-widest flex items-center gap-1.5">
                  <BarChart2 className="h-3 w-3" />
                  Also Today
                </p>
                {data.secondaryTopics.map((topic, i) => (
                  <SecondaryTopicCard key={topic.id} topic={topic} idx={i} />
                ))}
              </div>
            )}

            {/* Quick links */}
            <AnimatePresence>
              {!loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-xl bg-surface-100 border border-surface-300 p-4"
                >
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-widest mb-3">Quick Links</p>
                  <div className="space-y-1">
                    {[
                      { href: '/', label: 'Full Feed', icon: Layers },
                      { href: '/trending', label: 'Trending Topics', icon: TrendingUp },
                      { href: '/law', label: 'Law Codex', icon: Gavel },
                      { href: '/debate', label: 'Live Debates', icon: Mic },
                      { href: '/topics', label: 'Browse All Topics', icon: BarChart2 },
                    ].map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-200 transition-colors text-xs text-surface-400 hover:text-white group"
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 text-surface-500 group-hover:text-for-400 transition-colors" />
                        {label}
                        <ChevronRight className="h-3 w-3 ml-auto opacity-40 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer note */}
        {!loading && data && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 text-center text-[10px] font-mono text-surface-600"
          >
            Lobby Market Front Page · Edition #{data.edition.toLocaleString()} · Auto-refreshes every 10 minutes
          </motion.p>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
