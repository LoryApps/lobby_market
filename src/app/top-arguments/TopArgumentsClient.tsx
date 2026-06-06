'use client'

/**
 * /top-arguments — AI-Graded Argument Hall of Fame
 *
 * Displays civic arguments that have been critiqued and graded by the
 * platform's AI coach. Arguments are ranked by quality score (A→F) and
 * community upvotes. Filters by time period, grade, and side.
 *
 * Scores are earned when a user runs the inline AI critique on their draft
 * before submission — the grade (A/B/C/D/F) and numeric score (1–10) are
 * then permanently attached to the argument card.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  ChevronRight,
  ExternalLink,
  Gavel,
  Link2,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  TopScoredArgument,
  TopScoredResponse,
  Period,
  GradeFilter,
  SideFilter,
} from '@/app/api/arguments/top-scored/route'

// ─── Grade config ────────────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<string, { score: string; text: string; bg: string; border: string; ring: string }> = {
  A: { score: '9–10', text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     ring: 'ring-emerald/40' },
  B: { score: '7–8',  text: 'text-for-300',    bg: 'bg-for-500/10',     border: 'border-for-500/30',     ring: 'ring-for-500/40' },
  C: { score: '5–6',  text: 'text-gold',       bg: 'bg-gold/10',        border: 'border-gold/30',        ring: 'ring-gold/40' },
  D: { score: '3–4',  text: 'text-against-300',bg: 'bg-against-500/10', border: 'border-against-500/30', ring: 'ring-against-500/40' },
  F: { score: '1–2',  text: 'text-against-400',bg: 'bg-against-600/10', border: 'border-against-600/30', ring: 'ring-against-600/40' },
}

const PERIODS: { id: Period; label: string }[] = [
  { id: 'week',  label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all',   label: 'All Time' },
]

const GRADE_FILTERS: { id: GradeFilter; label: string }[] = [
  { id: 'all', label: 'All Grades' },
  { id: 'A',   label: 'Grade A' },
  { id: 'B',   label: 'Grade B' },
  { id: 'C',   label: 'Grade C' },
]

const SIDE_FILTERS: { id: SideFilter; label: string; icon: typeof Scale }[] = [
  { id: 'all',     label: 'Both',    icon: Scale },
  { id: 'for',     label: 'FOR',     icon: TrendingUp },
  { id: 'against', label: 'AGAINST', icon: Gavel },
]

const PAGE_SIZE = 20

// ─── Helpers ──────────────────────────────────────────────────────────────────────

function relativeTime(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round((score / 10) * 100)
  const color =
    score >= 9 ? 'bg-emerald' :
    score >= 7 ? 'bg-for-400' :
    score >= 5 ? 'bg-gold' :
    score >= 3 ? 'bg-against-400' : 'bg-against-600'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-surface-300/40 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">{score}/10</span>
    </div>
  )
}

// ─── Argument Card ─────────────────────────────────────────────────────────────────

function ArgumentCard({ arg, rank }: { arg: TopScoredArgument; rank: number }) {
  const isFor   = arg.side === 'blue'
  const sideDot = isFor ? 'bg-for-500' : 'bg-against-500'
  const gradeConfig = GRADE_CONFIG[arg.ai_grade] ?? GRADE_CONFIG.C

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative flex gap-3 p-4 rounded-xl border transition-colors',
        gradeConfig.bg,
        gradeConfig.border,
      )}
    >
      {/* Rank badge */}
      <div className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-surface-100 border border-surface-300 flex items-center justify-center">
        <span className="text-[9px] font-bold font-mono text-surface-400">#{rank}</span>
      </div>

      {/* Side dot */}
      <div className="flex-shrink-0 pt-1.5">
        <div className={cn('h-2.5 w-2.5 rounded-full', sideDot)} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {/* Author + grade row */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <Avatar
            src={arg.author?.avatar_url ?? null}
            fallback={arg.author?.display_name || arg.author?.username || '?'}
            size="xs"
          />
          <Link
            href={`/profile/${arg.author?.username ?? arg.user_id}`}
            className="text-xs font-medium text-white hover:text-for-300 transition-colors truncate max-w-[100px]"
          >
            {arg.author?.display_name || arg.author?.username || 'Anonymous'}
          </Link>
          {arg.author?.role && arg.author.role !== 'person' && (
            <Badge
              variant={arg.author.role as 'person' | 'debator' | 'troll_catcher' | 'elder'}
              className="text-[9px]"
            >
              {arg.author.role}
            </Badge>
          )}
          <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wide', isFor ? 'text-for-400' : 'text-against-400')}>
            {isFor ? 'For' : 'Against'}
          </span>
          {/* AI Grade badge */}
          <span
            className={cn(
              'ml-auto flex-shrink-0 inline-flex items-center justify-center h-5 w-5 rounded text-xs font-bold font-mono ring-1',
              gradeConfig.text,
              gradeConfig.bg,
              gradeConfig.ring,
            )}
            title={`AI Grade: ${arg.ai_grade} — Score: ${arg.ai_score}/10`}
          >
            {arg.ai_grade}
          </span>
        </div>

        {/* Quality score bar */}
        <ScoreBar score={arg.ai_score} />

        {/* Argument content */}
        <p className="text-sm text-surface-200 leading-relaxed mt-2">{arg.content}</p>

        {/* Source URL */}
        {arg.source_url && (
          <a
            href={arg.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-mono text-surface-500 hover:text-surface-300 transition-colors max-w-full"
          >
            <Link2 className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {(() => { try { return new URL(arg.source_url).hostname.replace(/^www\./, '') } catch { return arg.source_url } })()}
            </span>
            <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 opacity-60" />
          </a>
        )}

        {/* Footer: topic link + upvotes + time */}
        <div className="mt-2.5 flex items-center gap-3 flex-wrap">
          {arg.topic && (
            <Link
              href={`/topic/${arg.topic_id}`}
              className="flex items-center gap-1 text-[11px] text-surface-500 hover:text-surface-300 transition-colors max-w-[220px]"
            >
              <ChevronRight className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{arg.topic.statement}</span>
            </Link>
          )}
          <div className="flex items-center gap-1 text-[11px] text-surface-600 ml-auto flex-shrink-0">
            <ThumbsUp className="h-3 w-3" />
            <span className="font-mono">{arg.upvotes}</span>
          </div>
          <span className="text-[11px] text-surface-700 flex-shrink-0">{relativeTime(arg.created_at)}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export function TopArgumentsClient() {
  const [args, setArgs] = useState<TopScoredArgument[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [currentOffset, setCurrentOffset] = useState(0)

  const [period, setPeriod] = useState<Period>('all')
  const [grade, setGrade] = useState<GradeFilter>('all')
  const [side, setSide] = useState<SideFilter>('all')

  const hasMore = currentOffset < total

  const buildUrl = useCallback((off: number) => {
    const p = new URLSearchParams({ period, grade, side, limit: String(PAGE_SIZE), offset: String(off) })
    return `/api/arguments/top-scored?${p.toString()}`
  }, [period, grade, side])

  const fetchArgs = useCallback(async (reset: boolean) => {
    const off = reset ? 0 : currentOffset
    if (reset) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }
    try {
      const res = await fetch(buildUrl(off))
      if (!res.ok) throw new Error('Failed')
      const data = (await res.json()) as TopScoredResponse
      if (reset) {
        setArgs(data.arguments)
        setCurrentOffset(data.arguments.length)
      } else {
        setArgs((prev) => [...prev, ...data.arguments])
        setCurrentOffset(off + data.arguments.length)
      }
      setTotal(data.total)
    } catch {
      if (reset) setArgs([])
    } finally {
      if (reset) {
        setLoading(false)
      } else {
        setLoadingMore(false)
      }
    }
  }, [buildUrl, currentOffset])

  useEffect(() => {
    fetchArgs(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, grade, side])

  const filterBarRef = useRef<HTMLDivElement>(null)

  return (
    <div className="min-h-screen bg-surface-100">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <Link href="/" className="text-surface-500 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-gold" />
            <h1 className="text-lg font-bold text-white">Top Arguments</h1>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-surface-500">
            <Sparkles className="h-3 w-3 text-purple" />
            <span>AI-graded</span>
          </div>
        </div>
        <p className="text-[12px] text-surface-500 mb-5 pl-7">
          Arguments graded by the AI coach — A through F — ranked by quality then upvotes.
          Run a draft critique before submitting to earn your grade.
        </p>

        {/* Grade legend */}
        <div className="flex gap-1.5 flex-wrap mb-4">
          {Object.entries(GRADE_CONFIG).map(([g, cfg]) => (
            <div
              key={g}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border',
                cfg.bg, cfg.border, cfg.text
              )}
            >
              <span className="font-bold">{g}</span>
              <span className="opacity-70">{cfg.score}</span>
            </div>
          ))}
        </div>

        {/* ── Filter bar ── */}
        <div ref={filterBarRef} className="flex gap-2 flex-wrap mb-5">
          {/* Period */}
          <div className="flex gap-1 p-0.5 bg-surface-200 rounded-lg border border-surface-300/40">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all',
                  period === p.id
                    ? 'bg-surface-400 text-white'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Grade filter */}
          <div className="flex gap-1 p-0.5 bg-surface-200 rounded-lg border border-surface-300/40">
            {GRADE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setGrade(f.id)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all',
                  grade === f.id
                    ? 'bg-surface-400 text-white'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Side filter */}
          <div className="flex gap-1 p-0.5 bg-surface-200 rounded-lg border border-surface-300/40">
            {SIDE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSide(f.id)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all',
                  side === f.id
                    ? f.id === 'for'     ? 'bg-for-500/20 text-for-300'
                    : f.id === 'against' ? 'bg-against-500/20 text-against-300'
                    :                     'bg-surface-400 text-white'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                <f.icon className="h-3 w-3" />
                <span>{f.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        {!loading && (
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="h-3.5 w-3.5 text-surface-600" />
            <span className="text-[11px] font-mono text-surface-600">
              {total.toLocaleString()} graded argument{total !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={() => fetchArgs(true)}
              className="ml-auto text-surface-600 hover:text-surface-400 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl border border-surface-300/30 bg-surface-200/40 animate-pulse">
                <div className="flex gap-3">
                  <Skeleton className="h-2.5 w-2.5 rounded-full mt-1.5 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2 items-center">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-5 w-5 rounded ml-auto" />
                    </div>
                    <Skeleton className="h-1 w-full rounded-full" />
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-4/5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : args.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No graded arguments yet"
            description="Arguments earn a grade when the author runs the AI critique before submitting. Check back as the community starts using it."
            actions={[{ label: 'Browse debates', href: '/' }]}
          />
        ) : (
          <>
            <div className="space-y-4">
              <AnimatePresence>
                {args.map((arg, i) => (
                  <ArgumentCard key={arg.id} arg={arg} rank={i + 1} />
                ))}
              </AnimatePresence>
            </div>

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => fetchArgs(false)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 bg-surface-200 hover:bg-surface-300 border border-surface-300 rounded-xl text-sm text-surface-300 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 text-gold" />
                  )}
                  Load more
                </button>
              </div>
            )}
          </>
        )}

        {/* How to earn your grade */}
        <div className="mt-10 p-4 rounded-xl border border-surface-300/30 bg-surface-200/40">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-purple" />
            <span className="text-sm font-semibold text-white">How to earn your grade</span>
          </div>
          <ol className="space-y-1.5 text-[12px] text-surface-400">
            <li className="flex gap-2">
              <span className="text-surface-600 flex-shrink-0 font-mono">1.</span>
              Go to any active debate topic.
            </li>
            <li className="flex gap-2">
              <span className="text-surface-600 flex-shrink-0 font-mono">2.</span>
              Write your FOR or AGAINST argument (minimum 10 characters).
            </li>
            <li className="flex gap-2">
              <span className="text-surface-600 flex-shrink-0 font-mono">3.</span>
              Click the <strong className="text-purple">AI Critique</strong> button to get feedback on clarity, evidence, logic, and persuasion.
            </li>
            <li className="flex gap-2">
              <span className="text-surface-600 flex-shrink-0 font-mono">4.</span>
              Improve your argument if needed, then submit — your grade is permanently saved.
            </li>
            <li className="flex gap-2">
              <span className="text-surface-600 flex-shrink-0 font-mono">5.</span>
              Top-graded arguments appear here for the community to discover.
            </li>
          </ol>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
