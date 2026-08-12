'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  Brain,
  CheckCircle2,
  Circle,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ImpactResponse, ImpactArgument, ImpactMilestone, CategoryImpact } from '@/app/api/arguments/impact/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed', active: 'active', voting: 'active',
  law: 'law', failed: 'failed', continued: 'proposed', archived: 'proposed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed', active: 'Active', voting: 'Voting',
  law: 'LAW', failed: 'Failed', continued: 'Continued', archived: 'Archived',
}

// ─── Impact Score Ring ────────────────────────────────────────────────────────

function ImpactRing({ score }: { score: number }) {
  const maxDisplay = 2000
  const pct = Math.min(score / maxDisplay, 1)
  const r = 54
  const circ = 2 * Math.PI * r
  const dash = pct * circ

  let ringColor = '#3b82f6'
  if (score >= 1000) ringColor = '#f59e0b'
  else if (score >= 500) ringColor = '#a78bfa'
  else if (score >= 100) ringColor = '#22d3ee'

  let label = 'Rising'
  if (score >= 1000) label = 'Legendary'
  else if (score >= 500) label = 'Influencer'
  else if (score >= 100) label = 'Active'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-flex items-center justify-center">
        <svg width={128} height={128} viewBox="0 0 128 128">
          <circle cx={64} cy={64} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
          <circle
            cx={64}
            cy={64}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth={10}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 64 64)"
            style={{ transition: 'stroke-dasharray 1s cubic-bezier(.4,0,.2,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-mono font-bold text-white leading-none">
            {score.toLocaleString()}
          </span>
          <span className="text-[10px] font-mono text-surface-500 mt-0.5">IMPACT</span>
        </div>
      </div>
      <span
        className={cn(
          'text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full',
          score >= 1000
            ? 'bg-gold/15 text-gold border border-gold/30'
            : score >= 500
            ? 'bg-purple/15 text-purple border border-purple/30'
            : score >= 100
            ? 'bg-for-500/15 text-for-400 border border-for-500/30'
            : 'bg-surface-300/40 text-surface-400 border border-surface-300',
        )}
      >
        {label}
      </span>
    </div>
  )
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ImpactArgCard({ arg, highlight }: { arg: ImpactArgument; highlight?: 'law' | 'replies' }) {
  return (
    <Link
      href={`/arguments/${arg.id}`}
      className={cn(
        'group flex flex-col gap-1.5 rounded-xl border p-3.5 transition-all',
        highlight === 'law'
          ? 'bg-gold/5 border-gold/30 hover:border-gold/50'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant={STATUS_BADGE[arg.topic_status] ?? 'proposed'} className="text-[10px] shrink-0">
          {STATUS_LABEL[arg.topic_status] ?? arg.topic_status}
        </Badge>
        <span className="text-xs font-mono text-surface-400 truncate">
          {arg.topic_statement}
        </span>
      </div>
      <p className="text-sm text-surface-600 leading-relaxed line-clamp-2">{arg.content}</p>
      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold',
            arg.side === 'blue'
              ? 'bg-for-500/15 text-for-400 border border-for-500/30'
              : 'bg-against-500/15 text-against-400 border border-against-500/30',
          )}
        >
          {arg.side === 'blue'
            ? <ThumbsUp className="h-2.5 w-2.5" aria-hidden />
            : <ThumbsDown className="h-2.5 w-2.5" aria-hidden />}
          {arg.side === 'blue' ? 'FOR' : 'AGAINST'}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-mono text-surface-400">
          <TrendingUp className="h-3 w-3" aria-hidden />
          {arg.upvotes.toLocaleString()}
        </span>
        {arg.reply_count > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-purple">
            <MessageSquare className="h-3 w-3" aria-hidden />
            {arg.reply_count} {arg.reply_count === 1 ? 'reply' : 'replies'}
          </span>
        )}
        <span className="ml-auto text-[10px] font-mono text-surface-500">{relativeTime(arg.created_at)}</span>
      </div>
    </Link>
  )
}

