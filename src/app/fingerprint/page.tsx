'use client'

/**
 * /fingerprint — Civic Fingerprint
 *
 * Shows how unique your civic voice is compared to the platform consensus.
 * Each category bar reveals how far your voting leans from the average voter.
 * A high "fingerprint score" means you're a genuine outlier; a low score
 * means you track the majority across most issues.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  ExternalLink,
  Fingerprint,
  RefreshCw,
  Share2,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { FingerprintData, FingerprintCategory, OutlierVote } from '@/app/api/analytics/fingerprint/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function deviationLabel(dev: number): string {
  if (dev > 20) return 'Strongly FOR'
  if (dev > 10) return 'Leans FOR'
  if (dev > 3) return 'Slightly FOR'
  if (dev > -4) return 'Aligned'
  if (dev > -11) return 'Slightly AGAINST'
  if (dev > -21) return 'Leans AGAINST'
  return 'Strongly AGAINST'
}

function deviationColor(dev: number): string {
  if (dev > 10) return 'text-for-300'
  if (dev > 3) return 'text-for-400/70'
  if (dev > -4) return 'text-surface-500'
  if (dev > -11) return 'text-against-400/70'
  return 'text-against-300'
}

function scoreColor(score: number): string {
  if (score >= 25) return 'text-against-300'
  if (score >= 15) return 'text-gold'
  if (score >= 8) return 'text-purple'
  return 'text-for-300'
}

function scoreBg(score: number): string {
  if (score >= 25) return 'bg-against-500/10 border-against-500/30'
  if (score >= 15) return 'bg-gold/10 border-gold/30'
  if (score >= 8) return 'bg-purple/10 border-purple/30'
  return 'bg-for-500/10 border-for-500/30'
}

function statusBadge(status: string): 'proposed' | 'active' | 'law' | 'failed' {
  if (status === 'law') return 'law'
  if (status === 'failed') return 'failed'
  if (status === 'proposed') return 'proposed'
  return 'active'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-14 w-14 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ─── Deviation Bar ────────────────────────────────────────────────────────────

function DeviationBar({ cat }: { cat: FingerprintCategory }) {
  const maxDev = 50
  const userBarWidth = Math.min(100, (Math.abs(cat.deviation) / maxDev) * 100)
  const isFor = cat.deviation >= 0
  const aligned = Math.abs(cat.deviation) <= 3

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-xl bg-surface-100 border border-surface-300 p-4 hover:border-surface-400/60 transition-colors"
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-white">{cat.category}</span>
          <span className="text-[11px] font-mono text-surface-500">{cat.user_votes} votes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('text-xs font-mono font-semibold', deviationColor(cat.deviation))}>
            {deviationLabel(cat.deviation)}
          </span>
          {!aligned && (
            <span
              className={cn(
                'text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-md',
                isFor ? 'bg-for-500/15 text-for-400' : 'bg-against-500/15 text-against-400',
              )}
            >
              {cat.deviation > 0 ? '+' : ''}
              {cat.deviation}%
            </span>
          )}
        </div>
      </div>

      <div className="relative h-3 rounded-full bg-surface-300 overflow-hidden">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-surface-400 -translate-x-px z-10" />
        {aligned ? (
          <div className="absolute left-1/2 top-0.5 bottom-0.5 w-6 -translate-x-1/2 rounded-full bg-surface-500" />
        ) : isFor ? (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
            style={{ transformOrigin: 'left', width: `${userBarWidth / 2}%`, left: '50%' }}
            className="absolute top-0 bottom-0 rounded-r-full bg-for-500/70"
          />
        ) : (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
            style={{ transformOrigin: 'right', width: `${userBarWidth / 2}%`, right: '50%' }}
            className="absolute top-0 bottom-0 rounded-l-full bg-against-500/70"
          />
        )}
      </div>

      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] font-mono text-surface-600">← AGAINST</span>
        <span className="text-[10px] font-mono text-surface-600">
          Platform avg: {cat.platform_for_pct}% FOR
        </span>
        <span className="text-[10px] font-mono text-surface-600">FOR →</span>
      </div>
    </motion.div>
  )
}

// ─── Outlier Card ─────────────────────────────────────────────────────────────

function OutlierCard({
  vote,
  label,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  vote: OutlierVote
  label: string
  icon: typeof ThumbsUp
  iconColor: string
  iconBg: string
}) {
  return (
    <Link
      href={`/topic/${vote.topic_id}`}
      className="group block rounded-xl bg-surface-100 border border-surface-300 p-4 hover:border-surface-400/60 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-sm font-semibold text-white leading-snug group-hover:text-for-300 transition-colors">
            {truncate(vote.statement, 90)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={statusBadge(vote.status)} size="xs">
              {vote.status.toUpperCase()}
            </Badge>
            {vote.category && (
              <span className="text-[11px] font-mono text-surface-500">{vote.category}</span>
            )}
            <span
              className={cn(
                'text-[11px] font-mono font-semibold ml-auto',
                vote.user_side === 'for' ? 'text-for-400' : 'text-against-400',
              )}
            >
              You voted {vote.user_side.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Users className="h-3 w-3 text-surface-500" />
            <span className="text-[11px] font-mono text-surface-500">
              {vote.minority_pct}% of voters agree · {vote.total_votes.toLocaleString()} total
            </span>
            <ExternalLink className="h-3 w-3 text-surface-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  icon: typeof BarChart2
  color: string
}) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60">
      <div className={cn('flex items-center gap-1.5', color)}>
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-mono uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-mono font-bold text-white leading-none">{value}</p>
      {sub && <p className="text-[11px] text-surface-500 font-mono">{sub}</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FingerprintPage() {
  const router = useRouter()
  const [data, setData] = useState<FingerprintData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shared, setShared] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/fingerprint')
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load fingerprint')
      const json = (await res.json()) as FingerprintData
      setData(json)
    } catch {
      setError('Failed to load your fingerprint. Try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  async function handleShare() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My Civic Fingerprint · Lobby Market', url })
      } else {
        await navigator.clipboard.writeText(url)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <Link
              href="/analytics"
              className={cn(
                'flex-shrink-0 flex items-center justify-center mt-0.5 h-9 w-9 rounded-lg',
                'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
              )}
              aria-label="Back to analytics"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Fingerprint</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                How unique is your civic voice?
              </p>
            </div>
          </div>
          <button
            onClick={handleShare}
            aria-label="Share fingerprint"
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono',
              'border transition-all',
              shared
                ? 'bg-emerald/10 border-emerald/40 text-emerald'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
            )}
          >
            <Share2 className="h-3.5 w-3.5" />
            {shared ? 'Copied!' : 'Share'}
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}

        {loading && <PageSkeleton />}

        {!loading && error && (
          <div className="text-center py-20">
            <p className="text-surface-500 text-sm font-mono mb-4">{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-surface-200 text-surface-500 hover:text-white text-sm font-mono transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {/* ── Identity card ────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn('rounded-2xl border p-5', scoreBg(data.fingerprint_score))}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="relative flex-shrink-0">
                    <div
                      className={cn(
                        'flex items-center justify-center h-14 w-14 rounded-xl border',
                        scoreBg(data.fingerprint_score),
                      )}
                    >
                      <Fingerprint className={cn('h-7 w-7', scoreColor(data.fingerprint_score))} />
                    </div>
                    {data.fingerprint_score >= 20 && (
                      <motion.div
                        className={cn('absolute -inset-1 rounded-xl border', scoreBg(data.fingerprint_score))}
                        animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.05, 1] }}
                        transition={{ duration: 2.5, repeat: Infinity }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('font-mono text-xl font-bold leading-tight', scoreColor(data.fingerprint_score))}>
                      {data.unique_label}
                    </p>
                    <p className="text-sm text-surface-400 mt-1 leading-relaxed">{data.unique_description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <StatPill
                    label="Fingerprint Score"
                    value={data.fingerprint_score}
                    sub="avg deviation"
                    icon={Fingerprint}
                    color={scoreColor(data.fingerprint_score)}
                  />
                  <StatPill
                    label="Consensus Align"
                    value={`${data.overall_alignment}%`}
                    sub={`${data.mainstream_votes} of ${data.total_votes}`}
                    icon={Users}
                    color="text-for-400"
                  />
                  <StatPill
                    label="Contrarian Votes"
                    value={data.minority_votes}
                    sub="in the minority"
                    icon={Zap}
                    color="text-gold"
                  />
                </div>
              </motion.div>

              {/* ── Outlier positions ─────────────────────────────────── */}
              {(data.rarest_position || data.most_mainstream) && (
                <div className="space-y-2.5">
                  <h2 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-wider">
                    Your Positions
                  </h2>
                  {data.rarest_position && (
                    <OutlierCard
                      vote={data.rarest_position}
                      label="Most Contrarian Vote"
                      icon={TrendingDown}
                      iconColor="text-against-400"
                      iconBg="bg-against-500/10 border-against-500/30"
                    />
                  )}
                  {data.most_mainstream && (
                    <OutlierCard
                      vote={data.most_mainstream}
                      label="Most Mainstream Vote"
                      icon={TrendingUp}
                      iconColor="text-for-400"
                      iconBg="bg-for-500/10 border-for-500/30"
                    />
                  )}
                </div>
              )}

              {/* ── Category deviation bars ───────────────────────────── */}
              {data.categories.length === 0 ? (
                <EmptyState
                  icon={BarChart2}
                  iconColor="text-surface-500"
                  title="No category data yet"
                  description="Vote on more topics across different categories to reveal your fingerprint."
                  actions={[{ label: 'Browse topics', href: '/', variant: 'primary' }]}
                />
              ) : (
                <div className="space-y-2.5">
                  <h2 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-wider">
                    Category Deviation
                  </h2>
                  <p className="text-xs text-surface-600 font-mono">
                    Bars show how far your votes lean from the platform average. Sorted by divergence.
                  </p>
                  {data.categories.map((cat, i) => (
                    <motion.div
                      key={cat.category}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <DeviationBar cat={cat} />
                    </motion.div>
                  ))}
                </div>
              )}

              {/* ── Related pages ─────────────────────────────────────── */}
              <div className="pt-2">
                <h2 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Explore More
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: '/compass', icon: BarChart2, label: 'Civic Compass', sub: 'Vote distribution radar' },
                    { href: '/cohort', icon: Users, label: 'Civic Tribe', sub: 'Who votes like you' },
                    { href: '/rivals', icon: Zap, label: 'Civic Rivals', sub: 'Who opposes you most' },
                    { href: '/positions', icon: ThumbsUp, label: 'Your Positions', sub: 'All your votes' },
                  ].map((link) => {
                    const Icon = link.icon
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="group flex items-center gap-2.5 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400/60 transition-colors"
                      >
                        <Icon className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-mono font-semibold text-white leading-tight">{link.label}</p>
                          <p className="text-[11px] font-mono text-surface-500">{link.sub}</p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-surface-600 ml-auto flex-shrink-0" />
                      </Link>
                    )
                  })}
                </div>
              </div>

              {/* ── Refresh ───────────────────────────────────────────── */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={load}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono text-surface-500 hover:text-white bg-surface-200/50 hover:bg-surface-200 border border-surface-300 transition-all"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh data
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
