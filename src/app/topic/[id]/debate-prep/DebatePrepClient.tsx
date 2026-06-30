'use client'

/**
 * /topic/[id]/debate-prep — The Debate Prep Kit
 *
 * A preparation kit for any topic: choose your side, see the strongest
 * arguments from both camps, review the evidence base, and get tactical
 * strategic tips matched to the current vote split.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  ExternalLink,
  FileText,
  Lightbulb,
  RefreshCw,
  Scale,
  Shield,
  Sword,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
  AlertTriangle,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  DebatePrepResponse,
  PrepArgument,
  PrepEvidence,
  SideStrategy,
  DebatePrepStats,
} from '@/app/api/topics/[id]/debate-prep/route'

// ─── Config ───────────────────────────────────────────────────────────────────

type Side = 'for' | 'against'
type Tab = 'my-case' | 'opposition' | 'evidence' | 'strategy'

const STRENGTH_LABEL: Record<string, string> = {
  dominant: 'Dominant',
  strong: 'Strong',
  contested: 'Contested',
  weak: 'Weak',
}

const STRENGTH_COLOR: Record<string, string> = {
  dominant: 'text-emerald',
  strong: 'text-for-400',
  contested: 'text-gold',
  weak: 'text-against-400',
}

const EVIDENCE_SIDE_CONFIG: Record<string, { label: string; color: string }> = {
  for: { label: 'Supports FOR', color: 'text-for-400' },
  against: { label: 'Supports AGAINST', color: 'text-against-400' },
  neutral: { label: 'Neutral / Context', color: 'text-surface-400' },
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DebatePrepSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
        <Skeleton className="h-5 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/3 rounded" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  variant,
}: {
  arg: PrepArgument
  variant: 'ally' | 'opponent'
}) {
  const isAlly = variant === 'ally'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 space-y-3',
        isAlly
          ? 'border-for-500/20 bg-for-500/5'
          : 'border-against-500/20 bg-against-500/5'
      )}
    >
      <p className="text-sm text-white leading-relaxed">{arg.content}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {arg.author && (
            <>
              <Avatar
                src={arg.author.avatar_url}
                username={arg.author.username}
                size="xs"
              />
              <span className="text-xs text-surface-400">
                {arg.author.display_name ?? arg.author.username}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-surface-400">
          <ThumbsUp className="h-3 w-3" />
          <span>{arg.upvotes}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Evidence Card ────────────────────────────────────────────────────────────

function EvidenceCard({ item }: { item: PrepEvidence }) {
  const cfg = EVIDENCE_SIDE_CONFIG[item.side] ?? EVIDENCE_SIDE_CONFIG.neutral
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-surface-300 bg-surface-100 p-4 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn('text-xs font-medium', cfg.color)}>{cfg.label}</span>
            {item.domain && (
              <span className="text-xs text-surface-500">{item.domain}</span>
            )}
          </div>
          <p className="text-sm font-medium text-white leading-snug">{item.title}</p>
          {item.description && (
            <p className="text-xs text-surface-400 mt-1 leading-relaxed line-clamp-2">
              {item.description}
            </p>
          )}
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 p-1.5 rounded-lg hover:bg-surface-300 transition-colors text-surface-400 hover:text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <div className="flex items-center justify-between mt-2">
        {item.author && (
          <span className="text-xs text-surface-500">
            Added by {item.author.display_name ?? item.author.username}
          </span>
        )}
        <div className="flex items-center gap-1 text-xs text-surface-400 ml-auto">
          <ThumbsUp className="h-3 w-3" />
          <span>{item.upvotes}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Strategy Panel ───────────────────────────────────────────────────────────

function StrategyPanel({ strategy, side }: { strategy: SideStrategy; side: Side }) {
  return (
    <div className="space-y-4">
      <div
        className={cn(
          'rounded-xl border p-4',
          side === 'for'
            ? 'border-for-500/30 bg-for-500/5'
            : 'border-against-500/30 bg-against-500/5'
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className={cn('h-4 w-4', side === 'for' ? 'text-for-400' : 'text-against-400')} />
          <span className="text-sm font-semibold text-white">Strategic Overview</span>
        </div>
        <p className="text-sm text-surface-300 leading-relaxed">{strategy.overview}</p>
      </div>

      <div className="space-y-3">
        {strategy.tips.map((tip, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-1.5"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold',
                  side === 'for' ? 'bg-for-500/20 text-for-400' : 'bg-against-500/20 text-against-400'
                )}
              >
                {i + 1}
              </span>
              <p className="text-sm font-semibold text-white">{tip.title}</p>
            </div>
            <p className="text-xs text-surface-400 leading-relaxed pl-7">{tip.body}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── Stats Row ────────────────────────────────────────────────────────────────

function StatsRow({ stats, blue_pct }: { stats: DebatePrepStats; blue_pct: number }) {
  const forPct = Math.round(blue_pct)
  const againstPct = 100 - forPct

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
        <p className="text-lg font-bold text-for-400">{forPct}%</p>
        <p className="text-xs text-surface-500 mt-0.5">FOR</p>
        <p className={cn('text-[10px] mt-1 font-medium', STRENGTH_COLOR[stats.for_strength])}>
          {STRENGTH_LABEL[stats.for_strength]}
        </p>
      </div>
      <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
        <p className={cn('text-lg font-bold', stats.contestedness >= 80 ? 'text-gold' : 'text-surface-400')}>
          {stats.contestedness}
        </p>
        <p className="text-xs text-surface-500 mt-0.5">Contest Score</p>
        <p className="text-[10px] text-surface-600 mt-1">
          {stats.contestedness >= 80 ? 'Knife-edge' : stats.contestedness >= 60 ? 'Closely fought' : 'Clear lean'}
        </p>
      </div>
      <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
        <p className="text-lg font-bold text-against-400">{againstPct}%</p>
        <p className="text-xs text-surface-500 mt-0.5">AGAINST</p>
        <p className={cn('text-[10px] mt-1 font-medium', STRENGTH_COLOR[stats.against_strength])}>
          {STRENGTH_LABEL[stats.against_strength]}
        </p>
      </div>
    </div>
  )
}

// ─── Side Selector ────────────────────────────────────────────────────────────

function SideSelector({
  side,
  onChange,
  blue_pct,
}: {
  side: Side
  onChange: (s: Side) => void
  blue_pct: number
}) {
  const forPct = Math.round(blue_pct)
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
      <p className="text-xs text-surface-400 mb-3 text-center font-medium uppercase tracking-wider">
        Which side are you preparing for?
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onChange('for')}
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-xl border p-4 transition-all duration-200',
            side === 'for'
              ? 'border-for-500 bg-for-500/10 text-for-400'
              : 'border-surface-300 text-surface-400 hover:border-for-500/50 hover:text-for-400'
          )}
        >
          <ThumbsUp className="h-5 w-5" />
          <span className="text-sm font-semibold">FOR</span>
          <span className="text-xs opacity-70">{forPct}% currently</span>
        </button>
        <button
          onClick={() => onChange('against')}
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-xl border p-4 transition-all duration-200',
            side === 'against'
              ? 'border-against-500 bg-against-500/10 text-against-400'
              : 'border-surface-300 text-surface-400 hover:border-against-500/50 hover:text-against-400'
          )}
        >
          <ThumbsDown className="h-5 w-5" />
          <span className="text-sm font-semibold">AGAINST</span>
          <span className="text-xs opacity-70">{100 - forPct}% currently</span>
        </button>
      </div>
    </div>
  )
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: typeof BookOpen }[] = [
  { key: 'my-case', label: 'My Case', icon: Shield },
  { key: 'opposition', label: 'Opposition', icon: Sword },
  { key: 'evidence', label: 'Evidence', icon: FileText },
  { key: 'strategy', label: 'Strategy', icon: Lightbulb },
]

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex rounded-xl bg-surface-200 p-1 gap-1">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = active === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all duration-200',
              isActive
                ? 'bg-surface-100 text-white shadow-sm'
                : 'text-surface-400 hover:text-surface-300'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Empty argument state ─────────────────────────────────────────────────────

function EmptyArguments({ side, topicId }: { side: Side; topicId: string }) {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-8 text-center">
      <Users className="h-8 w-8 text-surface-500 mx-auto mb-3" />
      <p className="text-sm font-medium text-white mb-1">No arguments yet</p>
      <p className="text-xs text-surface-400 mb-4">
        Be the first to make the {side === 'for' ? 'FOR' : 'AGAINST'} case for this topic.
      </p>
      <Link
        href={`/topic/${topicId}/argue`}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
          side === 'for'
            ? 'bg-for-500 hover:bg-for-600 text-white'
            : 'bg-against-500 hover:bg-against-600 text-white'
        )}
      >
        Add your argument
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  topicId: string
}

export function DebatePrepClient({ topicId }: Props) {
  const [data, setData] = useState<DebatePrepResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [side, setSide] = useState<Side>('for')
  const [tab, setTab] = useState<Tab>('my-case')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/debate-prep`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load debate prep data')
      const json: DebatePrepResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    load()
  }, [load])

  const myArgs = side === 'for' ? (data?.for_arguments ?? []) : (data?.against_arguments ?? [])
  const oppArgs = side === 'for' ? (data?.against_arguments ?? []) : (data?.for_arguments ?? [])
  const myStrategy = side === 'for' ? data?.for_strategy : data?.against_strategy
  const accentColor = side === 'for' ? 'text-for-400' : 'text-against-400'

  return (
    <div className="min-h-screen bg-surface-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface-900/95 backdrop-blur-sm border-b border-surface-300">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href={`/topic/${topicId}`}
            className="p-2 rounded-lg hover:bg-surface-200 transition-colors text-surface-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold shrink-0" />
              <h1 className="text-sm font-bold text-white truncate">Debate Prep Kit</h1>
            </div>
            {data && (
              <p className="text-xs text-surface-500 truncate mt-0.5">{data.topic.statement}</p>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-surface-200 transition-colors text-surface-400 hover:text-white"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 pb-28 space-y-5">
        {/* Loading */}
        {loading && <DebatePrepSkeleton />}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/10 p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-against-400 mx-auto mb-2" />
            <p className="text-sm text-against-300 mb-3">{error}</p>
            <button
              onClick={load}
              className="text-xs text-surface-400 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              {/* Topic info */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant={STATUS_BADGE[data.topic.status] ?? 'proposed'}>
                        {data.topic.status}
                      </Badge>
                      {data.topic.category && (
                        <span className="text-xs text-surface-400">{data.topic.category}</span>
                      )}
                      <span className="text-xs text-surface-500 ml-auto">
                        {data.topic.total_votes.toLocaleString()} votes
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-white leading-snug">
                      {data.topic.statement}
                    </p>
                  </div>
                </div>
                {/* Vote split bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-for-400 font-medium">{Math.round(data.topic.blue_pct)}% For</span>
                    <span className="text-against-400 font-medium">{100 - Math.round(data.topic.blue_pct)}% Against</span>
                  </div>
                  <div className="h-2 rounded-full bg-against-900 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-for-500 to-for-400"
                      style={{ width: `${data.topic.blue_pct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <StatsRow stats={data.stats} blue_pct={data.topic.blue_pct} />

              {/* Side selector */}
              <SideSelector
                side={side}
                onChange={(s) => {
                  setSide(s)
                  setTab('my-case')
                }}
                blue_pct={data.topic.blue_pct}
              />

              {/* Tabs */}
              <TabBar active={tab} onChange={setTab} />

              {/* Tab content */}
              <AnimatePresence mode="wait">
                {tab === 'my-case' && (
                  <motion.div
                    key="my-case"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2">
                      <Shield className={cn('h-4 w-4', accentColor)} />
                      <h2 className="text-sm font-semibold text-white">
                        Best {side === 'for' ? 'FOR' : 'AGAINST'} Arguments
                      </h2>
                      <span className="ml-auto text-xs text-surface-400">
                        {myArgs.length} community argument{myArgs.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {myArgs.length === 0 ? (
                      <EmptyArguments side={side} topicId={topicId} />
                    ) : (
                      <div className="space-y-3">
                        {myArgs.map((arg) => (
                          <ArgumentCard key={arg.id} arg={arg} variant="ally" />
                        ))}
                      </div>
                    )}
                    <Link
                      href={`/topic/${topicId}/arguments`}
                      className="flex items-center justify-center gap-1.5 text-xs text-surface-400 hover:text-white transition-colors py-2"
                    >
                      View all arguments
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </motion.div>
                )}

                {tab === 'opposition' && (
                  <motion.div
                    key="opposition"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2">
                      <Sword className="h-4 w-4 text-surface-400" />
                      <h2 className="text-sm font-semibold text-white">
                        Know Your Opposition
                      </h2>
                      <span className="ml-auto text-xs text-surface-400">
                        {oppArgs.length} argument{oppArgs.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'rounded-xl border p-3 text-xs',
                        'border-surface-300 bg-surface-100 text-surface-400'
                      )}
                    >
                      <Zap className="h-3.5 w-3.5 inline mr-1.5 text-gold" />
                      Study these carefully — they represent the strongest case against your position.
                    </div>
                    {oppArgs.length === 0 ? (
                      <div className="rounded-xl border border-surface-300 bg-surface-100 p-8 text-center">
                        <p className="text-sm text-surface-400">
                          No {side === 'for' ? 'AGAINST' : 'FOR'} arguments yet — you face no opposition!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {oppArgs.map((arg) => (
                          <ArgumentCard key={arg.id} arg={arg} variant="opponent" />
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {tab === 'evidence' && (
                  <motion.div
                    key="evidence"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-surface-400" />
                      <h2 className="text-sm font-semibold text-white">Evidence Base</h2>
                      <span className="ml-auto text-xs text-surface-400">
                        {data.evidence.length} source{data.evidence.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {data.evidence.length === 0 ? (
                      <div className="rounded-xl border border-surface-300 bg-surface-100 p-8 text-center">
                        <FileText className="h-8 w-8 text-surface-500 mx-auto mb-3" />
                        <p className="text-sm font-medium text-white mb-1">No evidence yet</p>
                        <p className="text-xs text-surface-400 mb-4">
                          Add a source to strengthen this debate.
                        </p>
                        <Link
                          href={`/topic/${topicId}/evidence`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-sm text-white transition-colors"
                        >
                          Add evidence
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.evidence.map((item) => (
                          <EvidenceCard key={item.id} item={item} />
                        ))}
                      </div>
                    )}
                    <Link
                      href={`/topic/${topicId}/evidence`}
                      className="flex items-center justify-center gap-1.5 text-xs text-surface-400 hover:text-white transition-colors py-2"
                    >
                      View all evidence
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </motion.div>
                )}

                {tab === 'strategy' && myStrategy && (
                  <motion.div
                    key="strategy"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2">
                      <Lightbulb className={cn('h-4 w-4', accentColor)} />
                      <h2 className="text-sm font-semibold text-white">
                        {side === 'for' ? 'FOR' : 'AGAINST'} Strategy
                      </h2>
                      <span className="ml-auto text-xs text-surface-400">
                        Tailored to current {Math.round(data.topic.blue_pct)}%/{100 - Math.round(data.topic.blue_pct)}% split
                      </span>
                    </div>
                    <StrategyPanel strategy={myStrategy} side={side} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Quick links */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Link
                  href={`/topic/${topicId}/argue`}
                  className={cn(
                    'flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-colors',
                    side === 'for'
                      ? 'border-for-500/30 bg-for-500/5 text-for-400 hover:bg-for-500/10'
                      : 'border-against-500/30 bg-against-500/5 text-against-400 hover:bg-against-500/10'
                  )}
                >
                  <span>Argue {side === 'for' ? 'FOR' : 'AGAINST'}</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
                <Link
                  href={`/topic/${topicId}`}
                  className="flex items-center justify-between px-4 py-3 rounded-xl border border-surface-300 bg-surface-100 text-sm font-medium text-surface-300 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <span>Vote now</span>
                  <Scale className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
