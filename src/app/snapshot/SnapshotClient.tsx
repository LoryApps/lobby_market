'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Camera,
  Check,
  Copy,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Timer,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { VoteBar } from '@/components/voting/VoteBar'
import { cn } from '@/lib/utils/cn'
import type {
  TodayResponse,
  TodayStats,
  TodayTopTopic,
  TodayTopArgument,
  TodayLaw,
  TodayVotingTopic,
} from '@/app/api/today/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'closed'
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m left`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h left`
  return `${Math.floor(hrs / 24)}d left`
}

const CATEGORY_COLOR: Record<string, string> = {
  politics: 'text-for-400',
  economy: 'text-gold',
  science: 'text-emerald',
  social: 'text-purple',
  environment: 'text-emerald',
  technology: 'text-for-300',
  health: 'text-against-400',
  education: 'text-gold',
  justice: 'text-against-400',
  culture: 'text-purple',
}

function categoryColor(cat: string | null): string {
  return CATEGORY_COLOR[cat?.toLowerCase() ?? ''] ?? 'text-surface-500'
}

// ─── Pulse dot ────────────────────────────────────────────────────────────────

function PulseDot({ color = 'bg-emerald' }: { color?: string }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5 flex-shrink-0">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', color)} />
      <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', color)} />
    </span>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-surface-200/60 border border-surface-300/60 min-w-0 flex-1">
      <Icon className={cn('h-4 w-4', color)} aria-hidden="true" />
      <span className={cn('text-lg font-bold tabular-nums', color)}>
        {typeof value === 'number' ? formatCount(value) : value}
      </span>
      <span className="text-[10px] text-surface-500 uppercase tracking-wider font-medium leading-none text-center">
        {label}
      </span>
    </div>
  )
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function TopicRow({ topic, label }: { topic: TodayTopTopic | TodayVotingTopic; label?: string }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const winning = forPct >= 50

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="group block p-4 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors"
    >
      {(label || topic.category) && (
        <div className="flex items-center gap-2 mb-2">
          {label && (
            <Badge variant={label === 'Voting Now' ? 'against' : 'active'} size="sm">
              {label}
            </Badge>
          )}
          {topic.category && (
            <span className={cn('text-[11px] font-medium uppercase tracking-wide', categoryColor(topic.category))}>
              {topic.category}
            </span>
          )}
        </div>
      )}
      <p className="text-sm font-medium text-white leading-snug mb-3 group-hover:text-for-300 transition-colors line-clamp-2">
        {topic.statement}
      </p>
      <VoteBar bluePct={topic.blue_pct} totalVotes={topic.total_votes} />
      <div className="flex justify-between mt-1.5 text-[11px] font-medium">
        <span className={winning ? 'text-for-400' : 'text-surface-500'}>
          <ThumbsUp className="inline h-3 w-3 mr-0.5" aria-hidden="true" />
          {forPct}%
        </span>
        <span className="text-surface-500 tabular-nums">{formatCount(topic.total_votes)} votes</span>
        <span className={!winning ? 'text-against-400' : 'text-surface-500'}>
          {againstPct}%
          <ThumbsDown className="inline h-3 w-3 ml-0.5" aria-hidden="true" />
        </span>
      </div>
      {'voting_ends_at' in topic && topic.voting_ends_at && (
        <div className="flex items-center gap-1 mt-2 text-[11px] text-against-400 font-medium">
          <Timer className="h-3 w-3" aria-hidden="true" />
          {timeUntil(topic.voting_ends_at)}
        </div>
      )}
    </Link>
  )
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawCard({ law }: { law: TodayLaw }) {
  return (
    <Link
      href={`/topic/${law.id}`}
      className="group flex items-start gap-3 p-3.5 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-emerald/40 transition-colors"
    >
      <div className="flex-shrink-0 mt-0.5 h-7 w-7 rounded-lg bg-emerald/10 flex items-center justify-center">
        <Gavel className="h-3.5 w-3.5 text-emerald" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white line-clamp-2 group-hover:text-emerald transition-colors leading-snug">
          {law.statement}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {law.category && (
            <span className={cn('text-[10px] font-medium uppercase tracking-wide', categoryColor(law.category))}>
              {law.category}
            </span>
          )}
          <span className="text-[10px] text-surface-500">{formatCount(law.total_votes)} votes</span>
        </div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5 group-hover:text-emerald transition-colors" aria-hidden="true" />
    </Link>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg }: { arg: TodayTopArgument }) {
  const isFor = arg.side === 'blue'
  return (
    <Link
      href={`/topic/${arg.topic_id}`}
      className="group block p-4 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors"
    >
      <div className="flex items-start gap-3 mb-3">
        <Avatar src={arg.author?.avatar_url} fallback={arg.author?.display_name ?? arg.author?.username ?? '?'} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white truncate">
              {arg.author?.display_name ?? arg.author?.username ?? 'Anonymous'}
            </span>
            <Badge variant={isFor ? 'active' : 'against'} size="sm">
              {isFor ? 'For' : 'Against'}
            </Badge>
          </div>
          {arg.topic && (
            <p className="text-[11px] text-surface-500 truncate mt-0.5">{arg.topic.statement}</p>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-gold font-medium flex-shrink-0">
          <ThumbsUp className="h-3 w-3" aria-hidden="true" />
          {formatCount(arg.upvotes)}
        </div>
      </div>
      <p className="text-sm text-surface-700 leading-relaxed line-clamp-3 group-hover:text-white transition-colors">
        &ldquo;{arg.content}&rdquo;
      </p>
    </Link>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        {/* Sections */}
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
        ))}
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SnapshotClient() {
  const [data, setData] = useState<TodayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/today', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json() as TodayResponse
        setData(json)
        setLastRefreshed(new Date())
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 90 seconds
  useEffect(() => {
    const id = setInterval(load, 90_000)
    return () => clearInterval(id)
  }, [load])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText('https://lobby.market/snapshot')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // not supported
    }
  }

  if (loading && !data) return <LoadingSkeleton />

  const stats = data?.stats
  const topTopic = data?.topTopic
  const topArgument = data?.topArgument
  const recentLaw = data?.recentLaw
  const votingNow = data?.votingNow ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <PulseDot />
              <h1 className="text-xl font-bold text-white tracking-tight">Civic Snapshot</h1>
            </div>
            <p className="text-sm text-surface-500">
              Live pulse of democracy —{' '}
              <span className="text-surface-600">
                updated {timeAgo(lastRefreshed.toISOString())}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              aria-label="Refresh snapshot"
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={copyLink}
              aria-label="Copy snapshot link"
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors',
                copied
                  ? 'bg-emerald/20 border border-emerald/40 text-emerald'
                  : 'bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
              )}
            >
              {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>

        {/* ── Live stats ───────────────────────────────────────────────────── */}
        {stats && (
          <AnimatePresence mode="wait">
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6"
            >
              <StatPill icon={Vote} label="Votes Today" value={stats.votes_cast} color="text-for-400" />
              <StatPill icon={MessageSquare} label="Arguments" value={stats.arguments_made} color="text-purple" />
              <StatPill icon={Flame} label="New Topics" value={stats.new_topics} color="text-gold" />
              <StatPill icon={Gavel} label="Laws Passed" value={stats.laws_passed} color="text-emerald" />
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Hottest topic ────────────────────────────────────────────────── */}
        {topTopic && (
          <section className="mb-6" aria-labelledby="hottest-heading">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="h-4 w-4 text-gold" aria-hidden="true" />
              <h2 id="hottest-heading" className="text-sm font-semibold text-white uppercase tracking-wide">
                Hottest Right Now
              </h2>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <TopicRow topic={topTopic} label="Active" />
            </motion.div>
          </section>
        )}

        {/* ── Voting now ───────────────────────────────────────────────────── */}
        {votingNow.length > 0 && (
          <section className="mb-6" aria-labelledby="voting-heading">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-against-400" aria-hidden="true" />
                <h2 id="voting-heading" className="text-sm font-semibold text-white uppercase tracking-wide">
                  Final Voting
                </h2>
                <span className="text-xs text-against-400 font-medium">{votingNow.length} topic{votingNow.length !== 1 ? 's' : ''}</span>
              </div>
              <Link
                href="/topics?status=voting"
                className="text-xs text-surface-500 hover:text-white transition-colors flex items-center gap-1"
              >
                See all <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
            <div className="space-y-3">
              {votingNow.slice(0, 3).map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.04 }}
                >
                  <TopicRow topic={t} label="Voting Now" />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── Top argument ─────────────────────────────────────────────────── */}
        {topArgument && (
          <section className="mb-6" aria-labelledby="argument-heading">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-purple" aria-hidden="true" />
              <h2 id="argument-heading" className="text-sm font-semibold text-white uppercase tracking-wide">
                Strongest Argument Today
              </h2>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <ArgumentCard arg={topArgument} />
            </motion.div>
          </section>
        )}

        {/* ── Recent law ───────────────────────────────────────────────────── */}
        {recentLaw && (
          <section className="mb-6" aria-labelledby="law-heading">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-emerald" aria-hidden="true" />
                <h2 id="law-heading" className="text-sm font-semibold text-white uppercase tracking-wide">
                  Most Recent Law
                </h2>
              </div>
              <Link
                href="/law"
                className="text-xs text-surface-500 hover:text-white transition-colors flex items-center gap-1"
              >
                Law Codex <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              <LawCard law={recentLaw} />
            </motion.div>
          </section>
        )}

        {/* ── Footer CTA ───────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-surface-300/60 bg-surface-200/40 p-5 text-center"
        >
          <Camera className="h-6 w-6 text-surface-500 mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm text-surface-600 mb-3">
            This snapshot updates automatically every 90 seconds. Share it to show what democracy looks like right now.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-medium hover:bg-for-700 transition-colors"
            >
              <Vote className="h-3.5 w-3.5" aria-hidden="true" />
              Join the debate
            </Link>
            <Link
              href="/trending"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-300 text-surface-700 text-sm font-medium hover:bg-surface-400 hover:text-white transition-colors"
            >
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              Trending topics
            </Link>
          </div>
        </motion.div>

      </main>
      <BottomNav />
    </div>
  )
}
