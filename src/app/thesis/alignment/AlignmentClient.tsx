'use client'

/**
 * /thesis/alignment — Civic Thesis Alignment Tracker
 *
 * Shows active civic theses that are linked to a real topic, alongside
 * the topic's actual vote split. Reveals where community prediction
 * (thesis agree %) is in sync with — or diverging from — real voter
 * consensus (topic blue_pct).
 *
 * "Aligned" = thesis believers and topic voters are leaning the same way.
 * "Diverging" = thesis consensus contradicts what the voters actually think.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Gavel,
  GitCompare,
  Loader2,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { AlignedThesis, AlignmentResponse } from '@/app/api/thesis/alignment/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const CATEGORY_COLOR: Record<string, string> = {
  economics:   'text-gold',
  politics:    'text-for-400',
  technology:  'text-purple',
  science:     'text-emerald',
  ethics:      'text-against-400',
  philosophy:  'text-purple',
  culture:     'text-gold',
  health:      'text-emerald',
  environment: 'text-emerald',
  education:   'text-for-400',
}

const SORT_OPTIONS = [
  { id: 'alignment',   label: 'Most Aligned',  icon: CheckCircle2 },
  { id: 'divergence',  label: 'Most Diverging', icon: XCircle      },
  { id: 'newest',      label: 'Newest',          icon: Zap          },
  { id: 'most_votes',  label: 'Most Voted',      icon: BarChart2    },
] as const

type SortMode = typeof SORT_OPTIONS[number]['id']

// ─── Alignment badge ──────────────────────────────────────────────────────────

function AlignmentBadge({ label, score }: { label: AlignedThesis['alignment_label']; score: number }) {
  if (label === 'aligned') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald/10 border border-emerald/30 text-emerald">
        <CheckCircle2 className="h-3 w-3" />
        Aligned · {score}%
      </span>
    )
  }
  if (label === 'diverging') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-against-500/10 border border-against-500/30 text-against-300">
        <TrendingDown className="h-3 w-3" />
        Diverging · {score}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-surface-300/40 border border-surface-400/40 text-surface-500">
      <Scale className="h-3 w-3" />
      Neutral · {score}%
    </span>
  )
}

// ─── Mini bar ─────────────────────────────────────────────────────────────────

function MiniBar({
  pct,
  colorFor,
  colorAgainst,
  label,
}: {
  pct: number
  colorFor: string
  colorAgainst: string
  label: string
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-mono text-surface-500">{label}</div>
      <div className="h-2 rounded-full overflow-hidden bg-surface-200 flex">
        <div
          className={cn('h-full rounded-l-full transition-all', colorFor)}
          style={{ width: `${pct}%` }}
        />
        <div
          className={cn('h-full rounded-r-full transition-all flex-1', colorAgainst)}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-for-400">{pct}% agree</span>
        <span className="text-against-400">{100 - pct}% disagree</span>
      </div>
    </div>
  )
}

// ─── Entry card ───────────────────────────────────────────────────────────────

function AlignmentCard({ entry }: { entry: AlignedThesis }) {
  const [expanded, setExpanded] = useState(false)
  const catColor = CATEGORY_COLOR[entry.thesis_category?.toLowerCase() ?? ''] ?? 'text-surface-500'

  const topicBlue = Math.round(entry.topic.blue_pct)
  const thesisAgree = entry.thesis_agree_pct
  const alignmentDelta = Math.abs(thesisAgree - topicBlue)

  const hasEnoughVotes = entry.thesis_agree_count + entry.thesis_disagree_count >= 3

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border bg-surface-100 p-4 hover:border-surface-400 transition-colors',
        entry.alignment_label === 'aligned'
          ? 'border-emerald/20 hover:border-emerald/40'
          : entry.alignment_label === 'diverging'
          ? 'border-against-500/20 hover:border-against-500/40'
          : 'border-surface-300',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar
            src={entry.author.avatar_url}
            username={entry.author.username}
            size="xs"
          />
          <Link
            href={`/profile/${entry.author.username}`}
            className="text-sm font-mono text-surface-500 hover:text-white transition-colors truncate"
          >
            {entry.author.display_name ?? entry.author.username}
          </Link>
          <span className={cn('text-[10px] font-mono uppercase tracking-wider', catColor)}>
            {entry.thesis_category}
          </span>
        </div>
        <AlignmentBadge label={entry.alignment_label} score={entry.alignment_score} />
      </div>

      {/* Thesis statement */}
      <Link href={`/thesis/${entry.thesis_id}`} className="block group mb-3">
        <p className="text-sm font-mono text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-2">
          {entry.thesis_statement}
        </p>
      </Link>

      {/* Side-by-side bars */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Thesis agreement */}
        <div>
          <MiniBar
            pct={hasEnoughVotes ? thesisAgree : 50}
            colorFor="bg-for-500"
            colorAgainst="bg-against-500/60"
            label="Thesis consensus"
          />
          {!hasEnoughVotes && (
            <div className="text-[10px] font-mono text-surface-500 mt-1">
              {entry.thesis_agree_count + entry.thesis_disagree_count} vote{(entry.thesis_agree_count + entry.thesis_disagree_count) !== 1 ? 's' : ''} — too few to score
            </div>
          )}
        </div>
        {/* Topic vote */}
        <div>
          <MiniBar
            pct={topicBlue}
            colorFor="bg-for-500"
            colorAgainst="bg-against-500/60"
            label="Topic vote split"
          />
          <div className="text-[10px] font-mono text-surface-500 mt-1">
            {entry.topic.total_votes.toLocaleString()} vote{entry.topic.total_votes !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Delta */}
      {hasEnoughVotes && (
        <div className="flex items-center gap-2 mb-3">
          <GitCompare className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
          <span className="text-xs font-mono text-surface-400">
            {alignmentDelta === 0
              ? 'Perfect alignment — thesis and voters agree exactly'
              : alignmentDelta <= 10
              ? `${alignmentDelta}pt gap — tightly aligned`
              : alignmentDelta <= 25
              ? `${alignmentDelta}pt gap — moderately aligned`
              : `${alignmentDelta}pt gap — significantly diverging`
            }
          </span>
        </div>
      )}

      {/* Linked topic */}
      <div className="rounded-xl bg-surface-200/60 border border-surface-300 p-3 mb-2">
        <div className="flex items-start gap-2">
          <Scale className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-0.5">
              Linked topic
            </div>
            <Link
              href={`/topic/${entry.topic.id}`}
              className="text-xs font-mono text-surface-400 hover:text-white transition-colors line-clamp-2"
            >
              {entry.topic.statement}
            </Link>
          </div>
          <Link
            href={`/topic/${entry.topic.id}`}
            aria-label="View topic"
            className="flex-shrink-0 text-surface-500 hover:text-white transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Expand rationale */}
      {entry.thesis_rationale && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-surface-400 transition-colors"
          aria-expanded={expanded}
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
          {expanded ? 'Hide rationale' : 'Show rationale'}
        </button>
      )}
      <AnimatePresence>
        {expanded && entry.thesis_rationale && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs font-mono text-surface-400 mt-2 leading-relaxed"
          >
            {entry.thesis_rationale}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AlignmentClient() {
  const [data, setData] = useState<AlignmentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<SortMode>('alignment')

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({ sort, limit: '24' })
      if (category) params.set('category', category)
      const res = await fetch(`/api/thesis/alignment?${params.toString()}`)
      if (res.ok) {
        const json: AlignmentResponse = await res.json()
        setData(json)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [category, sort])

  useEffect(() => { load() }, [load])

  const entries = data?.entries ?? []
  const stats = data?.stats

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <Link
            href="/thesis"
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Theses
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-mono font-bold text-white mb-1 flex items-center gap-2">
                <GitCompare className="h-6 w-6 text-purple flex-shrink-0" />
                Thesis Alignment
              </h1>
              <p className="text-sm font-mono text-surface-400 max-w-lg">
                Where civic predictions meet reality — compare thesis community consensus
                with actual topic vote outcomes to see who&apos;s reading the room.
              </p>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh"
              className="flex-shrink-0 p-2 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Stats strip */}
        {stats && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-2 mb-5"
          >
            {[
              {
                label: 'Linked Theses',
                value: stats.total_linked.toString(),
                icon: Sparkles,
                color: 'text-purple',
              },
              {
                label: 'Avg Alignment',
                value: `${stats.avg_alignment}%`,
                icon: GitCompare,
                color: stats.avg_alignment >= 65 ? 'text-emerald' : stats.avg_alignment <= 40 ? 'text-against-400' : 'text-gold',
              },
              {
                label: 'Top Category',
                value: stats.most_aligned_category ?? '—',
                icon: BarChart2,
                color: CATEGORY_COLOR[stats.most_aligned_category?.toLowerCase() ?? ''] ?? 'text-surface-500',
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-2 text-center"
              >
                <s.icon className={cn('h-3.5 w-3.5 mx-auto mb-1', s.color)} aria-hidden="true" />
                <div className="font-mono text-base font-bold text-white leading-tight">{s.value}</div>
                <div className="font-mono text-[10px] text-surface-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Sort + Category filters */}
        <div className="flex flex-col gap-2 mb-5">
          {/* Sort tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {SORT_OPTIONS.map((opt) => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.id}
                  onClick={() => setSort(opt.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-colors',
                    sort === opt.id
                      ? 'bg-for-500/20 border border-for-500/40 text-for-300'
                      : 'bg-surface-200 border border-surface-300 text-surface-500 hover:text-white',
                  )}
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {opt.label}
                </button>
              )
            })}
          </div>

          {/* Category pills */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setCategory('')}
              className={cn(
                'px-2.5 py-1 rounded-full text-[11px] font-mono font-medium transition-colors',
                category === ''
                  ? 'bg-surface-400 text-white'
                  : 'bg-surface-200 border border-surface-300 text-surface-500 hover:text-white',
              )}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat === category ? '' : cat)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-mono font-medium transition-colors',
                  category === cat
                    ? 'bg-surface-400 text-white'
                    : 'bg-surface-200 border border-surface-300 text-surface-500 hover:text-white',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-5 text-[11px] font-mono">
          <div className="flex items-center gap-1 text-emerald">
            <CheckCircle2 className="h-3 w-3" />
            Aligned: thesis believers & voters lean the same way
          </div>
          <div className="flex items-center gap-1 text-against-400">
            <TrendingDown className="h-3 w-3" />
            Diverging: thesis consensus contradicts the voters
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={GitCompare}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/30"
            title="No linked theses yet"
            description={
              category
                ? `No active theses in ${category} are linked to a topic. Link a thesis to a topic when creating it.`
                : 'No active theses are linked to a topic yet. Write a thesis and link it to a topic to appear here.'
            }
            action={{ label: 'Write a Thesis', href: '/thesis/create' }}
          />
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <AlignmentCard key={entry.thesis_id} entry={entry} />
            ))}
          </div>
        )}

        {/* CTA */}
        {!loading && entries.length > 0 && (
          <div className="mt-6 rounded-2xl border border-purple/20 bg-purple/5 p-5 text-center">
            <h3 className="font-mono text-sm font-semibold text-white mb-1.5">
              Share your civic prediction
            </h3>
            <p className="font-mono text-xs text-surface-400 mb-3">
              Write a thesis linked to an active topic and see how your prediction
              aligns with the community.
            </p>
            <Link
              href="/thesis/create"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple/20 border border-purple/40 text-purple text-sm font-mono font-semibold hover:bg-purple/30 transition-colors"
            >
              Write a Thesis
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
