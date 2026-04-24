'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Award,
  Calendar,
  ChevronUp,
  Clock,
  FileText,
  Flame,
  Gavel,
  MessageSquare,
  Scale,
  ThumbsDown,
  ThumbsUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { TopicTimelineData, TimelineMilestone, ArgumentBucket } from '@/app/api/topics/[id]/timeline/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return formatDate(iso)
}

// ─── Milestone config ─────────────────────────────────────────────────────────

const MILESTONE_CONFIG: Record<
  TimelineMilestone['type'],
  {
    icon: typeof FileText
    iconColor: string
    iconBg: string
    dotColor: string
    isFuture?: boolean
  }
> = {
  proposed: {
    icon: FileText,
    iconColor: 'text-surface-500',
    iconBg: 'bg-surface-200 border-surface-400',
    dotColor: 'bg-surface-500',
  },
  activated: {
    icon: Zap,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/15 border-for-500/40',
    dotColor: 'bg-for-500',
  },
  voting: {
    icon: Scale,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/15 border-purple/40',
    dotColor: 'bg-purple',
  },
  law: {
    icon: Gavel,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/15 border-gold/40',
    dotColor: 'bg-gold',
  },
  failed: {
    icon: XCircle,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/15 border-against-500/40',
    dotColor: 'bg-against-500',
  },
  voting_ends: {
    icon: Clock,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/15 border-amber-500/40',
    dotColor: 'bg-amber-500',
    isFuture: true,
  },
}

// ─── Activity chart (SVG) ─────────────────────────────────────────────────────

