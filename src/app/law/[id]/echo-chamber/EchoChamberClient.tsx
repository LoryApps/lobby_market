'use client'

/**
 * /law/[id]/echo-chamber — Debate Polarisation Audit
 *
 * Analyses the civic debate that produced this established law:
 *   • Echo Index — how siloed was the discourse?
 *   • Consensus Type — was it a landslide or a narrow victory?
 *   • Bridge Builders — voters who upvoted arguments from the opposing side
 *   • Bridge Arguments — arguments that earned cross-partisan respect
 *   • Siloed Arguments — popular points that only one side engaged with
 *
 * Distinct from /law/[id]/blocs (role/clout breakdown of voters) and
 * /law/[id]/dissent (who voted against and why).
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  Brain,
  Gavel,
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
import type {
  LawEchoChamberResponse,
  BridgeBuilder,
  EchoArgument,
} from '@/app/api/laws/[id]/echo-chamber/route'

// ─── Echo meter ───────────────────────────────────────────────────────────────

function EchoMeter({
  index,
  label,
  consensusType,
  forPct,
}: {
  index: number
  label: string
  consensusType: string
  forPct: number
}) {
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

  const consensusColor =
    consensusType === 'Landslide'     ? 'bg-for-500/20 text-for-300 border-for-500/40' :
    consensusType === 'Clear Majority'? 'bg-for-500/10 text-for-400 border-for-500/30' :
    consensusType === 'Narrow Victory'? 'bg-gold/10 text-gold border-gold/30' :
                                        'bg-against-500/10 text-against-400 border-against-500/30'

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-mono text-surface-400 uppercase tracking-widest mb-1">
            Echo Index
          </p>
          <p className={cn('text-5xl font-black tabular-nums', textColor)}>{index}</p>
          <p className="text-sm text-surface-300 mt-0.5">out of 100</p>
        </div>
        <div className="flex flex-col items-end gap-2">
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
          <Badge className={cn('text-xs font-mono px-2.5 py-1', consensusColor)}>
            {consensusType} · {Math.round(forPct)}% For
          </Badge>
        </div>
      </div>

      {/* Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-mono text-surface-500">
          <span>Cross-aisle discourse (0)</span>
          <span>Pure echo chamber (100)</span>
        </div>
        <div className="h-3 rounded-full bg-surface-300 overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', color)}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        <p className="text-xs text-surface-400 leading-snug pt-1">
          {pct >= 80
            ? 'The debate that produced this law was deeply siloed. Voters mostly engaged only with their own side.'
            : pct >= 60
            ? 'Most engagement stayed within partisan lines during the debate that produced this law.'
            : pct >= 40
            ? 'Some cross-partisan engagement occurred before this law was established.'
            : 'Voters regularly crossed partisan lines in the debate that led to this law — a sign of genuine civic discourse.'}
        </p>
      </div>
    </div>
  )
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatStrip({ data }: { data: LawEchoChamberResponse }) {
  const crossRate =
    data.voters_with_upvotes > 0
      ? Math.round((data.cross_partisan_upvoters / data.voters_with_upvotes) * 100)
      : 0

  const items = [
    { label: 'Original Voters',   value: data.total_voters.toLocaleString(),            color: 'text-surface-200' },
    { label: 'Voted FOR',         value: data.for_voters.toLocaleString(),              color: 'text-for-400'     },
    { label: 'Voted AGAINST',     value: data.against_voters.toLocaleString(),          color: 'text-against-400' },
    { label: 'Engaged in Args',   value: data.voters_with_upvotes.toLocaleString(),     color: 'text-purple'      },
    { label: 'Bridge Builders',   value: data.cross_partisan_upvoters.toLocaleString(), color: 'text-emerald'     },
    { label: 'Cross-Aisle Rate',  value: `${crossRate}%`,                               color: 'text-gold'        },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map(({ label, value, color }) => (
        <div key={label} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
          <p className="text-[10px] font-mono text-surface-400 uppercase tracking-widest mb-1">
            {label}
          </p>
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
          {builder.cross_upvotes} cross-partisan upvote
          {builder.cross_upvotes !== 1 ? 's' : ''} of {builder.total_upvotes_given} total
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

function EchoArgCard({
  arg,
  kind,
}: {
  arg: EchoArgument
  kind: 'bridge' | 'siloed'
}) {
  const crossPct =
    arg.total_upvotes > 0
      ? Math.round((arg.cross_upvotes / arg.total_upvotes) * 100)
      : 0
  const sideBorder =
    arg.side === 'for' ? 'border-l-for-500' : 'border-l-against-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl bg-surface-100 border border-surface-300 border-l-4 p-4 space-y-2',
        sideBorder
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
      <p className="text-sm text-surface-200 leading-snug line-clamp-3">
        {arg.content}
      </p>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-5 w-40 rounded" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EchoChamberClient({ lawId }: { lawId: string }) {
  const [data, setData] = useState<LawEchoChamberResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/echo-chamber`)
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load echo chamber data.')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => {
    load()
  }, [load])

  const law = data?.law

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back */}
        <Link
          href={`/law/${lawId}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-200 transition-colors mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to law
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Waypoints className="h-5 w-5 text-purple" />
            <h1 className="text-xl font-bold text-white">Debate Polarisation Audit</h1>
          </div>
          {law && (
            <Link
              href={`/law/${lawId}`}
              className="text-sm text-surface-300 hover:text-surface-100 transition-colors line-clamp-2 leading-snug"
            >
              {law.statement}
              <ArrowUpRight className="inline h-3 w-3 ml-0.5 opacity-60" />
            </Link>
          )}
          <p className="text-xs text-surface-500 mt-2 leading-relaxed">
            How polarised was the debate that produced this law? Measures whether voters
            engaged across partisan lines — or stayed in their own echo chamber.
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
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
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
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Echo meter */}
              <EchoMeter
                index={data.echo_index}
                label={data.echo_label}
                consensusType={data.consensus_type}
                forPct={data.law.blue_pct}
              />

              {/* Stats */}
              <StatStrip data={data} />

              {/* Methodology note */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex items-start gap-3">
                <Brain className="h-4 w-4 text-purple mt-0.5 flex-shrink-0" />
                <p className="text-xs text-surface-400 leading-relaxed">
                  The echo index measures the proportion of argument upvotes that came from
                  same-side voters during the original debate. A score of 100 means all
                  engagement stayed within partisan lines; 0 means all upvotes crossed sides.
                  Bridge builders are voters who upvoted at least one argument from the
                  opposing side before the final vote was cast.
                </p>
              </div>

              {/* Insight banner */}
              <div
                className={cn(
                  'rounded-xl border p-4 flex items-start gap-3',
                  data.echo_index >= 60
                    ? 'bg-against-500/5 border-against-500/20'
                    : 'bg-emerald/5 border-emerald/20'
                )}
              >
                <Gavel
                  className={cn(
                    'h-4 w-4 mt-0.5 flex-shrink-0',
                    data.echo_index >= 60 ? 'text-against-400' : 'text-emerald'
                  )}
                />
                <div>
                  <p
                    className={cn(
                      'text-sm font-semibold mb-1',
                      data.echo_index >= 60 ? 'text-against-300' : 'text-emerald'
                    )}
                  >
                    {data.echo_index >= 80
                      ? 'Echo chamber law — legitimacy concerns'
                      : data.echo_index >= 60
                      ? 'Partisan law — limited cross-aisle buy-in'
                      : data.echo_index >= 40
                      ? 'Mixed consensus — some cross-partisan support'
                      : 'Strong consensus — broad cross-aisle legitimacy'}
                  </p>
                  <p className="text-xs text-surface-400 leading-relaxed">
                    {data.echo_index >= 80
                      ? `This ${data.consensus_type.toLowerCase()} was reached with very little cross-partisan discourse. The law reflects one side's dominant voice rather than genuine collective agreement.`
                      : data.echo_index >= 60
                      ? `The debate was mostly siloed, but the law still passed with a ${data.consensus_type.toLowerCase()}. A more deliberative process might have produced a stronger mandate.`
                      : data.echo_index >= 40
                      ? `Some cross-partisan engagement occurred during the debate. The law has moderate civic legitimacy from both sides.`
                      : `The debate showed genuine cross-partisan engagement before the law was established — voters engaged with opposing arguments, giving this law stronger democratic legitimacy.`}
                  </p>
                </div>
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
                    title="No bridge builders found"
                    description="No voters upvoted arguments from the opposing side during this debate."
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
                    <h2 className="text-base font-semibold text-white">
                      Bridge Arguments
                    </h2>
                    <span className="text-xs text-surface-500">
                      highest cross-partisan engagement
                    </span>
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
                    <h2 className="text-base font-semibold text-white">
                      Siloed Arguments
                    </h2>
                    <span className="text-xs text-surface-500">
                      popular, but almost no cross-aisle engagement
                    </span>
                  </div>
                  <div className="space-y-3">
                    {data.siloed_arguments.map(a => (
                      <EchoArgCard key={a.id} arg={a} kind="siloed" />
                    ))}
                  </div>
                </section>
              )}

              {/* Tips */}
              <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-semibold text-white">
                    What Does This Mean for Democracy?
                  </h2>
                </div>
                <ul className="space-y-2">
                  {[
                    'A low echo index means the law was forged through genuine deliberation — opposing voices engaged seriously with each other.',
                    'A high echo index suggests the majority simply out-voted the minority without much cross-aisle persuasion.',
                    'Bridge builders are the most civic-minded participants: they sought to understand and acknowledge the other side\'s best arguments.',
                    'Laws with high echo indexes may face stronger dissent and amendment pressure over time.',
                  ].map((tip, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs text-surface-300 leading-relaxed"
                    >
                      <BarChart2 className="h-3.5 w-3.5 text-gold mt-0.5 flex-shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </section>

              {/* Related links */}
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href={`/law/${lawId}/blocs`}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                >
                  <Users className="h-3.5 w-3.5" />
                  Voting Blocs
                </Link>
                <Link
                  href={`/law/${lawId}/dissent`}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-against-400 hover:text-against-300 transition-colors"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Dissent Analysis
                </Link>
                <Link
                  href={`/law/${lawId}/verdict`}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-gold hover:text-gold/80 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Community Verdict
                </Link>
                {law?.topic_id && (
                  <Link
                    href={`/topic/${law.topic_id}/echo-chamber`}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-purple hover:text-purple/80 transition-colors"
                  >
                    <Waypoints className="h-3.5 w-3.5" />
                    Original Topic Analysis
                  </Link>
                )}
              </div>

            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
