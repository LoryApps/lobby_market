'use client'

/**
 * /tags/[tag]/stats — Tag Analytics Dashboard
 *
 * Deep-dive analytics for a specific civic tag:
 *   - Overview stats (topics, votes, laws, followers)
 *   - Status breakdown (proposed / active / voting / law / failed)
 *   - FOR vs AGAINST consensus gauge
 *   - Category breakdown bar chart
 *   - Weekly activity sparkline (last 8 weeks)
 *   - Top contributors by argument upvotes
 *   - Top arguments from this tag
 *   - Related co-occurring tags
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Gavel,
  GitCompare,
  Hash,
  MessageSquare,
  Network,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { TagFollowButton } from '@/components/ui/TagFollowButton'
import { cn } from '@/lib/utils/cn'
import type {
  TagStatsResponse,
  TagStatsCategoryBreakdown,
  TagStatsTopArgument,
  TagStatsWeeklyActivity,
} from '@/app/api/tags/[tag]/stats/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

const TAG_PALETTES = [
  { text: 'text-for-300',      bg: 'bg-for-500/10',      border: 'border-for-500/30' },
  { text: 'text-against-300',  bg: 'bg-against-500/10',  border: 'border-against-500/30' },
  { text: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30' },
  { text: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  { text: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30' },
  { text: 'text-for-400',       bg: 'bg-for-500/15',       border: 'border-for-500/40' },
]

function tagPalette(tag: string) {
  const code = tag.charCodeAt(0) + tag.charCodeAt(Math.min(2, tag.length - 1))
  return TAG_PALETTES[code % TAG_PALETTES.length]
}

const CATEGORY_COLORS: Record<string, { bar: string; text: string }> = {
  Economics:   { bar: 'bg-gold',         text: 'text-gold' },
  Politics:    { bar: 'bg-for-500',      text: 'text-for-400' },
  Technology:  { bar: 'bg-purple',       text: 'text-purple' },
  Science:     { bar: 'bg-emerald',      text: 'text-emerald' },
  Ethics:      { bar: 'bg-against-400',  text: 'text-against-300' },
  Philosophy:  { bar: 'bg-for-300',      text: 'text-for-300' },
  Culture:     { bar: 'bg-gold',         text: 'text-gold' },
  Health:      { bar: 'bg-emerald',      text: 'text-emerald' },
  Environment: { bar: 'bg-emerald',      text: 'text-emerald' },
  Education:   { bar: 'bg-purple',       text: 'text-purple' },
  Other:       { bar: 'bg-surface-400',  text: 'text-surface-500' },
}

function catColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'text-white',
}: {
  icon: typeof TrendingUp
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-surface-100 border border-surface-300 rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-surface-500">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span className="text-[11px] font-mono uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn('font-mono text-2xl font-bold', color)}>
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>
      {sub && <p className="text-[11px] font-mono text-surface-500">{sub}</p>}
    </div>
  )
}

function ConsensusGauge({ forPct }: { forPct: number }) {
  const againstPct = 100 - forPct
  const isFor = forPct > 55
  const isAgainst = againstPct > 55

  return (
    <div className="bg-surface-100 border border-surface-300 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3 text-surface-500">
        <Scale className="h-3.5 w-3.5" aria-hidden />
        <span className="text-[11px] font-mono uppercase tracking-wide">Community Consensus</span>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl font-mono font-bold text-for-400">{forPct}%</span>
        <span className="text-surface-500 font-mono text-sm">FOR</span>
        <span className="flex-1" />
        <span className="text-surface-500 font-mono text-sm">AGAINST</span>
        <span className="text-2xl font-mono font-bold text-against-400">{againstPct}%</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-surface-300">
        <motion.div
          className="bg-for-500"
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <div className="bg-against-500 flex-1" />
      </div>
      <p className={cn(
        'mt-2 text-[11px] font-mono',
        isFor ? 'text-for-400' : isAgainst ? 'text-against-400' : 'text-gold'
      )}>
        {isFor ? 'Leans FOR across debates' : isAgainst ? 'Leans AGAINST across debates' : 'Contested — near 50/50 average'}

      </p>
    </div>
  )
}

function StatusBreakdown({ data }: { data: TagStatsResponse }) {
  const total = data.total_topics || 1
  const statuses = [
    { label: 'LAW',      count: data.law_count,      color: 'bg-gold',         text: 'text-gold' },
    { label: 'Active',   count: data.active_count,   color: 'bg-for-500',      text: 'text-for-400' },
    { label: 'Voting',   count: data.voting_count,   color: 'bg-purple',       text: 'text-purple' },
    { label: 'Proposed', count: data.proposed_count, color: 'bg-surface-400',  text: 'text-surface-500' },
    { label: 'Failed',   count: data.failed_count,   color: 'bg-against-700',  text: 'text-against-400' },
  ]

  return (
    <div className="bg-surface-100 border border-surface-300 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3 text-surface-500">
        <BarChart2 className="h-3.5 w-3.5" aria-hidden />
        <span className="text-[11px] font-mono uppercase tracking-wide">Status Breakdown</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-surface-300 mb-3">
        {statuses.map(({ label, count, color }) => {
          const pct = (count / total) * 100
          if (pct < 1) return null
          return (
            <motion.div
              key={label}
              className={color}
              style={{ width: `${pct}%` }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {statuses.map(({ label, count, text }) => count > 0 && (
          <div key={label} className="flex items-center gap-1">
            <span className={cn('text-[11px] font-mono font-semibold', text)}>{count}</span>
            <span className="text-[11px] font-mono text-surface-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CategoryBars({ categories }: { categories: TagStatsCategoryBreakdown[] }) {
  const maxCount = Math.max(...categories.map((c) => c.topic_count), 1)
  return (
    <div className="bg-surface-100 border border-surface-300 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4 text-surface-500">
        <BarChart2 className="h-3.5 w-3.5" aria-hidden />
        <span className="text-[11px] font-mono uppercase tracking-wide">By Category</span>
      </div>
      <div className="space-y-2.5">
        {categories.map((cat) => {
          const { bar, text } = catColor(cat.category)
          const pct = Math.round((cat.topic_count / maxCount) * 100)
          return (
            <div key={cat.category} className="flex items-center gap-2">
              <span className={cn('text-[11px] font-mono w-20 flex-shrink-0 truncate', text)}>
                {cat.category}
              </span>
              <div className="flex-1 h-2 bg-surface-300 rounded-full overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', bar)}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
              <span className="text-[11px] font-mono text-surface-500 w-6 text-right">
                {cat.topic_count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeeklySparkline({ weeks }: { weeks: TagStatsWeeklyActivity[] }) {
  const maxTopics = Math.max(...weeks.map((w) => w.new_topics), 1)
  const formatWeek = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="bg-surface-100 border border-surface-300 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4 text-surface-500">
        <TrendingUp className="h-3.5 w-3.5" aria-hidden />
        <span className="text-[11px] font-mono uppercase tracking-wide">Weekly New Topics (8 weeks)</span>
      </div>
      <div className="flex items-end gap-1.5 h-16">
        {weeks.map((w, i) => {
          const pct = maxTopics > 0 ? (w.new_topics / maxTopics) * 100 : 0
          const isLast = i === weeks.length - 1
          return (
            <div key={w.week_start} className="flex flex-col items-center flex-1 gap-1">
              <motion.div
                className={cn(
                  'w-full rounded-sm',
                  isLast ? 'bg-for-500' : 'bg-surface-300'
                )}
                style={{ height: `${Math.max(pct, 4)}%` }}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(pct, 4)}%` }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                title={`${formatWeek(w.week_start)}: ${w.new_topics} new topics`}
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-[10px] font-mono text-surface-500">
          {weeks[0] ? formatWeek(weeks[0].week_start) : ''}
        </span>
        <span className="text-[10px] font-mono text-for-400">This week</span>
      </div>
    </div>
  )
}

function TopArgumentCard({ arg }: { arg: TagStatsTopArgument }) {
  return (
    <div className="bg-surface-100 border border-surface-300 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
          arg.side === 'for'
            ? 'bg-for-500/15 text-for-400 border-for-500/30'
            : 'bg-against-500/15 text-against-400 border-against-500/30'
        )}>
          {arg.side === 'for' ? <ThumbsUp className="h-2.5 w-2.5" aria-hidden /> : <ThumbsDown className="h-2.5 w-2.5" aria-hidden />}
          {arg.side.toUpperCase()}
        </span>
        <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500 ml-auto">
          <TrendingUp className="h-3 w-3" aria-hidden />
          {arg.upvotes}
        </span>
      </div>
      <p className="text-sm text-white leading-relaxed line-clamp-3">{arg.content}</p>
      <div className="flex items-center gap-2 pt-1 border-t border-surface-300">
        <Avatar src={arg.author_avatar} username={arg.author_username} size="xs" />
        <span className="text-[11px] font-mono text-surface-500">@{arg.author_username}</span>
        <span className="text-surface-600 text-[11px]">·</span>
        <Link
          href={`/topic/${arg.topic_id}`}
          className="text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors truncate"
        >
          {arg.topic_statement}
        </Link>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TagStatsPage() {
  const params = useParams<{ tag: string }>()
  const tag = decodeURIComponent(params.tag ?? '').toLowerCase()

  const [data, setData] = useState<TagStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tags/${encodeURIComponent(tag)}/stats`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as TagStatsResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [tag])

  useEffect(() => { load() }, [load])

  const palette = tagPalette(tag)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href={`/tags/${encodeURIComponent(tag)}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0 mt-0.5"
            aria-label="Back to tag page"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-mono font-bold border',
                palette.bg, palette.text, palette.border
              )}>
                <Hash className="h-3.5 w-3.5" aria-hidden />
                {tag}
              </span>
              <span className="text-[11px] font-mono text-surface-500 bg-surface-200 px-2 py-0.5 rounded-full">
                Analytics
              </span>
            </div>
            <p className="text-xs font-mono text-surface-500">
              Deep-dive stats for all debates tagged #{tag}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <TagFollowButton tag={tag} size="sm" />
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
              aria-label="Refresh stats"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Nav pills ─────────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { label: 'Topics', href: `/tags/${encodeURIComponent(tag)}` },
            { label: 'Analytics', href: `/tags/${encodeURIComponent(tag)}/stats`, active: true },
            { label: 'Compare', href: `/tags/compare?a=${encodeURIComponent(tag)}` },
            { label: 'Graph', href: `/tags/graph` },
          ].map(({ label, href, active }) => (
            <Link
              key={label}
              href={href}
              className={cn(
                'px-3 py-1 rounded-full text-[11px] font-mono border transition-colors',
                active
                  ? 'bg-for-600/20 text-for-300 border-for-500/40'
                  : 'bg-surface-200 text-surface-500 border-surface-300 hover:bg-surface-300 hover:text-white'
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* ── Loading ───────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            </motion.div>
          )}

          {!loading && error && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={BarChart2}
                title="Failed to load stats"
                description={error}
                action={{ label: 'Retry', onClick: load }}
              />
            </motion.div>
          )}

          {!loading && data && data.total_topics === 0 && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Hash}
                title={`No topics tagged #${tag}`}
                description="This tag hasn't been applied to any debates yet."
                action={{ label: 'Browse Tags', href: '/tags' }}
              />
            </motion.div>
          )}

          {!loading && data && data.total_topics > 0 && (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* ── Overview stats ─────────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon={BarChart2} label="Topics"    value={data.total_topics} color="text-white" />
                <StatCard icon={TrendingUp} label="Votes"    value={data.total_votes}  color="text-for-400" />
                <StatCard icon={Gavel}      label="Laws"     value={data.law_count}    color="text-gold" />
                <StatCard icon={Users}      label="Followers" value={data.followers_count} color="text-purple" />
              </div>

              {/* ── Consensus + Status ─────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ConsensusGauge forPct={data.avg_for_pct} />
                <StatusBreakdown data={data} />
              </div>

              {/* ── Category breakdown + Weekly activity ──────────────────── */}
              {(data.categories.length > 0 || data.weekly_activity.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.categories.length > 0 && <CategoryBars categories={data.categories} />}
                  {data.weekly_activity.length > 0 && <WeeklySparkline weeks={data.weekly_activity} />}
                </div>
              )}

              {/* ── Top contributors ───────────────────────────────────────── */}
              {data.top_contributors.length > 0 && (
                <div className="bg-surface-100 border border-surface-300 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4 text-surface-500">
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                    <span className="text-[11px] font-mono uppercase tracking-wide">Top Contributors</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.top_contributors.map((c, i) => (
                      <Link
                        key={c.user_id}
                        href={`/profile/${c.username}`}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-200 transition-colors group"
                      >
                        <span className="text-[11px] font-mono text-surface-500 w-4 flex-shrink-0">
                          {i + 1}.
                        </span>
                        <Avatar
                          src={c.avatar_url}
                          username={c.username}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono text-white truncate group-hover:text-for-300 transition-colors">
                            {c.display_name ?? `@${c.username}`}
                          </p>
                          <p className="text-[10px] font-mono text-surface-500">
                            {c.argument_count} arg{c.argument_count !== 1 ? 's' : ''} · {c.total_upvotes} upvotes
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-for-400 transition-colors flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Top arguments ──────────────────────────────────────────── */}
              {data.top_arguments.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 text-surface-500">
                    <Zap className="h-3.5 w-3.5" aria-hidden />
                    <span className="text-[11px] font-mono uppercase tracking-wide">Top Arguments</span>
                  </div>
                  <div className="space-y-3">
                    {data.top_arguments.map((arg) => (
                      <TopArgumentCard key={arg.id} arg={arg} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Related tags ───────────────────────────────────────────── */}
              {data.related_tags.length > 0 && (
                <div className="bg-surface-100 border border-surface-300 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-4 text-surface-500">
                    <Network className="h-3.5 w-3.5" aria-hidden />
                    <span className="text-[11px] font-mono uppercase tracking-wide">Related Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.related_tags.map((rt) => {
                      const p = tagPalette(rt.tag)
                      return (
                        <Link
                          key={rt.tag}
                          href={`/tags/${encodeURIComponent(rt.tag)}`}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border transition-colors hover:opacity-80',
                            p.bg, p.text, p.border
                          )}
                        >
                          <Hash className="h-2.5 w-2.5" aria-hidden />
                          {rt.tag}
                          <span className="text-[9px] text-current opacity-60">
                            ×{rt.co_occurrence}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Footer links ───────────────────────────────────────────── */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Link
                  href={`/tags/${encodeURIComponent(tag)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 text-surface-400 hover:bg-surface-300 hover:text-white text-[11px] font-mono border border-surface-300 transition-colors"
                >
                  <Hash className="h-3 w-3" aria-hidden />
                  Browse topics
                </Link>
                <Link
                  href={`/tags/compare?a=${encodeURIComponent(tag)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 text-surface-400 hover:bg-surface-300 hover:text-white text-[11px] font-mono border border-surface-300 transition-colors"
                >
                  <GitCompare className="h-3 w-3" aria-hidden />
                  Compare tag
                </Link>
                <Link
                  href="/tags/graph"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 text-surface-400 hover:bg-surface-300 hover:text-white text-[11px] font-mono border border-surface-300 transition-colors"
                >
                  <Network className="h-3 w-3" aria-hidden />
                  Tag network
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
