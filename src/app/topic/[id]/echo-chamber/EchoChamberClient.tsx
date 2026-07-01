'use client'

/**
 * /topic/[id]/echo-chamber — Echo Chamber Analyzer
 *
 * Measures ideological segregation within a debate: are FOR voters only
 * engaging with FOR arguments and AGAINST voters with AGAINST? Or is there
 * genuine cross-partisan discourse?
 *
 * Metrics:
 *   • Echo Index 0-100  — 100 = fully siloed, 0 = fully cross-aisle
 *   • Bridge Builders   — voters who upvoted opposite-side arguments
 *   • Bridge Arguments  — arguments with highest cross-partisan upvotes
 *   • Siloed Arguments  — popular arguments that only one side engages with
 *
 * Distinct from:
 *   /sentiment    — civility & toxicity analysis
 *   /consensus    — common-ground finder
 *   /frames       — ideological framing of arguments
 *   /breakdown    — demographic voter breakdown
 *   /persuasion   — arguments that changed minds
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  Brain,
  RefreshCw,
  Shield,
  Sparkles,
  ThumbsUp,
  Users,
  Waypoints,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { EchoChamberResponse, BridgeBuilder, EchoArgument } from '@/app/api/topics/[id]/echo-chamber/route'

// ─── Echo meter ───────────────────────────────────────────────────────────────

function EchoMeter({ index, label }: { index: number; label: string }) {
  const pct = index
  const color =
    pct >= 80 ? 'bg-against-500'
    : pct >= 60 ? 'bg-orange-500'
    : pct >= 40 ? 'bg-gold'
    : 'bg-emerald'

  const textColor =
    pct >= 80 ? 'text-against-400'
    : pct >= 60 ? 'text-orange-400'
    : pct >= 40 ? 'text-gold'
    : 'text-emerald'

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-surface-400 uppercase tracking-widest mb-1">Echo Index</p>
          <p className={cn('text-5xl font-black tabular-nums', textColor)}>{index}</p>
          <p className="text-sm text-surface-300 mt-0.5">out of 100</p>
        </div>
        <div className="text-right">
          <Badge
            className={cn(
              'text-sm font-mono px-3 py-1',
              pct >= 80 ? 'bg-against-500/20 text-against-300 border-against-500/40' :
              pct >= 60 ? 'bg-orange-500/20 text-orange-300 border-orange-500/40' :
              pct >= 40 ? 'bg-gold/20 text-gold border-gold/30' :
              'bg-emerald/20 text-emerald border-emerald/30'
            )}
          >
            {label}
          </Badge>
          <p className="text-xs text-surface-400 mt-2 max-w-[180px] text-right leading-snug">
            {pct >= 80 ? 'Voters mostly engage only with arguments from their own side.' :
             pct >= 60 ? 'Most engagement stays within partisan lines.' :
             pct >= 40 ? 'Some cross-partisan engagement present.' :
             'Voters regularly engage with opposing viewpoints.'}
          </p>
        </div>
      </div>

      {/* Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-mono text-surface-500">
          <span>Cross-aisle (0)</span>
          <span>Echo chamber (100)</span>
        </div>
        <div className="h-3 rounded-full bg-surface-300 overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', color)}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatStrip({ data }: { data: EchoChamberResponse }) {
  const crossRate = data.voters_with_upvotes > 0
    ? Math.round((data.cross_partisan_upvoters / data.voters_with_upvotes) * 100)
    : 0

  const items = [
    { label: 'Total Voters',         value: data.total_voters.toLocaleString(),              color: 'text-surface-200' },
    { label: 'FOR Voters',           value: data.for_voters.toLocaleString(),                color: 'text-for-400'     },
    { label: 'AGAINST Voters',       value: data.against_voters.toLocaleString(),            color: 'text-against-400' },
    { label: 'Voters Who Argued',    value: data.voters_with_upvotes.toLocaleString(),       color: 'text-purple'      },
    { label: 'Bridge Builders',      value: data.cross_partisan_upvoters.toLocaleString(),   color: 'text-emerald'     },
    { label: 'Cross-Aisle Rate',     value: `${crossRate}%`,                                 color: 'text-gold'        },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map(({ label, value, color }) => (
        <div key={label} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
          <p className="text-[10px] font-mono text-surface-400 uppercase tracking-widest mb-1">{label}</p>
          <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Bridge builder card ──────────────────────────────────────────────────────

function BridgeBuilderCard({ builder }: { builder: BridgeBuilder }) {
  const pct = Math.round(builder.cross_ratio * 100)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex items-start gap-3"
    >
      <Link href={`/${builder.username}`}>
        <Avatar
          src={builder.avatar_url}
          username={builder.username ?? '?'}
          size="md"
        />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Link
            href={`/${builder.username}`}
            className="font-semibold text-sm text-surface-100 hover:text-white truncate"
          >
            {builder.display_name ?? builder.username ?? 'Anonymous'}
          </Link>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Badge
              className={cn(
                'text-[10px] px-1.5 py-0.5',
                builder.voted_side === 'for'
                  ? 'bg-for-500/20 text-for-300 border-for-500/40'
                  : 'bg-against-500/20 text-against-300 border-against-500/40'
              )}
            >
              Voted {builder.voted_side.toUpperCase()}
            </Badge>
            <Badge className="text-[10px] px-1.5 py-0.5 bg-emerald/10 text-emerald border-emerald/30">
              {pct}% cross
            </Badge>
          </div>
        </div>
        <p className="text-xs text-surface-400 mt-0.5">
          {builder.cross_upvotes} cross-partisan upvote{builder.cross_upvotes !== 1 ? 's' : ''} of {builder.total_upvotes_given} total
        </p>
        {builder.top_cross_argument && (
          <p className="text-xs text-surface-300 mt-2 italic leading-snug line-clamp-2">
            &ldquo;{builder.top_cross_argument}&hellip;&rdquo;
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Echo argument card ───────────────────────────────────────────────────────

function EchoArgCard({ arg, kind }: { arg: EchoArgument; kind: 'bridge' | 'siloed' }) {
  const crossPct = arg.total_upvotes > 0
    ? Math.round((arg.cross_upvotes / arg.total_upvotes) * 100)
    : 0
  const sideBg = arg.side === 'for'
    ? 'border-l-for-500'
    : 'border-l-against-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl bg-surface-100 border border-surface-300 border-l-4 p-4 space-y-2',
        sideBg
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Badge
            className={cn(
              'text-[10px] px-1.5 py-0.5',
              arg.side === 'for'
                ? 'bg-for-500/20 text-for-300 border-for-500/40'
                : 'bg-against-500/20 text-against-300 border-against-500/40'
            )}
          >
            {arg.side.toUpperCase()}
          </Badge>
          {arg.author_username && (
            <Link
              href={`/${arg.author_username}`}
              className="text-[10px] text-surface-400 hover:text-surface-200 truncate max-w-[80px]"
            >
              @{arg.author_username}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-surface-400">
            <ThumbsUp className="h-3 w-3" />
            {arg.upvotes.toLocaleString()}
          </span>
          {kind === 'bridge' ? (
            <Badge className="text-[10px] px-1.5 py-0.5 bg-emerald/10 text-emerald border-emerald/30">
              {crossPct}% from opposite side
            </Badge>
          ) : (
            <Badge className="text-[10px] px-1.5 py-0.5 bg-surface-400/20 text-surface-400 border-surface-400/30">
              {crossPct}% cross-aisle
            </Badge>
          )}
        </div>
      </div>
      <p className="text-sm text-surface-200 leading-snug line-clamp-3">{arg.content}</p>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <Skeleton className="h-36 rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-6 w-40 rounded" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EchoChamberClient({ topicId }: { topicId: string }) {
  const [data, setData] = useState<EchoChamberResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/echo-chamber`)
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load echo chamber data.')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  const topic = data?.topic

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back */}
        <Link
          href={`/topic/${topicId}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-200 transition-colors mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to topic
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Waypoints className="h-5 w-5 text-purple" />
            <h1 className="text-xl font-bold text-white">Echo Chamber Analyzer</h1>
          </div>
          {topic && (
            <Link
              href={`/topic/${topicId}`}
              className="text-sm text-surface-300 hover:text-surface-100 transition-colors line-clamp-2 leading-snug"
            >
              {topic.statement}
              <ArrowUpRight className="inline h-3 w-3 ml-0.5 opacity-60" />
            </Link>
          )}
          <p className="text-xs text-surface-500 mt-2 leading-relaxed">
            Measures ideological segregation in this debate. Are voters engaging only with
            arguments from their own side — or crossing party lines?
          </p>
        </div>

        {/* Refresh */}
        {!loading && (
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors mb-5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={<Brain className="h-8 w-8" />}
                title="Could not load analysis"
                description={error}
                action={{ label: 'Try again', onClick: load }}
              />
            </motion.div>
          ) : data ? (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">

              {/* Echo meter */}
              <EchoMeter index={data.echo_index} label={data.echo_label} />

              {/* Stats */}
              <StatStrip data={data} />

              {/* Methodology note */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex items-start gap-3">
                <Brain className="h-4 w-4 text-purple mt-0.5 flex-shrink-0" />
                <p className="text-xs text-surface-400 leading-relaxed">
                  The echo index measures the proportion of argument upvotes that came from
                  same-side voters. A score of 100 means all upvotes stayed within partisan
                  lines; 0 means all upvotes crossed sides. Bridge builders are voters who
                  upvoted at least one argument from the opposing side.
                </p>
              </div>

              {/* Bridge builders */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-4 w-4 text-emerald" />
                  <h2 className="text-base font-semibold text-white">Bridge Builders</h2>
                  <Badge className="text-[10px] px-1.5 py-0.5 bg-emerald/10 text-emerald border-emerald/30">
                    {data.bridge_builders.length}
                  </Badge>
                </div>
                {data.bridge_builders.length === 0 ? (
                  <EmptyState
                    icon={<Users className="h-6 w-6" />}
                    title="No bridge builders yet"
                    description="No voters have upvoted arguments from the opposing side. This debate is fully siloed."
                    size="sm"
                  />
                ) : (
                  <div className="space-y-3">
                    {data.bridge_builders.map(b => (
                      <BridgeBuilderCard key={b.id} builder={b} />
                    ))}
                  </div>
                )}
              </section>

              {/* Bridge arguments */}
              {data.bridge_arguments.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-4 w-4 text-gold" />
                    <h2 className="text-base font-semibold text-white">Bridge Arguments</h2>
                    <span className="text-xs text-surface-500">highest cross-partisan engagement</span>
                  </div>
                  <div className="space-y-3">
                    {data.bridge_arguments.map(a => (
                      <EchoArgCard key={a.id} arg={a} kind="bridge" />
                    ))}
                  </div>
                </section>
              )}

              {/* Siloed arguments */}
              {data.siloed_arguments.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-4 w-4 text-against-400" />
                    <h2 className="text-base font-semibold text-white">Siloed Arguments</h2>
                    <span className="text-xs text-surface-500">popular but almost no cross-aisle engagement</span>
                  </div>
                  <div className="space-y-3">
                    {data.siloed_arguments.map(a => (
                      <EchoArgCard key={a.id} arg={a} kind="siloed" />
                    ))}
                  </div>
                </section>
              )}

              {/* Recommendations */}
              <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-semibold text-white">How to Reduce the Echo Effect</h2>
                </div>
                <ul className="space-y-2">
                  {[
                    'Upvote strong arguments from the side you disagree with — even if you don\'t change your vote.',
                    'Reply to opposing arguments with substance, not dismissal. Engagement that crosses sides lowers the echo index.',
                    'Read the Bridge Arguments above — they\'re the ones already earning cross-partisan respect.',
                  ].map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-surface-300 leading-relaxed">
                      <BarChart2 className="h-3.5 w-3.5 text-gold mt-0.5 flex-shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Related links */}
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href={`/topic/${topicId}/consensus`}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald hover:text-emerald/80 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Common Ground Finder
                </Link>
                <Link
                  href={`/topic/${topicId}/persuasion`}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-purple hover:text-purple/80 transition-colors"
                >
                  <Brain className="h-3.5 w-3.5" />
                  Persuasion Lab
                </Link>
                <Link
                  href={`/topic/${topicId}/sentiment`}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-gold hover:text-gold/80 transition-colors"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  Sentiment Analysis
                </Link>
              </div>

            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
