'use client'

/**
 * /topic/[id]/fault-lines — Debate Fault Lines
 *
 * Reveals the hidden fracture points in a debate:
 *   • Flashpoints   — arguments that generated the most replies (lightning rods)
 *   • Dead Certainties — high-upvote arguments with zero replies (uncontested)
 *   • Contested Ground — arguments with more replies than upvotes (argument magnets)
 *   • First Movers  — the founding arguments: did they hold up over time?
 *
 * Distinct from:
 *   /topic/[id]/anatomy    — structural breakdown (length, grades, citation rate)
 *   /topic/[id]/threads    — live active thread list
 *   /topic/[id]/quality    — per-argument quality scoring
 *   /topic/[id]/crossfire  — head-to-head argument battles
 *   /topic/[id]/impact     — which arguments had the most reach/engagement
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FlameKindling,
  Info,
  MessageSquare,
  RefreshCw,
  Scale,
  Swords,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { FaultLinesData, FaultLineArg } from '@/app/api/topics/[id]/fault-lines/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

const GRADE_PILL: Record<string, string> = {
  A: 'bg-emerald/20 text-emerald border-emerald/30',
  B: 'bg-for-500/20 text-for-300 border-for-500/30',
  C: 'bg-gold/20 text-gold border-gold/30',
  D: 'bg-against-400/20 text-against-300 border-against-400/30',
  F: 'bg-against-600/20 text-against-300 border-against-600/30',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SidePill({ side }: { side: 'blue' | 'red' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wide border',
        side === 'blue'
          ? 'bg-for-500/20 text-for-300 border-for-500/30'
          : 'bg-against-500/20 text-against-300 border-against-500/30'
      )}
    >
      {side === 'blue' ? (
        <ThumbsUp className="h-2.5 w-2.5" aria-hidden="true" />
      ) : (
        <ThumbsDown className="h-2.5 w-2.5" aria-hidden="true" />
      )}
      {side === 'blue' ? 'FOR' : 'AGAINST'}
    </span>
  )
}

interface ArgCardProps {
  arg: FaultLineArg
  rank?: number
  highlight?: 'flashpoint' | 'certainty' | 'contested' | 'pioneer'
  topicId: string
}

function ArgCard({ arg, rank, highlight, topicId }: ArgCardProps) {
  const isFor = arg.side === 'blue'

  const accentBorder =
    highlight === 'flashpoint'
      ? 'border-l-against-400'
      : highlight === 'certainty'
        ? 'border-l-emerald'
        : highlight === 'contested'
          ? 'border-l-gold'
          : 'border-l-purple'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (rank ?? 0) * 0.06 }}
      className={cn(
        'relative rounded-xl border border-surface-300 bg-surface-100 p-4 border-l-2',
        accentBorder
      )}
    >
      {/* Rank badge */}
      {rank !== undefined && (
        <span className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-surface-200 border border-surface-400 text-[10px] font-mono font-bold text-surface-600">
          {rank + 1}
        </span>
      )}

      {/* Header row */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <SidePill side={arg.side} />

        {arg.ai_grade && (
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-mono font-bold border',
              GRADE_PILL[arg.ai_grade] ?? 'bg-surface-300 text-surface-500 border-surface-400'
            )}
          >
            {arg.ai_grade}
          </span>
        )}

        <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-surface-500">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {timeAgo(arg.created_at)}
        </span>
      </div>

      {/* Content */}
      <p className="text-sm text-surface-900 leading-relaxed line-clamp-3 mb-3">
        {arg.content}
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs font-mono text-surface-500">
        <span className={cn('flex items-center gap-1', isFor ? 'text-for-400' : 'text-against-400')}>
          <ThumbsUp className="h-3 w-3" aria-hidden="true" />
          {arg.upvotes.toLocaleString()}
        </span>

        <span className="flex items-center gap-1 text-purple">
          <MessageSquare className="h-3 w-3" aria-hidden="true" />
          {arg.reply_count.toLocaleString()}
        </span>

        {arg.reply_count > 0 && arg.upvotes > 0 && (
          <span className="flex items-center gap-1 text-gold">
            <Zap className="h-3 w-3" aria-hidden="true" />
            {(arg.tension_ratio).toFixed(1)}× tension
          </span>
        )}

        <Link
          href={`/topic/${topicId}/arguments`}
          className="ml-auto flex items-center gap-1 text-surface-500 hover:text-white transition-colors"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          <span>View</span>
        </Link>
      </div>
    </motion.div>
  )
}