// ─── Category Impact Rows ─────────────────────────────────────────────────────

function CategoryImpactRow({ item, maxUpvotes }: { item: CategoryImpact; maxUpvotes: number }) {
  const pct = maxUpvotes > 0 ? (item.upvotes / maxUpvotes) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-20 shrink-0">
        <span className="text-xs font-mono text-surface-400 truncate block">{item.category}</span>
      </div>
      <div className="flex-1 h-2 rounded-full bg-surface-300/40 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full rounded-full bg-for-600/70"
        />
      </div>
      <div className="flex items-center gap-2 shrink-0 w-28 justify-end">
        <span className="text-xs font-mono text-surface-500">{item.total} args</span>
        {item.lawCount > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-gold font-semibold">
            <Gavel className="h-3 w-3" aria-hidden />
            {item.lawCount}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Milestone Row ────────────────────────────────────────────────────────────

function MilestoneRow({ milestone }: { milestone: ImpactMilestone }) {
  return (
    <div className={cn('flex items-center gap-3 py-2 border-b border-surface-300/50 last:border-0')}>
      {milestone.achieved ? (
        <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" aria-hidden />
      ) : (
        <Circle className="h-4 w-4 text-surface-400 shrink-0" aria-hidden />
      )}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-mono font-semibold',
          milestone.achieved ? 'text-white' : 'text-surface-500',
        )}>
          {milestone.label}
        </p>
        <p className="text-[10px] font-mono text-surface-500 mt-0.5">{milestone.value}</p>
      </div>
      {milestone.achieved && (
        <span className="text-[10px] font-mono text-emerald bg-emerald/10 border border-emerald/30 px-2 py-0.5 rounded-full shrink-0">
          Achieved
        </span>
      )}
    </div>
  )
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4">
          <Skeleton className="h-3 w-16 mb-3" />
          <Skeleton className="h-7 w-12" />
        </div>
      ))}
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-3.5 space-y-2">
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type TabId = 'law' | 'replies' | 'milestones'

