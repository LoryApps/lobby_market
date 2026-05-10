'use client'

/**
 * /arguments/top-scored — Best Arguments
 *
 * Showcases the highest AI-graded arguments on the platform, ranked by
 * quality score. Filterable by period (week / month / all-time), grade
 * (A / B / C), and side (FOR / AGAINST). Grade badges use distinct accent
 * colours: gold for A, emerald for B, blue for C, grey for D, red for F.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  Brain,
  CheckCircle2,
  Link2,
  Loader2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Trophy,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  TopScoredArgument,
  TopScoredResponse,
  Period,
  GradeFilter,
  SideFilter,
} from '@/app/api/arguments/top-scored/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<string, {
  label: string
  bg: string
  border: string
  text: string
  scoreFill: string
  cardBorder: string
  cardGlow: string
}> = {
  A: {
    label: 'A',
    bg: 'bg-gold/20',
    border: 'border-gold/50',
    text: 'text-gold',
    scoreFill: 'bg-gold',
    cardBorder: 'border-gold/25',
    cardGlow: 'shadow-[0_0_24px_rgba(201,168,76,0.12)]',
  },
  B: {
    label: 'B',
    bg: 'bg-emerald/15',
    border: 'border-emerald/40',
    text: 'text-emerald',
    scoreFill: 'bg-emerald',
    cardBorder: 'border-emerald/20',
    cardGlow: 'shadow-[0_0_20px_rgba(5,150,105,0.10)]',
  },
  C: {
    label: 'C',
    bg: 'bg-for-500/12',
    border: 'border-for-500/35',
    text: 'text-for-400',
    scoreFill: 'bg-for-500',
    cardBorder: 'border-for-500/18',
    cardGlow: '',
  },
  D: {
    label: 'D',
    bg: 'bg-surface-300/50',
    border: 'border-surface-400/50',
    text: 'text-surface-400',
    scoreFill: 'bg-surface-500',
    cardBorder: 'border-surface-300',
    cardGlow: '',
  },
  F: {
    label: 'F',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    text: 'text-against-400',
    scoreFill: 'bg-against-500',
    cardBorder: 'border-against-500/18',
    cardGlow: '',
  },
}

const DEFAULT_GRADE = GRADE_CONFIG.C

function getGradeCfg(grade: string) {
  return GRADE_CONFIG[grade.toUpperCase()] ?? DEFAULT_GRADE
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
]

const GRADES: { value: GradeFilter; label: string }[] = [
  { value: 'all', label: 'All Grades' },
  { value: 'A', label: 'A  Exceptional' },
  { value: 'B', label: 'B  Strong' },
  { value: 'C', label: 'C  Adequate' },
]

const SIDES: { value: SideFilter; label: string }[] = [
  { value: 'all', label: 'Both Sides' },
  { value: 'for', label: 'FOR' },
  { value: 'against', label: 'AGAINST' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 30) return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m < 2) return 'just now'
  return `${m}m ago`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ArgSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3 animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-full bg-surface-300 flex-shrink-0" />
        <div className="h-8 w-8 rounded-lg bg-surface-300 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-32 bg-surface-300 rounded" />
          <div className="h-2 w-20 bg-surface-300 rounded" />
        </div>
        <div className="h-5 w-12 bg-surface-300 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="h-3.5 w-full bg-surface-300 rounded" />
        <div className="h-3.5 w-5/6 bg-surface-300 rounded" />
        <div className="h-3.5 w-3/4 bg-surface-300 rounded" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-2.5 w-24 bg-surface-300 rounded" />
        <div className="h-2.5 w-32 bg-surface-300 rounded" />
      </div>
    </div>
  )
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, grade }: { score: number; grade: string }) {
  const cfg = getGradeCfg(grade)
  const pct = Math.round((score / 10) * 100)
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', cfg.scoreFill)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('text-[10px] font-mono font-semibold tabular-nums', cfg.text)}>
        {score.toFixed(1)}/10
      </span>
    </div>
  )
}

// ─── Grade badge ──────────────────────────────────────────────────────────────

function GradeBadge({ grade, size = 'md' }: { grade: string; size?: 'sm' | 'md' | 'lg' }) {
  const cfg = getGradeCfg(grade)
  return (
    <span
      className={cn(
        'flex items-center justify-center flex-shrink-0 rounded-lg font-bold font-mono border',
        cfg.bg, cfg.border, cfg.text,
        size === 'lg' ? 'h-10 w-10 text-xl' : size === 'sm' ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-base',
      )}
      aria-label={`Grade ${grade}`}
    >
      {grade.toUpperCase()}
    </span>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg, rank }: { arg: TopScoredArgument; rank: number }) {
  const cfg = getGradeCfg(arg.ai_grade)
  const isFor = arg.side === 'blue'

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: rank * 0.035 }}
      className={cn(
        'rounded-2xl border bg-surface-100 p-4 space-y-3 transition-shadow',
        cfg.cardBorder,
        cfg.cardGlow,
      )}
    >
      {/* Header: rank + grade + author + time */}
      <div className="flex items-center gap-2.5">
        {/* Rank */}
        <span
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold font-mono',
            rank === 0
              ? 'bg-gold/25 text-gold border border-gold/50'
              : rank === 1
              ? 'bg-surface-300/60 text-white border border-surface-400/40'
              : rank === 2
              ? 'bg-against-500/10 text-against-300 border border-against-500/30'
              : 'bg-surface-200 text-surface-500 border border-surface-300',
          )}
          aria-label={`Rank ${rank + 1}`}
        >
          {rank + 1}
        </span>

        {/* Grade */}
        <GradeBadge grade={arg.ai_grade} size="md" />

        {/* Author */}
        {arg.author ? (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Avatar
              src={arg.author.avatar_url}
              fallback={arg.author.display_name ?? arg.author.username}
              size="xs"
              className="flex-shrink-0"
            />
            <Link
              href={`/profile/${arg.author.username}`}
              className="text-xs font-semibold text-surface-300 hover:text-white transition-colors truncate"
            >
              {arg.author.display_name ?? arg.author.username}
            </Link>
            {arg.author.role !== 'person' && (
              <span className="text-[10px] font-mono text-gold/70 flex-shrink-0">
                {ROLE_LABEL[arg.author.role] ?? arg.author.role}
              </span>
            )}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Side pill */}
        <span
          className={cn(
            'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
            isFor
              ? 'bg-for-500/15 border-for-500/40 text-for-300'
              : 'bg-against-500/15 border-against-500/40 text-against-300',
          )}
        >
          {isFor ? <ThumbsUp className="h-2.5 w-2.5" aria-hidden /> : <ThumbsDown className="h-2.5 w-2.5" aria-hidden />}
          {isFor ? 'FOR' : 'AGAINST'}
        </span>

        <span className="text-[10px] text-surface-600 flex-shrink-0 hidden sm:block">
          {relativeTime(arg.created_at)}
        </span>
      </div>

      {/* Score bar */}
      <ScoreBar score={arg.ai_score} grade={arg.ai_grade} />

      {/* Content */}
      <Link href={`/arguments/${arg.id}`} className="block group">
        <blockquote
          className={cn(
            'text-sm leading-relaxed group-hover:opacity-90 transition-opacity',
            isFor ? 'text-for-100' : 'text-against-100',
          )}
        >
          <span
            className={cn('text-lg font-bold leading-none mr-0.5', isFor ? 'text-for-400' : 'text-against-400')}
            aria-hidden
          >
            &ldquo;
          </span>
          {truncate(arg.content, 260)}
          <span
            className={cn('text-lg font-bold leading-none ml-0.5', isFor ? 'text-for-400' : 'text-against-400')}
            aria-hidden
          >
            &rdquo;
          </span>
        </blockquote>
      </Link>

      {/* Footer: upvotes + source + topic */}
      <div className="flex items-center gap-3 pt-0.5">
        {/* Upvotes */}
        <div className="flex items-center gap-1">
          {isFor ? (
            <ThumbsUp className="h-3 w-3 text-for-400" aria-hidden />
          ) : (
            <ThumbsDown className="h-3 w-3 text-against-400" aria-hidden />
          )}
          <span className="text-xs font-mono font-semibold text-white">
            {arg.upvotes.toLocaleString()}
          </span>
        </div>

        {/* Source indicator */}
        {arg.source_url && (
          <a
            href={arg.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-mono text-emerald/70 hover:text-emerald transition-colors"
            aria-label="View source"
          >
            <Link2 className="h-2.5 w-2.5" aria-hidden />
            Source
          </a>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Topic link */}
        {arg.topic && (
          <Link
            href={`/topic/${arg.topic_id}`}
            className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500 hover:text-surface-300 transition-colors max-w-[200px]"
            aria-label={`View topic: ${arg.topic.statement}`}
          >
            {arg.topic.status && (
              <Badge variant={STATUS_BADGE[arg.topic.status] ?? 'proposed'} className="flex-shrink-0">
                {arg.topic.status === 'law' ? 'LAW' : arg.topic.status === 'voting' ? 'Voting' : arg.topic.status === 'active' ? 'Active' : arg.topic.status === 'failed' ? 'Failed' : 'Proposed'}
              </Badge>
            )}
            <span className="truncate">{truncate(arg.topic.statement, 45)}</span>
            <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" aria-hidden />
          </Link>
        )}
      </div>
    </motion.article>
  )
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

function FilterPill({
  active,
  onClick,
  children,
  accent,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  accent?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all',
        active
          ? accent ?? 'bg-for-600/30 border-for-500/60 text-for-300'
          : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
      )}
    >
      {children}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

export default function TopScoredPage() {
  const [args, setArgs] = useState<TopScoredArgument[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [period, setPeriod] = useState<Period>('all')
  const [grade, setGrade] = useState<GradeFilter>('all')
  const [side, setSide] = useState<SideFilter>('all')
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const fetchArgs = useCallback(async (
    p: Period,
    g: GradeFilter,
    s: SideFilter,
    off: number,
    append: boolean,
  ) => {
    if (off === 0) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const url = new URL('/api/arguments/top-scored', window.location.origin)
      url.searchParams.set('period', p)
      url.searchParams.set('grade', g)
      url.searchParams.set('side', s)
      url.searchParams.set('limit', String(PAGE_SIZE))
      url.searchParams.set('offset', String(off))

      const res = await fetch(url.toString(), { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const data = (await res.json()) as TopScoredResponse

      setArgs((prev) => append ? [...prev, ...data.arguments] : data.arguments)
      setTotal(data.total)
      setHasMore(off + PAGE_SIZE < data.total)
    } catch {
      setError('Could not load top-scored arguments. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Fetch on filter change
  useEffect(() => {
    setOffset(0)
    void fetchArgs(period, grade, side, 0, false)
  }, [period, grade, side, fetchArgs])

  function loadMore() {
    const next = offset + PAGE_SIZE
    setOffset(next)
    void fetchArgs(period, grade, side, next, true)
  }

  const aCount = args.filter((a) => a.ai_grade === 'A').length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Page header ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <Trophy className="h-5 w-5 text-gold" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Best Arguments</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                The Lobby&apos;s highest AI-graded arguments, ranked by quality score
              </p>
            </div>
          </div>

          {/* Stat strip */}
          <div className="flex items-center gap-4 mt-4 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-surface-500">
              <Brain className="h-3.5 w-3.5 text-purple" aria-hidden />
              <span className="text-white font-semibold">{total.toLocaleString()}</span>
              <span>graded arguments</span>
            </div>
            {aCount > 0 && (
              <div className="flex items-center gap-1.5 text-surface-500">
                <Award className="h-3.5 w-3.5 text-gold" aria-hidden />
                <span className="text-gold font-semibold">{aCount}</span>
                <span>grade A on this page</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-surface-500 ml-auto">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald" aria-hidden />
              <span>AI-verified quality</span>
            </div>
          </div>
        </motion.div>

        {/* ── Filters ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut', delay: 0.06 }}
          className="mb-5 space-y-2.5"
        >
          {/* Period */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-surface-600 w-12 flex-shrink-0">Period</span>
            {PERIODS.map((p) => (
              <FilterPill
                key={p.value}
                active={period === p.value}
                onClick={() => setPeriod(p.value)}
                accent="bg-purple/20 border-purple/50 text-purple"
              >
                {p.label}
              </FilterPill>
            ))}
          </div>

          {/* Grade */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-surface-600 w-12 flex-shrink-0">Grade</span>
            {GRADES.map((g) => {
              const cfg = g.value !== 'all' ? getGradeCfg(g.value) : null
              return (
                <FilterPill
                  key={g.value}
                  active={grade === g.value}
                  onClick={() => setGrade(g.value)}
                  accent={cfg ? `${cfg.bg} ${cfg.border} ${cfg.text}` : undefined}
                >
                  {g.label}
                </FilterPill>
              )
            })}
          </div>

          {/* Side */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-surface-600 w-12 flex-shrink-0">Side</span>
            {SIDES.map((s) => (
              <FilterPill
                key={s.value}
                active={side === s.value}
                onClick={() => setSide(s.value)}
                accent={
                  s.value === 'for'
                    ? 'bg-for-500/15 border-for-500/40 text-for-300'
                    : s.value === 'against'
                    ? 'bg-against-500/15 border-against-500/40 text-against-300'
                    : undefined
                }
              >
                {s.label}
              </FilterPill>
            ))}
          </div>
        </motion.div>

        {/* ── Results ────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <ArgSkeleton key={i} delay={i * 40} />
              ))}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-against-500/20 bg-against-500/5 p-6 text-center"
            >
              <Scale className="h-8 w-8 text-against-400 mx-auto mb-3" aria-hidden />
              <p className="text-sm font-mono text-against-300 mb-3">{error}</p>
              <button
                onClick={() => void fetchArgs(period, grade, side, 0, false)}
                className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Try again
              </button>
            </motion.div>
          ) : args.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Brain}
                iconColor="text-purple"
                iconBg="bg-purple/10"
                iconBorder="border-purple/30"
                title="No graded arguments yet"
                description="Arguments receive AI quality scores after submission. Check back soon — the community is building."
                actions={[
                  { label: 'Browse Topics', href: '/' },
                  { label: 'Trending Arguments', href: '/arguments/trending', variant: 'secondary' },
                ]}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`${period}-${grade}-${side}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {args.map((arg, i) => (
                <ArgumentCard key={arg.id} arg={arg} rank={i} />
              ))}

              {/* Load more */}
              {hasMore && (
                <div className="pt-2 flex justify-center">
                  <button
                    onClick={loadMore}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all disabled:opacity-50"
                  >
                    {refreshing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {refreshing ? 'Loading…' : `Load more · ${total - args.length} remaining`}
                  </button>
                </div>
              )}

              {/* Attribution footer */}
              <div className="pt-4 flex items-center gap-2 text-[11px] font-mono text-surface-600">
                <Brain className="h-3 w-3 text-purple" aria-hidden />
                <span>Quality scores powered by the Argument Coach AI · </span>
                <Link href="/coach" className="text-for-500 hover:text-for-400 transition-colors">
                  Grade your arguments →
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
