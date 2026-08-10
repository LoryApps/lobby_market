'use client'

/**
 * /hot-seat
 *
 * Daily deliberative topic — the most divisive (closest to 50/50) active topic.
 * Users must read both the top FOR and AGAINST arguments before the vote
 * button unlocks, encouraging informed participation.
 *
 * Distinct from:
 *   /signal          — most URGENT topic (near 75%/25% threshold), not forced deliberation
 *   /blitz           — rapid-fire voting game, no deliberation
 *   /swipe           — swipe-card topics, no forced reading
 *   /argument-of-the-day — highlights best argument, not the most divisive topic
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Flame,
  Lock,
  RefreshCw,
  Scale,
  Share2,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Unlock,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { HotSeatArgument, HotSeatResponse, HotSeatTopic } from '@/app/api/hot-seat/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const READ_STORAGE_KEY = 'lm_hot_seat_read_v1'

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/20' },
  Politics:    { text: 'text-for-400',       bg: 'bg-for-500/10',      border: 'border-for-500/20' },
  Technology:  { text: 'text-purple',        bg: 'bg-purple/10',       border: 'border-purple/20' },
  Science:     { text: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/20' },
  Ethics:      { text: 'text-purple',        bg: 'bg-purple/10',       border: 'border-purple/20' },
  Philosophy:  { text: 'text-for-300',       bg: 'bg-for-400/10',      border: 'border-for-400/20' },
  Culture:     { text: 'text-against-300',   bg: 'bg-against-400/10',  border: 'border-against-400/20' },
  Health:      { text: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/20' },
  Environment: { text: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/20' },
  Education:   { text: 'text-purple',        bg: 'bg-purple/10',       border: 'border-purple/20' },
}

function catColor(cat: string | null) {
  return CATEGORY_COLOR[cat ?? ''] ?? { text: 'text-surface-500', bg: 'bg-surface-200', border: 'border-surface-300' }
}

const ROLE_LABEL: Record<string, string> = {
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function hoursLabel(iso: string | null): string | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return null
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h >= 24) return `${Math.floor(h / 24)}d left`
  if (h >= 1) return `${h}h ${m}m left`
  return `${m}m left`
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({ bluePct, total }: { bluePct: number; total: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-for-400">FOR {forPct}%</span>
        <span className="text-surface-500">{total.toLocaleString()} votes</span>
        <span className="text-against-400">{againstPct}% AGAINST</span>
      </div>
      <div className="h-2 bg-against-500/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-for-500 rounded-full transition-all duration-700"
          style={{ width: `${forPct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  side,
  isRead,
  onRead,
}: {
  arg: HotSeatArgument
  side: 'blue' | 'red'
  isRead: boolean
  onRead: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isLong = arg.content.length > 240

  const config =
    side === 'blue'
      ? {
          border: 'border-for-500/30',
          headerBg: 'bg-for-500/8',
          accent: 'text-for-400',
          label: 'FOR',
          labelBg: 'bg-for-500/10 border-for-500/20',
          checkColor: 'text-for-400',
        }
      : {
          border: 'border-against-500/30',
          headerBg: 'bg-against-500/8',
          accent: 'text-against-400',
          label: 'AGAINST',
          labelBg: 'bg-against-500/10 border-against-500/20',
          checkColor: 'text-against-400',
        }

  function handleExpand() {
    setExpanded((v) => !v)
    if (!isRead) onRead()
  }

  // Auto-mark read for short arguments when they're rendered
  useEffect(() => {
    if (!isLong && !isRead) {
      const timer = setTimeout(() => onRead(), 800)
      return () => clearTimeout(timer)
    }
  }, [isLong, isRead, onRead])

  return (
    <div
      className={cn(
        'rounded-xl border transition-all duration-200',
        config.border,
        isRead ? 'bg-surface-200/80' : 'bg-surface-200/40',
      )}
    >
      {/* Header */}
      <button
        onClick={handleExpand}
        className={cn(
          'w-full flex items-center justify-between p-4 text-left rounded-t-xl transition-colors',
          config.headerBg,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isRead ? (
              <CheckCircle2 className={cn('w-4 h-4', config.checkColor)} />
            ) : (
              <div className="w-4 h-4 rounded-full border-2 border-surface-500" />
            )}
            <span className={cn('text-xs font-semibold uppercase tracking-wider', config.accent)}>
              {config.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Avatar
              src={arg.author_avatar_url}
              username={arg.author_username}
              size="xs"
            />
            <span className="text-xs text-surface-500 truncate max-w-[120px]">
              {arg.author_display_name ?? arg.author_username}
            </span>
            {arg.author_role !== 'person' && ROLE_LABEL[arg.author_role] && (
              <span className="text-[10px] text-surface-600">
                · {ROLE_LABEL[arg.author_role]}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-surface-500 font-mono">
            {arg.upvote_count.toLocaleString()} ↑
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-surface-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-surface-500" />
          )}
        </div>
      </button>

      {/* Body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2">
              <p className="text-sm text-surface-800 leading-relaxed">{arg.content}</p>
              {isRead && (
                <div className={cn('mt-2 flex items-center gap-1 text-xs', config.checkColor)}>
                  <CheckCircle2 className="w-3 h-3" />
                  Read
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed preview */}
      {!expanded && (
        <div className="px-4 pb-3 pt-1">
          <p className="text-xs text-surface-500 leading-snug line-clamp-2">{arg.content}</p>
        </div>
      )}
    </div>
  )
}

