'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  ChevronDown,
  ChevronRight,
  Flame,
  GitFork,
  Loader2,
  RefreshCw,
  Tag,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TopicChain, TopicChainsResponse } from '@/app/api/topics/chains/route'

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

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

// ─── Config ────────────────────────────────────────────────────────────────────

type SortMode = 'votes' | 'depth' | 'recent'

const SORT_OPTIONS: { id: SortMode; label: string; icon: typeof TrendingUp }[] = [
  { id: 'votes', label: 'Most Voted', icon: TrendingUp },
  { id: 'depth', label: 'Longest Chain', icon: GitFork },
  { id: 'recent', label: 'Newest', icon: Flame },
]

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/20' },
  Economics:   { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/20' },
  Technology:  { text: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/20' },
  Science:     { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/20' },
  Ethics:      { text: 'text-against-300',  bg: 'bg-against-500/10',  border: 'border-against-500/20' },
  Philosophy:  { text: 'text-for-300',      bg: 'bg-for-400/10',      border: 'border-for-400/20' },
  Culture:     { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/20' },
  Health:      { text: 'text-against-300',  bg: 'bg-against-400/10',  border: 'border-against-400/20' },
  Environment: { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/20' },
  Education:   { text: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/20' },
}

function catColor(cat: string | null) {
  return CATEGORY_COLORS[cat ?? ''] ?? { text: 'text-surface-400', bg: 'bg-surface-300/10', border: 'border-surface-300/20' }
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed:  'proposed',
  active:    'active',
  voting:    'active',
  law:       'law',
  failed:    'failed',
  continued: 'proposed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed:  'Proposed',
  active:    'Active',
  voting:    'Voting',
  law:       'LAW',
  failed:    'Failed',
  continued: 'Continued',
}

// ─── Vote split bar ───────────────────────────────────────────────────────────

function VoteSplitBar({ bluePct, size = 'sm' }: { bluePct: number; size?: 'sm' | 'xs' }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  const h = size === 'xs' ? 'h-1' : 'h-1.5'
  return (
    <div className={cn('w-full rounded-full overflow-hidden bg-surface-400/20 flex', h)}>
      <div className="bg-for-500 rounded-l-full" style={{ width: `${forPct}%` }} />
      <div className="bg-against-500 rounded-r-full flex-1" />
      <span className="sr-only">{forPct}% for, {againstPct}% against</span>
    </div>
  )
}

// ─── Chain depth badge ────────────────────────────────────────────────────────

function DepthBadge({ depth }: { depth: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold',
        depth >= 3
          ? 'bg-gold/20 text-gold border border-gold/30'
          : depth === 2
          ? 'bg-purple/20 text-purple border border-purple/30'
          : 'bg-surface-300/40 text-surface-500 border border-surface-400/30',
      )}
    >
      <GitFork className="h-2.5 w-2.5" />
      {depth} step{depth !== 1 ? 's' : ''}
    </span>
  )
}

// ─── Chain connector label ────────────────────────────────────────────────────

function ConnectorLabel({ connector }: { connector: string | null }) {
  if (!connector) return null
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-widest',
        connector === 'but'
          ? 'bg-against-500/15 text-against-400 border border-against-500/20'
          : 'bg-for-500/15 text-for-400 border border-for-500/20',
      )}
    >
      …{connector}
    </span>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function ChainSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-surface-300/40 bg-surface-100 p-4 space-y-3"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="pl-11 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Chain card ───────────────────────────────────────────────────────────────

function ChainCard({ chain }: { chain: TopicChain }) {
  const [expanded, setExpanded] = useState(false)
  const cc = catColor(chain.category)
  const hasNodes = chain.nodes.length > 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden',
        'border-surface-300/50 hover:border-surface-400/70',
        'transition-colors duration-150',
      )}
    >
      {/* Root topic ── */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Category dot / icon */}
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0',
              cc.bg, cc.border, 'border',
            )}
            aria-hidden
          >
            <GitFork className={cn('h-4 w-4', cc.text)} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              {chain.category && (
                <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', cc.text)}>
                  {chain.category}
                </span>
              )}
              <Badge variant={STATUS_BADGE[chain.root.status] ?? 'proposed'} className="text-[9px]">
                {STATUS_LABEL[chain.root.status] ?? chain.root.status}
              </Badge>
              <DepthBadge depth={chain.depth} />
            </div>

            {/* Root statement */}
            <Link
              href={`/topic/${chain.root.id}`}
              className="group"
              aria-label={`View topic: ${chain.root.statement}`}
            >
              <p className="font-mono text-sm font-semibold text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-2">
                {chain.root.statement}
              </p>
            </Link>

            {/* Stats row */}
            <div className="mt-2 flex items-center gap-3 text-[11px] font-mono text-surface-500">
              <span className="flex items-center gap-1">
                <BarChart2 className="h-3 w-3" aria-hidden />
                {formatVotes(chain.total_votes)} votes total
              </span>
              <span>{chain.nodes.length + 1} topic{chain.nodes.length !== 0 ? 's' : ''}</span>
              <span>{relativeTime(chain.root.created_at)}</span>
            </div>

            {/* Root vote split */}
            <div className="mt-2">
              <VoteSplitBar bluePct={chain.root.blue_pct} size="sm" />
              <div className="flex justify-between mt-0.5">
                <span className="text-[10px] font-mono text-for-400">
                  {Math.round(chain.root.blue_pct)}% FOR
                </span>
                <span className="text-[10px] font-mono text-against-400">
                  {100 - Math.round(chain.root.blue_pct)}% AGAINST
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Expand toggle */}
        {hasNodes && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className={cn(
              'mt-3 w-full flex items-center justify-between gap-2',
              'px-3 py-2 rounded-xl',
              'text-xs font-mono text-surface-500',
              'bg-surface-200/60 hover:bg-surface-200 border border-surface-300/40',
              'transition-colors',
            )}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse chain' : 'Expand chain continuations'}
          >
            <span className="flex items-center gap-2">
              <GitFork className="h-3 w-3" />
              {chain.nodes.length} continuation{chain.nodes.length !== 1 ? 's' : ''}
            </span>
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      {/* Continuations list ── */}
      <AnimatePresence>
        {expanded && hasNodes && (
          <motion.div
            key="nodes"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-surface-300/40 divide-y divide-surface-300/20">
              {chain.nodes.map((node) => {
                const indent = node.chain_depth * 16
                return (
                  <div
                    key={node.id}
                    className="flex items-start gap-3 px-4 py-3 bg-surface-50/30 hover:bg-surface-100/50 transition-colors"
                    style={{ paddingLeft: `${16 + indent}px` }}
                  >
                    {/* Connector line visual */}
                    <div className="flex flex-col items-center flex-shrink-0 mt-1" aria-hidden>
                      <div className="w-px h-2 bg-surface-400/30" />
                      <div className="h-3 w-3 rounded-full border-2 border-surface-500/50 bg-surface-200 flex-shrink-0" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                        <ConnectorLabel connector={node.connector} />
                        <Badge variant={STATUS_BADGE[node.status] ?? 'proposed'} className="text-[9px]">
                          {STATUS_LABEL[node.status] ?? node.status}
                        </Badge>
                      </div>
                      <Link
                        href={`/topic/${node.id}`}
                        className="group"
                        aria-label={`View continuation: ${node.statement}`}
                      >
                        <p className="font-mono text-xs font-medium text-surface-700 group-hover:text-white transition-colors line-clamp-2 leading-relaxed">
                          {node.statement}
                        </p>
                      </Link>
                      <div className="mt-1 flex items-center gap-2">
                        <VoteSplitBar bluePct={node.blue_pct} size="xs" />
                        <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
                          {formatVotes(node.total_votes)}
                        </span>
                      </div>
                    </div>

                    <Link
                      href={`/topic/${node.id}`}
                      className="flex-shrink-0 mt-1 text-surface-500 hover:text-for-300 transition-colors"
                      aria-label="Go to topic"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer CTA for leaf node */}
      {!expanded && hasNodes && (
        <div className="px-4 pb-4 pt-0">
          <Link
            href={`/topic/${chain.nodes[chain.nodes.length - 1].id}`}
            className={cn(
              'flex items-center justify-between gap-2 px-3 py-2 rounded-xl',
              'text-xs font-mono text-surface-400 hover:text-white',
              'border border-surface-300/30 hover:border-for-500/30 bg-surface-200/30 hover:bg-for-500/5',
              'transition-all',
            )}
          >
            <span>View latest: {chain.nodes[chain.nodes.length - 1].statement.slice(0, 55)}…</span>
            <ArrowRight className="h-3.5 w-3.5 flex-shrink-0" />
          </Link>
        </div>
      )}
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ChainsPage() {
  const [chains, setChains] = useState<TopicChain[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortMode>('votes')
  const [category, setCategory] = useState('')
  const offset = chains.length

  const fetchChains = useCallback(async (
    sortMode: SortMode,
    cat: string,
    off: number,
    replace: boolean,
  ) => {
    if (replace) setLoading(true)
    else setLoadingMore(true)
    setError(null)

    try {
      const params = new URLSearchParams({ sort: sortMode, limit: '15', offset: String(off) })
      if (cat) params.set('category', cat)
      const res = await fetch(`/api/topics/chains?${params}`)
      if (!res.ok) throw new Error('Failed to load chains')
      const data: TopicChainsResponse = await res.json()
      setChains((prev) => replace ? data.chains : [...prev, ...data.chains])
      setTotal(data.total)
    } catch {
      setError('Could not load topic chains. Please try again.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchChains(sort, category, 0, true)
  }, [sort, category, fetchChains])

  function handleReset() {
    setSort('votes')
    setCategory('')
  }

  const hasMore = chains.length < total

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12" id="main-content">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple/10 border border-purple/30">
              <GitFork className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Topic Chains</h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Lineages of debate — how topics evolve through continuations
              </p>
            </div>
          </div>

          {total > 0 && !loading && (
            <p className="font-mono text-xs text-surface-500 mt-3">
              {total} chain{total !== 1 ? 's' : ''} found
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-3 mb-6">
          {/* Sort row */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex items-center gap-1 bg-surface-200/80 border border-surface-300 rounded-xl p-1 flex-shrink-0">
              {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSort(id)}
                  aria-pressed={sort === id}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                    sort === id
                      ? 'bg-purple/80 text-white shadow-sm'
                      : 'text-surface-500 hover:text-surface-300',
                  )}
                >
                  <Icon className="h-3 w-3 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Category chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <Tag className="h-3 w-3 text-surface-500 flex-shrink-0" />
            <button
              onClick={() => setCategory('')}
              aria-pressed={!category}
              className={cn(
                'flex-shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium border transition-all',
                !category
                  ? 'bg-surface-400 text-white border-surface-400'
                  : 'bg-transparent text-surface-500 border-surface-500/40 hover:text-surface-300',
              )}
            >
              All
            </button>
            {CATEGORIES.map((cat) => {
              const cc = catColor(cat)
              const active = category === cat
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(category === cat ? '' : cat)}
                  aria-pressed={active}
                  className={cn(
                    'flex-shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium border transition-all',
                    active
                      ? cn(cc.bg, cc.text, cc.border)
                      : 'bg-transparent text-surface-500 border-surface-500/40 hover:text-surface-300',
                  )}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <ChainSkeleton />
        ) : error ? (
          <EmptyState
            icon={GitFork}
            title="Could not load chains"
            description={error}
            actions={[{ label: 'Retry', onClick: () => fetchChains(sort, category, 0, true), icon: RefreshCw }]}
          />
        ) : chains.length === 0 ? (
          <EmptyState
            icon={GitFork}
            title="No chains yet"
            description={
              category
                ? `No topic chains found in ${category}. Try a different category.`
                : 'No topic chains have formed yet. Topics evolve into chains when continuations are proposed and voted on.'
            }
            actions={category ? [{ label: 'Clear filter', onClick: handleReset, icon: RefreshCw }] : []}
          />
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {chains.map((chain) => (
                <ChainCard key={chain.root.id} chain={chain} />
              ))}
            </AnimatePresence>

            {hasMore && (
              <button
                onClick={() => fetchChains(sort, category, offset, false)}
                disabled={loadingMore}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3 rounded-xl',
                  'font-mono text-sm text-surface-500 border border-surface-300/40',
                  'hover:border-purple/40 hover:text-white bg-surface-100/50 hover:bg-surface-100',
                  'transition-all disabled:opacity-50',
                )}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Load more chains ({total - chains.length} remaining)
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
