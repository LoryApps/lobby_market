'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  Coins,
  ExternalLink,
  Gavel,
  Landmark,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { PlatformStatsResponse } from '@/app/api/platform-stats/route'

// ─── Animated counter ─────────────────────────────────────────────────────────

function AnimatedCount({ value, duration = 1400 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  const started = useRef(false)

  useEffect(() => {
    if (!inView || started.current || value === 0) return
    started.current = true
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(eased * value))
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [inView, value, duration])

  return <span ref={ref}>{display.toLocaleString()}</span>
}

// ─── Category color map ───────────────────────────────────────────────────────

const CAT_COLOR: Record<string, { bar: string; badge: string; text: string }> = {
  Politics:    { bar: 'bg-for-500',    badge: 'bg-for-500/15 border-for-500/30',    text: 'text-for-400'    },
  Economics:   { bar: 'bg-gold',       badge: 'bg-gold/15 border-gold/30',          text: 'text-gold'       },
  Technology:  { bar: 'bg-purple',     badge: 'bg-purple/15 border-purple/30',      text: 'text-purple'     },
  Science:     { bar: 'bg-emerald',    badge: 'bg-emerald/15 border-emerald/30',    text: 'text-emerald'    },
  Ethics:      { bar: 'bg-for-300',    badge: 'bg-for-300/15 border-for-300/30',    text: 'text-for-300'    },
  Philosophy:  { bar: 'bg-purple',     badge: 'bg-purple/15 border-purple/30',      text: 'text-purple'     },
  Culture:     { bar: 'bg-against-400',badge: 'bg-against-400/15 border-against-400/30', text: 'text-against-400' },
  Health:      { bar: 'bg-emerald',    badge: 'bg-emerald/15 border-emerald/30',    text: 'text-emerald'    },
  Education:   { bar: 'bg-gold',       badge: 'bg-gold/15 border-gold/30',          text: 'text-gold'       },
  Environment: { bar: 'bg-emerald',    badge: 'bg-emerald/15 border-emerald/30',    text: 'text-emerald'    },
  Other:       { bar: 'bg-surface-500',badge: 'bg-surface-500/15 border-surface-500/30', text: 'text-surface-500' },
}
function getCatColor(cat: string) {
  return CAT_COLOR[cat] ?? CAT_COLOR['Other']
}

// ─── Relative time ────────────────────────────────────────────────────────────

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string
  value: number
  icon: typeof Gavel
  color: string
  sub?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex flex-col gap-2"
    >
      <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl', color)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-3xl font-mono font-bold text-white">
        <AnimatedCount value={value} />
      </p>
      <p className="text-sm font-mono text-surface-500">{label}</p>
      {sub && <p className="text-xs text-surface-600 font-mono">{sub}</p>}
    </motion.div>
  )
}

// ─── Monthly sparkline ────────────────────────────────────────────────────────