export default function ImpactClient() {
  const [data, setData] = useState<ImpactResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('law')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/arguments/impact')
      if (res.status === 401) {
        setError('Sign in to view your argument impact.')
        return
      }
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch {
      setError('Could not load impact data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const maxCatUpvotes = data
    ? Math.max(...data.categoryImpact.map((c) => c.upvotes), 1)
    : 1

  const achievedCount = data?.milestones.filter((m) => m.achieved).length ?? 0
  const totalMilestones = data?.milestones.length ?? 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-6">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link
            href="/arguments/mine"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors shrink-0"
            aria-label="Back to my arguments"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white">Argument Impact</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Your civic reach — laws shaped, debates sparked
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Error ───────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/10 px-4 py-3 text-sm font-mono text-against-400">
            {error}
          </div>
        )}

        {/* ── Impact Ring + Key Stats ──────────────────────────────────── */}
        {loading ? (
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-6">
            <div className="flex flex-col items-center gap-4">
              <Skeleton className="h-32 w-32 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ) : data ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-surface-300 bg-surface-100 p-5"
          >
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ImpactRing score={data.impactScore} />
              <div className="flex-1 grid grid-cols-2 gap-3 w-full">
                {[
                  {
                    label: 'Laws Shaped',
                    value: data.lawCount.toLocaleString(),
                    icon: Gavel,
                    color: 'text-gold',
                    bg: 'bg-gold/10',
                    border: 'border-gold/30',
                  },
                  {
                    label: 'Total Upvotes',
                    value: data.totalUpvotes.toLocaleString(),
                    icon: TrendingUp,
                    color: 'text-for-400',
                    bg: 'bg-for-500/10',
                    border: 'border-for-500/30',
                  },
                  {
                    label: 'Debate Replies',
                    value: data.totalReplies.toLocaleString(),
                    icon: MessageSquare,
                    color: 'text-purple',
                    bg: 'bg-purple/10',
                    border: 'border-purple/30',
                  },
                  {
                    label: 'Est. Reach',
                    value: data.reachEstimate >= 1000
                      ? `${(data.reachEstimate / 1000).toFixed(1)}k`
                      : data.reachEstimate.toLocaleString(),
                    icon: Users,
                    color: 'text-emerald',
                    bg: 'bg-emerald/10',
                    border: 'border-emerald/30',
                  },
                ].map(({ label, value, icon: Icon, color, bg, border }) => (
                  <div key={label} className={cn('rounded-xl border p-3.5', bg, border, 'bg-surface-100')}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon className={cn('h-3.5 w-3.5', color)} aria-hidden />
                      <span className="text-[10px] font-mono text-surface-400 uppercase tracking-wide">{label}</span>
                    </div>
                    <p className={cn('text-xl font-mono font-bold', color)}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-4 text-[10px] font-mono text-surface-500 text-center">
              Impact score = (laws × 50) + (replies × 3) + (upvotes × 0.5) ·{' '}
              <span className="text-for-400">{achievedCount}/{totalMilestones} milestones</span>
            </p>
          </motion.div>
        ) : null}

        {/* ── Stats strip (overall) ────────────────────────────────────── */}
        {loading ? (
          <StatsSkeleton />
        ) : data && data.totalArguments > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            {[
              { label: 'Arguments', value: data.totalArguments.toLocaleString(), icon: Scale, color: 'text-surface-400' },
              { label: 'On Law Topics', value: data.lawCount.toLocaleString(), icon: Gavel, color: 'text-gold' },
              { label: 'Total Replies', value: data.totalReplies.toLocaleString(), icon: MessageSquare, color: 'text-purple' },
              { label: 'Milestones', value: `${achievedCount}/${totalMilestones}`, icon: Star, color: 'text-gold' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl border border-surface-300 bg-surface-100 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className={cn('h-3.5 w-3.5', color)} aria-hidden />
                  <span className="text-[10px] font-mono text-surface-400 uppercase tracking-wide">{label}</span>
                </div>
                <p className={cn('text-2xl font-mono font-bold', color)}>{value}</p>
              </div>
            ))}
          </motion.div>
        ) : null}

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        {!loading && data && data.totalArguments > 0 && (
          <div className="flex items-center gap-1 rounded-xl bg-surface-200 p-1 self-start">
            {(
              [
                { id: 'law' as TabId, label: `Laws (${data.lawCount})`, icon: Gavel },
                { id: 'replies' as TabId, label: 'By Replies', icon: MessageSquare },
                { id: 'milestones' as TabId, label: 'Milestones', icon: Award },
              ] as { id: TabId; label: string; icon: React.ElementType }[]
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
                  tab === id
                    ? 'bg-surface-50 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-400',
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* ── Tab Content ──────────────────────────────────────────────── */}
        {!loading && data && data.totalArguments > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {/* Law Arguments Tab */}
              {tab === 'law' && (
                <>
                  {data.lawCount === 0 ? (
                    <EmptyState
                      icon={Gavel}
                      iconColor="text-gold"
                      iconBg="bg-gold/10"
                      iconBorder="border-gold/30"
                      title="No laws yet"
                      description="Keep arguing on active topics — when they pass into law, your arguments appear here."
                      actions={[{ label: 'Browse Active Debates', href: '/' }]}
                    />
                  ) : (
                    <>
                      <div className="flex items-center gap-2 px-1">
                        <Gavel className="h-4 w-4 text-gold" aria-hidden />
                        <h2 className="text-xs font-mono text-surface-400 uppercase tracking-wider">
                          Arguments on topics that became law
                        </h2>
                      </div>
                      {data.topUpvotedLaw.map((arg) => (
                        <ImpactArgCard key={arg.id} arg={arg} highlight="law" />
                      ))}
                      {data.lawArguments.length > 5 && (
                        <p className="text-xs font-mono text-surface-500 text-center pt-1">
                          Showing top 5 of {data.lawArguments.length} law-status arguments
                        </p>
                      )}
                    </>
                  )}
                </>
              )}

              {/* By Replies Tab */}
              {tab === 'replies' && (
                <>
                  <div className="flex items-center gap-2 px-1">
                    <MessageSquare className="h-4 w-4 text-purple" aria-hidden />
                    <h2 className="text-xs font-mono text-surface-400 uppercase tracking-wider">
                      Arguments that sparked the most discussion
                    </h2>
                  </div>
                  {data.topReplyArgs.filter((a) => a.reply_count > 0).length === 0 ? (
                    <EmptyState
                      icon={MessageSquare}
                      iconColor="text-purple"
                      iconBg="bg-purple/10"
                      iconBorder="border-purple/30"
                      title="No replies yet"
                      description="Arguments with the most replies will appear here once people start responding."
                      actions={[{ label: 'View my arguments', href: '/arguments/mine' }]}
                    />
                  ) : (
                    data.topReplyArgs.map((arg) => (
                      <ImpactArgCard key={arg.id} arg={arg} />
                    ))
                  )}

                  {/* Category breakdown */}
                  {data.categoryImpact.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="rounded-xl border border-surface-300 bg-surface-100 p-4"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <BarChart2 className="h-4 w-4 text-for-400" aria-hidden />
                        <h2 className="text-xs font-mono text-surface-400 uppercase tracking-wider">
                          Impact by category
                        </h2>
                      </div>
                      <div className="space-y-2.5">
                        {data.categoryImpact.map((item) => (
                          <CategoryImpactRow key={item.category} item={item} maxUpvotes={maxCatUpvotes} />
                        ))}
                      </div>
                      <p className="mt-3 text-[10px] font-mono text-surface-500">
                        Bar = upvote share · <span className="text-gold">gavel = laws enacted</span>
                      </p>
                    </motion.div>
                  )}
                </>
              )}

              {/* Milestones Tab */}
              {tab === 'milestones' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-surface-300 bg-surface-100 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-gold" aria-hidden />
                      <h2 className="text-xs font-mono text-surface-400 uppercase tracking-wider">
                        Impact milestones
                      </h2>
                    </div>
                    <span className="text-xs font-mono text-gold font-semibold">
                      {achievedCount}/{totalMilestones}
                    </span>
                  </div>
                  <div>
                    {data.milestones.map((m) => (
                      <MilestoneRow key={m.label} milestone={m} />
                    ))}
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-surface-300/40 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(achievedCount / totalMilestones) * 100}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-for-600 to-gold"
                    />
                  </div>
                  <p className="mt-2 text-[10px] font-mono text-surface-500">
                    {achievedCount === totalMilestones
                      ? 'All milestones achieved — civic legend status!'
                      : `${totalMilestones - achievedCount} milestone${totalMilestones - achievedCount !== 1 ? 's' : ''} remaining`}
                  </p>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Loading state ─────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {!loading && !error && data && data.totalArguments === 0 && (
          <EmptyState
            icon={Zap}
            iconColor="text-for-400"
            iconBg="bg-for-500/10"
            iconBorder="border-for-500/30"
            title="No impact yet"
            description="Start writing arguments on active debates to build your civic impact score."
            actions={[{ label: 'Browse Active Topics', href: '/' }]}
          />
        )}

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        {!loading && data && data.totalArguments > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/arguments/mine"
              className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-mono font-medium bg-for-500/10 text-for-400 hover:bg-for-500/20 border border-for-500/30 transition-all"
            >
              <Scale className="h-4 w-4" aria-hidden />
              My Arguments
            </Link>
            <Link
              href="/arguments/dna"
              className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-mono font-medium bg-purple/10 text-purple hover:bg-purple/20 border border-purple/30 transition-all"
            >
              <Brain className="h-4 w-4" aria-hidden />
              Argument DNA
            </Link>
            <Link
              href="/"
              className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-mono font-medium bg-surface-200 text-surface-400 hover:bg-surface-300 hover:text-white border border-surface-300 transition-all"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              Argue on Active Topics
            </Link>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