interface SectionProps {
  title: string
  icon: React.ReactNode
  description: string
  accent: string
  children: React.ReactNode
  isEmpty: boolean
}

function Section({ title, icon, description, accent, children, isEmpty }: SectionProps) {
  const [open, setOpen] = useState(true)

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-50 overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-surface-100 transition-colors text-left"
        aria-expanded={open}
      >
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0', accent)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-mono text-sm font-bold text-white">{title}</h2>
          <p className="text-xs text-surface-500 mt-0.5">{description}</p>
        </div>
        <span className="text-surface-500 text-xs font-mono">{open ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="px-4 pb-4">
              {isEmpty ? (
                <p className="py-6 text-center text-sm text-surface-500">
                  Not enough data yet — check back as the debate grows.
                </p>
              ) : (
                <div className="space-y-3">
                  {children}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FaultLinesClient() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<FaultLinesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/topics/${id}/fault-lines`)
      if (!res.ok) throw new Error('fetch failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 pb-24">
        <TopBar />
        <main className="mx-auto max-w-2xl px-4 pt-4 space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-0 pb-24">
        <TopBar />
        <main className="mx-auto max-w-2xl px-4 pt-4">
          <EmptyState
            icon={<AlertTriangle className="h-8 w-8 text-against-400" />}
            title="Couldn't load fault lines"
            description="Something went wrong. Try again."
            action={
              <button
                onClick={fetchData}
                className="flex items-center gap-1.5 rounded-lg bg-surface-200 px-4 py-2 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Retry
              </button>
            }
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const forPct = Math.round(data.blue_pct)
  const againstPct = 100 - forPct

  // Most-contested side display
  const contestLabel =
    data.most_contested_side === 'blue'
      ? 'FOR arguments draw more debate'
      : data.most_contested_side === 'red'
        ? 'AGAINST arguments draw more debate'
        : 'Both sides draw equal debate'

  const contestColor =
    data.most_contested_side === 'blue'
      ? 'text-for-300'
      : data.most_contested_side === 'red'
        ? 'text-against-300'
        : 'text-surface-500'

  return (
    <div className="min-h-screen bg-surface-0 pb-24">
      <TopBar />

      <main className="mx-auto max-w-2xl px-4 pt-4 space-y-5">

        {/* Back link */}
        <Link
          href={`/topic/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to debate
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-against-300 shrink-0" aria-hidden="true" />
            <h1 className="font-mono text-lg font-bold text-white">Fault Lines</h1>
            {data.category && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {data.category}
              </Badge>
            )}
          </div>
          <p className="text-sm text-surface-500 line-clamp-2">{data.topic_statement}</p>
        </motion.div>

        {/* Vote bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3"
        >
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-for-300 font-bold">{forPct}% FOR</span>
            <span className="text-surface-500">{data.total_votes.toLocaleString()} votes</span>
            <span className="text-against-300 font-bold">{againstPct}% AGAINST</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-surface-200">
            <motion.div
              className="bg-for-500"
              style={{ width: `${forPct}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${forPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            <div className="bg-against-500 flex-1" />
          </div>
        </motion.div>

        {/* Summary stats */}
        {!data.unavailable && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-3 gap-2"
          >
            {[
              {
                label: 'Arguments',
                value: data.total_arguments.toLocaleString(),
                icon: <Scale className="h-3.5 w-3.5 text-for-400" />,
                color: 'text-for-300',
              },
              {
                label: 'Replies',
                value: data.total_replies.toLocaleString(),
                icon: <MessageSquare className="h-3.5 w-3.5 text-purple" />,
                color: 'text-purple',
              },
              {
                label: 'Avg replies',
                value: `${data.avg_replies_per_arg}×`,
                icon: <TrendingUp className="h-3.5 w-3.5 text-gold" />,
                color: 'text-gold',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center"
              >
                <div className="flex justify-center mb-1">{stat.icon}</div>
                <p className={cn('font-mono text-base font-bold', stat.color)}>{stat.value}</p>
                <p className="text-[10px] text-surface-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Contested-side callout */}
        {!data.unavailable && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 rounded-xl border border-surface-300 bg-surface-100 px-4 py-3"
          >
            <Info className="h-4 w-4 text-surface-500 shrink-0" aria-hidden="true" />
            <p className="text-xs font-mono">
              <span className={cn('font-bold', contestColor)}>{contestLabel}</span>
              {' '}— the side that attracts more replies is under greater intellectual pressure.
            </p>
          </motion.div>
        )}

        {/* Insufficient data */}
        {data.unavailable ? (
          <EmptyState
            icon={<Swords className="h-8 w-8 text-surface-400" />}
            title="Too early to map fault lines"
            description="Fault lines emerge as the debate grows. Come back once more arguments and replies have been posted."
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="space-y-4"
          >

            {/* Section 1: Flashpoints */}
            <Section
              title="Flashpoints"
              icon={<FlameKindling className="h-4 w-4 text-against-300" />}
              description="Arguments that generated the most replies — the debate's lightning rods"
              accent="bg-against-500/20"
              isEmpty={data.flashpoints.length === 0}
            >
              {data.flashpoints.map((arg, i) => (
                <ArgCard
                  key={arg.id}
                  arg={arg}
                  rank={i}
                  highlight="flashpoint"
                  topicId={id}
                />
              ))}
            </Section>

            {/* Section 2: Contested Ground */}
            <Section
              title="Contested Ground"
              icon={<Swords className="h-4 w-4 text-gold" />}
              description="Arguments debated more fiercely than they're upvoted — high tension, unresolved"
              accent="bg-gold/20"
              isEmpty={data.contested_ground.length === 0}
            >
              {data.contested_ground.map((arg, i) => (
                <ArgCard
                  key={arg.id}
                  arg={arg}
                  rank={i}
                  highlight="contested"
                  topicId={id}
                />
              ))}
            </Section>

            {/* Section 3: Dead Certainties */}
            <Section
              title="Dead Certainties"
              icon={<CheckCircle2 className="h-4 w-4 text-emerald" />}
              description="High-upvote arguments that nobody challenged — accepted as self-evident"
              accent="bg-emerald/20"
              isEmpty={data.dead_certainties.length === 0}
            >
              {data.dead_certainties.map((arg, i) => (
                <ArgCard
                  key={arg.id}
                  arg={arg}
                  rank={i}
                  highlight="certainty"
                  topicId={id}
                />
              ))}
            </Section>

            {/* Section 4: First Movers */}
            <Section
              title="First Movers"
              icon={<Trophy className="h-4 w-4 text-purple" />}
              description="The founding arguments — posted first, they set the tone for everything that followed"
              accent="bg-purple/20"
              isEmpty={data.first_movers.length === 0}
            >
              {data.first_movers.map((arg, i) => (
                <ArgCard
                  key={arg.id}
                  arg={arg}
                  rank={i}
                  highlight="pioneer"
                  topicId={id}
                />
              ))}
            </Section>

          </motion.div>
        )}

        {/* Footer links */}
        <div className="flex flex-wrap gap-2 pb-2">
          {[
            { href: `/topic/${id}/anatomy`, label: 'Anatomy' },
            { href: `/topic/${id}/threads`, label: 'Threads' },
            { href: `/topic/${id}/impact`, label: 'Impact' },
            { href: `/topic/${id}/crossfire`, label: 'Crossfire' },
            { href: `/topic/${id}/quality`, label: 'Quality' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg border border-surface-300 bg-surface-100 px-3 py-1.5 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Refresh */}
        <div className="flex justify-center pb-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 rounded-lg border border-surface-300 bg-surface-100 px-4 py-2 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </button>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
