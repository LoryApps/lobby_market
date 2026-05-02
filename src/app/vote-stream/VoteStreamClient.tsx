'use client'

/**
 * /vote-stream — The Live Vote Ticker
 *
 * A real-time rolling display of every vote landing on the platform.
 * Polls /api/vote-stream every 5 seconds; new entries animate in from the top.
 *
 * Distinct from:
 *  - /live        (argument feed, not votes)
 *  - /tally       (per-topic vote totals)
 *  - /surge       (velocity over days)
 *  - /pulse       (argument activity)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Flame,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { VoteStreamEntry, VoteStreamStats, VoteStreamResponse } from '@/app/api/vote-stream/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_MS = 5_000
const MAX_DISPLAY = 80

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1_000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

const CATEGORY_COLORS: Record<string, { text: string; dot: string }> = {
  Politics:    { text: 'text-for-400',    dot: 'bg-for-400' },
  Economics:   { text: 'text-gold',        dot: 'bg-gold' },
  Technology:  { text: 'text-purple',      dot: 'bg-purple' },
  Science:     { text: 'text-emerald',     dot: 'bg-emerald' },
  Ethics:      { text: 'text-against-300', dot: 'bg-against-400' },
  Philosophy:  { text: 'text-for-300',     dot: 'bg-for-300' },
  Culture:     { text: 'text-gold',        dot: 'bg-gold' },
  Health:      { text: 'text-against-300', dot: 'bg-against-300' },
  Environment: { text: 'text-emerald',     dot: 'bg-emerald' },
  Education:   { text: 'text-purple',      dot: 'bg-purple' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VoteRow({ vote, isNew }: { vote: VoteStreamEntry; isNew: boolean }) {
  const isFor = vote.side === 'blue'
  const cat = vote.topic.category
  const catStyle = cat ? (CATEGORY_COLORS[cat] ?? { text: 'text-surface-500', dot: 'bg-surface-500' }) : null
  const [rel, setRel] = useState(() => relativeTime(vote.created_at))

  useEffect(() => {
    const id = setInterval(() => setRel(relativeTime(vote.created_at)), 15_000)
    return () => clearInterval(id)
  }, [vote.created_at])

  return (
    <motion.div
      layout
      initial={isNew ? { opacity: 0, y: -20, scale: 0.97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl border transition-colors',
        isFor
          ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/40'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/40'
      )}
    >
      {/* Side badge */}
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg',
          isFor ? 'bg-for-500/15 text-for-400' : 'bg-against-500/15 text-against-400'
        )}
        aria-label={isFor ? 'For' : 'Against'}
      >
        {isFor
          ? <ThumbsUp className="h-3.5 w-3.5" />
          : <ThumbsDown className="h-3.5 w-3.5" />
        }
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/topic/${vote.topic.id}`}
          className="block text-sm text-white/90 hover:text-white leading-snug line-clamp-2 transition-colors"
        >
          {vote.topic.statement}
        </Link>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {cat && catStyle && (
            <span className={cn('flex items-center gap-1 text-[11px] font-mono', catStyle.text)}>
              <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', catStyle.dot)} />
              {cat}
            </span>
          )}
          <span className="text-[11px] font-mono text-surface-500">{rel}</span>
        </div>
      </div>

      {/* Current consensus */}
      <div className="flex-shrink-0 text-right">
        <div className={cn('text-sm font-mono font-semibold', isFor ? 'text-for-400' : 'text-against-400')}>
          {vote.topic.blue_pct.toFixed(0)}%
        </div>
        <div className="text-[10px] font-mono text-surface-600 mt-0.5">
          FOR
        </div>
      </div>
    </motion.div>
  )
}

function StatsBar({ stats, loading }: { stats: VoteStreamStats | null; loading: boolean }) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    )
  }

  const forPct = stats.forPctLast60s
  const againstPct = 100 - forPct

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {/* Votes this minute */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="h-3.5 w-3.5 text-gold" />
          <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">Last 60s</span>
        </div>
        <div className="text-2xl font-mono font-bold text-white">{stats.votesLast60s}</div>
        <div className="text-xs font-mono text-surface-500 mt-0.5">votes cast</div>
      </div>

      {/* FOR sentiment */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="h-3.5 w-3.5 text-for-400" />
          <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">Sentiment</span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-mono font-bold text-for-400">{forPct}%</span>
          <span className="text-sm font-mono text-against-400 mb-0.5">{againstPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-300 mt-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-for-500 to-for-400 rounded-full transition-all duration-700"
            style={{ width: `${forPct}%` }}
          />
        </div>
      </div>

      {/* 5-min volume */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Flame className="h-3.5 w-3.5 text-against-400" />
          <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">5 minutes</span>
        </div>
        <div className="text-2xl font-mono font-bold text-white">{stats.votesLast5m}</div>
        <div className="text-xs font-mono text-surface-500 mt-0.5">total votes</div>
      </div>

      {/* Hot topic */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Flame className="h-3.5 w-3.5 text-gold animate-pulse" />
          <span className="text-[11px] font-mono text-gold uppercase tracking-wide">Hottest</span>
        </div>
        {stats.hotTopicId ? (
          <>
            <Link
              href={`/topic/${stats.hotTopicId}`}
              className="text-sm font-semibold text-white hover:text-gold transition-colors line-clamp-2 leading-snug"
            >
              {stats.hotTopicStatement}
            </Link>
            <div className="text-[11px] font-mono text-surface-500 mt-1">
              {stats.hotTopicVotes60s} votes this minute
            </div>
          </>
        ) : (
          <div className="text-sm font-mono text-surface-500">Quiet right now</div>
        )}
      </div>
    </div>
  )
}

function StreamSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300">
          <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-8 w-10 flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VoteStreamClient() {
  const [votes, setVotes] = useState<VoteStreamEntry[]>([])
  const [stats, setStats] = useState<VoteStreamStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const seenIds = useRef<Set<string>>(new Set())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const res = await fetch('/api/vote-stream', { cache: 'no-store' })
      if (!res.ok) return
      const data: VoteStreamResponse = await res.json()

      const fresh = data.votes.filter((v) => !seenIds.current.has(v.id))
      const freshIds = new Set(fresh.map((v) => v.id))

      if (fresh.length > 0) {
        fresh.forEach((v) => seenIds.current.add(v.id))
        setVotes((prev) => {
          const merged = [...fresh, ...prev]
          return merged.slice(0, MAX_DISPLAY)
        })
        setNewIds(freshIds)
        setTimeout(() => setNewIds(new Set()), 1_500)
      } else if (votes.length === 0) {
        data.votes.forEach((v) => seenIds.current.add(v.id))
        setVotes(data.votes.slice(0, MAX_DISPLAY))
      }

      setStats(data.stats)
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      if (manual) setRefreshing(false)
    }
  }, [votes.length])

  useEffect(() => {
    fetchData()
    timerRef.current = setInterval(() => fetchData(), POLL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <Activity className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white flex items-center gap-2">
                Vote Stream
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-for-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-for-500" />
                </span>
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">Democracy in real-time</p>
            </div>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            aria-label="Refresh vote stream"
            className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-lg',
              'bg-surface-200 border border-surface-300 text-surface-500',
              'hover:bg-surface-300 hover:text-white transition-colors text-xs font-mono',
              'disabled:opacity-50'
            )}
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
            {refreshing ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {/* Stats */}
        <StatsBar stats={stats} loading={loading} />

        {/* Sentiment bar — full width */}
        {stats && !loading && (
          <div className="mb-6 rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-surface-500 uppercase tracking-wide">Platform sentiment — last 5 minutes</span>
              <span className="text-xs font-mono text-surface-500">
                {stats.votesLast5m} votes
              </span>
            </div>
            <div className="relative h-3 rounded-full overflow-hidden bg-against-500/20">
              <motion.div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full"
                animate={{ width: `${stats.forPctLast5m}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="flex items-center gap-1 text-xs font-mono text-for-400">
                <ThumbsUp className="h-3 w-3" />
                FOR {stats.forPctLast5m}%
              </span>
              <span className="flex items-center gap-1 text-xs font-mono text-against-400">
                AGAINST {100 - stats.forPctLast5m}%
                <ThumbsDown className="h-3 w-3" />
              </span>
            </div>
          </div>
        )}

        {/* Ticker label */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-mono text-surface-500 uppercase tracking-widest">
            Live votes · last 30 min
          </h2>
          <Link
            href="/tally"
            className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
          >
            Topic totals
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Vote stream */}
        {loading ? (
          <StreamSkeleton />
        ) : votes.length === 0 ? (
          <div className="text-center py-20 text-surface-500 font-mono text-sm">
            No votes in the last 30 minutes. The Lobby is quiet.
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false} mode="popLayout">
              {votes.map((vote) => (
                <VoteRow
                  key={vote.id}
                  vote={vote}
                  isNew={newIds.has(vote.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Footer nudge */}
        {votes.length > 0 && (
          <div className="mt-6 text-center text-xs font-mono text-surface-600">
            Showing the last {Math.min(votes.length, MAX_DISPLAY)} votes · updates every 5 seconds
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
