'use client'

/**
 * /argument-of-the-day
 *
 * Daily spotlight on the single highest-quality argument posted to the
 * Lobby in the last 24 hours, ranked by community upvotes + AI score.
 *
 * Distinct from:
 *   /gallery         — masonry of all-time best arguments (no daily curation)
 *   /top-arguments   — filtered leaderboard (not day-scoped)
 *   /reel            — TikTok scroll format (not curated)
 *   /spotlight       — weekly platform spotlight (not argument-focused)
 *
 * Refreshes every 30 minutes. Archive shows the last 7 days.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Crown,
  ExternalLink,
  Flame,
  Gavel,
  Quote,
  RefreshCw,
  Scale,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  ArgumentOfTheDayResponse,
  DailyArgument,
  ArchiveEntry,
} from '@/app/api/argument-of-the-day/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const GRADE_STYLE: Record<string, { text: string; bg: string }> = {
  A: { text: 'text-emerald', bg: 'bg-emerald/10' },
  B: { text: 'text-for-400', bg: 'bg-for-500/10' },
  C: { text: 'text-gold', bg: 'bg-gold/10' },
  D: { text: 'text-against-400', bg: 'bg-against-500/10' },
  F: { text: 'text-surface-500', bg: 'bg-surface-300/50' },
}

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Society: 'text-against-400',
  Environment: 'text-emerald',
  Health: 'text-against-400',
  Education: 'text-gold',
  Law: 'text-surface-400',
  Defense: 'text-for-400',
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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) {
    const m = Math.floor(diff / 60_000)
    return m < 1 ? 'just now' : `${m}m ago`
  }
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function truncate(text: string, chars: number): string {
  if (text.length <= chars) return text
  return text.slice(0, chars).trimEnd() + '…'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade: string }) {
  const s = GRADE_STYLE[grade] ?? GRADE_STYLE.F
  return (
    <span className={cn('text-xs font-mono font-bold px-1.5 py-0.5 rounded', s.text, s.bg)}>
      {grade}
    </span>
  )
}

function SideBadge({ side }: { side: 'blue' | 'red' }) {
  return (
    <Badge variant={side === 'blue' ? 'for' : 'against'}>
      {side === 'blue' ? (
        <>
          <ThumbsUp className="w-2.5 h-2.5 mr-0.5" /> FOR
        </>
      ) : (
        <>
          <ThumbsDown className="w-2.5 h-2.5 mr-0.5" /> AGAINST
        </>
      )}
    </Badge>
  )
}

function VoteSplit({ bluePct, total }: { bluePct: number; total: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-for-400 font-mono tabular-nums">{forPct}%</span>
      <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden min-w-[48px]">
        <div className="h-full bg-for-500 rounded-full" style={{ width: `${forPct}%` }} />
      </div>
      <span className="text-against-400 font-mono tabular-nums">{againstPct}%</span>
      <span className="text-surface-500">·</span>
      <span className="text-surface-500">{total.toLocaleString()} votes</span>
    </div>
  )
}

// ─── Hero argument card ───────────────────────────────────────────────────────

function HeroArgumentCard({ arg }: { arg: DailyArgument }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const isLong = arg.content.length > 300

  const sideConfig =
    arg.side === 'blue'
      ? {
          border: 'border-for-500/40',
          glow: 'from-for-500/8 via-transparent',
          quoteMark: 'text-for-400/30',
          accent: 'text-for-400',
        }
      : {
          border: 'border-against-500/40',
          glow: 'from-against-500/8 via-transparent',
          quoteMark: 'text-against-400/30',
          accent: 'text-against-400',
        }

  async function handleShare() {
    const url = `${window.location.origin}/argument-of-the-day`
    const text = `"${arg.content.slice(0, 120)}…"\n\n— Today's Argument of the Day on Lobby Market`
    if (navigator.share) {
      await navigator.share({ title: 'Argument of the Day · Lobby Market', text, url })
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'rounded-2xl border bg-gradient-to-b to-surface-200 p-6 space-y-5',
        sideConfig.border,
        sideConfig.glow,
      )}
    >
      {/* Author row */}
      <div className="flex items-center gap-3">
        <Link href={`/profile/${arg.author?.username ?? ''}`} className="shrink-0">
          <Avatar
            src={arg.author?.avatar_url}
            username={arg.author?.username ?? '?'}
            size="md"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href={`/profile/${arg.author?.username ?? ''}`}
              className="text-sm font-semibold text-surface-900 hover:text-white transition-colors truncate"
            >
              {arg.author?.display_name ?? arg.author?.username ?? 'Unknown'}
            </Link>
            {arg.author?.role && arg.author.role !== 'person' && (
              <span className="text-xs text-surface-500">
                {ROLE_LABEL[arg.author.role] ?? arg.author.role}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {arg.author?.clout !== undefined && arg.author.clout > 0 && (
              <span className="text-xs text-gold font-mono">{arg.author.clout.toLocaleString()} clout</span>
            )}
            <span className="text-xs text-surface-500">{relativeTime(arg.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <SideBadge side={arg.side} />
          {arg.ai_grade && <GradeBadge grade={arg.ai_grade} />}
        </div>
      </div>

      {/* Quote */}
      <div className="relative">
        <Quote
          className={cn('absolute -top-1 -left-1 w-8 h-8', sideConfig.quoteMark)}
          aria-hidden
        />
        <div className="pl-6">
          <p className="text-surface-900 text-[15px] leading-relaxed">
            {isLong && !expanded ? truncate(arg.content, 300) : arg.content}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-400 mt-2 transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3" /> Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" /> Read full argument
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Topic context */}
      {arg.topic && (
        <Link
          href={`/topic/${arg.topic_id}`}
          className="block rounded-xl border border-surface-300 bg-surface-100/60 hover:bg-surface-100 transition-colors p-3 space-y-2 group"
        >
          <div className="flex items-start gap-2">
            <Scale className="w-3.5 h-3.5 text-surface-500 shrink-0 mt-0.5" />
            <p className="text-xs text-surface-500 leading-snug group-hover:text-surface-400 transition-colors">
              {truncate(arg.topic.statement, 120)}
            </p>
            <ExternalLink className="w-3 h-3 text-surface-600 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          {arg.topic.total_votes > 0 && (
            <VoteSplit bluePct={arg.topic.blue_pct ?? 50} total={arg.topic.total_votes} />
          )}
          <div className="flex items-center gap-1.5">
            {arg.topic.category && (
              <span className={cn('text-xs font-medium', CATEGORY_COLOR[arg.topic.category] ?? 'text-surface-500')}>
                {arg.topic.category}
              </span>
            )}
            {arg.topic.status === 'law' && (
              <Badge variant="law" className="text-[10px]">
                <Gavel className="w-2.5 h-2.5 mr-0.5" /> Law
              </Badge>
            )}
          </div>
        </Link>
      )}

      {/* Stats + actions */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-surface-500">
            <Zap className="w-3.5 h-3.5 text-gold" />
            <span className="text-sm font-mono tabular-nums text-gold">{arg.upvotes.toLocaleString()}</span>
            <span className="text-xs">upvotes</span>
          </div>
          {arg.ai_score !== null && (
            <div className="flex items-center gap-1.5 text-surface-500">
              <Sparkles className="w-3.5 h-3.5 text-purple" />
              <span className="text-sm font-mono tabular-nums text-purple">{arg.ai_score}/10</span>
              <span className="text-xs">AI score</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {arg.source_url && (
            <a
              href={arg.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-400 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Source
            </a>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShare}
            className="gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" />
            {copied ? 'Copied!' : 'Share'}
          </Button>
          <Link href={`/topic/${arg.topic_id}#arg-${arg.id}`}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowRight className="w-3.5 h-3.5" />
              View debate
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Archive card ─────────────────────────────────────────────────────────────

function ArchiveCard({ entry, index }: { entry: ArchiveEntry; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const { argument: arg } = entry
  if (!arg) return null

  const sideColor = arg.side === 'blue' ? 'border-l-for-500/60' : 'border-l-against-500/60'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={cn(
        'rounded-xl border border-surface-300 bg-surface-200/60 hover:bg-surface-200 transition-colors p-4',
        'border-l-2',
        sideColor,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-surface-500 font-medium">{entry.dateLabel}</span>
            <SideBadge side={arg.side} />
            {arg.ai_grade && <GradeBadge grade={arg.ai_grade} />}
          </div>
          <p className="text-sm text-surface-800 leading-snug">
            {expanded ? arg.content : truncate(arg.content, 160)}
          </p>
          {arg.content.length > 160 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-surface-500 hover:text-surface-400 transition-colors"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
          <div className="flex items-center gap-2">
            {arg.author && (
              <Link
                href={`/profile/${arg.author.username}`}
                className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-400 transition-colors"
              >
                <Avatar
                  src={arg.author.avatar_url}
                  username={arg.author.username}
                  size="xs"
                />
                {arg.author.display_name ?? arg.author.username}
              </Link>
            )}
            <span className="text-surface-600">·</span>
            <span className="flex items-center gap-0.5 text-xs text-gold">
              <Zap className="w-3 h-3" />
              {arg.upvotes}
            </span>
            {arg.topic?.category && (
              <>
                <span className="text-surface-600">·</span>
                <span className={cn('text-xs', CATEGORY_COLOR[arg.topic.category] ?? 'text-surface-500')}>
                  {arg.topic.category}
                </span>
              </>
            )}
          </div>
        </div>
        <Link href={`/topic/${arg.topic_id}#arg-${arg.id}`} className="shrink-0">
          <Button variant="ghost" size="sm">
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Countdown to midnight UTC ─────────────────────────────────────────────────

function MidnightCountdown() {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    function calc() {
      const now = new Date()
      const midnight = new Date()
      midnight.setUTCHours(24, 0, 0, 0)
      const diff = midnight.getTime() - now.getTime()
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-1.5 text-xs text-surface-500">
      <Calendar className="w-3 h-3" />
      <span>Next argument in</span>
      <span className="font-mono text-surface-400 tabular-nums">{timeLeft}</span>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ArgumentOfTheDayPage() {
  const [data, setData] = useState<ArgumentOfTheDayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const fetchedAt = useRef<number>(0)

  const load = useCallback(async (force = false) => {
    if (!force && loading === false && Date.now() - fetchedAt.current < 30_000) return
    if (force) setRefreshing(true); else setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/argument-of-the-day', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as ArgumentOfTheDayResponse
      setData(json)
      fetchedAt.current = Date.now()
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loading])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const archiveWithArgs = data?.archive.filter((e) => e.argument !== null) ?? []

  return (
    <div className="min-h-screen bg-surface-100 pb-24">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-20">

        {/* ─── Header ─────────────────────────────────────────────────────── */}
        <div className="text-center space-y-1 pt-6 pb-6">
          <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-gold/80 uppercase tracking-widest">
            <Crown className="w-3.5 h-3.5" />
            Daily Feature
          </div>
          <h1 className="text-2xl font-bold text-white">Argument of the Day</h1>
          {data?.todayDate && (
            <p className="text-sm text-surface-500">{formatDate(data.todayDate)}</p>
          )}
          <MidnightCountdown />
        </div>

        {/* ─── Intro blurb ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-surface-300 bg-surface-200/60 px-4 py-3 mb-5 flex items-start gap-3">
          <Trophy className="w-4 h-4 text-gold shrink-0 mt-0.5" />
          <p className="text-xs text-surface-500 leading-relaxed">
            Every day, the Lobby crowns the most compelling new argument — ranked by community upvotes and
            AI quality score. Read it, share it, or head into the debate to add your voice.
          </p>
        </div>

        {/* ─── Refresh button ──────────────────────────────────────────────── */}
        <div className="flex justify-end mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => load(true)}
            disabled={refreshing}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* ─── Today's argument ────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-surface-300 bg-surface-200 p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-surface-300 bg-surface-200 p-8 text-center space-y-3">
              <Flame className="w-8 h-8 text-surface-600 mx-auto" />
              <p className="text-surface-500 text-sm">Failed to load today&apos;s argument.</p>
              <Button variant="ghost" size="sm" onClick={() => load(true)}>Try again</Button>
            </div>
          ) : data?.today ? (
            <HeroArgumentCard key={data.today.id} arg={data.today} />
          ) : (
            <EmptyState
              icon={<Quote className="w-8 h-8 text-surface-600" />}
              title="No argument crowned yet"
              description="No arguments have been written today. Be the first — pick a topic and make your case."
              action={
                <Link href="/arguments">
                  <Button variant="ghost" size="sm" className="gap-1.5">
                    <ArrowRight className="w-4 h-4" /> Browse topics
                  </Button>
                </Link>
              }
            />
          )}
        </AnimatePresence>

        {/* ─── Quick links ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2 mt-6">
          {[
            { href: '/gallery', icon: Award, label: 'All-time Gallery', color: 'text-gold' },
            { href: '/top-arguments', icon: Sparkles, label: 'Top Scored', color: 'text-purple' },
            { href: '/reel', icon: Flame, label: 'Argument Reel', color: 'text-against-400' },
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

        {/* ─── Archive ─────────────────────────────────────────────────────── */}
        {archiveWithArgs.length > 0 && (
          <section className="mt-8 space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-surface-500" />
              <h2 className="text-sm font-semibold text-surface-400">Previous Winners</h2>
            </div>
            {archiveWithArgs.map((entry, i) => (
              <ArchiveCard key={entry.date} entry={entry} index={i} />
            ))}
          </section>
        )}

        {/* ─── Footer nudge ────────────────────────────────────────────────── */}
        <div className="mt-8 rounded-xl border border-surface-300 bg-surface-200/40 px-4 py-4 flex items-center gap-3">
          <Scale className="w-5 h-5 text-for-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-surface-500 leading-relaxed">
              Want to be tomorrow&apos;s Argument of the Day? Pick a topic, vote your position, and write
              the most compelling case you can make.
            </p>
          </div>
          <Link href="/arguments/foryou" className="shrink-0">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs whitespace-nowrap">
              Write one <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
