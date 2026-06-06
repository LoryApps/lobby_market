'use client'

/**
 * /influx — The Civic Influx
 *
 * Shows topics where viewer interest has dramatically outpaced actual
 * voter participation. These are debates that have captured widespread
 * attention — people are reading, browsing, clicking — but most haven't
 * yet cast a vote. The Influx reveals where the next wave of democratic
 * participation is about to break.
 *
 * Influx Score = viewer_gap × (1 - conversion_rate)
 *   viewer_gap      = view_count − total_votes
 *   conversion_rate = total_votes / view_count
 *
 * Distinct from:
 *   /surge        — already surging in vote velocity (voters, not viewers)
 *   /canary       — early warning before trending (not view-gap based)
 *   /lighthouse   — neglected debates with FEW views and few votes
 *   /rising       — rising citizens, not topic viewership
 *   /heat         — overall engagement intensity (not view/vote gap)
 *
 * The Influx answers: "Where is public attention building faster
 * than participation — and where can one vote tip the balance?"
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Cpu,
  Eye,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Loader2,
  Music2,
  RefreshCw,
  Scale,
  TrendingUp,
  Users,
  Vote,
  Waves,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { InfluxTopic, InfluxResponse } from '@/app/api/topics/influx/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
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

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics:   TrendingUp,
  Politics:    Landmark,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  Users,
  Culture:     Music2,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  active: 'active',
  voting: 'proposed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function influxLabel(score: number): { label: string; color: string; ring: string } {
  if (score >= 5000) return { label: 'Flood',  color: 'text-for-300',     ring: 'ring-for-500/40' }
  if (score >= 2000) return { label: 'Surge',  color: 'text-for-400',     ring: 'ring-for-500/30' }
  if (score >= 800)  return { label: 'Rising', color: 'text-gold',        ring: 'ring-gold/30' }
  return                    { label: 'Swell',  color: 'text-surface-400', ring: 'ring-surface-400/20' }
}

function conversionBar(rate: number) {
  const pct = Math.round(rate * 100)
  return { pct, label: `${pct}%` }
}

function formatGap(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m    = Math.floor(diff / 60_000)
  const h    = Math.floor(m / 60)
  const d    = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TopicSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-5 w-full rounded" />
          <Skeleton className="h-5 w-3/4 rounded" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-3 w-12 rounded" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-7 w-24 rounded-lg" />
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: React.ReactNode
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-3.5 w-3.5', color)} />
        <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      {sub && <div className="text-xs text-surface-500 mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function InfluxCard({
  topic,
  rank,
}: {
  topic: InfluxTopic
  rank: number
}) {
  const { label, color, ring } = influxLabel(topic.influx_score)
  const { pct } = conversionBar(topic.conversion_rate)
  const CatIcon = topic.category ? (CATEGORY_ICONS[topic.category] ?? Scale) : Scale
  const forPct  = Math.round(topic.blue_pct ?? 50)

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: rank * 0.04 }}
      className={cn(
        'relative rounded-xl border bg-surface-100 p-4',
        'hover:border-surface-400 transition-colors',
        `ring-1 ${ring}`,
        topic.influx_score >= 5000
          ? 'border-for-600/60'
          : topic.influx_score >= 2000
          ? 'border-for-700/40'
          : 'border-surface-300',
      )}
    >
      {/* Rank badge */}
      <span
        className={cn(
          'absolute -top-2 -left-2 flex items-center justify-center',
          'h-5 w-5 rounded-full text-[10px] font-mono font-bold',
          'bg-surface-200 border border-surface-400 text-surface-500',
        )}
      >
        {rank}
      </span>

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {/* Category + status */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {topic.category && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                <CatIcon className="h-3 w-3" aria-hidden="true" />
                {topic.category}
              </span>
            )}
            <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="sm">
              {topic.status === 'voting' ? 'Final Vote' : 'Active'}
            </Badge>
            <span className={cn('text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-surface-200', color)}>
              {label}
            </span>
          </div>

          <h3 className="text-sm font-medium text-white leading-snug line-clamp-3">
            {topic.statement}
          </h3>
        </div>

        {/* Viewer gap pill */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center min-w-[56px] rounded-lg bg-surface-200 border border-surface-400 p-2 text-center">
          <Eye className="h-3.5 w-3.5 text-for-400 mb-0.5" aria-hidden="true" />
          <span className="text-sm font-bold text-white tabular-nums leading-none">
            {formatGap(topic.viewer_gap)}
          </span>
          <span className="text-[9px] font-mono text-surface-500 leading-none mt-0.5">
            waiting
          </span>
        </div>
      </div>

      {/* Conversion meter */}
      <div className="mb-3 space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-mono text-surface-500">Voter conversion</span>
          <span className={cn('text-[10px] font-mono font-semibold tabular-nums', color)}>{pct}%</span>
        </div>
        <div className="relative h-1.5 rounded-full overflow-hidden bg-surface-300">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: rank * 0.04 }}
            className={cn(
              'absolute inset-y-0 left-0 rounded-full',
              pct < 20 ? 'bg-for-500'
              : pct < 40 ? 'bg-for-400'
              : 'bg-gold',
            )}
          />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-surface-600">
          <span>
            <Vote className="inline h-2.5 w-2.5 mr-0.5" aria-hidden="true" />
            {formatGap(topic.total_votes)} voted
          </span>
          <span>
            <Eye className="inline h-2.5 w-2.5 mr-0.5" aria-hidden="true" />
            {formatGap(topic.view_count)} viewed
          </span>
        </div>
      </div>

      {/* Vote bar */}
      <div className="mb-3">
        <div className="relative h-1 rounded-full overflow-hidden bg-surface-300">
          <div
            className="absolute inset-y-0 left-0 bg-for-600 rounded-l-full"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 bg-against-700 rounded-r-full"
            style={{ width: `${100 - forPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] font-mono mt-0.5">
          <span className="text-for-400">{forPct}% FOR</span>
          <span className="text-surface-600">{relativeTime(topic.created_at)}</span>
          <span className="text-against-400">{100 - forPct}% AGN</span>
        </div>
      </div>

      {/* CTA */}
      <div className="flex gap-2">
        <Link
          href={`/topic/${topic.id}`}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg',
            'text-xs font-mono font-medium',
            'bg-for-600 text-white hover:bg-for-500 transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400',
          )}
        >
          <Vote className="h-3.5 w-3.5" aria-hidden="true" />
          Vote now
        </Link>
        <Link
          href={`/topic/${topic.id}`}
          className={cn(
            'flex items-center justify-center gap-1 px-3 py-2 rounded-lg',
            'text-xs font-mono text-surface-400',
            'bg-surface-200 hover:bg-surface-300 hover:text-white transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400',
          )}
          aria-label="View debate"
        >
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </motion.article>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InfluxClient() {
  const [data, setData]           = useState<InfluxResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(false)
  const [category, setCategory]   = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const abortRef                  = useRef<AbortController | null>(null)

  const fetchData = useCallback(async (cat: string | null) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError(false)
    try {
      const url = cat
        ? `/api/topics/influx?category=${encodeURIComponent(cat)}`
        : '/api/topics/influx'
      const res = await fetch(url, { signal: ctrl.signal })
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as InfluxResponse
      setData(json)
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData(category)
  }, [category, fetchData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData(category)
  }

  const stats = data?.stats
  const topics = data?.topics ?? []

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pb-24 pt-4" id="main-content" tabIndex={-1}>

        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <Waves className="h-5 w-5 text-for-400" aria-hidden="true" />
            <h1 className="text-lg font-bold text-white">The Civic Influx</h1>
          </div>
          <p className="text-sm text-surface-500 leading-snug">
            Debates where public attention has outpaced participation. These topics have captured
            widespread interest — but most viewers haven&apos;t voted yet. The wave is building.
          </p>
        </div>

        {/* Stats strip */}
        {!loading && stats && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-2 gap-3 mb-5"
          >
            <StatCard
              label="Untapped votes"
              value={<AnimatedNumber value={stats.total_viewer_gap} />}
              sub="viewers haven't voted yet"
              icon={Eye}
              color="text-for-400"
            />
            <StatCard
              label="Avg conversion"
              value={`${Math.round(stats.avg_conversion_rate * 100)}%`}
              sub="viewers who vote"
              icon={Vote}
              color="text-gold"
            />
          </motion.div>
        )}

        {/* Category filter */}
        <div
          role="group"
          aria-label="Filter by category"
          className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-hide"
        >
          <button
            onClick={() => setCategory(null)}
            className={cn(
              'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500',
              category === null
                ? 'bg-for-600 text-white'
                : 'bg-surface-200 text-surface-400 hover:bg-surface-300 hover:text-white',
            )}
          >
            All
          </button>
          {CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat] ?? Scale
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat === category ? null : cat)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-mono transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500',
                  category === cat
                    ? 'bg-for-600 text-white'
                    : 'bg-surface-200 text-surface-400 hover:bg-surface-300 hover:text-white',
                )}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                {cat}
              </button>
            )
          })}
        </div>

        {/* Refresh button */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono text-surface-500">
            {loading ? (
              <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Loading…</span>
            ) : (
              `${topics.length} topic${topics.length !== 1 ? 's' : ''} with high influx`
            )}
          </span>
          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono',
              'text-surface-400 hover:text-white bg-surface-200 hover:bg-surface-300',
              'transition-colors disabled:opacity-50',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500',
            )}
            aria-label="Refresh influx data"
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} aria-hidden="true" />
            Refresh
          </button>
        </div>

        {/* Error state */}
        {error && !loading && (
          <div className="rounded-xl border border-against-600/30 bg-against-900/20 p-4 text-center mb-4">
            <p className="text-sm text-against-400 mb-2">Failed to load influx data</p>
            <button
              onClick={handleRefresh}
              className="text-xs font-mono text-surface-400 hover:text-white underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3" aria-label="Loading topics">
            {Array.from({ length: 6 }).map((_, i) => (
              <TopicSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && topics.length === 0 && (
          <EmptyState
            icon={Waves}
            title="No influx detected"
            description={
              category
                ? `No ${category} topics show a significant viewer-to-voter gap right now.`
                : 'All active topics have strong voter participation right now.'
            }
            actions={ category ? [{ label: 'Clear filter', onClick: () => setCategory(null) }] : undefined }
          />
        )}

        {/* Topic list */}
        {!loading && topics.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key={category ?? 'all'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {topics.map((topic, i) => (
                <InfluxCard key={topic.id} topic={topic} rank={i + 1} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Context footer */}
        {!loading && topics.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-6 rounded-xl border border-surface-300 bg-surface-100 p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
              <span className="text-xs font-mono text-surface-400">What is the Influx?</span>
            </div>
            <p className="text-xs text-surface-500 leading-relaxed">
              The Influx Score measures how much viewer interest has outpaced actual voting.
              A{' '}
              <strong className="text-for-300">Flood</strong>-rated topic has thousands of viewers who
              haven&apos;t voted — one campaign or share could trigger a wave of democratic participation.
              Low conversion doesn&apos;t mean low interest — it means the debate is primed.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {[
                { label: 'Flood',  color: 'text-for-300',     desc: '5,000+ gap score' },
                { label: 'Surge',  color: 'text-for-400',     desc: '2,000–5,000' },
                { label: 'Rising', color: 'text-gold',        desc: '800–2,000' },
                { label: 'Swell',  color: 'text-surface-400', desc: 'Under 800' },
              ].map(({ label, color, desc }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={cn('text-xs font-mono font-semibold', color)}>{label}</span>
                  <span className="text-[10px] text-surface-600">{desc}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Related pages */}
        <nav aria-label="Related civic analysis" className="mt-4">
          <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wider mb-2">
            Related
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { href: '/surge',       label: 'Vote Surge' },
              { href: '/canary',      label: 'Canary' },
              { href: '/lighthouse',  label: 'Lighthouse' },
              { href: '/trending',    label: 'Trending' },
              { href: '/pressure',    label: 'Pressure Test' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-mono',
                  'bg-surface-200 text-surface-400 hover:bg-surface-300 hover:text-white',
                  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500',
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </main>

      <BottomNav />
    </div>
  )
}
