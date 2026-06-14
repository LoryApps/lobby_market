'use client'

/**
 * /issues — The Civic Issues Hub
 *
 * Groups all civic topics into 12 major policy issue areas — from Climate
 * to Criminal Justice — and shows the community's aggregate consensus on each.
 *
 * Unlike /categories (single-label grouping) or /tags (keyword search),
 * Issues synthesises consensus across multiple related tags and categories
 * to give a high-level read on where the platform stands on each major
 * policy domain.
 *
 * Distinct from:
 *   /categories  — groups by single category label
 *   /tags        — single keyword tag page
 *   /matrix      — cross-category correlation heatmap
 *   /accord      — near-unanimous consensus topics
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Minus,
  Building2,
  Cpu,
  GraduationCap,
  Globe,
  Gavel,
  Heart,
  Landmark,
  Leaf,
  Mic,
  RefreshCw,
  Scale,
  Shield,
  ThumbsUp,
  TrendingUp,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { IssueStat, IssuesResponse } from '@/app/api/issues/route'

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Leaf,
  TrendingUp,
  Vote,
  Cpu,
  Scale,
  Heart,
  GraduationCap,
  Globe,
  Mic,
  Building2,
  Shield,
  Landmark,
}

// ─── Color config ─────────────────────────────────────────────────────────────

interface ColorConfig {
  text: string
  bg: string
  border: string
  bar: string
  badge: string
}

const COLOR_MAP: Record<string, ColorConfig> = {
  emerald: {
    text: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    bar: 'bg-emerald',
    badge: 'bg-emerald/20 text-emerald',
  },
  gold: {
    text: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    bar: 'bg-gold',
    badge: 'bg-gold/20 text-gold',
  },
  for: {
    text: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    bar: 'bg-for-400',
    badge: 'bg-for-500/20 text-for-400',
  },
  purple: {
    text: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    bar: 'bg-purple',
    badge: 'bg-purple/20 text-purple',
  },
  against: {
    text: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    bar: 'bg-against-400',
    badge: 'bg-against-500/20 text-against-400',
  },
}

function getColor(colorKey: string): ColorConfig {
  return COLOR_MAP[colorKey] ?? COLOR_MAP['for']
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function consensusLabel(avgBluePct: number, strength: number): string {
  if (strength < 10) return 'Divided'
  if (avgBluePct > 50) {
    if (strength >= 60) return 'Strong FOR'
    if (strength >= 30) return 'Leaning FOR'
    return 'Slight FOR'
  } else {
    if (strength >= 60) return 'Strong AGAINST'
    if (strength >= 30) return 'Leaning AGAINST'
    return 'Slight AGAINST'
  }
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function IssueCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-200 border border-surface-300 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  )
}

// ─── Issue Card ───────────────────────────────────────────────────────────────

function IssueCard({ issue, index }: { issue: IssueStat; index: number }) {
  const Icon = ICON_MAP[issue.icon] ?? Scale
  const colors = getColor(issue.color)

  const forPct = Math.round(issue.avg_blue_pct)
  const againstPct = 100 - forPct
  const label = consensusLabel(issue.avg_blue_pct, issue.consensus_strength)
  const TrendIcon =
    issue.trending_direction === 'up'
      ? ArrowUp
      : issue.trending_direction === 'down'
      ? ArrowDown
      : Minus

  const trendColor =
    issue.trending_direction === 'up'
      ? 'text-for-400'
      : issue.trending_direction === 'down'
      ? 'text-against-400'
      : 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn(
        'rounded-2xl bg-surface-200 border p-5 flex flex-col gap-4',
        'hover:bg-surface-300/50 transition-colors',
        colors.border,
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn('flex items-center justify-center h-11 w-11 rounded-xl flex-shrink-0', colors.bg, 'border', colors.border)}>
          <Icon className={cn('h-5 w-5', colors.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-mono text-base font-bold text-white leading-tight">
              {issue.title}
            </h2>
            <div className={cn('flex items-center gap-1 text-[10px] font-mono font-medium', trendColor)}>
              <TrendIcon className="h-3 w-3" />
              <span className="capitalize">{issue.trending_direction}</span>
            </div>
          </div>
          <p className="text-xs font-mono text-surface-600 mt-0.5 leading-relaxed">
            {issue.description}
          </p>
        </div>
      </div>

      {/* Consensus bar */}
      {issue.topic_count > 0 ? (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-for-400 font-semibold">{forPct}% FOR</span>
              <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-mono font-bold', colors.badge)}>
                {label}
              </span>
              <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
            </div>
            <div className="relative h-2 rounded-full overflow-hidden bg-against-900/60">
              <div
                className="absolute left-0 top-0 h-full bg-for-400/80 transition-all duration-700 ease-out"
                style={{ width: `${forPct}%` }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-mono text-surface-500">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{formatVotes(issue.total_votes)} votes</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              <span>{issue.topic_count} topics</span>
            </div>
            {issue.active_count > 0 && (
              <div className="flex items-center gap-1 text-for-400">
                <span className="h-1.5 w-1.5 rounded-full bg-for-400 animate-pulse" />
                <span>{issue.active_count} active</span>
              </div>
            )}
            {issue.law_count > 0 && (
              <div className="flex items-center gap-1 text-gold">
                <Gavel className="h-3 w-3" />
                <span>{issue.law_count} {issue.law_count === 1 ? 'law' : 'laws'}</span>
              </div>
            )}
          </div>

          {/* Top topic snippet */}
          {issue.top_topic && (
            <Link
              href={`/topic/${issue.top_topic.id}`}
              className={cn(
                'block rounded-xl p-3 border transition-colors',
                'bg-surface-100/60 border-surface-300/60 hover:border-surface-400/60',
              )}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-mono text-surface-600 uppercase tracking-wide mb-1">
                    {issue.top_topic.status === 'law'
                      ? 'Recent law'
                      : issue.top_topic.status === 'voting'
                      ? 'In voting'
                      : 'Top debate'}
                  </p>
                  <p className="text-xs font-mono text-surface-700 leading-snug line-clamp-2">
                    {issue.top_topic.statement}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className={cn(
                    'text-[10px] font-mono font-bold',
                    Math.round(issue.top_topic.blue_pct) >= 50 ? 'text-for-400' : 'text-against-400',
                  )}>
                    {Math.round(issue.top_topic.blue_pct)}%
                  </div>
                  <div className="text-[9px] font-mono text-surface-600">
                    {Math.round(issue.top_topic.blue_pct) >= 50 ? 'FOR' : 'AGAINST'}
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Footer link */}
          <Link
            href={`/search?q=${encodeURIComponent(issue.title)}&tab=topics`}
            className={cn(
              'flex items-center justify-end gap-1 text-[11px] font-mono transition-colors',
              colors.text,
              'hover:opacity-80',
            )}
          >
            <span>Browse all {issue.topic_count} topics</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </>
      ) : (
        <div className="text-xs font-mono text-surface-600 italic">
          No matching topics yet. Be the first to propose one.
        </div>
      )}
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function IssuesPage() {
  const [data, setData] = useState<IssuesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<'votes' | 'consensus' | 'active'>('votes')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/issues', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as IssuesResponse
      setData(json)
    } catch {
      setError('Failed to load civic issues')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const sortedIssues = data
    ? [...data.issues].sort((a, b) => {
        if (sort === 'consensus') return b.consensus_strength - a.consensus_strength
        if (sort === 'active') return b.active_count - a.active_count
        return b.total_votes - a.total_votes
      })
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-mono text-3xl md:text-4xl font-black text-white tracking-tight">
                Civic Issues
              </h1>
              <p className="mt-2 text-sm font-mono text-surface-500 max-w-xl">
                12 major policy domains — each aggregating consensus across dozens of related debates.
                Where does the platform actually stand on the issues that matter?
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors text-xs font-mono"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {/* Platform summary */}
          {data && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 flex flex-wrap gap-4 text-xs font-mono text-surface-500"
            >
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-for-400" />
                <span className="text-white font-semibold">{data.issues.reduce((s, i) => s + i.topic_count, 0).toLocaleString()}</span>
                <span>topics across all issues</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-purple" />
                <span className="text-white font-semibold">{formatVotes(data.issues.reduce((s, i) => s + i.total_votes, 0))}</span>
                <span>total votes cast</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Gavel className="h-3.5 w-3.5 text-gold" />
                <span className="text-white font-semibold">{data.issues.reduce((s, i) => s + i.law_count, 0)}</span>
                <span>laws established</span>
              </div>
              {data.generated_at && (
                <div className="text-surface-600">
                  Updated {new Date(data.generated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className="text-[11px] font-mono text-surface-600">Sort by:</span>
          {(
            [
              { key: 'votes', label: 'Most Votes' },
              { key: 'consensus', label: 'Strongest Consensus' },
              { key: 'active', label: 'Most Active' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={cn(
                'px-3 py-1 rounded-lg text-[11px] font-mono transition-colors border',
                sort === key
                  ? 'bg-for-500/20 border-for-500/40 text-for-400'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-against-500/10 border border-against-500/30 px-4 py-3 text-sm font-mono text-against-400 mb-6">
            {error}
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 12 }).map((_, i) => (
                <IssueCardSkeleton key={i} />
              ))
            : sortedIssues.map((issue, i) => (
                <IssueCard key={issue.slug} issue={issue} index={i} />
              ))}
        </div>

        {/* Comparison bar — most controversial vs most agreed */}
        {!loading && data && data.issues.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-10 rounded-2xl bg-surface-200 border border-surface-300 p-6"
          >
            <h2 className="font-mono text-sm font-bold text-white mb-4 uppercase tracking-widest">
              Issue Compass
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Strongest consensus */}
              {(() => {
                const top = [...data.issues].sort((a, b) => b.consensus_strength - a.consensus_strength)[0]
                if (!top) return null
                const topColors = getColor(top.color)
                return (
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono text-surface-600 uppercase tracking-widest">
                      Strongest Consensus
                    </p>
                    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border', topColors.bg, topColors.border)}>
                      <ThumbsUp className={cn('h-4 w-4 flex-shrink-0', topColors.text)} />
                      <div>
                        <p className={cn('text-xs font-mono font-bold', topColors.text)}>{top.title}</p>
                        <p className="text-[10px] font-mono text-surface-500">
                          {Math.round(top.avg_blue_pct)}% {top.avg_blue_pct >= 50 ? 'FOR' : 'AGAINST'} · {top.consensus_strength}% conviction
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Most divided */}
              {(() => {
                const bottom = [...data.issues].filter(i => i.topic_count > 0).sort((a, b) => a.consensus_strength - b.consensus_strength)[0]
                if (!bottom) return null
                return (
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono text-surface-600 uppercase tracking-widest">
                      Most Divided
                    </p>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-surface-300/50 border-surface-400/50">
                      <Scale className="h-4 w-4 flex-shrink-0 text-surface-500" />
                      <div>
                        <p className="text-xs font-mono font-bold text-white">{bottom.title}</p>
                        <p className="text-[10px] font-mono text-surface-500">
                          {Math.round(bottom.avg_blue_pct)}% FOR / {100 - Math.round(bottom.avg_blue_pct)}% AGAINST
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Most active */}
              {(() => {
                const active = [...data.issues].sort((a, b) => b.active_count - a.active_count)[0]
                if (!active) return null
                const activeColors = getColor(active.color)
                return (
                  <div className="space-y-2">
                    <p className="text-[10px] font-mono text-surface-600 uppercase tracking-widest">
                      Most Active Now
                    </p>
                    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border', activeColors.bg, activeColors.border)}>
                      <Zap className={cn('h-4 w-4 flex-shrink-0', activeColors.text)} />
                      <div>
                        <p className={cn('text-xs font-mono font-bold', activeColors.text)}>{active.title}</p>
                        <p className="text-[10px] font-mono text-surface-500">
                          {active.active_count} live debates · {formatVotes(active.total_votes)} total votes
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </motion.div>
        )}

        {/* Cross-links */}
        <div className="mt-8 flex flex-wrap gap-3 text-xs font-mono">
          {[
            { href: '/categories', label: 'Browse by Category' },
            { href: '/tags', label: 'Browse by Tag' },
            { href: '/matrix', label: 'Category Correlation Matrix' },
            { href: '/accord', label: 'Near-Unanimous Accord' },
            { href: '/mandate', label: 'Strong Mandates' },
            { href: '/trending', label: 'Trending Topics' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
            >
              {label}
              <ArrowRight className="h-3 w-3" />
            </Link>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
