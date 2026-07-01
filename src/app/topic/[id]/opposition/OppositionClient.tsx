'use client'

/**
 * /topic/[id]/opposition — Opposition Playbook
 *
 * Surfaces the strongest case from the minority side: their best arguments,
 * top voices, rhetorical patterns, and what it would take to change their minds.
 *
 * Distinct from:
 *   /crossfire    — most contested arguments (heat, not minority-focus)
 *   /persuasion   — arguments that cross the aisle (effectiveness)
 *   /versus       — raw side-by-side comparison
 *   /steelman     — AI's best-case charitable construction
 *   /breakdown    — demographic voter breakdown
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Brain,
  ChevronDown,
  ChevronUp,
  Flame,
  Gavel,
  Heart,
  Lightbulb,
  Megaphone,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  ThumbsUp,
  TrendingDown,
  Trophy,
  Users,
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
  OppositionResponse,
  OppositionArgument,
  ObjectionCategory,
} from '@/app/api/topics/[id]/opposition/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function reltime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const RHETORICAL_META: Record<
  string,
  { label: string; color: string; bg: string; border: string; Icon: typeof Flame }
> = {
  evidence:  { label: 'Empirical',   color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     Icon: BarChart2 },
  moral:     { label: 'Moral',       color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30',      Icon: Heart },
  economic:  { label: 'Economic',    color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        Icon: Scale },
  practical: { label: 'Practical',   color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', Icon: Zap },
  precedent: { label: 'Historical',  color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        Icon: Gavel },
}

const SIDE_LABEL: Record<string, string> = {
  for:     'FOR',
  against: 'AGAINST',
}

const SIDE_COLOR: Record<string, string> = {
  for:     'text-for-400',
  against: 'text-against-400',
}

const SIDE_BG: Record<string, string> = {
  for:     'bg-for-500/20 border-for-500/40',
  against: 'bg-against-500/20 border-against-500/40',
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-10 rounded-lg w-1/3" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Rhetorical-type pill ─────────────────────────────────────────────────────

function RhetoricalPill({ type }: { type: string }) {
  const meta = RHETORICAL_META[type] ?? RHETORICAL_META.practical
  const { Icon } = meta
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border',
        meta.bg, meta.border, meta.color
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgCard({
  arg,
  rank,
}: {
  arg: OppositionArgument
  rank: number
}) {
  const [expanded, setExpanded] = useState(false)
  const isLong = arg.body.length > arg.bite.length + 5

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      className="bg-surface-100 border border-surface-300 rounded-xl p-4 group hover:border-surface-400 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* rank */}
        <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-surface-200 text-[10px] font-mono text-surface-500 font-bold mt-0.5">
          {rank}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {/* body */}
          <p className="text-sm text-white/90 leading-relaxed">
            {expanded ? arg.body : arg.bite}
          </p>

          {isLong && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="inline-flex items-center gap-0.5 text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
            >
              {expanded ? (
                <><ChevronUp className="h-3 w-3" /> Show less</>
              ) : (
                <><ChevronDown className="h-3 w-3" /> Show more</>
              )}
            </button>
          )}

          {/* meta row */}
          <div className="flex items-center gap-2 flex-wrap">
            <RhetoricalPill type={arg.rhetorical_type} />

            <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
              <ThumbsUp className="h-2.5 w-2.5" />
              {arg.upvotes.toLocaleString()}
            </span>

            {arg.reply_count > 0 && (
              <span className="text-[10px] font-mono text-surface-500">
                {arg.reply_count} {arg.reply_count === 1 ? 'reply' : 'replies'}
              </span>
            )}

            {arg.author && (
              <Link
                href={`/profile/${arg.author.username ?? arg.author.id}`}
                className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
              >
                <Avatar
                  src={arg.author.avatar_url}
                  fallback={arg.author.display_name ?? arg.author.username ?? '?'}
                  size="xs"
                />
                {arg.author.display_name ?? arg.author.username ?? 'Anonymous'}
              </Link>
            )}

            <span className="text-[10px] font-mono text-surface-500 ml-auto">
              {reltime(arg.created_at)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Category bar ─────────────────────────────────────────────────────────────

function CategoryBar({ cats }: { cats: ObjectionCategory[] }) {
  const COLOR_MAP: Record<string, string> = {
    against: 'bg-against-500',
    gold:    'bg-gold',
    emerald: 'bg-emerald',
    purple:  'bg-purple',
  }
  const TEXT_MAP: Record<string, string> = {
    against: 'text-against-400',
    gold:    'text-gold',
    emerald: 'text-emerald',
    purple:  'text-purple',
  }

  return (
    <div className="space-y-3">
      {cats.map((c) => (
        <div key={c.label} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className={cn('text-xs font-mono font-semibold', TEXT_MAP[c.color] ?? 'text-white')}>
              {c.label}
            </span>
            <span className="text-[10px] font-mono text-surface-500">
              {c.share}% · {c.count} arg{c.count !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${c.share}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className={cn('h-full rounded-full', COLOR_MAP[c.color] ?? 'bg-surface-400')}
            />
          </div>
          <p className="text-[11px] text-surface-500 leading-relaxed">{c.description}</p>
          {c.example_argument && (
            <p className="text-[11px] text-surface-400 italic pl-2 border-l border-surface-400 line-clamp-2">
              &ldquo;{c.example_argument}&rdquo;
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

interface OppositionClientProps {
  topicId: string
}

export function OppositionClient({ topicId }: OppositionClientProps) {
  const [data, setData] = useState<OppositionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'arguments' | 'voices' | 'patterns' | 'conditions'>('arguments')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/opposition`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as OppositionResponse
      setData(json)
    } catch {
      setError('Could not load opposition data.')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  const minoritySide = data?.minority_side ?? 'against'
  const minorityLabel = SIDE_LABEL[minoritySide] ?? 'AGAINST'
  const minorityColor = SIDE_COLOR[minoritySide] ?? 'text-against-400'
  const minoritySideBg = SIDE_BG[minoritySide] ?? 'bg-against-500/20 border-against-500/40'

  const TABS = [
    { id: 'arguments' as const, label: 'Best Arguments', Icon: Megaphone },
    { id: 'voices' as const,    label: 'Top Voices',     Icon: Users },
    { id: 'patterns' as const,  label: 'Rhetoric',       Icon: Brain },
    { id: 'conditions' as const, label: 'What Flips Them', Icon: Lightbulb },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 pb-24 pt-2 max-w-2xl mx-auto w-full px-4">
        {/* Back link */}
        <Link
          href={`/topic/${topicId}`}
          className="inline-flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to topic
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-against-400" />
            <h1 className="text-sm font-mono font-bold text-white uppercase tracking-widest">
              Opposition Playbook
            </h1>
          </div>

          {loading ? (
            <Skeleton className="h-16 rounded-xl" />
          ) : data ? (
            <div className="bg-surface-100 border border-surface-300 rounded-xl p-4 space-y-3">
              <p className="text-base font-semibold text-white leading-snug line-clamp-3">
                {data.topic.statement}
              </p>

              {/* vote bar */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-for-400 w-10 text-right">
                  {data.majority_side === 'for' ? data.majority_pct : data.minority_pct}%
                </span>
                <div className="flex-1 h-2 bg-against-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-for-500 rounded-full transition-all duration-700"
                    style={{ width: `${data.topic.blue_pct}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-against-400 w-10">
                  {data.majority_side === 'against' ? data.majority_pct : data.minority_pct}%
                </span>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
                  minoritySideBg, minorityColor
                )}>
                  {minorityLabel} · {data.minority_pct}%
                </span>
                <span className="text-[10px] font-mono text-surface-500">
                  {data.total_minority_arguments.toLocaleString()} {SIDE_LABEL[minoritySide]} arguments ·{' '}
                  {data.topic.total_votes.toLocaleString()} total votes
                </span>
              </div>

              <p className="text-[11px] text-surface-400 leading-relaxed">
                The <span className={cn('font-semibold', minorityColor)}>{minorityLabel}</span> side
                holds {data.minority_pct}% of the vote. This playbook surfaces their strongest
                arguments, top voices, and rhetorical patterns — so you understand what you&apos;re
                up against.
              </p>
            </div>
          ) : null}
        </div>

        {/* Tabs */}
        {!loading && data && (
          <div className="flex gap-1 mb-5 overflow-x-auto no-scrollbar">
            {TABS.map((tab) => {
              const { Icon } = tab
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors border',
                    activeTab === tab.id
                      ? 'bg-against-500/20 border-against-500/40 text-against-300'
                      : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Loading */}
        {loading && <LoadingSkeleton />}

        {/* Error */}
        {error && (
          <EmptyState
            icon={Shield}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Could not load opposition data"
            description={error}
            actions={[{ label: 'Try again', onClick: load, variant: 'primary' }]}
          />
        )}

        {/* Refresh */}
        {data && !loading && (
          <div className="flex justify-end mb-2">
            <button
              onClick={load}
              className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
            >
              <RefreshCw className="h-2.5 w-2.5" />
              Refresh
            </button>
          </div>
        )}

        {/* ── Tab: Best Arguments ───────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {data && !loading && activeTab === 'arguments' && (
            <motion.div
              key="arguments"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {data.top_arguments.length === 0 ? (
                <EmptyState
                  icon={Megaphone}
                  title={`No ${minorityLabel} arguments yet`}
                  description="Be the first to make the case."
                  actions={[{
                    label: 'Add an argument',
                    href: `/topic/${topicId}#arguments`,
                    variant: 'primary',
                  }]}
                />
              ) : (
                <>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mb-3">
                    Top {data.top_arguments.length} {minorityLabel} arguments by upvotes
                  </p>
                  {data.top_arguments.map((arg, i) => (
                    <ArgCard key={arg.id} arg={arg} rank={i + 1} />
                  ))}
                  {data.total_minority_arguments > data.top_arguments.length && (
                    <Link
                      href={`/topic/${topicId}/arguments?side=${minoritySide}`}
                      className="flex items-center justify-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors py-3 border border-surface-300 rounded-xl hover:border-surface-400"
                    >
                      View all {data.total_minority_arguments} {minorityLabel} arguments
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ── Tab: Top Voices ─────────────────────────────────────────────── */}
          {data && !loading && activeTab === 'voices' && (
            <motion.div
              key="voices"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {data.top_voices.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No contributors yet"
                  description={`No one has posted ${minorityLabel} arguments so far.`}
                />
              ) : (
                data.top_voices.map((voice, i) => (
                  <motion.div
                    key={voice.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-surface-100 border border-surface-300 rounded-xl p-4 hover:border-surface-400 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Link href={`/profile/${voice.username ?? voice.id}`}>
                        <Avatar
                          src={voice.avatar_url}
                          fallback={voice.display_name ?? voice.username ?? '?'}
                          size="md"
                        />
                      </Link>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/profile/${voice.username ?? voice.id}`}
                            className="text-sm font-semibold text-white hover:text-for-400 transition-colors"
                          >
                            {voice.display_name ?? voice.username ?? 'Anonymous'}
                          </Link>
                          {voice.username && (
                            <span className="text-[10px] font-mono text-surface-500">
                              @{voice.username}
                            </span>
                          )}
                          {i === 0 && (
                            <Badge variant="active" size="sm">
                              <Trophy className="h-2.5 w-2.5 mr-0.5" />
                              Top voice
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-wrap text-[10px] font-mono text-surface-500">
                          <span className="flex items-center gap-1">
                            <Megaphone className="h-2.5 w-2.5" />
                            {voice.argument_count} arg{voice.argument_count !== 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="h-2.5 w-2.5" />
                            {voice.total_upvotes.toLocaleString()} upvotes
                          </span>
                          <span className="flex items-center gap-1">
                            <Sparkles className="h-2.5 w-2.5" />
                            {voice.clout.toLocaleString()} clout
                          </span>
                        </div>

                        {voice.top_argument && (
                          <p className="text-[11px] text-surface-400 italic border-l border-surface-400 pl-2 line-clamp-2">
                            &ldquo;{voice.top_argument}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}

              {data.top_voices.length > 0 && (
                <Link
                  href={`/topic/${topicId}/contributors`}
                  className="flex items-center justify-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors py-3 border border-surface-300 rounded-xl hover:border-surface-400"
                >
                  View all contributors
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </motion.div>
          )}

          {/* ── Tab: Rhetoric Patterns ──────────────────────────────────────── */}
          {data && !loading && activeTab === 'patterns' && (
            <motion.div
              key="patterns"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {data.objection_categories.length === 0 ? (
                <EmptyState
                  icon={Brain}
                  title="No patterns yet"
                  description="Add arguments to reveal rhetorical patterns."
                />
              ) : (
                <>
                  <div className="bg-surface-100 border border-surface-300 rounded-xl p-5">
                    <h2 className="text-xs font-mono font-bold text-white uppercase tracking-widest mb-4">
                      How the {minorityLabel} side argues
                    </h2>
                    <CategoryBar cats={data.objection_categories} />
                  </div>

                  <div className="bg-surface-100 border border-surface-300 rounded-xl p-5 space-y-4">
                    <h2 className="text-xs font-mono font-bold text-white uppercase tracking-widest">
                      What this means
                    </h2>
                    <p className="text-xs text-surface-400 leading-relaxed">
                      The {minorityLabel} side primarily uses{' '}
                      <span className="text-white font-medium">
                        {data.objection_categories[0]?.label.toLowerCase() ?? 'practical'}
                      </span>{' '}
                      arguments ({data.objection_categories[0]?.share ?? 0}% of their case).
                      {data.objection_categories[0]?.label === 'Empirical' && (
                        ' Counter with your own data and challenge their sources.'
                      )}
                      {data.objection_categories[0]?.label === 'Moral' && (
                        ' Engage on values — don\'t just cite statistics, speak to rights and justice.'
                      )}
                      {data.objection_categories[0]?.label === 'Economic' && (
                        ' Address the cost argument directly. Show the economic case for your position.'
                      )}
                      {data.objection_categories[0]?.label === 'Practical' && (
                        ' Show how implementation is feasible. Concrete examples and case studies help.'
                      )}
                      {data.objection_categories[0]?.label === 'Historical' && (
                        ' Counter their precedents with better ones, or explain why the comparison fails.'
                      )}
                    </p>
                    <Link
                      href={`/topic/${topicId}/persuasion`}
                      className="inline-flex items-center gap-1.5 text-[11px] font-mono text-gold hover:text-gold/80 transition-colors"
                    >
                      <Sparkles className="h-3 w-3" />
                      See which arguments cross the aisle →
                    </Link>
                  </div>

                  <div className="bg-surface-100 border border-surface-300 rounded-xl p-5 space-y-3">
                    <h2 className="text-xs font-mono font-bold text-white uppercase tracking-widest">
                      Strategic read
                    </h2>
                    {data.objection_categories.map((c) => (
                      <div key={c.label} className="flex items-start gap-2">
                        <span className={cn(
                          'flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5',
                          c.color === 'emerald' ? 'bg-emerald' :
                          c.color === 'purple'  ? 'bg-purple' :
                          c.color === 'gold'    ? 'bg-gold' :
                          'bg-against-400'
                        )} />
                        <div>
                          <span className="text-xs font-mono font-semibold text-white">
                            {c.label} ({c.share}%)
                          </span>
                          <span className="text-[11px] text-surface-400"> — {c.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="flex gap-2 flex-wrap">
                <Link
                  href={`/topic/${topicId}/frames`}
                  className="inline-flex items-center gap-1.5 text-[11px] font-mono text-purple hover:text-purple/80 transition-colors"
                >
                  <Brain className="h-3 w-3" />
                  Ideological frames →
                </Link>
                <Link
                  href={`/topic/${topicId}/steelman`}
                  className="inline-flex items-center gap-1.5 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                >
                  <Shield className="h-3 w-3" />
                  Steelman each side →
                </Link>
              </div>
            </motion.div>
          )}

          {/* ── Tab: What Flips Them ────────────────────────────────────────── */}
          {data && !loading && activeTab === 'conditions' && (
            <motion.div
              key="conditions"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="bg-surface-100 border border-surface-300 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-gold" />
                  <h2 className="text-xs font-mono font-bold text-white uppercase tracking-widest">
                    What would change {minorityLabel} voters&apos; minds
                  </h2>
                </div>
                <p className="text-[11px] text-surface-400 leading-relaxed">
                  {minorityLabel} voters have declared the conditions under which they&apos;d
                  change their position. These are your persuasion entry points.
                </p>
              </div>

              {data.change_conditions.length === 0 ? (
                <EmptyState
                  icon={Lightbulb}
                  iconColor="text-gold"
                  iconBg="bg-gold/10"
                  iconBorder="border-gold/30"
                  title="No conditions yet"
                  description={`No ${minorityLabel} voters have declared what would change their mind.`}
                  actions={[{
                    label: 'Add your condition',
                    href: `/topic/${topicId}/changemaker`,
                    variant: 'primary',
                  }]}
                />
              ) : (
                <div className="space-y-3">
                  {data.change_conditions.map((cond, i) => (
                    <motion.div
                      key={cond.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="bg-surface-100 border border-gold/20 rounded-xl p-4 hover:border-gold/40 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <Lightbulb className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-1.5">
                          <p className="text-sm text-white/90 leading-relaxed">
                            &ldquo;{cond.condition}&rdquo;
                          </p>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-surface-500">
                            <ThumbsUp className="h-2.5 w-2.5" />
                            {cond.upvotes} found this relatable
                            <span className={cn(
                              'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                              cond.voter_side === 'for'
                                ? 'bg-for-500/20 text-for-400'
                                : 'bg-against-500/20 text-against-400'
                            )}>
                              {SIDE_LABEL[cond.voter_side]}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  <Link
                    href={`/topic/${topicId}/changemaker`}
                    className="flex items-center justify-center gap-1.5 text-xs font-mono text-gold hover:text-gold/80 transition-colors py-3 border border-gold/20 rounded-xl hover:border-gold/40"
                  >
                    <Lightbulb className="h-3 w-3" />
                    View all change conditions
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}

              <div className="bg-surface-100 border border-surface-300 rounded-xl p-4 space-y-3">
                <h3 className="text-[10px] font-mono font-bold text-surface-500 uppercase tracking-widest">
                  Related analysis
                </h3>
                <div className="flex flex-col gap-2">
                  <Link
                    href={`/topic/${topicId}/swing`}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-against-400 hover:text-against-300 transition-colors"
                  >
                    <TrendingDown className="h-3 w-3" />
                    Swing analysis — which voters are flippable?
                  </Link>
                  <Link
                    href={`/topic/${topicId}/persuasion`}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-gold hover:text-gold/80 transition-colors"
                  >
                    <Sparkles className="h-3 w-3" />
                    Persuasion Lab — what arguments actually work?
                  </Link>
                  <Link
                    href={`/topic/${topicId}/consensus`}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald hover:text-emerald/80 transition-colors"
                  >
                    <Scale className="h-3 w-3" />
                    Common ground — where do both sides agree?
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer links */}
        {data && !loading && (
          <div className="mt-8 pt-6 border-t border-surface-300 flex items-center justify-between flex-wrap gap-3">
            <Link
              href={`/topic/${topicId}`}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to topic
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href={`/topic/${topicId}/versus`}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <Scale className="h-3 w-3" />
                Full comparison
              </Link>
              <Link
                href={`/topic/${topicId}/arguments`}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <Megaphone className="h-3 w-3" />
                All arguments
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
