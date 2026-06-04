'use client'

/**
 * /epicenter — The Civic Epicenter
 *
 * Ranks topics by their centrality in the civic knowledge graph:
 * a weighted score of wiki-link connectivity (in + out), argument depth,
 * vote volume, and view count. The higher the score, the more the whole
 * civic discourse orbits around that topic.
 *
 * Distinct from:
 *   /connections  — the raw wiki-link graph for a single topic
 *   /galaxy       — 3-D topic universe (visual, not ranked)
 *   /nexus        — topics connecting multiple civic chains
 *   /correlations — topics that share the same voters (not wiki links)
 *   /tipping-point — proximity to the 75% law threshold (not connectivity)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Crown,
  ExternalLink,
  GitMerge,
  Globe,
  Link2,
  MessageSquare,
  Network,
  RefreshCw,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  EpicenterResponse,
  EpicenterTopic,
  EpicenterStats,
} from '@/app/api/epicenter/route'

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30'     },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Ethics:      { text: 'text-against-300', bg: 'bg-against-600/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-indigo-400',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30'  },
  Culture:     { text: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/30'  },
  Health:      { text: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/30'    },
  Environment: { text: 'text-green-400',   bg: 'bg-green-500/10',   border: 'border-green-500/30'   },
  Education:   { text: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30'    },
}

function cat(c: string | null) {
  return CAT_COLORS[c ?? ''] ?? { text: 'text-surface-500', bg: 'bg-surface-200', border: 'border-surface-300' }
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-400' },
  active:   { label: 'Active',   color: 'text-for-400'     },
  voting:   { label: 'Voting',   color: 'text-gold'        },
  law:      { label: 'Law',      color: 'text-emerald'     },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function scoreBar(score: number) {
  const pct = Math.round(score * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-for-500 via-purple to-gold"
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
      <span className="text-xs font-mono text-surface-500 w-8 text-right">{pct}</span>
    </div>
  )
}

function crownColor(rank: number) {
  if (rank === 1) return 'text-gold'
  if (rank === 2) return 'text-surface-400'
  return 'text-amber-600'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EpicenterSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      {/* Crown cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-52 rounded-2xl" />
        ))}
      </div>
      {/* List */}
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  )
}

// ─── Crown card (top 3) ───────────────────────────────────────────────────────