function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null
  const max = Math.max(...points, 1)
  const h = 40
  const w = 120
  const step = w / (points.length - 1)
  const coords = (v: number, i: number) =>
    `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={points.map(coords).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        className={color}
      />
      {points.map((v, i) => {
        const [cx, cy] = coords(v, i).split(',')
        return (
          <circle key={i} cx={cx} cy={cy} r={3} className={cn('fill-current', color)} />
        )
      })}
    </svg>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, sub }: { icon: typeof Gavel; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-for-500/10 border border-for-500/30">
        <Icon className="h-4 w-4 text-for-400" />
      </div>
      <div>
        <h2 className="font-mono text-base font-bold text-white">{title}</h2>
        <p className="text-xs font-mono text-surface-500">{sub}</p>
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-12" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PlatformStatsClient() {
  const [data, setData] = useState<PlatformStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/platform-stats', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load stats')
      const json = (await res.json()) as PlatformStatsResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-for-500/10 border border-for-500/30">
                <BarChart2 className="h-6 w-6 text-for-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl md:text-3xl font-bold text-white">
                  Platform Stats
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Civic impact metrics — updated in real time
                </p>
              </div>
            </div>
            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh stats"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white text-xs font-mono transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {data && (
            <p className="mt-3 text-xs font-mono text-surface-600">
              Last updated {relTime(data.generatedAt)}
            </p>
          )}
        </div>

        {loading && !data && <LoadingState />}

        {error && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <p className="font-mono text-surface-500 text-sm">{error}</p>
            <button
              onClick={load}
              className="mt-4 px-4 py-2 rounded-lg bg-for-500/10 border border-for-500/30 text-for-400 font-mono text-sm hover:bg-for-500/20 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {data && (
          <div className="space-y-10">

            {/* ── Primary stat grid ────────────────────────────────────────── */}
            <section>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                <StatCard
                  label="Laws Established"
                  value={data.totals.laws}
                  icon={Gavel}
                  color="bg-gold/10 text-gold border border-gold/30"
                  sub="All time"
                />
                <StatCard
                  label="Total Votes Cast"
                  value={data.totals.votes}
                  icon={Scale}
                  color="bg-for-500/10 text-for-400 border border-for-500/30"
                  sub="Across all topics"
                />
                <StatCard
                  label="Citizens"
                  value={data.totals.users}
                  icon={Users}
                  color="bg-emerald/10 text-emerald border border-emerald/30"
                  sub="Registered"
                />
                <StatCard
                  label="Arguments"
                  value={data.totals.arguments}
                  icon={MessageSquare}
                  color="bg-purple/10 text-purple border border-purple/30"
                  sub="Debated"
                />
              </div>
            </section>

            {/* ── Secondary stat grid ──────────────────────────────────────── */}
            <section>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                <StatCard
                  label="Active Topics"
                  value={data.totals.activeTopics}
                  icon={Zap}
                  color="bg-for-500/10 text-for-400 border border-for-500/30"
                />
                <StatCard
                  label="In Voting"
                  value={data.totals.votingTopics}
                  icon={TrendingUp}
                  color="bg-purple/10 text-purple border border-purple/30"
                />
                <StatCard
                  label="Debates Held"
                  value={data.totals.debates}
                  icon={Shield}
                  color="bg-against-500/10 text-against-400 border border-against-500/30"
                />
                <StatCard
                  label="Coalitions"
                  value={data.totals.coalitions}
                  icon={Trophy}
                  color="bg-gold/10 text-gold border border-gold/30"
                />
              </div>
            </section>

            {/* ── Milestone progress ───────────────────────────────────────── */}
            <section>
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 md:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4 text-gold" />
                  <h2 className="font-mono text-sm font-bold text-white">Next Milestone</h2>
                </div>
                <div className="flex items-end justify-between mb-2">
                  <div>
                    <p className="font-mono text-xl font-bold text-white">
                      {data.milestone.current.toLocaleString()}
                      <span className="text-surface-500 text-base font-normal">
                        {' / '}{data.milestone.next.toLocaleString()}
                      </span>
                    </p>
                    <p className="text-sm font-mono text-surface-500 mt-0.5">
                      {data.milestone.label} reached
                    </p>
                  </div>
                  <p className="font-mono text-2xl font-bold text-gold">{data.milestone.pct}%</p>
                </div>
                <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${data.milestone.pct}%` }}
                    transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                    className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold"
                  />
                </div>
                <p className="mt-2 text-xs font-mono text-surface-600">
                  {(data.milestone.next - data.milestone.current).toLocaleString()} more to go
                </p>
              </div>
            </section>

            {/* ── Category breakdown ───────────────────────────────────────── */}
            {data.categoryBreakdown.length > 0 && (
              <section>
                <SectionHeader
                  icon={Landmark}
                  title="By Category"
                  sub="Laws and total engagement per civic category"
                />
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 md:p-6 space-y-4">
                  {data.categoryBreakdown.map((cat) => {
                    const maxLaws = data.categoryBreakdown[0]?.laws ?? 1
                    const pct = Math.round((cat.laws / Math.max(maxLaws, 1)) * 100)
                    const color = getCatColor(cat.category)
                    return (
                      <div key={cat.category}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'text-xs font-mono px-2 py-0.5 rounded-full border',
                                color.badge,
                                color.text
                              )}
                            >
                              {cat.category}
                            </span>
                            <span className="text-xs font-mono text-surface-600">
                              {cat.topics.toLocaleString()} topics
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-surface-500">
                              <ThumbsUp className="inline h-3 w-3 mr-0.5 text-for-400" />
                              {cat.forPct}%
                            </span>
                            <span className="font-mono text-sm font-semibold text-white">
                              {cat.laws} laws
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
                            className={cn('h-full rounded-full', color.bar)}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Monthly growth sparklines ────────────────────────────────── */}
            {data.monthlyGrowth.length > 0 && (
              <section>
                <SectionHeader
                  icon={TrendingUp}
                  title="Monthly Trends"
                  sub="Laws established and votes cast, last 6 months"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Laws */}
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                    <p className="font-mono text-xs text-surface-500 mb-3">Laws / month</p>
                    <div className="flex items-end justify-between gap-4">
                      <Sparkline
                        points={data.monthlyGrowth.map((m) => m.laws)}
                        color="text-gold"
                      />
                      <div className="text-right">
                        <p className="font-mono text-2xl font-bold text-white">
                          {data.monthlyGrowth[data.monthlyGrowth.length - 1]?.laws ?? 0}
                        </p>
                        <p className="text-xs font-mono text-surface-500">
                          {data.monthlyGrowth[data.monthlyGrowth.length - 1]?.label}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-3">
                      {data.monthlyGrowth.map((m) => (
                        <div key={m.month} className="flex-1 text-center">
                          <p className="text-xs font-mono text-surface-600">{m.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Votes */}
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                    <p className="font-mono text-xs text-surface-500 mb-3">Votes / month</p>
                    <div className="flex items-end justify-between gap-4">
                      <Sparkline
                        points={data.monthlyGrowth.map((m) => m.votes)}
                        color="text-for-400"
                      />
                      <div className="text-right">
                        <p className="font-mono text-2xl font-bold text-white">
                          {(data.monthlyGrowth[data.monthlyGrowth.length - 1]?.votes ?? 0).toLocaleString()}
                        </p>
                        <p className="text-xs font-mono text-surface-500">
                          {data.monthlyGrowth[data.monthlyGrowth.length - 1]?.label}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-3">
                      {data.monthlyGrowth.map((m) => (
                        <div key={m.month} className="flex-1 text-center">
                          <p className="text-xs font-mono text-surface-600">{m.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ── Recent laws ──────────────────────────────────────────────── */}
            {data.recentLaws.length > 0 && (
              <section>
                <SectionHeader
                  icon={Gavel}
                  title="Recently Established"
                  sub="The most recently passed laws on the platform"
                />
                <div className="space-y-2">
                  {data.recentLaws.map((law, i) => {
                    const forPct = Math.round(law.blue_pct)
                    const againstPct = 100 - forPct
                    const color = getCatColor(law.category ?? 'Other')
                    return (
                      <motion.div
                        key={law.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Link
                          href={`/law/${law.id}`}
                          className="flex items-start gap-4 rounded-xl bg-surface-100 border border-surface-300 p-4 hover:border-for-500/40 hover:bg-surface-200 transition-all group"
                        >
                          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gold/10 border border-gold/30 flex-shrink-0 mt-0.5">
                            <Gavel className="h-4 w-4 text-gold" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-sm text-white group-hover:text-for-300 transition-colors line-clamp-2">
                              {law.statement}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              {law.category && (
                                <span className={cn('text-xs font-mono px-2 py-0.5 rounded-full border', color.badge, color.text)}>
                                  {law.category}
                                </span>
                              )}
                              <span className="text-xs font-mono text-surface-600">
                                {relTime(law.established_at)}
                              </span>
                              <span className="text-xs font-mono text-surface-600">
                                {law.total_votes.toLocaleString()} votes
                              </span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="flex items-center gap-1 text-for-400 text-xs font-mono">
                              <ThumbsUp className="h-3 w-3" />{forPct}%
                            </div>
                            <div className="flex items-center gap-1 text-against-400 text-xs font-mono mt-0.5">
                              <ThumbsDown className="h-3 w-3" />{againstPct}%
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
                <Link
                  href="/laws"
                  className="flex items-center gap-1.5 mt-3 text-sm font-mono text-for-400 hover:text-for-300 transition-colors"
                >
                  View all laws <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </section>
            )}

            {/* ── Top contributors ─────────────────────────────────────────── */}
            {data.topContributors.length > 0 && (
              <section>
                <SectionHeader
                  icon={Trophy}
                  title="Top Contributors"
                  sub="Citizens with the highest Clout on the platform"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {data.topContributors.map((user, i) => (
                    <motion.div
                      key={user.username}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <Link
                        href={`/profile/${user.username}`}
                        className="flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-300 p-4 hover:border-for-500/40 hover:bg-surface-200 transition-all group"
                      >
                        <div className="relative flex-shrink-0">
                          <Avatar
                            src={user.avatarUrl ?? undefined}
                            username={user.username}
                            displayName={user.displayName ?? undefined}
                            size="md"
                          />
                          {i < 3 && (
                            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-surface-0 border border-surface-300 flex items-center justify-center text-[10px] font-mono font-bold text-gold">
                              {i + 1}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm font-semibold text-white truncate group-hover:text-for-300 transition-colors">
                            {user.displayName ?? user.username}
                          </p>
                          <p className="text-xs font-mono text-surface-500">@{user.username}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center gap-1 text-gold text-xs font-mono justify-end">
                            <Coins className="h-3 w-3" />
                            {user.clout.toLocaleString()}
                          </div>
                          <p className="text-xs font-mono text-surface-600 mt-0.5">
                            {user.totalVotes.toLocaleString()} votes
                          </p>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
                <Link
                  href="/leaderboard"
                  className="flex items-center gap-1.5 mt-3 text-sm font-mono text-for-400 hover:text-for-300 transition-colors"
                >
                  Full leaderboard <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </section>
            )}

            {/* ── Platform links ───────────────────────────────────────────── */}
            <section>
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 md:p-6">
                <h2 className="font-mono text-sm font-bold text-white mb-4">Explore the Platform</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { href: '/topics', label: 'All Topics', icon: Scale },
                    { href: '/laws', label: 'The Codex', icon: Gavel },
                    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
                    { href: '/debate', label: 'Debates', icon: MessageSquare },
                    { href: '/coalitions', label: 'Coalitions', icon: Users },
                    { href: '/analytics', label: 'My Stats', icon: BarChart2 },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2.5 rounded-xl bg-surface-200 border border-surface-300 px-4 py-3 text-sm font-mono text-surface-500 hover:text-white hover:border-for-500/40 transition-all"
                    >
                      <Icon className="h-4 w-4 text-for-400 flex-shrink-0" />
                      {label}
                      <ExternalLink className="h-3 w-3 ml-auto text-surface-600" />
                    </Link>
                  ))}
                </div>
              </div>
            </section>

          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
