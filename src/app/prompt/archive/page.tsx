'use client'

/**
 * /prompt/archive — Civic Prompt Archive
 *
 * A historical record of every daily civic prompt — each day's featured
 * debate question with the community's final vote split. Browse past
 * prompts, see how consensus evolved, and jump into any topic.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { PromptArchiveEntry, PromptArchiveResponse } from '@/app/api/topics/prompt-archive/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

function isToday(iso: string, today: string): boolean {
  return iso === today
}

function relativeLabel(iso: string, today: string): string {
  const [ty, tm, td] = today.split('-').map(Number)
  const [iy, im, id] = iso.split('-').map(Number)
  const todayMs = new Date(ty, tm - 1, td).getTime()
  const dateMs = new Date(iy, im - 1, id).getTime()
  const diff = Math.round((todayMs - dateMs) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return `${diff} days ago`
}

// ─── Prompt Card ──────────────────────────────────────────────────────────────

function PromptCard({
  entry,
  today,
  index,
}: {
  entry: PromptArchiveEntry
  today: string
  index: number
}) {
  const forPct = Math.round(entry.blue_pct)
  const againstPct = 100 - forPct
  const categoryColor = CATEGORY_COLOR[entry.category ?? ''] ?? 'text-surface-500'
  const todayEntry = isToday(entry.prompt_date, today)
  const relLabel = relativeLabel(entry.prompt_date, today)

  const statusColor: Record<string, string> = {
    active: 'text-emerald border-emerald/30 bg-emerald/10',
    voting: 'text-gold border-gold/30 bg-gold/10',
    law: 'text-gold border-gold/30 bg-gold/10',
    failed: 'text-surface-500 border-surface-400/30 bg-surface-300/10',
    proposed: 'text-surface-500 border-surface-400/30 bg-surface-300/10',
  }
  const statusLabel: Record<string, string> = {
    active: 'ACTIVE',
    voting: 'VOTING',
    law: 'LAW',
    failed: 'CLOSED',
    proposed: 'PROPOSED',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn(
        'group relative rounded-2xl border bg-surface-100 overflow-hidden',
        'transition-all duration-200',
        todayEntry
          ? 'border-for-500/50 ring-1 ring-for-500/20'
          : 'border-surface-300 hover:border-surface-400'
      )}
    >
      {/* Today indicator */}
      {todayEntry && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-for-500 via-purple to-against-500" />
      )}

      <div className="p-4 sm:p-5 space-y-4">
        {/* ── Header row ─────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          {/* Date badge */}
          <div
            className={cn(
              'flex-shrink-0 flex flex-col items-center justify-center',
              'w-12 h-12 rounded-xl border text-center',
              todayEntry
                ? 'bg-for-500/10 border-for-500/30'
                : 'bg-surface-200 border-surface-300'
            )}
          >
            <span className={cn('text-[10px] font-mono uppercase tracking-wider leading-none', todayEntry ? 'text-for-400' : 'text-surface-500')}>
              {entry.prompt_date.slice(5, 7)}/{entry.prompt_date.slice(8)}
            </span>
            <span className={cn('text-xs font-mono font-bold leading-tight mt-0.5', todayEntry ? 'text-for-300' : 'text-surface-600')}>
              {relLabel === 'Today' ? 'Today' : relLabel === 'Yesterday' ? 'Yest.' : `${relativeLabel(entry.prompt_date, today).replace(' days ago', 'd')}`}
            </span>
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            {/* Meta row */}
            <div className="flex items-center gap-2 flex-wrap">
              {entry.category && (
                <span className={cn('text-[10px] font-mono uppercase tracking-wider font-semibold', categoryColor)}>
                  {entry.category}
                </span>
              )}
              <span
                className={cn(
                  'text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border',
                  statusColor[entry.status] ?? 'text-surface-500 border-surface-400/30'
                )}
              >
                {statusLabel[entry.status] ?? entry.status}
              </span>
              {entry.user_vote && (
                <span
                  className={cn(
                    'flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border',
                    entry.user_vote === 'blue'
                      ? 'bg-for-500/10 border-for-500/30 text-for-400'
                      : 'bg-against-500/10 border-against-500/30 text-against-400'
                  )}
                >
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Voted {entry.user_vote === 'blue' ? 'FOR' : 'AGAINST'}
                </span>
              )}
            </div>

            {/* Statement */}
            <p className="text-sm font-mono font-medium text-white leading-snug line-clamp-2 group-hover:text-for-200 transition-colors">
              {entry.statement}
            </p>
          </div>
        </div>

        {/* ── Vote bar ───────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <div className="h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
            <div
              className="h-full bg-for-500 transition-all duration-700"
              style={{ width: `${forPct}%` }}
            />
            <div
              className="h-full bg-against-500 flex-1 transition-all duration-700"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ThumbsUp className="h-3 w-3 text-for-400" />
              <span className="text-xs font-mono font-bold text-for-400">{forPct}% FOR</span>
            </div>
            <span className="text-[10px] font-mono text-surface-500">
              {entry.total_votes.toLocaleString()} votes
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-bold text-against-400">{againstPct}% AGAINST</span>
              <ThumbsDown className="h-3 w-3 text-against-400" />
            </div>
          </div>
        </div>

        {/* ── Actions ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <Link
            href={`/topic/${entry.topic_id}`}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-mono font-medium',
              'bg-surface-200 border border-surface-300 text-surface-500',
              'hover:bg-surface-300 hover:text-white hover:border-surface-400',
              'transition-colors'
            )}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Read debate
          </Link>
          {todayEntry && (
            <Link
              href="/prompt"
              className={cn(
                'flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-mono font-medium',
                'bg-for-500/10 border border-for-500/30 text-for-300',
                'hover:bg-for-500/20 hover:border-for-500/50',
                'transition-colors'
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Vote now
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function ArchiveSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PromptArchivePage() {
  const [data, setData] = useState<PromptArchiveResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/topics/prompt-archive')
      if (!res.ok) throw new Error('Failed to load archive')
      const json: PromptArchiveResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load the archive. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const votedCount = data?.entries.filter((e) => e.user_vote !== null).length ?? 0
  const todayEntry = data?.entries.find((e) => isToday(e.prompt_date, data.today))

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 py-6 pb-28 md:pb-10 space-y-6">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start gap-4">
          <Link
            href="/prompt"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0 mt-0.5',
              'bg-surface-200 border border-surface-300 text-surface-500',
              'hover:bg-surface-300 hover:text-white transition-colors'
            )}
            aria-label="Back to today's prompt"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Archive className="h-5 w-5 text-purple" />
              <h1 className="font-mono text-xl sm:text-2xl font-bold text-white">
                Prompt Archive
              </h1>
            </div>
            <p className="text-sm font-mono text-surface-500">
              {data
                ? `${data.entries.length} past civic prompts · ${votedCount} voted`
                : 'Historical daily civic questions with community results'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={load}
              disabled={loading}
              className={cn(
                'flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-mono',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              href="/prompt"
              className={cn(
                'flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-mono font-medium',
                'bg-for-500/10 border border-for-500/30 text-for-300',
                'hover:bg-for-500/20 hover:border-for-500/50 transition-colors'
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Today&apos;s prompt
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* ── Stats strip ─────────────────────────────────────────────── */}
        {data && data.entries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Prompts',
                value: data.entries.length,
                icon: Calendar,
                color: 'text-purple',
                bg: 'bg-purple/10',
                border: 'border-purple/20',
              },
              {
                label: 'You Voted',
                value: votedCount,
                icon: Vote,
                color: 'text-for-400',
                bg: 'bg-for-500/10',
                border: 'border-for-500/20',
              },
              {
                label: 'Total Votes',
                value: data.entries.reduce((acc, e) => acc + e.total_votes, 0).toLocaleString(),
                icon: ThumbsUp,
                color: 'text-emerald',
                bg: 'bg-emerald/10',
                border: 'border-emerald/20',
              },
              {
                label: 'Avg. Split',
                value: `${Math.round(data.entries.reduce((acc, e) => acc + e.blue_pct, 0) / data.entries.length)}% / ${100 - Math.round(data.entries.reduce((acc, e) => acc + e.blue_pct, 0) / data.entries.length)}%`,
                icon: ThumbsDown,
                color: 'text-against-400',
                bg: 'bg-against-500/10',
                border: 'border-against-500/20',
              },
            ].map((stat) => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className={cn(
                    'rounded-xl border p-3 flex items-center gap-3',
                    'bg-surface-100',
                    stat.border
                  )}
                >
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0', stat.bg)}>
                    <Icon className={cn('h-4 w-4', stat.color)} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-surface-500 leading-none">{stat.label}</div>
                    <div className="text-sm font-mono font-bold text-white mt-0.5 leading-none">{stat.value}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Today's prompt callout ───────────────────────────────────── */}
        {todayEntry && (
          <div className="rounded-xl border border-for-500/30 bg-for-500/5 p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Sparkles className="h-4.5 w-4.5 text-for-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono text-for-400 font-semibold uppercase tracking-wide">Today&apos;s Prompt</div>
              <p className="text-sm font-mono text-white line-clamp-1 mt-0.5">{todayEntry.statement}</p>
            </div>
            <Link
              href="/prompt"
              className={cn(
                'flex items-center gap-1 px-3 h-8 rounded-lg text-xs font-mono font-medium flex-shrink-0',
                'bg-for-500/10 border border-for-500/40 text-for-300',
                'hover:bg-for-500/20 transition-colors'
              )}
            >
              Vote <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* ── Grid ────────────────────────────────────────────────────── */}
        {loading ? (
          <ArchiveSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-against-500/20 bg-against-500/5 p-6 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        ) : !data || data.entries.length === 0 ? (
          <EmptyState
            icon={Archive}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/20"
            title="No archive yet"
            description="The Civic Prompt archive builds up over time as the community engages with daily debates."
            actions={[
              { label: "Today's Prompt", href: '/prompt', icon: Sparkles },
              { label: 'Browse topics', href: '/', variant: 'secondary' },
            ]}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.entries.map((entry, i) => (
              <PromptCard
                key={entry.topic_id}
                entry={entry}
                today={data.today}
                index={i}
              />
            ))}
          </div>
        )}

        {/* ── Footer nav ──────────────────────────────────────────────── */}
        {data && data.entries.length > 0 && (
          <div className="flex items-center justify-center gap-4 pt-4 border-t border-surface-300">
            <Link
              href="/prompt"
              className="flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Today&apos;s Prompt
            </Link>
            <span className="text-surface-600">·</span>
            <Link
              href="/quiz"
              className="flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Civic Quiz
            </Link>
            <span className="text-surface-600">·</span>
            <Link
              href="/swipe"
              className="flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Vote className="h-4 w-4" />
              Swipe &amp; Vote
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
