'use client'

/**
 * /whispers — The Civic Whisper Board
 *
 * Surfaces topics where the Lobby votes in near-total silence — high vote
 * counts but almost no arguments. These are the platform's "unspoken truths":
 * positions so obvious, so uncomfortable, or so culturally taboo that people
 * vote their conscience without publicly defending it.
 *
 * Tiers:
 *   Sacred Cow    — >80% one-sided, ≥200 silence score: taboo to challenge
 *   Universal Truth — >70% one-sided, ≥100 silence score: everyone knows
 *   The Uncomfortable — 55–70% one-sided, ≥50 silence score: felt but unspoken
 *   Elephant in Room — near-balanced, ≥20 silence score: the thing no one argues
 *
 * Silence Score = total_votes / (arg_count + 1)
 *
 * Distinct from:
 *   /gravity        — measures overall debate intensity (both high and low)
 *   /friction       — topics stuck in permanent deadlock
 *   /drought        — topics with recent low engagement (any kind)
 *   /accord         — near-unanimous topics (doesn't filter by argument count)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Eye,
  EyeOff,
  FlaskConical,
  Gavel,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Loader2,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  VolumeX,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { WhisperResponse, WhisperTopic, CategoryWhispers, WhisperTier } from '@/app/api/whispers/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 30 * 60 * 1000 // 30 min

const TIER_CONFIG: Record<
  WhisperTier,
  { label: string; color: string; bg: string; border: string; description: string }
> = {
  sacred_cow: {
    label: 'Sacred Cow',
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    description: 'So one-sided that arguing the other side is socially taboo',
  },
  universal_truth: {
    label: 'Universal Truth',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    description: 'Strong consensus — people vote without needing to defend it',
  },
  uncomfortable: {
    label: 'The Uncomfortable',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    description: 'People feel strongly but prefer not to say why publicly',
  },
  elephant: {
    label: 'Elephant in Room',
    color: 'text-surface-400',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
    description: 'The debate no one wants to have — so no one does',
  },
}

const CAT_CONFIG: Record<string, { icon: typeof Landmark; color: string }> = {
  Economics:   { icon: TrendingUp,    color: 'text-gold' },
  Politics:    { icon: Landmark,      color: 'text-for-400' },
  Technology:  { icon: Cpu,           color: 'text-purple' },
  Science:     { icon: FlaskConical,  color: 'text-emerald' },
  Ethics:      { icon: Scale,         color: 'text-against-300' },
  Health:      { icon: Heart,         color: 'text-against-300' },
  Environment: { icon: Leaf,          color: 'text-emerald' },
  Education:   { icon: GraduationCap, color: 'text-purple' },
  Culture:     { icon: Music2,        color: 'text-gold' },
  Philosophy:  { icon: Scale,         color: 'text-sky-400' },
}

// ─── Silence bar ──────────────────────────────────────────────────────────────

function SilenceBar({ blue_pct }: { blue_pct: number }) {
  const pct = Math.round(blue_pct)
  return (
    <div className="h-1 rounded-full overflow-hidden bg-surface-400/30 flex">
      <div
        className="h-full bg-for-500 transition-all"
        style={{ width: `${pct}%` }}
      />
      <div
        className="h-full bg-against-500 transition-all"
        style={{ width: `${100 - pct}%` }}
      />
    </div>
  )
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function TopicRow({ topic, rank }: { topic: WhisperTopic; rank: number }) {
  const tier = TIER_CONFIG[topic.tier]
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.02, duration: 0.25 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className="block rounded-2xl bg-surface-200/60 border border-surface-300/50 p-4
                   hover:border-surface-400/70 hover:bg-surface-200/90 transition-all group"
      >
        {/* Header: rank + tier badge */}
        <div className="flex items-start gap-3 mb-3">
          <span className="text-xs font-mono text-surface-600 w-5 shrink-0 pt-0.5">
            {rank}
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-md border',
                  tier.bg,
                  tier.border,
                  tier.color,
                )}
              >
                <VolumeX className="h-2.5 w-2.5" />
                {tier.label}
              </span>
              {topic.category && (
                <span className="text-[10px] font-mono text-surface-500">{topic.category}</span>
              )}
            </div>

            <p className="text-sm font-semibold text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-2">
              {topic.statement}
            </p>
          </div>
        </div>

        {/* Vote bar */}
        <SilenceBar blue_pct={topic.blue_pct} />

        {/* Metrics row */}
        <div className="flex items-center gap-4 mt-2.5 text-[11px] font-mono">
          <div className="flex items-center gap-1 text-for-400">
            <ThumbsUp className="h-3 w-3" />
            <span>{forPct}%</span>
          </div>
          <div className="flex items-center gap-1 text-against-400">
            <ThumbsDown className="h-3 w-3" />
            <span>{againstPct}%</span>
          </div>
          <div className="flex items-center gap-1 text-surface-500">
            <Users className="h-3 w-3" />
            <span>{topic.total_votes.toLocaleString()} votes</span>
          </div>
          <div className={cn(
            'flex items-center gap-1',
            topic.arg_count === 0 ? 'text-against-400' : 'text-surface-500',
          )}>
            <MessageSquare className="h-3 w-3" />
            <span>{topic.arg_count === 0 ? 'no arguments' : `${topic.arg_count} arg${topic.arg_count === 1 ? '' : 's'}`}</span>
          </div>
          <div className="ml-auto flex items-center gap-1 text-surface-600">
            <EyeOff className="h-3 w-3" />
            <span>{Math.round(topic.silence_score)}×</span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({ cat }: { cat: CategoryWhispers }) {
  const config = CAT_CONFIG[cat.category] ?? { icon: BarChart2, color: 'text-surface-400' }
  const Icon = config.icon

  return (
    <div className="rounded-2xl bg-surface-200/60 border border-surface-300/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', config.color)} />
        <span className="text-sm font-semibold text-white">{cat.category}</span>
        <span className="text-xs font-mono text-surface-500 ml-auto">{cat.topic_count} whispers</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <div className="space-y-0.5">
          <p className="text-surface-500">Avg silence</p>
          <p className="text-white font-semibold">{cat.avg_silence}×</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-surface-500">Sacred cows</p>
          <p className={cn('font-semibold', cat.sacred_cow_count > 0 ? 'text-against-300' : 'text-surface-600')}>
            {cat.sacred_cow_count}
          </p>
        </div>
        <div className="space-y-0.5">
          <p className="text-surface-500">Total votes</p>
          <p className="text-white font-semibold">{cat.total_votes.toLocaleString()}</p>
        </div>
      </div>

      {cat.quietest && (
        <Link
          href={`/topic/${cat.quietest.id}`}
          className="block text-[11px] font-mono text-surface-400 hover:text-for-300 transition-colors line-clamp-2"
        >
          <span className="text-surface-600">Quietest: </span>
          {cat.quietest.statement}
        </Link>
      )}
    </div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="rounded-2xl bg-surface-200/60 border border-surface-300/50 p-4 text-center">
      <p className={cn('text-xl font-black tabular-nums', color)}>{value}</p>
      <p className="text-[11px] font-mono text-surface-500 mt-1">{label}</p>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab = 'topics' | 'categories'
type TierFilter = 'all' | WhisperTier

export function WhispersClient() {
  const [data, setData] = useState<WhisperResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<Tab>('topics')
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [showFilters, setShowFilters] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/whispers')
      if (!res.ok) throw new Error('fetch failed')
      const json: WhisperResponse = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    timerRef.current = setTimeout(() => load(true), REFRESH_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [load])

  const filteredTopics = data?.topics.filter((t) =>
    tierFilter === 'all' ? true : t.tier === tierFilter,
  ) ?? []

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24 space-y-6">

        {/* Back + title */}
        <div className="flex items-center gap-3">
          <Link
            href="/trending"
            className="p-2 rounded-xl bg-surface-200/60 border border-surface-300/50 text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              <VolumeX className="h-5 w-5 text-surface-500" />
              Civic Whisper Board
            </h1>
            <p className="text-xs font-mono text-surface-500">
              Where the Lobby votes in silence
            </p>
          </div>
          <button
            onClick={() => load()}
            disabled={loading}
            className="ml-auto p-2 rounded-xl bg-surface-200/60 border border-surface-300/50 text-surface-400 hover:text-white transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Intro explanation */}
        <div className="rounded-2xl bg-surface-200/40 border border-surface-300/40 p-4 text-xs font-mono text-surface-400 leading-relaxed">
          <p>
            <span className="text-white font-semibold">Silence Score</span> = votes ÷ (arguments + 1).
            A score of 100 means 100 people voted for every 1 argument written.
            These topics reveal what the Lobby feels but won&apos;t publicly debate.
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <EmptyState
            icon={VolumeX}
            title="Failed to load whispers"
            description="Could not fetch silence data."
            action={{ label: 'Try again', onClick: () => load() }}
          />
        )}

        {/* Content */}
        {!loading && !error && data && (
          <>
            {/* Stats tiles */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                label="Total Whispers"
                value={data.stats.total_whispers}
                color="text-white"
              />
              <StatTile
                label="Sacred Cows"
                value={data.stats.sacred_cow_count}
                color="text-against-300"
              />
              <StatTile
                label="Avg Silence"
                value={`${data.stats.avg_silence_score}×`}
                color="text-surface-300"
              />
              <StatTile
                label="Quietest Category"
                value={data.stats.most_whispered_category ?? '—'}
                color="text-gold"
              />
            </div>

            {/* Loudest Silence highlight */}
            {data.stats.loudest_silence && (
              <Link
                href={`/topic/${data.stats.loudest_silence.id}`}
                className="block rounded-2xl border border-surface-400/40 bg-surface-200/60 p-4 hover:border-surface-400/70 transition-all group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
                    Loudest Silence
                  </span>
                  <span className="text-[10px] font-mono text-surface-600 ml-auto">
                    {data.stats.loudest_silence.total_votes.toLocaleString()} votes · 0 arguments
                  </span>
                </div>
                <p className="text-sm font-semibold text-white group-hover:text-for-300 transition-colors">
                  {data.stats.loudest_silence.statement}
                </p>
                <SilenceBar blue_pct={data.stats.loudest_silence.blue_pct} />
              </Link>
            )}

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl bg-surface-200/60 border border-surface-300/50 p-1">
              {(['topics', 'categories'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                    tab === t
                      ? 'bg-surface-300 text-white shadow-sm'
                      : 'text-surface-500 hover:text-surface-300',
                  )}
                >
                  {t === 'topics' ? 'By Silence' : 'By Category'}
                </button>
              ))}
            </div>

            {/* Topics tab */}
            {tab === 'topics' && (
              <>
                {/* Tier filter toggle */}
                <button
                  onClick={() => setShowFilters((s) => !s)}
                  className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  Filter by tier
                  {tierFilter !== 'all' && (
                    <span className={cn('ml-1 px-1.5 py-0.5 rounded text-[10px]', TIER_CONFIG[tierFilter].bg, TIER_CONFIG[tierFilter].color)}>
                      {TIER_CONFIG[tierFilter].label}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setTierFilter('all')}
                          className={cn(
                            'rounded-xl px-3 py-2 text-xs font-mono border transition-all text-left',
                            tierFilter === 'all'
                              ? 'bg-surface-300 border-surface-400 text-white'
                              : 'bg-surface-200/40 border-surface-300/40 text-surface-500 hover:text-white',
                          )}
                        >
                          All tiers
                        </button>
                        {(Object.keys(TIER_CONFIG) as WhisperTier[]).map((tier) => {
                          const cfg = TIER_CONFIG[tier]
                          return (
                            <button
                              key={tier}
                              onClick={() => setTierFilter(tier)}
                              className={cn(
                                'rounded-xl px-3 py-2 text-xs font-mono border transition-all text-left',
                                tierFilter === tier
                                  ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                                  : 'bg-surface-200/40 border-surface-300/40 text-surface-500 hover:text-white',
                              )}
                            >
                              <p className={cn('font-semibold', cfg.color)}>{cfg.label}</p>
                              <p className="text-[10px] text-surface-600 mt-0.5 truncate">{cfg.description}</p>
                            </button>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {filteredTopics.length === 0 ? (
                  <EmptyState
                    icon={Eye}
                    title="No whispers found"
                    description={
                      tierFilter !== 'all'
                        ? `No topics in the "${TIER_CONFIG[tierFilter].label}" tier.`
                        : 'No topics with high silence scores right now.'
                    }
                    action={tierFilter !== 'all' ? { label: 'Show all', onClick: () => setTierFilter('all') } : undefined}
                  />
                ) : (
                  <div className="space-y-2">
                    {filteredTopics.map((topic, i) => (
                      <TopicRow key={topic.id} topic={topic} rank={i + 1} />
                    ))}
                    <p className="text-center text-[10px] font-mono text-surface-700 py-2">
                      Showing {filteredTopics.length} whispered topic{filteredTopics.length === 1 ? '' : 's'}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Categories tab */}
            {tab === 'categories' && (
              <>
                {data.categories.length === 0 ? (
                  <EmptyState
                    icon={BarChart2}
                    title="No category data"
                    description="Category breakdown will appear as data accumulates."
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.categories.map((cat) => (
                      <CategoryCard key={cat.category} cat={cat} />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Tier legend */}
            <div className="rounded-2xl bg-surface-200/40 border border-surface-300/30 p-4 space-y-3">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">Tier Guide</p>
              <div className="space-y-2">
                {(Object.entries(TIER_CONFIG) as [WhisperTier, typeof TIER_CONFIG[WhisperTier]][]).map(([key, cfg]) => (
                  <div key={key} className="flex items-start gap-2">
                    <span
                      className={cn(
                        'inline-block text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0',
                        cfg.bg,
                        cfg.border,
                        cfg.color,
                      )}
                    >
                      {cfg.label}
                    </span>
                    <p className="text-[11px] font-mono text-surface-500">{cfg.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Related pages */}
            <div className="rounded-2xl bg-surface-200/40 border border-surface-300/30 p-4">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">Related Insights</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { label: 'Gravity Index', href: '/gravity', desc: 'Debate magnetism' },
                  { label: 'The Accord', href: '/accord', desc: 'Near-unanimous topics' },
                  { label: 'Friction Index', href: '/friction', desc: 'Stuck controversies' },
                  { label: 'Civic Schism', href: '/schism', desc: 'Deepest divides' },
                  { label: 'Common Ground', href: '/common-ground', desc: 'Consensus forming' },
                  { label: 'Tipping Point', href: '/tipping-point', desc: 'Near 50/50 topics' },
                ].map(({ label, href, desc }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors group"
                  >
                    <ArrowRight className="h-3 w-3 text-surface-600 group-hover:text-for-400 transition-colors shrink-0" />
                    <span>
                      <span className="block text-white group-hover:text-for-300 font-semibold transition-colors">{label}</span>
                      <span className="text-[10px]">{desc}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Generated at */}
            {data.generated_at && (
              <p className="text-center text-[10px] font-mono text-surface-700">
                Computed at {new Date(data.generated_at).toLocaleTimeString()} · refreshes every 30 min
              </p>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
