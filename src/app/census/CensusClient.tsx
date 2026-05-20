'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Crown,
  Gavel,
  Globe,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  Swords,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { CensusData } from '@/app/api/census/route'

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-400',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

const ROLE_COLORS: Record<string, { text: string; bar: string; icon: typeof Users }> = {
  person:        { text: 'text-surface-400', bar: 'bg-surface-500',   icon: Users },
  debator:       { text: 'text-for-400',     bar: 'bg-for-500',       icon: Swords },
  troll_catcher: { text: 'text-emerald',     bar: 'bg-emerald',       icon: Shield },
  elder:         { text: 'text-gold',        bar: 'bg-gold',          icon: Crown },
}

const BAND_COLORS = [
  'bg-surface-400',
  'bg-for-700',
  'bg-for-500',
  'bg-gold',
  'bg-against-500',
]

// ─── Consensus donut (SVG) ────────────────────────────────────────────────────

function ConsensusDonut({ data }: { data: CensusData['consensus_quality'] }) {
  if (data.total === 0) {
    return <div className="h-48 flex items-center justify-center text-surface-500 text-sm">No data yet</div>
  }

  const segments = [
    { label: 'Supermajority', count: data.supermajority, color: '#3b82f6', lightColor: 'bg-for-500', textColor: 'text-for-400' },
    { label: 'Majority',      count: data.majority,      color: '#6366f1', lightColor: 'bg-purple',   textColor: 'text-purple' },
    { label: 'Contested',     count: data.contested,     color: '#f59e0b', lightColor: 'bg-gold',     textColor: 'text-gold' },
    { label: 'Deadlock',      count: data.deadlock,      color: '#ef4444', lightColor: 'bg-against-500', textColor: 'text-against-400' },
  ]

  const total = data.total
  const cx = 80, cy = 80, r = 60, innerR = 36
  let cumulative = 0

  const arcs = segments.map((seg) => {
    const fraction = seg.count / total
    const start = cumulative
    cumulative += fraction
    return { ...seg, fraction, start }
  })

  const gap = 0.01
  const paths = arcs.map((arc) => {
    const startAngle = (arc.start * 360 - 90) * (Math.PI / 180)
    const endAngle = ((arc.start + arc.fraction - gap) * 360 - 90) * (Math.PI / 180)
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const ix1 = cx + innerR * Math.cos(endAngle)
    const iy1 = cy + innerR * Math.sin(endAngle)
    const ix2 = cx + innerR * Math.cos(startAngle)
    const iy2 = cy + innerR * Math.sin(startAngle)
    const largeArc = arc.fraction > 0.5 ? 1 : 0
    return {
      ...arc,
      d: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`,
    }
  })

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg viewBox="0 0 160 160" className="h-36 w-36 flex-shrink-0">
        {paths.map((p) => (
          <path key={p.label} d={p.d} fill={p.color} opacity={0.85} />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#94a3b8" fontSize="11">
          topics
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="white" fontSize="18" fontWeight="700">
          {total}
        </text>
      </svg>

      <div className="flex flex-col gap-2 flex-1">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-3">
            <div className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', seg.lightColor)} />
            <span className="text-sm text-surface-400 flex-1">{seg.label}</span>
            <span className={cn('text-sm font-mono font-semibold tabular-nums', seg.textColor)}>
              {seg.count}
            </span>
            <span className="text-xs text-surface-500 w-10 text-right tabular-nums">
              {total > 0 ? Math.round((seg.count / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Ideology bar ─────────────────────────────────────────────────────────────

function IdeologyBar({ pct, label }: { pct: number; label: string }) {
  const leanFor = pct >= 50

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-surface-500 w-20 truncate shrink-0">{label}</span>
      <div className="flex-1 flex h-4 rounded-full overflow-hidden bg-surface-300">
        <div
          className="h-full bg-against-500 transition-all duration-700"
          style={{ width: `${100 - pct}%` }}
        />
        <div
          className="h-full bg-for-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center gap-1 shrink-0 w-24 justify-end">
        {leanFor ? (
          <ThumbsUp className="h-3 w-3 text-for-400" />
        ) : (
          <ThumbsDown className="h-3 w-3 text-against-400" />
        )}
        <span
          className={cn(
            'text-xs font-mono font-semibold tabular-nums',
            leanFor ? 'text-for-400' : 'text-against-400'
          )}
        >
          {leanFor ? `${Math.round(pct)}% FOR` : `${Math.round(100 - pct)}% AGN`}
        </span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CensusClient() {
  const [data, setData] = useState<CensusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/census', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load census data')
      const json = (await res.json()) as CensusData
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-8">

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Link
              href="/stats"
              className="p-2 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors text-surface-400 hover:text-white"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">Civic Census</h1>
              <p className="text-xs text-surface-500">
                Platform demographics & ideological analysis
              </p>
            </div>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing || loading}
              className="p-2 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors text-surface-400 hover:text-white disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-2xl" />
              ))}
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="rounded-2xl border border-against-500/30 bg-against-500/10 p-6 text-center">
              <p className="text-against-400 text-sm mb-3">{error}</p>
              <button
                onClick={() => fetchData()}
                className="text-xs text-surface-400 hover:text-white transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {/* Data */}
          {data && !loading && (
            <AnimatePresence mode="wait">
              <motion.div
                key="census"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="space-y-5"
              >
                {/* ── Totals ───────────────────────────────────────────────── */}
                <section className="rounded-2xl border border-surface-300/50 bg-surface-200/60 p-5 backdrop-blur-sm">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-surface-500 mb-4 flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5" />
                    Platform Overview
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { label: 'Citizens', value: data.totals.registered_citizens, icon: Users, color: 'text-for-400' },
                      { label: 'Votes Cast', value: data.totals.total_votes_cast, icon: Vote, color: 'text-for-400' },
                      { label: 'Active Topics', value: data.totals.active_topics, icon: TrendingUp, color: 'text-gold' },
                      { label: 'Established Laws', value: data.totals.established_laws, icon: Gavel, color: 'text-gold' },
                      { label: 'Arguments', value: data.totals.total_arguments, icon: MessageSquare, color: 'text-purple' },
                      { label: 'Coalitions', value: data.totals.coalitions, icon: Users, color: 'text-emerald' },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div key={label} className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <Icon className={cn('h-3 w-3', color)} />
                          <span className="text-[11px] text-surface-500">{label}</span>
                        </div>
                        <AnimatedNumber
                          value={value}
                          className={cn('text-2xl font-bold tabular-nums', color)}
                        />
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── Platform ideology ────────────────────────────────────── */}
                <section className="rounded-2xl border border-surface-300/50 bg-surface-200/60 p-5 backdrop-blur-sm">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-surface-500 mb-4 flex items-center gap-2">
                    <Scale className="h-3.5 w-3.5" />
                    Platform Ideology
                  </h2>

                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="rounded-xl bg-surface-300/40 p-3 text-center">
                      <div className="text-[11px] text-surface-500 mb-1">Overall FOR%</div>
                      <div
                        className={cn(
                          'text-2xl font-bold tabular-nums',
                          data.platform_ideology.overall_for_pct >= 50 ? 'text-for-400' : 'text-against-400'
                        )}
                      >
                        {data.platform_ideology.overall_for_pct}%
                      </div>
                    </div>
                    <div className="rounded-xl bg-surface-300/40 p-3 text-center">
                      <div className="text-[11px] text-surface-500 mb-1">Polarisation</div>
                      <div className="text-2xl font-bold tabular-nums text-gold">
                        {data.platform_ideology.polarisation_index}
                      </div>
                    </div>
                    <div className="rounded-xl bg-surface-300/40 p-3 text-center">
                      <div className="text-[11px] text-surface-500 mb-1">Consensus Rate</div>
                      <div className="text-2xl font-bold tabular-nums text-emerald">
                        {data.consensus_quality.total > 0
                          ? Math.round(
                              ((data.consensus_quality.supermajority + data.consensus_quality.majority) /
                                data.consensus_quality.total) *
                                100
                            )
                          : 0}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <ThumbsUp className="h-3 w-3 text-for-400" />
                      <span className="text-surface-500">Most progressive:</span>
                      <span className={cn('font-medium', CAT_COLOR[data.platform_ideology.most_pro_category ?? ''] ?? 'text-white')}>
                        {data.platform_ideology.most_pro_category ?? '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <ThumbsDown className="h-3 w-3 text-against-400" />
                      <span className="text-surface-500">Most skeptical:</span>
                      <span className={cn('font-medium', CAT_COLOR[data.platform_ideology.most_against_category ?? ''] ?? 'text-white')}>
                        {data.platform_ideology.most_against_category ?? '—'}
                      </span>
                    </div>
                  </div>
                </section>

                {/* ── Role distribution ─────────────────────────────────────── */}
                <section className="rounded-2xl border border-surface-300/50 bg-surface-200/60 p-5 backdrop-blur-sm">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-surface-500 mb-4 flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" />
                    Civic Hierarchy
                  </h2>

                  <div className="space-y-3">
                    {data.role_distribution.map((seg) => {
                      const config = ROLE_COLORS[seg.role] ?? ROLE_COLORS.person
                      const Icon = config.icon
                      return (
                        <div key={seg.role}>
                          <div className="flex items-center gap-3 mb-1.5">
                            <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', config.text)} />
                            <span className={cn('text-sm font-medium', config.text)}>{seg.label}</span>
                            <span className="text-xs text-surface-500 ml-auto">
                              {seg.count.toLocaleString()} · {seg.avg_votes} avg votes
                            </span>
                            <span className={cn('text-sm font-mono font-bold tabular-nums w-12 text-right', config.text)}>
                              {seg.pct}%
                            </span>
                          </div>
                          <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
                            <motion.div
                              className={cn('h-full rounded-full', config.bar)}
                              initial={{ width: 0 }}
                              animate={{ width: `${seg.pct}%` }}
                              transition={{ duration: 0.8, delay: 0.1 }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>

                {/* ── Activity distribution ─────────────────────────────────── */}
                <section className="rounded-2xl border border-surface-300/50 bg-surface-200/60 p-5 backdrop-blur-sm">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-surface-500 mb-4 flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5" />
                    Voter Activity
                  </h2>

                  <div className="space-y-2.5">
                    {data.activity_bands.map((band, i) => (
                      <div key={band.label}>
                        <div className="flex items-center gap-3 mb-1">
                          <div className={cn('h-2 w-2 rounded-full flex-shrink-0', BAND_COLORS[i])} />
                          <span className="text-sm text-white flex-1">{band.label}</span>
                          <span className="text-xs text-surface-500">{band.description}</span>
                          <span className="text-xs font-mono text-surface-400 w-16 text-right tabular-nums">
                            {band.count.toLocaleString()}
                          </span>
                          <span className="text-xs font-mono font-semibold text-white w-10 text-right tabular-nums">
                            {band.pct}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
                          <motion.div
                            className={cn('h-full rounded-full opacity-80', BAND_COLORS[i])}
                            initial={{ width: 0 }}
                            animate={{ width: `${band.pct}%` }}
                            transition={{ duration: 0.8, delay: i * 0.08 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── Consensus quality ─────────────────────────────────────── */}
                <section className="rounded-2xl border border-surface-300/50 bg-surface-200/60 p-5 backdrop-blur-sm">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-surface-500 mb-4 flex items-center gap-2">
                    <BarChart2 className="h-3.5 w-3.5" />
                    Consensus Quality
                  </h2>
                  <ConsensusDonut data={data.consensus_quality} />
                  <p className="text-xs text-surface-500 mt-4">
                    <span className="text-white font-medium">Supermajority</span> (≥75% one side) ·{' '}
                    <span className="text-white font-medium">Majority</span> (60–75%) ·{' '}
                    <span className="text-white font-medium">Contested</span> (45–60%) ·{' '}
                    <span className="text-white font-medium">Deadlock</span> (45–55%)
                  </p>
                </section>

                {/* ── Category ideology ─────────────────────────────────────── */}
                <section className="rounded-2xl border border-surface-300/50 bg-surface-200/60 p-5 backdrop-blur-sm">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-surface-500 mb-1 flex items-center gap-2">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Category Ideology
                  </h2>
                  <p className="text-xs text-surface-500 mb-4">
                    Average FOR% across all topics in each category. Blue = community leans FOR, red = leans AGAINST.
                  </p>

                  <div className="space-y-2.5">
                    {data.category_ideology.map((cat) => (
                      <div key={cat.category}>
                        <IdeologyBar pct={cat.avg_for_pct} label={cat.category} />
                        <div className="flex items-center gap-3 mt-0.5 ml-[5.5rem]">
                          <span className="text-[10px] text-surface-600">
                            {cat.topic_count} topic{cat.topic_count !== 1 ? 's' : ''}
                          </span>
                          {cat.law_count > 0 && (
                            <span className="text-[10px] text-gold flex items-center gap-0.5">
                              <Gavel className="h-2.5 w-2.5" />
                              {cat.law_count} law{cat.law_count !== 1 ? 's' : ''}
                            </span>
                          )}
                          {cat.supermajority_count > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[9px] h-3.5 px-1 border-for-500/30 text-for-400"
                            >
                              {cat.supermajority_count} supermajority
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── Footer ─────────────────────────────────────────────────── */}
                <div className="text-center">
                  <p className="text-xs text-surface-600">
                    Updated {new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="flex justify-center gap-4 mt-3">
                    <Link href="/stats" className="text-xs text-surface-500 hover:text-for-400 transition-colors">
                      State of the Lobby →
                    </Link>
                    <Link href="/heatmap" className="text-xs text-surface-500 hover:text-for-400 transition-colors">
                      Topic Heatmap →
                    </Link>
                    <Link href="/insights" className="text-xs text-surface-500 hover:text-for-400 transition-colors">
                      Platform Insights →
                    </Link>
                  </div>
                </div>

              </motion.div>
            </AnimatePresence>
          )}

        </div>
      </main>

      <BottomNav />
    </div>
  )
}