function CrownCard({ topic, delay }: { topic: EpicenterTopic; delay: number }) {
  const c  = cat(topic.category)
  const st = STATUS_LABEL[topic.status] ?? { label: topic.status, color: 'text-surface-400' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={cn(
        'relative flex flex-col gap-3 p-5 rounded-2xl border',
        'bg-surface-100 hover:bg-surface-200 transition-colors group',
        topic.rank === 1 ? 'border-gold/40 ring-1 ring-gold/20' : 'border-surface-300',
      )}
    >
      {/* Rank crown */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Crown className={cn('h-4 w-4 flex-shrink-0', crownColor(topic.rank))} />
          <span className={cn('text-xs font-mono font-bold', crownColor(topic.rank))}>
            #{topic.rank}
          </span>
        </div>
        <span className={cn('text-xs font-mono', st.color)}>{st.label}</span>
      </div>

      {/* Statement */}
      <p className="text-sm font-medium text-white leading-snug line-clamp-3 flex-1">
        {topic.statement}
      </p>

      {/* Category */}
      {topic.category && (
        <span className={cn('text-xs font-mono', c.text)}>{topic.category}</span>
      )}

      {/* Network stats */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-surface-300">
        <div className="text-center">
          <p className="text-sm font-bold font-mono text-white">{topic.total_links}</p>
          <p className="text-[10px] font-mono text-surface-500">Links</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold font-mono text-white">{topic.argument_count}</p>
          <p className="text-[10px] font-mono text-surface-500">Args</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold font-mono text-white">{fmtNum(topic.total_votes)}</p>
          <p className="text-[10px] font-mono text-surface-500">Votes</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="space-y-1">
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">Epicenter Score</p>
        {scoreBar(topic.epicenter_score)}
      </div>

      {/* Link */}
      <Link
        href={`/topic/${topic.id}`}
        className="absolute inset-0 rounded-2xl"
        aria-label={`View ${topic.statement}`}
      />
    </motion.div>
  )
}

// ─── Row (rank 4–25) ──────────────────────────────────────────────────────────

function EpicenterRow({ topic, index }: { topic: EpicenterTopic; index: number }) {
  const c  = cat(topic.category)
  const st = STATUS_LABEL[topic.status] ?? { label: topic.status, color: 'text-surface-400' }
  const forPct     = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className="relative flex items-center gap-4 p-4 rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 transition-colors group"
    >
      {/* Rank */}
      <div className="w-7 flex-shrink-0 text-center">
        <span className="text-sm font-mono font-bold text-surface-500">
          {topic.rank}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium text-white leading-snug line-clamp-2">
          {topic.statement}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          {topic.category && (
            <span className={cn('text-xs font-mono', c.text)}>{topic.category}</span>
          )}
          <span className={cn('text-xs font-mono', st.color)}>{st.label}</span>
        </div>
      </div>

      {/* Network indicators */}
      <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
        {/* Links */}
        <div className="text-center w-14">
          <div className="flex items-center justify-center gap-1">
            <Link2 className="h-3 w-3 text-for-400" />
            <span className="text-sm font-mono font-bold text-white">{topic.total_links}</span>
          </div>
          <p className="text-[10px] font-mono text-surface-500 mt-0.5">links</p>
        </div>

        {/* Arguments */}
        <div className="text-center w-14">
          <div className="flex items-center justify-center gap-1">
            <MessageSquare className="h-3 w-3 text-purple" />
            <span className="text-sm font-mono font-bold text-white">{topic.argument_count}</span>
          </div>
          <p className="text-[10px] font-mono text-surface-500 mt-0.5">args</p>
        </div>

        {/* Votes with split */}
        <div className="text-center w-20">
          <div className="flex items-center justify-center gap-0.5 text-xs font-mono">
            <span className="text-for-400">{forPct}%</span>
            <span className="text-surface-500">/</span>
            <span className="text-against-400">{againstPct}%</span>
          </div>
          <p className="text-[10px] font-mono text-surface-500 mt-0.5">{fmtNum(topic.total_votes)} votes</p>
        </div>

        {/* Score */}
        <div className="w-24">
          {scoreBar(topic.epicenter_score)}
        </div>
      </div>

      {/* Mobile: compact stats */}
      <div className="sm:hidden flex-shrink-0 flex flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          <Link2 className="h-3 w-3 text-for-400" />
          <span className="text-xs font-mono text-white">{topic.total_links}</span>
        </div>
        <div className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3 text-purple" />
          <span className="text-xs font-mono text-white">{topic.argument_count}</span>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-700 flex-shrink-0 hidden sm:block" />

      <Link
        href={`/topic/${topic.id}`}
        className="absolute inset-0 rounded-xl"
        aria-label={`View ${topic.statement}`}
      />
    </motion.div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: EpicenterStats }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'Topics Analysed', value: stats.topics_analyzed, icon: Globe,        color: 'text-for-400'  },
        { label: 'Wiki Links',      value: stats.total_links,     icon: Network,       color: 'text-purple'   },
        { label: 'Arguments',       value: stats.total_arguments, icon: MessageSquare, color: 'text-gold'     },
      ].map(({ label, value, icon: Icon, color }) => (
        <div
          key={label}
          className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-surface-100 border border-surface-300"
        >
          <Icon className={cn('h-4 w-4', color)} />
          <p className="text-lg font-bold font-mono text-white">
            <AnimatedNumber value={value} />
          </p>
          <p className="text-[10px] font-mono text-surface-500 text-center">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Category breakdown ───────────────────────────────────────────────────────

function CategoryBreakdown({ stats }: { stats: EpicenterStats }) {
  if (stats.category_breakdown.length === 0) return null

  return (
    <div className="p-4 rounded-xl border border-surface-300 bg-surface-100 space-y-3">
      <h3 className="text-xs font-mono text-surface-500 uppercase tracking-widest">
        Category Representation
      </h3>
      <div className="space-y-2">
        {stats.category_breakdown.map((c) => {
          const cc   = cat(c.category)
          const pct  = Math.round(c.avg_score * 100)
          return (
            <div key={c.category} className="flex items-center gap-3">
              <span className={cn('text-xs font-mono w-24 flex-shrink-0', cc.text)}>
                {c.category}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className={cn('h-full rounded-full', cc.bg.replace('bg-', 'bg-').replace('/10', '/60'))}
                  style={{ width: `${Math.max(4, pct)}%` }}
                />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs font-mono text-surface-400 w-5 text-right">{c.count}</span>
                <Link2 className="h-3 w-3 text-surface-600" />
                <span className="text-xs font-mono text-surface-500 w-10">
                  {c.avg_links.toFixed(1)} avg
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EpicenterClient() {
  const [data, setData]       = useState<EpicenterResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      const url = force ? '/api/epicenter?force=1' : '/api/epicenter'
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as EpicenterResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load epicenter data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const crown     = data?.epicenters.slice(0, 3) ?? []
  const rest      = data?.epicenters.slice(3)    ?? []
  const updatedAt = data?.updated_at ? new Date(data.updated_at).toLocaleTimeString() : null

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-4 pb-24 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 -ml-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-label="Back to home"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold text-white">
                <Network className="h-5 w-5 text-for-400" />
                The Civic Epicenter
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                The load-bearing topics of the Lobby — ranked by wiki connectivity, argument depth, and democratic weight
              </p>
            </div>
          </div>

          {/* Methodology pill */}
          <div className="ml-8 flex flex-wrap gap-2 text-[10px] font-mono text-surface-500">
            <span className="flex items-center gap-1">
              <Link2 className="h-3 w-3 text-for-400" />
              40% wiki links
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-purple" />
              30% arguments
            </span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3 text-gold" />
              20% votes
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald" />
              10% views
            </span>
          </div>
        </div>

        {/* ── Refresh ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          {updatedAt && (
            <p className="text-xs font-mono text-surface-600">Updated {updatedAt}</p>
          )}
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        {loading ? (
          <EpicenterSkeleton />
        ) : error ? (
          <div className="p-6 rounded-xl border border-against-500/30 bg-against-600/10 text-center space-y-2">
            <p className="text-sm text-against-300">{error}</p>
            <button
              onClick={() => load(true)}
              className="text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        ) : !data || data.epicenters.length === 0 ? (
          <EmptyState
            icon={Network}
            title="No epicenters yet"
            description="Epicenters form as topics accumulate wiki links, arguments, and votes. Come back once the Lobby has more activity."
            actions={[{ label: 'Explore Topics', href: '/topics' }]}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Stats bar */}
              <StatsBar stats={data.stats} />

              {/* Crown trio */}
              {crown.length > 0 && (
                <div>
                  <h2 className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Crown className="h-3.5 w-3.5 text-gold" />
                    Top Epicenters
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {crown.map((t, i) => (
                      <CrownCard key={t.id} topic={t} delay={i * 0.1} />
                    ))}
                  </div>
                </div>
              )}

              {/* Ranked list */}
              {rest.length > 0 && (
                <div>
                  <h2 className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <BarChart2 className="h-3.5 w-3.5 text-surface-500" />
                    Full Rankings
                  </h2>
                  <div className="space-y-2">
                    {rest.map((t, i) => (
                      <EpicenterRow key={t.id} topic={t} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* Category breakdown */}
              <CategoryBreakdown stats={data.stats} />

              {/* Explainer */}
              <div className="p-4 rounded-xl border border-surface-300 bg-surface-100 space-y-3">
                <h3 className="text-xs font-mono text-surface-500 uppercase tracking-widest flex items-center gap-1.5">
                  <GitMerge className="h-3.5 w-3.5" />
                  How Epicenter Score Works
                </h3>
                <div className="space-y-2 text-xs font-mono text-surface-400 leading-relaxed">
                  <p>
                    Each topic is scored on four dimensions, normalised across all active topics to a 0–100 scale:
                  </p>
                  <ul className="space-y-1.5 ml-2">
                    <li className="flex items-start gap-2">
                      <Link2 className="h-3 w-3 text-for-400 mt-0.5 flex-shrink-0" />
                      <span><span className="text-white">Wiki Links (40%)</span> — total incoming + outgoing [[wikilinks]] in topic descriptions. A topic referenced by many others is a pivot point.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <MessageSquare className="h-3 w-3 text-purple mt-0.5 flex-shrink-0" />
                      <span><span className="text-white">Arguments (30%)</span> — number of distinct FOR/AGAINST arguments. Deep debate = deeper civic importance.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ThumbsUp className="h-3 w-3 text-gold mt-0.5 flex-shrink-0" />
                      <span><span className="text-white">Votes (20%)</span> — total democratic participation. High vote counts confirm the community considers this topic significant.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <TrendingUp className="h-3 w-3 text-emerald mt-0.5 flex-shrink-0" />
                      <span><span className="text-white">Views (10%)</span> — page views signal latent interest even from non-voters.</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Related pages */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { href: '/topic/graph', label: 'Law Graph',    icon: GitMerge, desc: 'Visual link map' },
                  { href: '/correlations', label: 'Correlations', icon: Network,  desc: 'Voter overlap'   },
                  { href: '/connections',  label: 'Connections',  icon: Link2,    desc: 'Per-topic links' },
                  { href: '/ripple',       label: 'Ripple Effect',icon: Zap,      desc: 'Verdict ripples' },
                ].map(({ href, label, icon: Icon, desc }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3 p-3 rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 transition-colors"
                  >
                    <Icon className="h-4 w-4 text-surface-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white">{label}</p>
                      <p className="text-[10px] font-mono text-surface-500">{desc}</p>
                    </div>
                    <ExternalLink className="h-3 w-3 text-surface-600 ml-auto flex-shrink-0" />
                  </Link>
                ))}
              </div>

            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
