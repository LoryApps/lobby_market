'use client'

/**
 * /catalyst — The Civic Catalyst
 *
 * Ranks topics by the number of other topics that reference them via wiki
 * [[wikilinks]]. High inbound-link count means other debates are building on
 * or reacting to this topic — it's a load-bearing idea that triggered a chain
 * reaction in civic discourse.
 *
 * Distinct from:
 *   /epicenter    — weighted multi-metric centrality (in+out links, args, votes)
 *   /connections  — raw link graph for a single topic
 *   /legacy       — impact of resolved topics on the broader canon
 *   /nexus        — topics that bridge multiple civic chains
 *   /surge        — currently accelerating topics (momentum, not influence)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Flame,
  GitMerge,
  Globe,
  Link2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Zap,
  Crown,
  ChevronDown,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CatalystTopic, CatalystResponse } from '@/app/api/catalyst/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-amber-400',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
  Justice: 'text-against-300',
  Immigration: 'text-surface-400',
}

const CATEGORY_BG: Record<string, string> = {
  Economics: 'bg-gold/10 border-gold/20',
  Politics: 'bg-for-500/10 border-for-500/20',
  Technology: 'bg-purple/10 border-purple/20',
  Science: 'bg-emerald/10 border-emerald/20',
  Ethics: 'bg-against-500/10 border-against-500/20',
  Philosophy: 'bg-purple/10 border-purple/20',
  Culture: 'bg-amber-500/10 border-amber-500/20',
  Health: 'bg-emerald/10 border-emerald/20',
  Environment: 'bg-emerald/10 border-emerald/20',
  Education: 'bg-for-300/10 border-for-300/20',
  Justice: 'bg-against-300/10 border-against-300/20',
  Immigration: 'bg-surface-400/10 border-surface-400/20',
}

function catColor(c: string | null): string {
  if (!c) return 'text-surface-400'
  for (const [k, v] of Object.entries(CATEGORY_COLORS)) {
    if (c.toLowerCase().includes(k.toLowerCase())) return v
  }
  return 'text-surface-400'
}

function catBg(c: string | null): string {
  if (!c) return 'bg-surface-200 border-surface-300'
  for (const [k, v] of Object.entries(CATEGORY_BG)) {
    if (c.toLowerCase().includes(k.toLowerCase())) return v
  }
  return 'bg-surface-200 border-surface-300'
}

// ─── Status badge variant ─────────────────────────────────────────────────────

type BadgeVariant = 'proposed' | 'active' | 'law' | 'failed'

function statusVariant(status: string): BadgeVariant {
  if (status === 'law') return 'law'
  if (status === 'active' || status === 'voting') return 'active'
  if (status === 'failed') return 'failed'
  return 'proposed'
}

// ─── Rank medal ───────────────────────────────────────────────────────────────

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-gold" />
  if (rank === 2) return <span className="text-sm font-black text-surface-300">#2</span>
  if (rank === 3) return <span className="text-sm font-black text-surface-400">#3</span>
  return <span className="text-xs font-mono text-surface-500">#{rank}</span>
}

// ─── Top 3 Podium Cards ───────────────────────────────────────────────────────

function PodiumCard({ topic, delay }: { topic: CatalystTopic; delay: number }) {
  const isFirst = topic.rank === 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Link href={`/topic/${topic.id}`} className="block group">
        <div
          className={cn(
            'rounded-2xl border p-5 transition-all duration-200 group-hover:scale-[1.02]',
            isFirst
              ? 'border-gold/40 bg-gold/5 ring-1 ring-gold/20'
              : 'border-surface-300 bg-surface-100',
          )}
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                isFirst ? 'bg-gold/20' : 'bg-surface-200',
              )}
            >
              <RankMedal rank={topic.rank} />
            </div>
            <Badge variant={statusVariant(topic.status)} className="text-xs capitalize shrink-0">
              {topic.status}
            </Badge>
          </div>

          <p className="text-sm font-semibold text-surface-100 leading-snug line-clamp-3 mb-3">
            {topic.statement}
          </p>

          {topic.category && (
            <span className={cn('text-xs font-semibold uppercase tracking-widest', catColor(topic.category))}>
              {topic.category}
            </span>
          )}

          <div className="mt-4 flex items-center gap-3 text-xs text-surface-500">
            <span className="flex items-center gap-1">
              <Link2 className="h-3.5 w-3.5 text-for-400" />
              <span className="font-bold text-for-300">{topic.inbound_links}</span>
              {' '}cited by
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {topic.argument_count}
            </span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3.5 w-3.5" />
              {topic.total_votes.toLocaleString()}
            </span>
          </div>

          {topic.citing_topics.length > 0 && (
            <div className="mt-3 pt-3 border-t border-surface-300">
              <p className="text-[10px] text-surface-500 mb-1.5 uppercase tracking-wider font-semibold">
                Cited by
              </p>
              <div className="flex flex-col gap-1">
                {topic.citing_topics.slice(0, 3).map((ct) => (
                  <span
                    key={ct.id}
                    className="text-[11px] text-surface-400 truncate flex items-center gap-1.5"
                  >
                    <span
                      className={cn(
                        'inline-block h-1.5 w-1.5 rounded-full shrink-0',
                        ct.status === 'law'
                          ? 'bg-gold'
                          : ct.status === 'active' || ct.status === 'voting'
                          ? 'bg-for-500'
                          : 'bg-surface-400',
                      )}
                    />
                    {ct.statement}
                  </span>
                ))}
                {topic.citing_topics.length > 3 && (
                  <span className="text-[10px] text-surface-500">
                    +{topic.citing_topics.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── List Row ─────────────────────────────────────────────────────────────────

function CatalystRow({ topic, index }: { topic: CatalystTopic; index: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
    >
      <div className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden">
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-200 mt-0.5">
            <RankMedal rank={topic.rank} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <Link
                href={`/topic/${topic.id}`}
                className="text-sm font-semibold text-surface-100 hover:text-for-300 transition-colors line-clamp-2 leading-snug"
              >
                {topic.statement}
              </Link>
              <ExternalLink className="h-3.5 w-3.5 text-surface-500 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100" />
            </div>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {topic.category && (
                <span className={cn('text-[10px] font-bold uppercase tracking-wider', catColor(topic.category))}>
                  {topic.category}
                </span>
              )}
              <Badge variant={statusVariant(topic.status)} className="text-[10px] capitalize">
                {topic.status}
              </Badge>
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs text-surface-500">
              <span className="flex items-center gap-1">
                <Link2 className="h-3.5 w-3.5 text-for-400" />
                <span className="font-bold text-for-300">{topic.inbound_links}</span>
                {' '}citations
              </span>
              {topic.outbound_links > 0 && (
                <span className="flex items-center gap-1">
                  <GitMerge className="h-3.5 w-3.5 text-surface-500" />
                  {topic.outbound_links} refs
                </span>
              )}
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {topic.argument_count}
              </span>
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3.5 w-3.5" />
                {topic.total_votes.toLocaleString()}
              </span>
            </div>
          </div>

          {topic.citing_topics.length > 0 && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors"
            >
              <ChevronDown
                className={cn('h-4 w-4 text-surface-400 transition-transform', expanded && 'rotate-180')}
              />
            </button>
          )}
        </div>

        <AnimatePresence>
          {expanded && topic.citing_topics.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="border-t border-surface-300 px-4 py-3 bg-surface-50">
                <p className="text-[10px] text-surface-500 mb-2 uppercase tracking-wider font-semibold">
                  Referenced by {topic.inbound_links} topic{topic.inbound_links !== 1 ? 's' : ''}
                </p>
                <div className="flex flex-col gap-1.5">
                  {topic.citing_topics.map((ct) => (
                    <Link
                      key={ct.id}
                      href={`/topic/${ct.id}`}
                      className="flex items-start gap-2 group"
                    >
                      <span
                        className={cn(
                          'inline-block h-1.5 w-1.5 rounded-full shrink-0 mt-1.5',
                          ct.status === 'law'
                            ? 'bg-gold'
                            : ct.status === 'active' || ct.status === 'voting'
                            ? 'bg-for-500'
                            : 'bg-surface-400',
                        )}
                      />
                      <span className="text-xs text-surface-400 group-hover:text-surface-200 transition-colors line-clamp-1">
                        {ct.statement}
                      </span>
                      {ct.category && (
                        <span
                          className={cn(
                            'text-[10px] font-semibold uppercase shrink-0',
                            catColor(ct.category),
                          )}
                        >
                          {ct.category}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string | number
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-surface-300 bg-surface-100 px-4 py-3 text-center">
      <Icon className="h-4 w-4 text-surface-500" />
      <span className="text-lg font-black text-surface-100">{value}</span>
      <span className="text-[10px] text-surface-500 uppercase tracking-wider font-semibold">{label}</span>
    </div>
  )
}

// ─── Category filter chips ────────────────────────────────────────────────────

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap',
        active
          ? 'border-for-500 bg-for-500/15 text-for-300'
          : 'border-surface-300 bg-surface-100 text-surface-400 hover:border-surface-400 hover:text-surface-200',
      )}
    >
      {label}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type LoadState = 'idle' | 'loading' | 'loaded' | 'error'

export function CatalystClient() {
  const [state, setState] = useState<LoadState>('loading')
  const [data, setData] = useState<CatalystResponse | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const fetchData = useCallback((cat: string | null) => {
    setState('loading')
    const params = new URLSearchParams({ limit: '30' })
    if (cat) params.set('category', cat)
    fetch(`/api/catalyst?${params}`)
      .then((r) => r.json())
      .then((d: CatalystResponse) => {
        setData(d)
        setState('loaded')
      })
      .catch(() => setState('error'))
  }, [])

  useEffect(() => {
    fetchData(null)
  }, [fetchData])

  const handleCategory = (cat: string | null) => {
    setActiveCategory(cat)
    fetchData(cat)
  }

  const catalysts = data?.catalysts ?? []
  const stats = data?.stats
  const podium = catalysts.slice(0, 3)
  const rest = catalysts.slice(3)

  const categories = stats
    ? stats.category_breakdown.map((c) => c.category)
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href="/"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-400 bg-surface-200 hover:bg-surface-300 transition-colors mt-0.5"
          >
            <ArrowLeft className="h-4 w-4 text-surface-300" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-for-500/10 border border-for-500/20">
                <Zap className="h-5 w-5 text-for-400" />
              </div>
              <div>
                <h1 className="text-xl font-black text-surface-100 leading-none">The Civic Catalyst</h1>
                <p className="text-xs text-surface-500 mt-0.5">Which ideas triggered the most chain reactions?</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => fetchData(activeCategory)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-400 bg-surface-200 hover:bg-surface-300 transition-colors"
            disabled={state === 'loading'}
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-400', state === 'loading' && 'animate-spin')} />
          </button>
        </div>

        {/* Explainer */}
        <div className="flex items-start gap-3 rounded-xl border border-surface-300 bg-surface-100 p-4 mb-6 text-sm text-surface-400">
          <Link2 className="h-4 w-4 text-for-400 mt-0.5 shrink-0" />
          <p>
            Topics ranked by how many other debates reference them via wiki citations.
            A high citation count means this idea has become a <span className="text-surface-200 font-semibold">load-bearing concept</span> —
            the foundation other civic arguments build upon.
          </p>
        </div>

        {/* Stats */}
        {state === 'loading' ? (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatPill icon={Zap} label="Catalysts" value={stats.total_catalysts} />
            <StatPill icon={Link2} label="Total Links" value={stats.total_links.toLocaleString()} />
            <StatPill icon={Globe} label="Top Category" value={stats.most_catalytic_category ?? '—'} />
          </div>
        ) : null}

        {/* Category filter */}
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
            <CategoryChip
              label="All"
              active={activeCategory === null}
              onClick={() => handleCategory(null)}
            />
            {categories.map((cat) => (
              <CategoryChip
                key={cat}
                label={cat}
                active={activeCategory === cat}
                onClick={() => handleCategory(cat)}
              />
            ))}
          </div>
        )}

        {/* Loading skeletons */}
        {state === 'loading' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-52 rounded-2xl" />
              ))}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <EmptyState
            icon={Flame}
            title="Failed to load catalyst data"
            description="Could not fetch topic link data. Try refreshing."
            actions={[{ label: 'Retry', onClick: () => fetchData(activeCategory) }]}
          />
        )}

        {/* Content */}
        {state === 'loaded' && (
          <>
            {catalysts.length === 0 ? (
              <EmptyState
                icon={Link2}
                title="No catalysts yet"
                description="Topics with wiki citations will appear here as the knowledge graph grows."
              />
            ) : (
              <div className="space-y-8">
                {/* Podium */}
                {podium.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="h-4 w-4 text-gold" />
                      <h2 className="text-sm font-bold text-surface-300 uppercase tracking-wider">
                        Top Catalysts
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {podium.map((topic, i) => (
                        <PodiumCard key={topic.id} topic={topic} delay={i * 0.08} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Rest of the list */}
                {rest.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="h-4 w-4 text-surface-500" />
                      <h2 className="text-sm font-bold text-surface-300 uppercase tracking-wider">
                        Ranked by Influence
                      </h2>
                    </div>
                    <div className="space-y-3">
                      {rest.map((topic, i) => (
                        <CatalystRow key={topic.id} topic={topic} index={i} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Category breakdown */}
                {stats && stats.category_breakdown.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Globe className="h-4 w-4 text-surface-500" />
                      <h2 className="text-sm font-bold text-surface-300 uppercase tracking-wider">
                        By Category
                      </h2>
                    </div>
                    <div className="rounded-xl border border-surface-300 bg-surface-100 divide-y divide-surface-300">
                      {stats.category_breakdown.map((cat) => (
                        <button
                          key={cat.category}
                          onClick={() => handleCategory(activeCategory === cat.category ? null : cat.category)}
                          className="flex items-center gap-3 w-full px-4 py-3 hover:bg-surface-200 transition-colors text-left group"
                        >
                          <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', catBg(cat.category).split(' ')[0].replace('bg-', 'bg-').replace('/10', '/60'))} />
                          <span className={cn('text-sm font-semibold', catColor(cat.category))}>{cat.category}</span>
                          <div className="flex-1" />
                          <div className="flex items-center gap-4 text-xs text-surface-500">
                            <span>{cat.count} catalyst{cat.count !== 1 ? 's' : ''}</span>
                            <span className="flex items-center gap-1">
                              <Link2 className="h-3 w-3" />
                              ~{cat.avg_inbound} avg citations
                            </span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Footer note */}
                <p className="text-xs text-surface-600 text-center leading-relaxed">
                  Citation count reflects wiki <code className="text-[10px] bg-surface-200 px-1 py-0.5 rounded">[[wikilinks]]</code> in other topics&apos; descriptions.
                  Updated live as the civic knowledge graph evolves.
                </p>
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