// ─── Steps progress ───────────────────────────────────────────────────────────

function StepIndicator({
  step,
  total,
}: {
  step: number
  total: number
}) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i < step ? 'bg-for-500 w-6' : i === step ? 'bg-surface-400 w-4' : 'bg-surface-600 w-2',
          )}
        />
      ))}
    </div>
  )
}

// ─── Deliberation lock ────────────────────────────────────────────────────────

function DeliberationLock({
  readFor,
  readAgainst,
}: {
  readFor: boolean
  readAgainst: boolean
}) {
  const allRead = readFor && readAgainst
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 flex items-center gap-3 transition-colors duration-300',
        allRead
          ? 'border-emerald/30 bg-emerald/5'
          : 'border-surface-300 bg-surface-200/40',
      )}
    >
      {allRead ? (
        <Unlock className="w-4 h-4 text-emerald shrink-0" />
      ) : (
        <Lock className="w-4 h-4 text-surface-500 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-semibold', allRead ? 'text-emerald' : 'text-surface-400')}>
          {allRead ? "Vote unlocked — you've read both sides" : 'Read both sides to unlock your vote'}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span
            className={cn(
              'flex items-center gap-1 text-[10px]',
              readFor ? 'text-for-400' : 'text-surface-600',
            )}
          >
            {readFor ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-surface-600" />}
            FOR argument
          </span>
          <span
            className={cn(
              'flex items-center gap-1 text-[10px]',
              readAgainst ? 'text-against-400' : 'text-surface-600',
            )}
          >
            {readAgainst ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-surface-600" />}
            AGAINST argument
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Vote panel ───────────────────────────────────────────────────────────────

function VotePanel({
  topic,
  onVoted,
}: {
  topic: HotSeatTopic
  onVoted: (choice: 'for' | 'against') => void
}) {
  const [voting, setVoting] = useState<'for' | 'against' | null>(null)
  const [error, setError] = useState(false)

  async function handleVote(choice: 'for' | 'against') {
    setVoting(choice)
    setError(false)
    try {
      const res = await fetch(`/api/topics/${topic.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: choice === 'for' ? 'blue' : 'red' }),
      })
      if (!res.ok) throw new Error('vote failed')
      onVoted(choice)
    } catch {
      setError(true)
      setVoting(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-surface-500 text-center font-mono uppercase tracking-wider">
        Cast your vote
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleVote('for')}
          disabled={voting !== null}
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl border p-4 transition-all duration-150',
            'border-for-500/30 bg-for-500/8 hover:bg-for-500/15 hover:border-for-500/50',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <ThumbsUp className={cn('w-6 h-6', voting === 'for' ? 'text-for-400 animate-bounce' : 'text-for-400')} />
          <span className="text-sm font-semibold text-for-400">FOR</span>
        </button>
        <button
          onClick={() => handleVote('against')}
          disabled={voting !== null}
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl border p-4 transition-all duration-150',
            'border-against-500/30 bg-against-500/8 hover:bg-against-500/15 hover:border-against-500/50',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <ThumbsDown className={cn('w-6 h-6', voting === 'against' ? 'text-against-400 animate-bounce' : 'text-against-400')} />
          <span className="text-sm font-semibold text-against-400">AGAINST</span>
        </button>
      </div>
      {error && (
        <p className="text-xs text-against-400 text-center">
          Vote failed — you may have already voted on this topic.
        </p>
      )}
    </div>
  )
}

// ─── Result panel ─────────────────────────────────────────────────────────────

function ResultPanel({
  topic,
  choice,
}: {
  topic: HotSeatTopic
  choice: 'for' | 'against'
}) {
  const [copied, setCopied] = useState(false)
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const userSide = choice === 'for' ? forPct : againstPct
  const majority = forPct >= againstPct ? 'for' : 'against'
  const withMajority = choice === majority

  async function handleShare() {
    const url = `${window.location.origin}/hot-seat`
    const text = `I voted ${choice.toUpperCase()} on today's Civic Hot Seat: "${topic.statement.slice(0, 80)}…" — ${userSide}% agreed. Can you read both sides?`
    if (navigator.share) {
      await navigator.share({ title: 'Civic Hot Seat · Lobby Market', text, url })
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      className="space-y-4"
    >
      {/* Civic duty banner */}
      <div className="rounded-xl border border-emerald/30 bg-emerald/5 px-4 py-3 flex items-center gap-3">
        <Shield className="w-5 h-5 text-emerald shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald">Civic duty done</p>
          <p className="text-xs text-surface-500 mt-0.5">
            You read both sides and cast an informed vote. That's how good democracy works.
          </p>
        </div>
      </div>

      {/* Your vote */}
      <div
        className={cn(
          'rounded-xl border p-4 text-center',
          choice === 'for'
            ? 'border-for-500/30 bg-for-500/8'
            : 'border-against-500/30 bg-against-500/8',
        )}
      >
        {choice === 'for' ? (
          <ThumbsUp className="w-7 h-7 text-for-400 mx-auto mb-2" />
        ) : (
          <ThumbsDown className="w-7 h-7 text-against-400 mx-auto mb-2" />
        )}
        <p className="text-xs text-surface-500">You voted</p>
        <p
          className={cn(
            'text-lg font-bold font-mono',
            choice === 'for' ? 'text-for-400' : 'text-against-400',
          )}
        >
          {choice.toUpperCase()}
        </p>
        <p className="text-xs text-surface-500 mt-1">
          {withMajority
            ? `You're with the ${userSide}% majority`
            : `You're with the ${userSide}% minority`}
        </p>
      </div>

      {/* Updated vote bar */}
      <VoteBar bluePct={topic.blue_pct} total={topic.total_votes + 1} />

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Link href={`/topic/${topic.id}`} className="flex-1">
          <Button variant="ghost" size="sm" className="w-full gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" />
            Full debate
          </Button>
        </Link>
        <Button variant="ghost" size="sm" onClick={handleShare} className="gap-1.5">
          <Share2 className="w-3.5 h-3.5" />
          {copied ? 'Copied!' : 'Share'}
        </Button>
      </div>
    </motion.div>
  )
}

// ─── Read-state tracker ────────────────────────────────────────────────────────

function loadReadState(topicId: string, date: string): { readFor: boolean; readAgainst: boolean } {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY)
    if (!raw) return { readFor: false, readAgainst: false }
    const store = JSON.parse(raw) as Record<string, { readFor: boolean; readAgainst: boolean; date: string }>
    const entry = store[topicId]
    // Expire if the stored date differs from today
    if (!entry || entry.date !== date) return { readFor: false, readAgainst: false }
    return { readFor: entry.readFor, readAgainst: entry.readAgainst }
  } catch {
    return { readFor: false, readAgainst: false }
  }
}

function saveReadState(
  topicId: string,
  date: string,
  readFor: boolean,
  readAgainst: boolean,
) {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY)
    const store = raw ? (JSON.parse(raw) as Record<string, { readFor: boolean; readAgainst: boolean; date: string }>) : {}
    // Prune old entries (keep only today's topic)
    const pruned: typeof store = {}
    for (const [k, v] of Object.entries(store)) {
      if (v.date === date) pruned[k] = v
    }
    pruned[topicId] = { readFor, readAgainst, date }
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(pruned))
  } catch {
    // Ignore storage errors
  }
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function HotSeatPage() {
  const [data, setData] = useState<HotSeatResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [readFor, setReadFor] = useState(false)
  const [readAgainst, setReadAgainst] = useState(false)
  const [voted, setVoted] = useState<'for' | 'against' | null>(null)
  const fetchedAt = useRef<number>(0)

  const load = useCallback(async (force = false) => {
    if (!force && !loading && Date.now() - fetchedAt.current < 60_000) return
    if (force) setRefreshing(true); else setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/hot-seat', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as HotSeatResponse
      setData(json)
      fetchedAt.current = Date.now()

      // Restore read state from localStorage
      if (json.topic) {
        const stored = loadReadState(json.topic.id, json.date)
        setReadFor(stored.readFor)
        setReadAgainst(stored.readAgainst)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loading])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleReadFor() {
    if (!data?.topic) return
    setReadFor(true)
    saveReadState(data.topic.id, data.date, true, readAgainst)
  }

  function handleReadAgainst() {
    if (!data?.topic) return
    setReadAgainst(true)
    saveReadState(data.topic.id, data.date, readFor, true)
  }

  function handleVoted(choice: 'for' | 'against') {
    setVoted(choice)
  }

  const topic = data?.topic
  const allRead = readFor && readAgainst

  // Step tracking: 0=loading, 1=reading, 2=voting, 3=voted
  const step = !topic ? 0 : voted ? 3 : allRead ? 2 : 1

  const timeLeft = topic?.voting_ends_at ? hoursLabel(topic.voting_ends_at) : null
  const cc = topic ? catColor(topic.category) : catColor(null)

  return (
    <div className="min-h-screen bg-surface-100 pb-24">
      <TopBar />

      <main className="max-w-xl mx-auto px-4 pt-20">

        {/* ─── Header ─────────────────────────────────────────────────── */}
        <div className="text-center space-y-1 pt-6 pb-5">
          <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-against-400/80 uppercase tracking-widest">
            <Flame className="w-3.5 h-3.5" />
            Daily Hot Seat
          </div>
          <h1 className="text-2xl font-bold text-white">Civic Hot Seat</h1>
          {data?.date && (
            <p className="text-sm text-surface-500">{formatDate(data.date)}</p>
          )}
        </div>

        {/* ─── Intro blurb ──────────────────────────────────────────── */}
        <div className="rounded-xl border border-surface-300 bg-surface-200/60 px-4 py-3 mb-5 flex items-start gap-3">
          <Trophy className="w-4 h-4 text-gold shrink-0 mt-0.5" />
          <p className="text-xs text-surface-500 leading-relaxed">
            Today&apos;s most divisive topic. Read the strongest argument on each side, then
            cast your vote. The vote button unlocks only after you&apos;ve considered both perspectives.
          </p>
        </div>

        {/* ─── Refresh ──────────────────────────────────────────────── */}
        <div className="flex justify-end mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* ─── Main content ─────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-surface-300 bg-surface-200 p-5 space-y-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-2 w-full mt-2" />
            </div>
            <div className="rounded-xl border border-surface-300 bg-surface-200 p-4 space-y-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-surface-300 bg-surface-200 p-8 text-center space-y-3">
            <Scale className="w-8 h-8 text-surface-600 mx-auto" />
            <p className="text-surface-500 text-sm">Failed to load today&apos;s hot seat.</p>
            <Button variant="ghost" size="sm" onClick={() => load(true)}>Try again</Button>
          </div>
        ) : !topic ? (
          <EmptyState
            icon={<Scale className="w-8 h-8 text-surface-600" />}
            title="No hot seat today"
            description="There aren't enough contested topics right now. Check back later or browse active debates."
            action={
              <Link href="/topics">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <ArrowRight className="w-4 h-4" /> Browse topics
                </Button>
              </Link>
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="hot-seat-content"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="space-y-4"
            >
              {/* Step progress */}
              <StepIndicator step={step} total={4} />

              {/* Topic card */}
              <div className="rounded-2xl border border-surface-300 bg-surface-200/80 p-5 space-y-4">
                {/* Category + meta */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {topic.category && (
                      <span
                        className={cn(
                          'text-xs font-semibold px-2 py-0.5 rounded-md border',
                          cc.text,
                          cc.bg,
                          cc.border,
                        )}
                      >
                        {topic.category}
                      </span>
                    )}
                    <Badge variant={topic.status === 'voting' ? 'active' : 'proposed'}>
                      {topic.status}
                    </Badge>
                    {timeLeft && (
                      <span className="flex items-center gap-1 text-[10px] text-surface-500">
                        <Clock className="w-3 h-3" />
                        {timeLeft}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-surface-500 shrink-0">
                    <Users className="w-3 h-3" />
                    <span className="font-mono">{topic.total_votes.toLocaleString()}</span>
                  </div>
                </div>

                {/* Statement */}
                <p className="text-base font-semibold text-white leading-snug">
                  {topic.statement}
                </p>

                {/* Vote bar */}
                <VoteBar bluePct={topic.blue_pct} total={topic.total_votes} />

                {/* Divisiveness note */}
                <p className="text-xs text-surface-600 text-center">
                  {topic.divisiveness < 5
                    ? 'Perfectly split — the Lobby is almost exactly divided.'
                    : topic.divisiveness < 10
                    ? 'Highly contested — no clear consensus.'
                    : 'Significantly divided community opinion.'}
                </p>
              </div>

              {/* FOR arguments */}
              {topic.top_for_args.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider px-1">
                    The Case For
                  </p>
                  {topic.top_for_args.slice(0, 1).map((arg) => (
                    <ArgumentCard
                      key={arg.id}
                      arg={arg}
                      side="blue"
                      isRead={readFor}
                      onRead={handleReadFor}
                    />
                  ))}
                </div>
              )}

              {/* AGAINST arguments */}
              {topic.top_against_args.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider px-1">
                    The Case Against
                  </p>
                  {topic.top_against_args.slice(0, 1).map((arg) => (
                    <ArgumentCard
                      key={arg.id}
                      arg={arg}
                      side="red"
                      isRead={readAgainst}
                      onRead={handleReadAgainst}
                    />
                  ))}
                </div>
              )}

              {/* Deliberation lock */}
              <DeliberationLock readFor={readFor} readAgainst={readAgainst} />

              {/* Vote / Result */}
              <AnimatePresence mode="wait">
                {voted ? (
                  <ResultPanel key="result" topic={topic} choice={voted} />
                ) : allRead ? (
                  <motion.div
                    key="vote"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <VotePanel topic={topic} onVoted={handleVoted} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="locked"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-2 gap-3 opacity-40 pointer-events-none"
                  >
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-for-500/30 bg-for-500/8 p-4">
                      <Lock className="w-5 h-5 text-surface-500" />
                      <span className="text-sm font-semibold text-surface-500">FOR</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-against-500/30 bg-against-500/8 p-4">
                      <Lock className="w-5 h-5 text-surface-500" />
                      <span className="text-sm font-semibold text-surface-500">AGAINST</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Full debate link */}
              <div className="flex items-center justify-center pt-1">
                <Link
                  href={`/topic/${topic.id}`}
                  className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-400 transition-colors"
                >
                  View all arguments
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

            </motion.div>
          </AnimatePresence>
        )}

        {/* ─── Quick links ──────────────────────────────────────────── */}
        <div className="mt-8 grid grid-cols-3 gap-2">
          {[
            { href: '/signal', icon: Flame, label: 'Civic Signal', color: 'text-against-400' },
            { href: '/blitz', icon: Trophy, label: 'Blitz Mode', color: 'text-gold' },
            { href: '/topics', icon: Scale, label: 'All Topics', color: 'text-for-400' },
          ].map(({ href, icon: Icon, label, color }) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl border border-surface-300 bg-surface-200/60 hover:bg-surface-200 transition-colors p-3 text-center space-y-1.5 group"
            >
              <Icon className={cn('w-5 h-5 mx-auto', color)} />
              <p className="text-xs text-surface-500 group-hover:text-surface-400 leading-tight transition-colors">
                {label}
              </p>
            </Link>
          ))}
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
