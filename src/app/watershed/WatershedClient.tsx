'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  Droplets,
  Flame,
  Gavel,
  Globe,
  Landmark,
  RefreshCw,
  Scale,
  Sparkles,
  Timer,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import { graphColorForCategory } from '@/lib/utils/graph-colors'
import type { WatershedData, WatershedLaw, CategoryStat } from '@/app/api/watershed/route'

// ─── Category color helpers ───────────────────────────────────────────────────

const CATEGORY_BG: Record<string, string> = {
  Economics:    'bg-gold/10 border-gold/30 text-gold',
  Politics:     'bg-for-500/10 border-for-500/30 text-for-400',
  Technology:   'bg-purple/10 border-purple/30 text-purple',
  Science:      'bg-emerald/10 border-emerald/30 text-emerald',
  Ethics:       'bg-against-500/10 border-against-500/30 text-against-400',
  Philosophy:   'bg-purple/10 border-purple/30 text-purple',
  Culture:      'bg-orange-500/10 border-orange-500/30 text-orange-400',
  Health:       'bg-pink-500/10 border-pink-500/30 text-pink-400',
  Environment:  'bg-green-500/10 border-green-500/30 text-green-400',
  Education:    'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
}

function catClass(cat: string | null) {
  if (!cat) return 'bg-surface-300/30 border-surface-400/30 text-surface-500'
  return CATEGORY_BG[cat] ?? 'bg-surface-300/30 border-surface-400/30 text-surface-500'
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle: string
  color: string
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className={cn('flex-shrink-0 mt-0.5 p-2 rounded-xl border', color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="font-mono font-bold text-lg text-white">{title}</h2>
        <p className="text-sm text-surface-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  )
}

function LawCard({
  law,
  rank,
  highlight,
  badge,
  delay,
}: {
  law: WatershedLaw
  rank?: number
  highlight?: string
  badge?: React.ReactNode
  delay: number
}) {
  const forPct = Math.round(law.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <Link
        href={`/law/${law.id}`}
        className="block rounded-2xl bg-surface-100 border border-surface-300 p-5 hover:border-surface-400 transition-all hover:bg-surface-200/50 group"
      >
        <div className="flex items-start gap-3">
          {rank !== undefined && (
            <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-surface-300/60 text-xs font-mono font-bold text-surface-500 mt-0.5">
              {rank}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {law.category && (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider border',
                    catClass(law.category)
                  )}
                >
                  {law.category}
                </span>
              )}
              {badge}
            </div>
            <p className="text-sm font-semibold text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-3">
              {law.statement}
            </p>
            {highlight && (
              <p className="text-[11px] font-mono text-surface-500 mt-1.5">{highlight}</p>
            )}
            {/* Vote bar */}
            <div className="mt-3">
              <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
                <div
                  className="bg-for-500 transition-all"
                  style={{ width: `${forPct}%` }}
                />
                <div
                  className="bg-against-500 flex-1 transition-all"
                />
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] font-mono">
                <span className="text-for-400">{forPct}% For</span>
                <span className="text-surface-500">
                  {law.total_votes.toLocaleString()} votes
                </span>
                <span className="text-against-400">{againstPct}% Against</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function StatCard({
  value,
  label,
  icon: Icon,
  color,
  delay,
}: {
  value: number
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex flex-col gap-2"
    >
      <div className={cn('flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider', color)}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="font-mono text-3xl font-bold text-white">
        <AnimatedNumber value={value} />
      </div>
    </motion.div>
  )
}

function CategoryBar({ stat, max, delay }: { stat: CategoryStat; max: number; delay: number }) {
  const pct = Math.round((stat.count / max) * 100)
  const color = graphColorForCategory(stat.category)

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      className="flex items-center gap-3"
    >
      <div className="w-24 text-xs font-mono text-surface-400 truncate text-right flex-shrink-0">
        {stat.category}
      </div>
      <div className="flex-1 h-5 rounded-full bg-surface-300/40 overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay: delay + 0.1, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-[10px] font-mono font-semibold text-white mix-blend-screen">
          {stat.count}
        </span>
      </div>
      <div className="w-14 text-[10px] font-mono text-surface-500 flex-shrink-0">
        {stat.avg_blue_pct}% avg
      </div>
    </motion.div>
  )
}

function TimelineDot({
  law,
  index,
  total,
}: {
  law: WatershedLaw
  index: number
  total: number
}) {
  const color = graphColorForCategory(law.category)
  const date = new Date(law.established_at)
  const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })

  return (
    <Link href={`/law/${law.id}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, delay: 0.02 * Math.min(index, 30) }}
        title={`${law.statement}\n${label} · ${Math.round(law.blue_pct)}% For`}
        className="group relative flex flex-col items-center"
        style={{ flex: `0 0 ${Math.round(800 / total)}px`, minWidth: 8, maxWidth: 32 }}
      >
        <div
          className="w-2.5 h-2.5 rounded-full border-2 border-surface-100 transition-all group-hover:scale-150"
          style={{ backgroundColor: color }}
        />
        {index % Math.max(1, Math.floor(total / 8)) === 0 && (
          <span className="absolute top-4 text-[9px] font-mono text-surface-600 whitespace-nowrap rotate-45 origin-left translate-x-1">
            {label}
          </span>
        )}
      </motion.div>
    </Link>
  )
}

function WatershedSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-5 w-full mb-1.5" />
            <Skeleton className="h-5 w-4/5 mb-3" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WatershedClient() {
  const [data, setData] = useState<WatershedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/watershed', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load watershed data')
      setData(await res.json() as WatershedData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const maxCatCount = data
    ? Math.max(...data.category_stats.map((c) => c.count), 1)
    : 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Back link ── */}
        <div className="mb-6">
          <Link
            href="/laws"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Law Codex
          </Link>
        </div>

        {/* ── Hero ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-for-500/10 border border-for-500/30">
                <Droplets className="h-5 w-5 text-for-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">The Civic Watershed</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  The definitive record of consensus achieved
                </p>
              </div>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing || loading}
              className="flex-shrink-0 p-2 rounded-xl border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-all disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>
          <p className="text-sm text-surface-500 leading-relaxed ml-14">
            Every law represents the democratic will of the Lobby at a moment in time — a
            point where enough voices aligned to turn debate into doctrine. Here is the record.
          </p>
        </motion.div>

        {loading ? (
          <WatershedSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <Scale className="h-10 w-10 text-surface-500" />
            <p className="text-surface-500 font-mono text-sm">{error}</p>
            <button
              onClick={() => load()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : data && data.total_laws === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <Gavel className="h-10 w-10 text-surface-500" />
            <p className="text-lg font-mono font-bold text-white">No laws yet</p>
            <p className="text-surface-500 text-sm max-w-sm">
              The first laws will appear here once topics reach consensus. Cast your votes to make history.
            </p>
            <Link
              href="/"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
            >
              <Vote className="h-3.5 w-3.5" /> Go vote
            </Link>
          </div>
        ) : data ? (
          <div className="space-y-10">

            {/* ── Platform stats ── */}
            <section>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard value={data.total_laws} label="Laws enacted" icon={Landmark} color="text-for-400" delay={0} />
                <StatCard value={data.total_votes} label="Votes cast" icon={Vote} color="text-emerald" delay={0.05} />
                <StatCard value={data.avg_blue_pct} label="Avg consensus" icon={TrendingUp} color="text-gold" delay={0.1} />
                <StatCard value={data.platform_days} label="Days of debate" icon={Timer} color="text-purple" delay={0.15} />
              </div>
            </section>

            {/* ── Decisive Mandates ── */}
            {data.mandates.length > 0 && (
              <section>
                <SectionHeading
                  icon={Award}
                  title="The Decisive Mandates"
                  subtitle="Laws that passed with the strongest community consensus"
                  color="bg-gold/10 border-gold/30 text-gold"
                />
                <div className="space-y-3">
                  {data.mandates.map((law, i) => (
                    <LawCard
                      key={law.id}
                      law={law}
                      rank={i + 1}
                      delay={0.05 * i}
                      highlight={`${Math.round(law.blue_pct)}% consensus · ${law.total_votes.toLocaleString()} votes`}
                      badge={
                        i === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold border bg-gold/10 border-gold/30 text-gold">
                            <Sparkles className="h-2.5 w-2.5" /> Highest mandate
                          </span>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Razor's Edge ── */}
            {data.razor_edge.length > 0 && (
              <section>
                <SectionHeading
                  icon={Scale}
                  title="The Razor's Edge"
                  subtitle="Laws that passed by the thinnest margins — democracy at its most delicate"
                  color="bg-against-500/10 border-against-500/30 text-against-400"
                />
                <div className="space-y-3">
                  {data.razor_edge.map((law, i) => (
                    <LawCard
                      key={law.id}
                      law={law}
                      delay={0.05 * i}
                      highlight={`Passed by ${(Math.round(law.blue_pct) - 50).toFixed(1)}pp margin · ${law.total_votes.toLocaleString()} votes`}
                      badge={
                        i === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold border bg-against-500/10 border-against-500/30 text-against-400">
                            <Scale className="h-2.5 w-2.5" /> Closest call
                          </span>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── The Epics ── */}
            {data.epics.length > 0 && (
              <section>
                <SectionHeading
                  icon={Flame}
                  title="The Epics"
                  subtitle="Laws that drew the most civic engagement — the Lobby at full volume"
                  color="bg-against-500/10 border-against-500/30 text-against-400"
                />
                <div className="space-y-3">
                  {data.epics.map((law, i) => (
                    <LawCard
                      key={law.id}
                      law={law}
                      rank={i + 1}
                      delay={0.05 * i}
                      highlight={`${law.total_votes.toLocaleString()} votes cast · ${Math.round(law.blue_pct)}% For`}
                      badge={
                        i === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold border bg-against-500/10 border-against-500/30 text-against-400">
                            <Flame className="h-2.5 w-2.5" /> Most voted
                          </span>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── The Vanguard ── */}
            {data.vanguard.length > 0 && (
              <section>
                <SectionHeading
                  icon={Zap}
                  title="The Vanguard"
                  subtitle="Topics that became law fastest — ideas whose time had clearly come"
                  color="bg-emerald/10 border-emerald/30 text-emerald"
                />
                <div className="space-y-3">
                  {data.vanguard.map((law, i) => (
                    <LawCard
                      key={law.id}
                      law={law}
                      rank={i + 1}
                      delay={0.05 * i}
                      highlight={
                        law.days_to_law !== null
                          ? `Enacted in ${law.days_to_law} day${law.days_to_law !== 1 ? 's' : ''} · ${law.total_votes.toLocaleString()} votes`
                          : `${law.total_votes.toLocaleString()} votes`
                      }
                      badge={
                        i === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold border bg-emerald/10 border-emerald/30 text-emerald">
                            <Zap className="h-2.5 w-2.5" /> Fastest
                          </span>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Category distribution ── */}
            {data.category_stats.length > 0 && (
              <section>
                <SectionHeading
                  icon={BarChart2}
                  title="Legislative Landscape"
                  subtitle="Where the Lobby has spoken most and with what force"
                  color="bg-purple/10 border-purple/30 text-purple"
                />
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                  {data.category_stats.map((stat, i) => (
                    <CategoryBar
                      key={stat.category}
                      stat={stat}
                      max={maxCatCount}
                      delay={0.04 * i}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Timeline ── */}
            {data.timeline.length > 0 && (
              <section>
                <SectionHeading
                  icon={Globe}
                  title="The Lineage"
                  subtitle="Every law in chronological order — the arc of civic history"
                  color="bg-for-500/10 border-for-500/30 text-for-400"
                />
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="relative">
                    {/* Connector line */}
                    <div className="absolute top-[5px] left-0 right-0 h-px bg-surface-300" />
                    <div className="flex items-start gap-0 overflow-x-auto pb-10 scrollbar-thin">
                      {data.timeline.map((law, i) => (
                        <TimelineDot
                          key={law.id}
                          law={law}
                          index={i}
                          total={data.timeline.length}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-surface-600 mt-1">
                    <span>First law</span>
                    <span>Most recent</span>
                  </div>
                </div>
                {data.total_laws > 50 && (
                  <p className="text-center text-[11px] font-mono text-surface-600 mt-2">
                    Showing first 50 of {data.total_laws.toLocaleString()} laws
                  </p>
                )}
              </section>
            )}

            {/* ── CTA ── */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="rounded-2xl bg-gradient-to-br from-for-900/60 to-surface-100 border border-for-700/40 p-6 text-center"
            >
              <Gavel className="h-8 w-8 text-for-400 mx-auto mb-3" />
              <h3 className="font-mono font-bold text-white text-lg mb-1.5">
                Your vote shapes the next law
              </h3>
              <p className="text-sm text-surface-400 mb-4 max-w-sm mx-auto">
                Every topic above started as someone&apos;s proposal. Cast yours and see where it lands in the watershed.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
                >
                  <Vote className="h-4 w-4" /> Vote now
                </Link>
                <Link
                  href="/laws"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-surface-300 hover:border-surface-400 text-white text-sm font-mono transition-colors"
                >
                  <Landmark className="h-4 w-4" /> View all laws
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.section>

          </div>
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