function ActivityChart({ buckets }: { buckets: ArgumentBucket[] }) {
  if (buckets.length === 0) return null

  const maxTotal = Math.max(...buckets.map((b) => b.total), 1)
  const W = 600
  const H = 80
  const barW = Math.max(4, Math.min(20, (W / buckets.length) - 2))
  const gap = Math.max(1, (W - barW * buckets.length) / Math.max(1, buckets.length - 1))

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-16 rounded overflow-hidden"
        aria-label="Argument activity over time"
        role="img"
      >
        {buckets.map((b, i) => {
          const x = i * (barW + gap)
          const forH = (b.for_count / maxTotal) * (H - 4)
          const againstH = (b.against_count / maxTotal) * (H - 4)
          const totalH = forH + againstH

          return (
            <g key={b.date}>
              {/* Against (red, bottom) */}
              <rect
                x={x}
                y={H - againstH}
                width={barW}
                height={againstH}
                fill="#ef4444"
                opacity={0.6}
                rx={1}
              />
              {/* For (blue, stacked on top) */}
              <rect
                x={x}
                y={H - totalH}
                width={barW}
                height={forH}
                fill="#3b82f6"
                opacity={0.8}
                rx={1}
              />
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2">
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-for-400">
          <span className="h-2 w-3 rounded-sm bg-for-500/80 flex-shrink-0" />
          FOR arguments
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-against-400">
          <span className="h-2 w-3 rounded-sm bg-against-500/60 flex-shrink-0" />
          AGAINST arguments
        </span>
        {buckets.length > 1 && (
          <span className="ml-auto text-[10px] font-mono text-surface-600">
            {formatDate(buckets[0].date)} → {formatDate(buckets[buckets.length - 1].date)}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Top argument card ────────────────────────────────────────────────────────

function TopArgumentCard({
  arg,
  index,
}: {
  arg: TopicTimelineData['top_for'][number]
  index: number
}) {
  const isFor = arg.side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className={cn(
        'rounded-xl border p-4 space-y-2',
        isFor
          ? 'bg-for-500/5 border-for-500/20'
          : 'bg-against-500/5 border-against-500/20'
      )}
    >
      <div className="flex items-center gap-2">
        {arg.author && (
          <Avatar
            src={arg.author.avatar_url}
            fallback={arg.author.display_name ?? arg.author.username}
            size="xs"
          />
        )}
        <span className="text-xs font-semibold text-white truncate">
          {arg.author?.display_name ?? arg.author?.username ?? 'Anonymous'}
        </span>
        {arg.upvotes > 0 && (
          <span
            className={cn(
              'ml-auto flex items-center gap-1 text-xs font-mono font-semibold flex-shrink-0',
              isFor ? 'text-for-400' : 'text-against-400'
            )}
          >
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            {arg.upvotes}
          </span>
        )}
      </div>
      <p className="text-sm text-surface-200 leading-relaxed line-clamp-3">
        &ldquo;{arg.content}&rdquo;
      </p>
      <p className="text-[10px] font-mono text-surface-600">{relativeTime(arg.created_at)}</p>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TopicTimelineClient({
  data,
  topicId,
}: {
  data: TopicTimelineData
  topicId: string
}) {
  const { topic, milestones, argument_buckets, top_for, top_against, total_arguments, debate_days } = data
  const [activeTab, setActiveTab] = useState<'for' | 'against'>('for')

  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
    proposed: 'proposed',
    active: 'active',
    voting: 'active',
    law: 'law',
    failed: 'failed',
  }

  return (
    <div className="space-y-6">
      {/* ── Stats strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Debate Days',
            value: debate_days,
            icon: Calendar,
            color: 'text-for-400',
            bg: 'bg-for-500/10 border-for-500/25',
          },
          {
            label: 'Total Votes',
            value: topic.total_votes.toLocaleString(),
            icon: Scale,
            color: 'text-purple',
            bg: 'bg-purple/10 border-purple/25',
          },
          {
            label: 'Arguments',
            value: total_arguments,
            icon: MessageSquare,
            color: 'text-gold',
            bg: 'bg-gold/10 border-gold/25',
          },
          {
            label: topic.status === 'law' ? 'Final Result' : 'Current Split',
            value: `${forPct}% / ${againstPct}%`,
            icon: topic.status === 'law' ? Gavel : Scale,
            color: forPct >= 50 ? 'text-for-400' : 'text-against-400',
            bg: forPct >= 50 ? 'bg-for-500/10 border-for-500/25' : 'bg-against-500/10 border-against-500/25',
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className={cn('rounded-xl border p-4 flex items-start gap-3', bg)}
          >
            <Icon className={cn('h-4.5 w-4.5 flex-shrink-0 mt-0.5', color)} aria-hidden="true" />
            <div>
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</p>
              <p className="text-lg font-mono font-bold text-white mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Vote bar ─────────────────────────────────────────────────────────── */}
      {topic.total_votes > 0 && (
        <div className="rounded-xl border border-surface-300 bg-surface-100 p-5">
          <div className="flex items-center justify-between text-sm font-mono mb-2">
            <span className="text-for-400 font-semibold">{forPct}% For</span>
            {topic.status === 'law' ? (
              <Badge variant="law">LAW</Badge>
            ) : (
              <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
                {topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
              </Badge>
            )}
            <span className="text-against-400 font-semibold">{againstPct}% Against</span>
          </div>
          <div className="h-3 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full bg-for-500 rounded-full transition-all"
              style={{ width: `${forPct}%` }}
            />
          </div>
          {/* Law threshold marker */}
          <div className="relative h-3 mt-0.5">
            <div
              className="absolute -top-3 h-6 w-px bg-gold/60"
              style={{ left: '67%' }}
              aria-label="67% law threshold"
            />
            <span
              className="absolute -top-5 text-[9px] font-mono text-gold/70 -translate-x-1/2"
              style={{ left: '67%' }}
            >
              67% Law
            </span>
          </div>
        </div>
      )}

      {/* ── Argument activity chart ──────────────────────────────────────────── */}
      {argument_buckets.length > 0 && (
        <div className="rounded-xl border border-surface-300 bg-surface-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-4 w-4 text-gold" aria-hidden="true" />
            <h2 className="text-sm font-mono font-semibold text-white">Argument Activity</h2>
            <span className="text-xs font-mono text-surface-500 ml-auto">
              {total_arguments} total argument{total_arguments !== 1 ? 's' : ''}
            </span>
          </div>
          <ActivityChart buckets={argument_buckets} />
        </div>
      )}

      {/* ── Status milestones ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-surface-300 bg-surface-100 p-5">
        <div className="flex items-center gap-2 mb-6">
          <Flame className="h-4 w-4 text-against-400" aria-hidden="true" />
          <h2 className="text-sm font-mono font-semibold text-white">Debate Journey</h2>
        </div>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-4 bottom-4 w-px bg-surface-300" aria-hidden="true" />

          <div className="space-y-6">
            {milestones.map((m, i) => {
              const cfg = MILESTONE_CONFIG[m.type]
              const Icon = cfg.icon
              const isFuture = m.type === 'voting_ends' && new Date(m.date) > new Date()

              return (
                <motion.div
                  key={`${m.type}-${m.date}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.08 }}
                  className="relative flex items-start gap-4 pl-10"
                >
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      'absolute left-0 flex items-center justify-center h-8 w-8 rounded-full border-2',
                      cfg.iconBg,
                      isFuture && 'opacity-60'
                    )}
                    aria-hidden="true"
                  >
                    <Icon className={cn('h-3.5 w-3.5', cfg.iconColor)} />
                  </div>

                  <div className={cn('flex-1 min-w-0 pb-2', isFuture && 'opacity-70')}>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-mono font-bold text-white">{m.label}</span>
                      {isFuture && (
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded-full">
                          upcoming
                        </span>
                      )}
                      <span className="text-xs font-mono text-surface-500 ml-auto flex-shrink-0">
                        {formatDate(m.date)}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-surface-500 mt-0.5">{m.description}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Top arguments ────────────────────────────────────────────────────── */}
      {(top_for.length > 0 || top_against.length > 0) && (
        <div className="rounded-xl border border-surface-300 bg-surface-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-4 w-4 text-gold" aria-hidden="true" />
            <h2 className="text-sm font-mono font-semibold text-white">Top Arguments</h2>
          </div>

          {/* Tab toggle */}
          <div className="flex rounded-lg border border-surface-300 overflow-hidden mb-4 w-fit">
            <button
              onClick={() => setActiveTab('for')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold transition-colors',
                activeTab === 'for'
                  ? 'bg-for-500/20 text-for-300 border-r border-surface-300'
                  : 'text-surface-500 hover:text-white border-r border-surface-300'
              )}
            >
              <ThumbsUp className="h-3 w-3" aria-hidden="true" />
              FOR ({top_for.length})
            </button>
            <button
              onClick={() => setActiveTab('against')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold transition-colors',
                activeTab === 'against'
                  ? 'bg-against-500/20 text-against-300'
                  : 'text-surface-500 hover:text-white'
              )}
            >
              <ThumbsDown className="h-3 w-3" aria-hidden="true" />
              AGAINST ({top_against.length})
            </button>
          </div>

          {activeTab === 'for' ? (
            top_for.length > 0 ? (
              <div className="space-y-3">
                {top_for.map((arg, i) => (
                  <TopArgumentCard key={arg.id} arg={arg} index={i} />
                ))}
              </div>
            ) : (
              <p className="text-sm font-mono text-surface-500">No FOR arguments yet.</p>
            )
          ) : top_against.length > 0 ? (
            <div className="space-y-3">
              {top_against.map((arg, i) => (
                <TopArgumentCard key={arg.id} arg={arg} index={i} />
              ))}
            </div>
          ) : (
            <p className="text-sm font-mono text-surface-500">No AGAINST arguments yet.</p>
          )}
        </div>
      )}

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 pt-2">
        <Link
          href={`/topic/${topicId}`}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl',
            'bg-for-600 text-white text-sm font-mono font-semibold',
            'hover:bg-for-700 transition-colors'
          )}
        >
          <Scale className="h-4 w-4" aria-hidden="true" />
          Vote on this topic
        </Link>
        <Link
          href="/topic/graph"
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl',
            'border border-surface-300 text-surface-500 text-sm font-mono',
            'hover:border-surface-400 hover:text-white transition-colors'
          )}
        >
          Explore the network
        </Link>
      </div>
    </div>
  )
}
