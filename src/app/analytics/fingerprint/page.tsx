'use client'

/**
 * /analytics/fingerprint — Civic Fingerprint
 *
 * Shows how the user's voting positions deviate from platform consensus
 * across every civic category. A positive deviation means the user votes
 * FOR more often than the platform average; negative means more AGAINST.
 *
 * Highlights the user's rarest and most mainstream positions, and assigns
 * an ideological label (Radical Outlier, Independent Thinker, etc.).
 *
 * Distinct from:
 *   /analytics/alignment        — side-by-side alignment with another user
 *   /analytics/alignment-network — social graph of vote alignment
 *   /analytics/contrarian       — contrarian vote deep-dive
 *   /analytics/diversity        — breadth-of-engagement score
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Fingerprint,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  FingerprintData,
  FingerprintCategory,
  OutlierVote,
} from '@/app/api/analytics/fingerprint/route'

// ─── Deviation bar component ──────────────────────────────────────────────────

function DeviationBar({
  category,
  index,
}: {
  category: FingerprintCategory
  index: number
}) {
  const dev = category.deviation  // -100 to +100
  const absDev = Math.abs(dev)
  const isFor = dev >= 0
  const width = Math.min(100, (absDev / 50) * 100) // scale: 50 pts deviation = full bar

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-surface-300">{category.category}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-surface-400">
            You {category.user_for_pct}% · Avg {category.platform_for_pct}%
          </span>
          <span
            className={cn(
              'text-[10px] font-mono font-bold',
              dev > 0 ? 'text-for-400' : dev < 0 ? 'text-against-400' : 'text-surface-400'
            )}
          >
            {dev > 0 ? '+' : ''}{dev}
          </span>
        </div>
      </div>

      {/* Centered bar: neutral line in middle, deviation bar extends left (against) or right (for) */}
      <div className="relative h-2 bg-surface-300/40 rounded-full">
        {/* Centre marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-surface-400/60 -translate-x-px z-10" />

        {/* Deviation fill */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${width / 2}%` }}
          transition={{ delay: index * 0.05 + 0.15, duration: 0.5, ease: 'easeOut' }}
          className={cn(
            'absolute top-0 bottom-0 rounded-full',
            isFor
              ? 'left-1/2 bg-for-500'
              : 'right-1/2 bg-against-500'
          )}
          style={isFor ? { left: '50%' } : { right: '50%' }}
        />
      </div>

      <div className="flex justify-between text-[9px] font-mono text-surface-500 px-0.5">
        <span>More AGAINST</span>
        <span>More FOR</span>
      </div>
    </motion.div>
  )
}

// ─── Outlier vote card ────────────────────────────────────────────────────────

function OutlierCard({
  vote,
  label,
  labelColor,
  description,
}: {
  vote: OutlierVote
  label: string
  labelColor: string
  description: string
}) {
  return (
    <div className="bg-surface-200/60 border border-surface-300/40 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wide', labelColor)}>
          {label}
        </span>
        <span className="text-[10px] text-surface-400 font-mono">{vote.minority_pct}% of voters</span>
      </div>

      <Link
        href={`/topic/${vote.topic_id}`}
        className="block text-xs text-white hover:text-for-300 transition-colors leading-relaxed line-clamp-2"
      >
        {vote.statement}
      </Link>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={vote.user_side === 'for' ? 'active' : 'failed'} size="xs">
          {vote.user_side === 'for' ? (
            <><ThumbsUp className="w-2.5 h-2.5 mr-1" />FOR</>
          ) : (
            <><ThumbsDown className="w-2.5 h-2.5 mr-1" />AGAINST</>
          )}
        </Badge>
        {vote.category && (
          <span className="text-[10px] text-surface-400">{vote.category}</span>
        )}
        <span className="text-[10px] text-surface-400 ml-auto">
          {vote.total_votes.toLocaleString()} total votes
        </span>
      </div>

      <p className="text-[11px] text-surface-400 italic">{description}</p>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FingerprintSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-48 rounded-xl" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
      </div>
    </div>
  )
}

// ─── Label config ─────────────────────────────────────────────────────────────

function labelStyle(label: string): { color: string; bg: string; ring: string } {
  switch (label) {
    case 'Radical Outlier':    return { color: 'text-against-300', bg: 'bg-against-500/10', ring: 'ring-against-500/40' }
    case 'Bold Contrarian':    return { color: 'text-against-400', bg: 'bg-against-600/10', ring: 'ring-against-500/30' }
    case 'Independent Thinker': return { color: 'text-purple',    bg: 'bg-purple/10',       ring: 'ring-purple/30' }
    case 'Selective Dissenter': return { color: 'text-for-300',   bg: 'bg-for-500/10',      ring: 'ring-for-500/30' }
    case 'Consensus Builder':   return { color: 'text-emerald',   bg: 'bg-emerald/10',      ring: 'ring-emerald/30' }
    case 'Voice of the Mainstream': return { color: 'text-for-400', bg: 'bg-for-600/10',   ring: 'ring-for-500/20' }
    default:                   return { color: 'text-surface-300', bg: 'bg-surface-200',    ring: 'ring-surface-400/30' }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FingerprintPage() {
  const router = useRouter()
  const [data, setData] = useState<FingerprintData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/fingerprint')
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as FingerprintData
      setData(json)
    } catch {
      setError('Could not load your civic fingerprint.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const style = data ? labelStyle(data.unique_label) : null

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24">
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 bg-surface-100/95 backdrop-blur-sm border-b border-surface-300/60 px-4 py-3 flex items-center gap-3">
          <Link
            href="/analytics"
            className="p-1.5 rounded-lg hover:bg-surface-200 transition-colors"
            aria-label="Back to Analytics"
          >
            <ArrowLeft className="w-4 h-4 text-surface-400" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-white">Civic Fingerprint</h1>
            <p className="text-[11px] text-surface-400">Your ideological profile vs. platform</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh fingerprint"
            className="p-1.5 rounded-lg hover:bg-surface-200 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('w-4 h-4 text-surface-400', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Content ── */}
        <div className="max-w-xl mx-auto px-4 py-4 space-y-5">
          {loading ? (
            <FingerprintSkeleton />
          ) : error ? (
            <EmptyState
              icon={Fingerprint}
              title="Fingerprint unavailable"
              description={error}
              action={{ label: 'Retry', onClick: load }}
            />
          ) : data && data.total_votes < 5 ? (
            <EmptyState
              icon={Fingerprint}
              title="Not enough data yet"
              description="Vote on at least 5 topics to reveal your civic fingerprint."
              action={{ label: 'Browse topics', href: '/' }}
            />
          ) : data ? (
            <>
              {/* ── Identity card ── */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  'relative overflow-hidden border rounded-2xl p-5',
                  'bg-surface-200',
                  style?.ring && `ring-1 ${style.ring}`,
                  'border-surface-300/60'
                )}
              >
                {/* Background icon watermark */}
                <div
                  aria-hidden
                  className="absolute -right-3 -top-3 opacity-5 pointer-events-none select-none"
                >
                  <Fingerprint className="w-32 h-32 text-white" />
                </div>

                <div className="relative space-y-3">
                  {/* Label */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-mono text-surface-400 uppercase tracking-widest">
                        Your civic archetype
                      </p>
                      <h2 className={cn('text-xl font-bold', style?.color)}>
                        {data.unique_label}
                      </h2>
                      <p className="text-xs text-surface-300 leading-relaxed max-w-xs">
                        {data.unique_description}
                      </p>
                    </div>

                    {/* Fingerprint score */}
                    <div className={cn('flex-shrink-0 rounded-xl p-3 text-center ring-1', style?.bg, style?.ring)}>
                      <p className={cn('text-2xl font-mono font-black', style?.color)}>
                        {data.fingerprint_score}
                      </p>
                      <p className="text-[9px] font-mono text-surface-400 mt-0.5">deviation</p>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-surface-300/40">
                    {[
                      { label: 'Total Votes',  value: data.total_votes.toLocaleString() },
                      { label: 'Mainstream',   value: `${data.overall_alignment}%` },
                      { label: 'Minority',     value: data.minority_votes.toLocaleString() },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center">
                        <p className="text-sm font-mono font-bold text-white">{value}</p>
                        <p className="text-[10px] text-surface-400">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Alignment bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-surface-400">
                      <span>Contrarian</span>
                      <span>Mainstream</span>
                    </div>
                    <div className="h-2 bg-surface-300/40 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${data.overall_alignment}%` }}
                        transition={{ delay: 0.3, duration: 0.7, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-against-500 via-gold to-emerald rounded-full"
                      />
                    </div>
                    <p className="text-center text-[10px] font-mono text-surface-400">
                      {data.overall_alignment}% of your votes align with the majority
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* ── Category deviations ── */}
              {data.categories.length > 0 && (
                <div className="bg-surface-200/70 border border-surface-300/50 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-widest">
                      Deviation by Category
                    </h3>
                    <span className="text-[10px] text-surface-500">vs. platform average</span>
                  </div>

                  <div className="space-y-5">
                    {data.categories.map((cat, i) => (
                      <DeviationBar key={cat.category} category={cat} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Notable positions ── */}
              {(data.rarest_position || data.most_mainstream) && (
                <div className="space-y-3">
                  <h3 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-widest px-1">
                    Notable Positions
                  </h3>

                  {data.rarest_position && (
                    <OutlierCard
                      vote={data.rarest_position}
                      label="Rarest Position"
                      labelColor="text-against-300"
                      description="The vote where you were furthest from platform consensus."
                    />
                  )}

                  {data.most_mainstream && (
                    <OutlierCard
                      vote={data.most_mainstream}
                      label="Most Mainstream"
                      labelColor="text-emerald"
                      description="The vote where you most strongly agreed with the majority."
                    />
                  )}
                </div>
              )}

              {/* ── Footer links ── */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {[
                  { href: '/analytics/contrarian',        label: 'Contrarian Deep-Dive', icon: TrendingDown },
                  { href: '/analytics/alignment',         label: 'Alignment Report',     icon: Scale },
                  { href: '/analytics/diversity',         label: 'Vote Diversity',        icon: BarChart2 },
                  { href: '/analytics',                   label: 'All Analytics',         icon: Zap },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 p-3 bg-surface-200/60 border border-surface-300/40 rounded-xl hover:border-surface-400/60 transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
                    <span className="text-xs text-surface-300 truncate">{label}</span>
                    <ChevronRight className="w-3 h-3 text-surface-500 ml-auto flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
