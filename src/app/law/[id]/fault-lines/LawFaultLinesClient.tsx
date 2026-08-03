'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FlameKindling,
  Gavel,
  Info,
  MessageSquare,
  RefreshCw,
  Scale,
  Swords,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LawFaultLinesData, FaultLineArg } from '@/app/api/laws/[id]/fault-lines/route'

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

// ─── Side Pill ────────────────────────────────────────────────────────────────

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
        <ThumbsUp className="h-2.5 w-2.5" aria-hidden />
      ) : (
        <ThumbsDown className="h-2.5 w-2.5" aria-hidden />
      )}
      {side === 'blue' ? 'FOR' : 'AGAINST'}
    </span>
  )
}

// ─── Argument Card ────────────────────────────────────────────────────────────

type Highlight = 'flashpoint' | 'contested' | 'certainty' | 'pioneer'

const HIGHLIGHT_CONFIG: Record<Highlight, { border: string; badge: string; badgeBg: string }> = {
  flashpoint: {
    border: 'border-against-500/30',
    badge: 'Flashpoint',
    badgeBg: 'bg-against-500/10 text-against-300 border-against-500/30',
  },
  contested: {
    border: 'border-gold/30',
    badge: 'Contested',
    badgeBg: 'bg-gold/10 text-gold border-gold/30',
  },
  certainty: {
    border: 'border-emerald/30',
    badge: 'Dead Certainty',
    badgeBg: 'bg-emerald/10 text-emerald border-emerald/30',
  },
  pioneer: {
    border: 'border-purple/30',
    badge: 'First Mover',
    badgeBg: 'bg-purple/10 text-purple border-purple/30',
  },
}

