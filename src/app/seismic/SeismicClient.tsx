'use client'

/**
 * /seismic — Civic Seismic Monitor
 *
 * Anomaly detection for unexpected vote-burst activity. Unlike /canary (trend
 * signals) or /surge (threshold proximity), this detects SUDDEN deviations
 * from a topic's own baseline — sudden spikes far above the topic's normal
 * hourly rate.
 *
 * Magnitude scale (0–10, Richter-inspired):
 *   0–0.9  → Imperceptible — background noise
 *   1–2.9  → Rumble — noticeable uptick
 *   3–5.9  → Aftershock — significant deviation, possibly settling
 *   6–7.9  → Quake — major activity burst
 *   8–10   → Major Quake — extreme anomaly
 *
 * Distinct from:
 *   /canary   — early-warning trend signals (rising, quiet storm)
 *   /surge    — topics near activation thresholds
 *   /momentum — raw vote volume
 *   /rhythm   — temporal activity patterns
 *   /trending — cumulative popularity
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flame,
  Layers,
  RefreshCw,
  Rss,
  Radio,
  Waves,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { SeismicEvent, SeismicResponse } from '@/app/api/seismic/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTO_REFRESH_MS = 90_000

// ─── Magnitude helpers ────────────────────────────────────────────────────────

function magnitudeLabel(m: number): string {
  if (m >= 8) return 'Major Quake'
  if (m >= 6) return 'Quake'
  if (m >= 3) return 'Aftershock'
  if (m >= 1) return 'Rumble'
  return 'Quiet'
}

function magnitudeColor(m: number): string {
  if (m >= 8) return 'text-against-400'
  if (m >= 6) return 'text-orange-400'
  if (m >= 3) return 'text-gold'
  return 'text-for-400'
}

function magnitudeBg(m: number): string {
  if (m >= 8) return 'bg-against-500/10 border-against-500/30'
  if (m >= 6) return 'bg-orange-500/10 border-orange-500/30'
  if (m >= 3) return 'bg-gold/10 border-gold/30'
  return 'bg-for-500/10 border-for-500/30'
}

function magnitudeBarColor(m: number): string {
  if (m >= 8) return 'bg-against-500'
  if (m >= 6) return 'bg-orange-500'
  if (m >= 3) return 'bg-gold'
  return 'bg-for-500'
}

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'bg-gold/10 text-gold border-gold/30',
  Politics:    'bg-for-500/10 text-for-400 border-for-500/30',
  Technology:  'bg-purple/10 text-purple border-purple/30',
  Science:     'bg-emerald/10 text-emerald border-emerald/30',
  Ethics:      'bg-for-300/10 text-for-300 border-for-300/30',
  Philosophy:  'bg-purple/10 text-purple border-purple/30',
  Culture:     'bg-against-400/10 text-against-300 border-against-400/30',
  Health:      'bg-emerald/10 text-emerald border-emerald/30',
  Environment: 'bg-emerald/10 text-emerald border-emerald/30',
  Education:   'bg-gold/10 text-gold border-gold/30',
}

function catClass(cat: string | null) {
  if (!cat) return 'bg-surface-300/30 text-surface-500 border-surface-400/30'
  return CATEGORY_COLORS[cat] ?? 'bg-surface-300/30 text-surface-500 border-surface-400/30'
}

// ─── Seismic event card ───────────────────────────────────────────────────────

function SeismicCard({ event }: { event: SeismicEvent }) {
  const mag = event.magnitude
  const barWidth = Math.min(100, (mag / 10) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 transition-colors hover:border-surface-400/60',
        'bg-surface-100/80',
        magnitudeBg(mag)
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <Link href={`/topic/${event.id}`} className="group flex items-start gap-1.5">
            <span className="text-sm font-mono text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
              {event.statement}
            </span>
            <ExternalLink className="h-3 w-3 text-surface-500 flex-shrink-0 mt-0.5 group-hover:text-for-400 transition-colors" />
          </Link>
        </div>
        {/* Magnitude badge */}
        <div className={cn('flex-shrink-0 text-right')}>
          <div className={cn('font-mono text-2xl font-bold leading-none', magnitudeColor(mag))}>
            {mag.toFixed(1)}
          </div>
          <div className="text-[10px] font-mono text-surface-500 mt-0.5">magnitude</div>
        </div>
      </div>

      {/* Magnitude bar */}
      <div className="h-1.5 rounded-full bg-surface-300 mb-3 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn('h-full rounded-full', magnitudeBarColor(mag))}
        />
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {event.category && (
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-md border', catClass(event.category))}>
              {event.category}
            </span>
          )}
          <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-md border', magnitudeBg(mag), magnitudeColor(mag))}>
            {magnitudeLabel(mag)}
          </span>
          <Badge
            variant={
              event.status === 'law' ? 'law' :
              event.status === 'active' ? 'active' :
              event.status === 'voting' ? 'active' :
              'proposed'
            }
          />
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-surface-500">
          <span>{event.multiplier.toFixed(1)}× baseline</span>
          <span>·</span>
          <span>{event.total_votes.toLocaleString()} votes</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  count,
  color,
  iconBg,
  expanded,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
  count: number
  color: string
  iconBg: string
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between gap-3 group mb-3"
    >
      <div className="flex items-center gap-3">
        <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl border', iconBg)}>
          <Icon className={cn('h-4 w-4', color)} />
        </div>
        <div className="text-left">
          <div className={cn('font-mono text-sm font-semibold', color)}>{title}</div>
          <div className="text-xs font-mono text-surface-500 mt-0.5">{subtitle}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn('text-xs font-mono px-2 py-0.5 rounded-full border', iconBg, color)}>
          {count}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
        )}
      </div>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SeismicClient() {
  const [data, setData] = useState<SeismicResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [expandedSections, setExpandedSections] = useState({
    quakes: true,
    aftershocks: true,
    rumbles: false,
  })

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/seismic', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch')
      const json: SeismicResponse = await res.json()
      setData(json)
      setLastRefresh(new Date())
      setError(null)
    } catch {
      setError('Unable to reach the seismic monitor.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, AUTO_REFRESH_MS)
    return () => clearInterval(interval)
  }, [fetchData])

  const toggleSection = (key: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30">
                <Activity className="h-5 w-5 text-against-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Civic Seismic</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Anomaly detection for unexpected vote bursts
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/api/rss/seismic"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-orange-400 transition-colors"
                aria-label="Subscribe to Seismic RSS Feed"
                title="RSS Alert Feed"
              >
                <Rss className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">RSS</span>
              </a>
              <button
                onClick={fetchData}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {lastRefresh && (
                  <span>{lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </button>
            </div>
          </div>
          <p className="text-sm font-mono text-surface-500 max-w-2xl leading-relaxed">
            When a debate suddenly erupts with activity far above its normal pace, the Seismic
            Monitor registers it. Rated on a 0–10 magnitude scale — a 6.0 means the topic is
            receiving 4× its usual vote rate.
          </p>
        </div>

        {/* ── Platform stats row ── */}
        {loading && !data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        )}

        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              {
                label: 'Active Quakes',
                value: data.platform_stats.active_quakes,
                icon: Flame,
                color: 'text-against-400',
                bg: 'bg-against-500/10 border-against-500/20',
              },
              {
                label: 'Max Magnitude',
                value: data.platform_stats.highest_magnitude.toFixed(1),
                icon: Waves,
                color: 'text-orange-400',
                bg: 'bg-orange-500/10 border-orange-500/20',
                raw: true,
              },
              {
                label: 'Total Anomalies',
                value: data.platform_stats.total_anomalies,
                icon: AlertTriangle,
                color: 'text-gold',
                bg: 'bg-gold/10 border-gold/20',
              },
              {
                label: 'Hottest Category',
                value: data.platform_stats.most_affected_category ?? '—',
                icon: Layers,
                color: 'text-purple',
                bg: 'bg-purple/10 border-purple/20',
                isText: true,
              },
            ].map(({ label, value, icon: Icon, color, bg, raw, isText }) => (
              <div key={label} className={cn('rounded-xl border px-4 py-3', bg)}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className={cn('h-3.5 w-3.5', color)} />
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">{label}</span>
                </div>
                {isText ? (
                  <div className={cn('font-mono text-sm font-bold', color)}>{value as string}</div>
                ) : raw ? (
                  <div className={cn('font-mono text-xl font-bold', color)}>{value as string}</div>
                ) : (
                  <div className={cn('font-mono text-xl font-bold', color)}>
                    <AnimatedNumber value={value as number} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Error state ── */}
        {error && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/5 p-6 text-center mb-8">
            <AlertTriangle className="h-8 w-8 text-against-400 mx-auto mb-2" />
            <p className="text-sm font-mono text-against-300">{error}</p>
            <button
              onClick={fetchData}
              className="mt-3 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Sections ── */}
        {loading && !data ? (
          <div className="space-y-6">
            {[1, 2, 3].map((s) => (
              <div key={s}>
                <Skeleton className="h-6 w-48 mb-3" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
                </div>
              </div>
            ))}
          </div>
        ) : data ? (
          <div className="space-y-8">

            {/* Quakes */}
            <section>
              <SectionHeader
                icon={Flame}
                title="Seismic Quakes"
                subtitle="Magnitude 6.0+ — major unexpected bursts"
                count={data.quakes.length}
                color="text-against-400"
                iconBg="bg-against-500/10 border-against-500/30"
                expanded={expandedSections.quakes}
                onToggle={() => toggleSection('quakes')}
              />
              <AnimatePresence>
                {expandedSections.quakes && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {data.quakes.length === 0 ? (
                      <EmptyState
                        icon={Activity}
                        title="No active quakes"
                        description="No topics are experiencing major unexpected vote bursts right now. Check back soon."
                      />
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {data.quakes.map((event) => (
                          <SeismicCard key={event.id} event={event} />
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Aftershocks */}
            <section>
              <SectionHeader
                icon={Waves}
                title="Aftershocks"
                subtitle="Magnitude 3.0–5.9 — settling from a surge"
                count={data.aftershocks.length}
                color="text-gold"
                iconBg="bg-gold/10 border-gold/30"
                expanded={expandedSections.aftershocks}
                onToggle={() => toggleSection('aftershocks')}
              />
              <AnimatePresence>
                {expandedSections.aftershocks && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {data.aftershocks.length === 0 ? (
                      <EmptyState
                        icon={Waves}
                        title="No aftershocks detected"
                        description="No topics show moderate activity deviations right now."
                      />
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {data.aftershocks.map((event) => (
                          <SeismicCard key={event.id} event={event} />
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Rumbles */}
            <section>
              <SectionHeader
                icon={Radio}
                title="Low Rumbles"
                subtitle="Magnitude 1.0–2.9 — noticeable uptick in activity"
                count={data.rumbles.length}
                color="text-for-400"
                iconBg="bg-for-500/10 border-for-500/30"
                expanded={expandedSections.rumbles}
                onToggle={() => toggleSection('rumbles')}
              />
              <AnimatePresence>
                {expandedSections.rumbles && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {data.rumbles.length === 0 ? (
                      <EmptyState
                        icon={Radio}
                        title="No rumbles detected"
                        description="Activity looks normal across all active topics."
                      />
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {data.rumbles.map((event) => (
                          <SeismicCard key={event.id} event={event} />
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

          </div>
        ) : null}

        {/* ── How it works ── */}
        <div className="mt-12 rounded-2xl border border-surface-300 bg-surface-100 p-6">
          <h2 className="font-mono text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-surface-500" />
            How Civic Seismic Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono text-surface-500 leading-relaxed">
            <div>
              <div className="text-white font-semibold mb-1">Baseline</div>
              The normal vote rate for each topic is calculated from its full lifetime. A topic with
              1,000 votes over 200 hours has a baseline of 5 votes/hour.
            </div>
            <div>
              <div className="text-white font-semibold mb-1">Anomaly Detection</div>
              The current rate (last 2 hours) is compared to the baseline. A 3× spike = Aftershock.
              A 5× spike = Quake. Argument activity corroborates the signal.
            </div>
            <div>
              <div className="text-white font-semibold mb-1">Magnitude Scale</div>
              0–10 Richter-inspired: log₁₀(multiplier) × 5 + log₁₀(recent votes) × 0.8.
              Designed so a 10× spike with 100 recent votes scores approximately 7.0.
            </div>
          </div>
        </div>

        {/* ── Related pages ── */}
        <div className="mt-6 pt-6 border-t border-surface-300">
          <div className="text-xs font-mono text-surface-500 mb-3 uppercase tracking-widest">Related monitors</div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Canary', href: '/canary', color: 'text-gold' },
              { label: 'Surge', href: '/surge', color: 'text-for-400' },
              { label: 'Momentum', href: '/momentum', color: 'text-purple' },
              { label: 'Trending', href: '/trending', color: 'text-surface-600' },
              { label: 'Tipping Point', href: '/tipping-point', color: 'text-against-400' },
              { label: 'Canary', href: '/heat', color: 'text-orange-400' },
            ]
              .filter((v, i, a) => a.findIndex((x) => x.href === v.href) === i)
              .map(({ label, href, color }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
                    'border border-surface-300 bg-surface-100 hover:border-surface-400 hover:bg-surface-200 transition-colors',
                    color
                  )}
                >
                  {label}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ))}
          </div>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
