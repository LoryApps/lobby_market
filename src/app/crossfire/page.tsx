'use client'

/**
 * /crossfire — Battle of Ideas
 *
 * Shows the most contested topics on the platform with their best
 * FOR vs AGAINST arguments displayed head-to-head. A curated view
 * of the sharpest intellectual clashes happening right now.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  Flame,
  RefreshCw,
  Scale,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CrossfireEntry, CrossfireResponse } from '@/app/api/crossfire/route'

// ─── Category colors ───────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

const CATEGORIES = [
  'All',
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function heatLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Deadlock', color: 'text-against-400' }
  if (score >= 75) return { label: 'Fierce', color: 'text-gold' }
  if (score >= 60) return { label: 'Contested', color: 'text-for-400' }
  return { label: 'Active', color: 'text-emerald' }
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

// ─── Argument card ─────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  side,
  expanded,
  onExpand,
}: {
  arg: CrossfireEntry['for_argument']
  side: 'for' | 'against'
  expanded: boolean
  onExpand: () => void
}) {
  const isFor = side === 'for'

  if (!arg) {
    return (
      <div
        className={cn(
          'flex-1 rounded-xl border border-dashed p-4 flex items-center justify-center',
          isFor
            ? 'border-for-500/20 bg-for-500/3'
            : 'border-against-500/20 bg-against-500/3'
        )}
      >
        <p className="text-xs font-mono text-surface-600 text-center">
          No {isFor ? 'FOR' : 'AGAINST'} argument yet
        </p>
      </div>
    )
  }

  const displayName = arg.author?.display_name ?? arg.author?.username ?? 'Anonymous'

  return (
    <motion.div
      layout
      className={cn(
        'flex-1 rounded-xl border p-4 flex flex-col gap-3 transition-colors',
        isFor
          ? 'border-for-500/30 bg-for-500/5 hover:border-for-500/50'
          : 'border-against-500/30 bg-against-500/5 hover:border-against-500/50'
      )}
    >
      {/* Side label */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full',
            isFor
              ? 'bg-for-500/15 text-for-400'
              : 'bg-against-500/15 text-against-400'
          )}
        >
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
        <div className="flex items-center gap-1 text-xs font-mono text-surface-500">
          {isFor ? (
            <ThumbsUp className="h-3 w-3 text-for-400" />
          ) : (
            <ThumbsDown className="h-3 w-3 text-against-400" />
          )}
          <span className={isFor ? 'text-for-400' : 'text-against-400'}>
            {arg.upvotes.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-surface-100 leading-relaxed font-light">
        {expanded ? arg.content : truncate(arg.content, 200)}
      </p>

      {arg.content.length > 200 && (
        <button
          onClick={onExpand}
          className={cn(
            'self-start flex items-center gap-1 text-[11px] font-mono transition-colors',
            isFor ? 'text-for-500 hover:text-for-300' : 'text-against-500 hover:text-against-300'
          )}
        >
          <ChevronDown
            className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')}
          />
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      {/* Source */}
      {arg.source_url && (
        <a
          href={arg.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-surface-300 transition-colors w-fit"
        >
          <ExternalLink className="h-2.5 w-2.5" />
          Source
        </a>
      )}

      {/* Author */}
      {arg.author && (
        <Link
          href={`/profile/${arg.author.username}`}
          className="flex items-center gap-2 mt-auto pt-2 border-t border-surface-300/30 hover:opacity-80 transition-opacity"
        >
          <Avatar
            src={arg.author.avatar_url}
            fallback={displayName}
            size="xs"
          />
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-mono text-surface-300 truncate">
              {arg.author.display_name ?? arg.author.username}
            </span>
            <span className="text-[10px] font-mono text-surface-500">
              @{arg.author.username}
            </span>
          </div>
        </Link>
      )}
    </motion.div>
  )
}

// ─── Crossfire card ────────────────────────────────────────────────────────────

function CrossfireCard({ entry }: { entry: CrossfireEntry }) {
  const [expandedSide, setExpandedSide] = useState<'for' | 'against' | null>(null)
  const heat = heatLabel(entry.controversy_score)
  const forPct = Math.round(entry.blue_pct)
  const againstPct = 100 - forPct
  const catColor = CATEGORY_COLOR[entry.topic_category ?? ''] ?? 'text-surface-400'

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-100 border border-surface-300 rounded-2xl overflow-hidden"
    >
      {/* Topic header */}
      <div className="p-4 border-b border-surface-300/50">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {entry.topic_category && (
              <span className={cn('text-[11px] font-mono font-semibold uppercase tracking-wide', catColor)}>
                {entry.topic_category}
              </span>
            )}
            <span
              className={cn(
                'text-[10px] font-mono font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full',
                heat.color,
                'bg-surface-200 border border-surface-400/40'
              )}
            >
              {heat.label}
            </span>
            {entry.topic_status === 'voting' && (
              <Badge variant="active" className="text-[10px]">
                Voting
              </Badge>
            )}
          </div>
          <Link
            href={`/topic/${entry.topic_id}`}
            className="flex-shrink-0 flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-surface-200 transition-colors"
          >
            Open
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <p className="text-sm font-semibold text-surface-100 leading-snug mb-3">
          {entry.topic_statement}
        </p>

        {/* Vote split bar */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-surface-300 rounded-full overflow-hidden">
              <div
                className="h-full bg-for-500 rounded-full transition-all duration-700"
                style={{ width: `${forPct}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-for-400 font-semibold">{forPct}% FOR</span>
            <div className="flex items-center gap-1 text-surface-500">
              <Users className="h-3 w-3" />
              {entry.total_votes.toLocaleString()} votes
            </div>
            <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
          </div>
        </div>
      </div>

      {/* Argument duel */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Swords className="h-3.5 w-3.5 text-surface-500" />
          <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
            Battle of Ideas
          </span>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <ArgumentCard
            arg={entry.for_argument}
            side="for"
            expanded={expandedSide === 'for'}
            onExpand={() => setExpandedSide(expandedSide === 'for' ? null : 'for')}
          />

          {/* VS divider */}
          <div className="flex md:flex-col items-center justify-center gap-1 py-1 md:py-4">
            <div className="flex-1 h-px md:h-auto md:w-px bg-surface-400/30 md:flex-none md:h-8" />
            <span className="text-[11px] font-mono font-bold text-surface-500 px-1">VS</span>
            <div className="flex-1 h-px md:h-auto md:w-px bg-surface-400/30 md:flex-none md:h-8" />
          </div>

          <ArgumentCard
            arg={entry.against_argument}
            side="against"
            expanded={expandedSide === 'against'}
            onExpand={() => setExpandedSide(expandedSide === 'against' ? null : 'against')}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500">
          <Scale className="h-3 w-3" />
          <span>Controversy {Math.round(entry.controversy_score)}%</span>
        </div>
        <Link
          href={`/topic/${entry.topic_id}`}
          className="text-[11px] font-mono text-for-500 hover:text-for-300 transition-colors flex items-center gap-1"
        >
          Read full debate
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.article>
  )
}

// ─── Skeleton loader ───────────────────────────────────────────────────────────

function CrossfireSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="bg-surface-100 border border-surface-300 rounded-2xl overflow-hidden"
        >
          <div className="p-4 border-b border-surface-300/50 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-2 w-full" />
          </div>
          <div className="p-4 flex gap-3">
            <div className="flex-1 space-y-2 rounded-xl border border-surface-300 p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="flex items-center justify-center w-8">
              <Skeleton className="h-4 w-6" />
            </div>
            <div className="flex-1 space-y-2 rounded-xl border border-surface-300 p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CrossfirePage() {
  const [entries, setEntries] = useState<CrossfireEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory] = useState('All')

  const fetchCrossfire = useCallback(async (cat: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({ limit: '12' })
      if (cat !== 'All') params.set('category', cat)
      const res = await fetch(`/api/crossfire?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data: CrossfireResponse = await res.json()
      setEntries(data.entries)
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchCrossfire(category)
  }, [category, fetchCrossfire])

  function handleCategoryChange(cat: string) {
    setCategory(cat)
  }

  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-20">
        {/* Hero */}
        <div className="px-4 pt-4 pb-3 border-b border-surface-300/50">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-for-500/30 to-against-500/30 border border-surface-400/40 flex items-center justify-center">
                <Swords className="h-4 w-4 text-surface-200" />
              </div>
              <div>
                <h1 className="text-base font-bold font-mono text-surface-100">
                  The Crossfire
                </h1>
                <p className="text-[11px] font-mono text-surface-500">
                  Battle of Ideas
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchCrossfire(category, true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-200 transition-colors disabled:opacity-50"
              aria-label="Refresh crossfire"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
          <p className="text-xs font-mono text-surface-500 mt-2">
            The most contested debates right now — the sharpest FOR vs AGAINST arguments, head-to-head.
          </p>

          {/* Heat legend */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {[
              { label: 'Deadlock', color: 'text-against-400', range: '90–100%' },
              { label: 'Fierce', color: 'text-gold', range: '75–89%' },
              { label: 'Contested', color: 'text-for-400', range: '60–74%' },
            ].map(({ label, color, range }) => (
              <div key={label} className="flex items-center gap-1">
                <Flame className={cn('h-3 w-3', color)} />
                <span className={cn('text-[10px] font-mono font-semibold', color)}>
                  {label}
                </span>
                <span className="text-[10px] font-mono text-surface-600">{range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category filter */}
        <div
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 border-b border-surface-300/40',
            'overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
          )}
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              aria-pressed={category === cat}
              className={cn(
                'flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border transition-all',
                category === cat
                  ? 'bg-for-600/80 text-white border-for-600'
                  : 'bg-transparent text-surface-500 border-surface-500/30 hover:text-surface-300 hover:border-surface-400'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-4 py-4 space-y-4">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <CrossfireSkeleton />
              </motion.div>
            ) : entries.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <EmptyState
                  icon={Swords}
                  title="No battles found"
                  description={
                    category === 'All'
                      ? 'No closely contested topics with arguments on both sides yet. Check back soon.'
                      : `No contested ${category} debates with arguments on both sides right now.`
                  }
                />
              </motion.div>
            ) : (
              <motion.div
                key={`entries-${category}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Stats bar */}
                <div className="flex items-center gap-4 text-[11px] font-mono text-surface-500 pb-1">
                  <div className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-for-500" />
                    <span>{entries.length} active battles</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Scale className="h-3 w-3 text-gold" />
                    <span>
                      {entries.filter((e) => e.for_argument && e.against_argument).length} fully matched
                    </span>
                  </div>
                </div>

                {entries.map((entry) => (
                  <CrossfireCard key={entry.topic_id} entry={entry} />
                ))}

                <div className="text-center py-6">
                  <Link
                    href="/split"
                    className="inline-flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-surface-200 transition-colors"
                  >
                    <Scale className="h-3.5 w-3.5" />
                    See all contested topics
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