function ArgCard({
  arg,
  rank,
  highlight,
  topicId,
}: {
  arg: FaultLineArg
  rank: number
  highlight: Highlight
  topicId: string
}) {
  const cfg = HIGHLIGHT_CONFIG[highlight]

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className={cn(
        'rounded-xl border bg-surface-100 p-4 space-y-3',
        cfg.border
      )}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2">
        <SidePill side={arg.side} />
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono font-bold border',
            cfg.badgeBg
          )}
        >
          {cfg.badge}
        </span>
        {arg.ai_grade && (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono font-bold border',
              GRADE_PILL[arg.ai_grade] ?? 'bg-surface-300/30 text-surface-500 border-surface-400/30'
            )}
          >
            {arg.ai_grade}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3 text-[10px] font-mono text-surface-500">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" aria-hidden />
            {arg.upvotes}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" aria-hidden />
            {arg.reply_count}
          </span>
          {highlight !== 'certainty' && arg.tension_ratio > 0 && (
            <span className="text-gold">{arg.tension_ratio.toFixed(1)}× tension</span>
          )}
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-surface-700 leading-relaxed line-clamp-3">{arg.content}</p>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] font-mono text-surface-600">
        <span className="flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" aria-hidden />
          {timeAgo(arg.created_at)}
        </span>
        <Link
          href={`/topic/${topicId}/arguments#${arg.id}`}
          className="flex items-center gap-1 text-surface-500 hover:text-for-300 transition-colors"
          aria-label="View argument in context"
        >
          View <ExternalLink className="h-2.5 w-2.5" aria-hidden />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  description,
  accent,
  isEmpty,
  children,
}: {
  title: string
  icon: React.ReactNode
  description: string
  accent: string
  isEmpty: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className={cn('flex-shrink-0 mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center', accent)}>
          {icon}
        </div>
        <div>
          <h2 className="font-mono text-sm font-bold text-white">{title}</h2>
          <p className="text-[11px] text-surface-500 mt-0.5">{description}</p>
        </div>
      </div>
      {isEmpty ? (
        <p className="rounded-xl border border-surface-300 bg-surface-100 px-4 py-3 text-xs font-mono text-surface-500">
          No {title.toLowerCase()} found in this debate.
        </p>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LawFaultLinesClient({ lawId }: { lawId: string }) {
  const [data, setData] = useState<LawFaultLinesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/laws/${lawId}/fault-lines`)
      if (!res.ok) throw new Error('Failed')
      const json: LawFaultLinesData = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { fetchData() }, [fetchData])

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
                <RefreshCw className="h-4 w-4" aria-hidden />
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

  const contestLabel =
    data.most_contested_side === 'blue'
      ? 'FOR arguments draw more debate'
      : data.most_contested_side === 'red'
        ? 'AGAINST arguments draw more debate'
        : 'Both sides drew equal debate'

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

        {/* Back */}
        <Link
          href={`/law/${lawId}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to law
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-against-300 shrink-0" aria-hidden />
            <h1 className="font-mono text-lg font-bold text-white">Fault Lines</h1>
            <Gavel className="h-4 w-4 text-gold shrink-0" aria-hidden />
            {data.category && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {data.category}
              </Badge>
            )}
          </div>
          <p className="text-sm text-surface-500 line-clamp-2">{data.law_statement}</p>
          <p className="text-[10px] font-mono text-surface-600">
            From the original debate · Established {new Date(data.established_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
          </p>
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
              { label: 'Arguments', value: data.total_arguments.toLocaleString(), icon: <Scale className="h-3.5 w-3.5 text-for-400" />, color: 'text-for-300' },
              { label: 'Replies', value: data.total_replies.toLocaleString(), icon: <MessageSquare className="h-3.5 w-3.5 text-purple" />, color: 'text-purple' },
              { label: 'Avg replies', value: `${data.avg_replies_per_arg}×`, icon: <TrendingUp className="h-3.5 w-3.5 text-gold" />, color: 'text-gold' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
                <div className="flex justify-center mb-1">{stat.icon}</div>
                <p className={cn('font-mono text-base font-bold', stat.color)}>{stat.value}</p>
                <p className="text-[10px] text-surface-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Contest callout */}
        {!data.unavailable && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 rounded-xl border border-surface-300 bg-surface-100 px-4 py-3"
          >
            <Info className="h-4 w-4 text-surface-500 shrink-0" aria-hidden />
            <p className="text-xs font-mono">
              <span className={cn('font-bold', contestColor)}>{contestLabel}</span>
              {' '}— the side that attracted more replies was under greater intellectual pressure.
            </p>
          </motion.div>
        )}

        {/* Insufficient data */}
        {data.unavailable ? (
          <EmptyState
            icon={<Swords className="h-8 w-8 text-surface-400" />}
            title="Debate data unavailable"
            description="This law's original debate doesn't have enough argument data to map fault lines."
            action={
              <Link
                href={`/law/${lawId}/arguments`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-200 px-4 py-2 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
              >
                View founding arguments
              </Link>
            }
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="space-y-6"
          >
            <Section
              title="Flashpoints"
              icon={<FlameKindling className="h-4 w-4 text-against-300" />}
              description="Arguments that generated the most replies — the debate's lightning rods"
              accent="bg-against-500/20"
              isEmpty={data.flashpoints.length === 0}
            >
              {data.flashpoints.map((arg, i) => (
                <ArgCard key={arg.id} arg={arg} rank={i} highlight="flashpoint" topicId={data.topic_id} />
              ))}
            </Section>

            <Section
              title="Contested Ground"
              icon={<Swords className="h-4 w-4 text-gold" />}
              description="Arguments debated more fiercely than they're upvoted — high tension, unresolved"
              accent="bg-gold/20"
              isEmpty={data.contested_ground.length === 0}
            >
              {data.contested_ground.map((arg, i) => (
                <ArgCard key={arg.id} arg={arg} rank={i} highlight="contested" topicId={data.topic_id} />
              ))}
            </Section>

            <Section
              title="Dead Certainties"
              icon={<CheckCircle2 className="h-4 w-4 text-emerald" />}
              description="High-upvote arguments that nobody challenged — accepted as self-evident truths"
              accent="bg-emerald/20"
              isEmpty={data.dead_certainties.length === 0}
            >
              {data.dead_certainties.map((arg, i) => (
                <ArgCard key={arg.id} arg={arg} rank={i} highlight="certainty" topicId={data.topic_id} />
              ))}
            </Section>

            <Section
              title="First Movers"
              icon={<Trophy className="h-4 w-4 text-purple" />}
              description="The founding arguments posted first — they shaped the entire debate that followed"
              accent="bg-purple/20"
              isEmpty={data.first_movers.length === 0}
            >
              {data.first_movers.map((arg, i) => (
                <ArgCard key={arg.id} arg={arg} rank={i} highlight="pioneer" topicId={data.topic_id} />
              ))}
            </Section>
          </motion.div>
        )}

        {/* Footer links */}
        <div className="flex flex-wrap gap-2 pb-2">
          {[
            { href: `/law/${lawId}/primer`, label: 'Primer' },
            { href: `/law/${lawId}/arguments`, label: 'Arguments' },
            { href: `/law/${lawId}/audit`, label: 'Audit' },
            { href: `/law/${lawId}/swing`, label: 'Swing' },
            { href: `/law/${lawId}/echo-chamber`, label: 'Echo Chamber' },
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
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Refresh
          </button>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
