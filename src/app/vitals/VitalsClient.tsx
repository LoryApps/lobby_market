'use client'

/**
 * /vitals — Civic Vitals Dashboard
 *
 * A quality-focused health report for the platform's civic discourse.
 * Unlike /transparency (raw volume) and /stats (totals), this page answers:
 * "How GOOD is our deliberation? Are we getting better or worse?"
 *
 * Sections:
 *   1. Overall Discourse Quality Score (composite 0–100)
 *   2. Argument Grade Distribution (A/B/C/D/F breakdown)
 *   3. Deliberation Depth (are voters also arguing?)
 *   4. Consensus Health (resolution rate, law rate, stuck topics)
 *   5. Evidence Quality (% cited arguments)
 *   6. Category Breakdown (which topics drive the best discourse)
 *   7. 7-Day Trend (daily argument quality)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Gavel,
  Heart,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { VitalsReport, GradeDistribution, DailyQuality, CategoryVitals } from '@/app/api/vitals/route'

// ─── Grade config ─────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<string, { label: string; bar: string; text: string; border: string; bg: string }> = {
  A: { label: 'Exceptional', bar: 'bg-emerald',       text: 'text-emerald',       border: 'border-emerald/40',      bg: 'bg-emerald/10' },
  B: { label: 'Strong',      bar: 'bg-for-500',       text: 'text-for-300',       border: 'border-for-500/40',      bg: 'bg-for-500/10' },
  C: { label: 'Adequate',    bar: 'bg-gold',           text: 'text-gold',          border: 'border-gold/40',         bg: 'bg-gold/10' },
  D: { label: 'Weak',        bar: 'bg-against-400',   text: 'text-against-300',   border: 'border-against-500/40',  bg: 'bg-against-500/10' },
  F: { label: 'Poor',        bar: 'bg-against-600',   text: 'text-against-400',   border: 'border-against-600/40',  bg: 'bg-against-600/10' },
}

const QUALITY_CONFIG: Record<string, { color: string; ring: string; glow: string; icon: typeof Sparkles }> = {
  Excellent: { color: 'text-emerald',     ring: 'ring-emerald/40',      glow: 'bg-emerald/10',    icon: Sparkles },
  Good:      { color: 'text-for-300',     ring: 'ring-for-500/40',      glow: 'bg-for-500/10',    icon: ThumbsUp },
  Fair:      { color: 'text-gold',        ring: 'ring-gold/40',         glow: 'bg-gold/10',       icon: Activity },
  'Needs Work': { color: 'text-against-300', ring: 'ring-against-500/40', glow: 'bg-against-500/10', icon: AlertTriangle },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'emerald' | 'for' | 'gold' | 'against' | 'purple'
  icon?: typeof Sparkles
}) {
  const accentMap = {
    emerald: 'text-emerald',
    for:     'text-for-400',
    gold:    'text-gold',
    against: 'text-against-400',
    purple:  'text-purple',
  } as const

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
      {Icon && (
        <div className={cn('mb-2', accent ? accentMap[accent] : 'text-surface-500')}>
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={cn('text-2xl font-mono font-bold', accent ? accentMap[accent] : 'text-white')}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      {sub && <div className="text-[11px] text-surface-500 mt-0.5">{sub}</div>}
    </div>
  )
}

function GradeBar({ grade, count, pct }: GradeDistribution) {
  const cfg = GRADE_CONFIG[grade] ?? GRADE_CONFIG['C']
  return (
    <div className="flex items-center gap-3">
      <div className={cn('flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border text-sm font-mono font-bold', cfg.text, cfg.bg, cfg.border)}>
        {grade}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-surface-400">{cfg.label}</span>
          <span className="text-xs font-mono text-white tabular-nums">{count.toLocaleString()} <span className="text-surface-500">({pct}%)</span></span>
        </div>
        <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            className={cn('h-full rounded-full', cfg.bar)}
          />
        </div>
      </div>
    </div>
  )
}

function DailyBar({ day, maxArgs }: { day: DailyQuality; maxArgs: number }) {
  const height = maxArgs > 0 ? Math.max(4, Math.round((day.arguments_posted / maxArgs) * 80)) : 4
  const qualityColor = day.a_grade >= 60 ? 'bg-emerald' : day.a_grade >= 40 ? 'bg-for-500' : day.a_grade >= 20 ? 'bg-gold' : 'bg-against-500'

  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <div className="text-[10px] font-mono text-surface-500 tabular-nums">{day.arguments_posted}</div>
      <div className="flex flex-col-reverse w-full" style={{ height: 88 }}>
        <div
          className={cn('w-full rounded-t transition-all', qualityColor, 'opacity-80')}
          style={{ height }}
          title={`${day.arguments_posted} args · ${day.a_grade}% high-quality`}
        />
      </div>
      <div className="text-[9px] font-mono text-surface-600 truncate w-full text-center">{day.label}</div>
    </div>
  )
}

function CategoryRow({ cat }: { cat: CategoryVitals }) {
  const lawRateColor = cat.law_rate >= 50 ? 'text-gold' : cat.law_rate >= 30 ? 'text-for-400' : 'text-surface-500'
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-surface-300/60 last:border-0">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-mono text-white truncate">{cat.category}</span>
      </div>
      <div className="text-right flex-shrink-0 flex items-center gap-4">
        <div className="text-right">
          <div className="text-[10px] text-surface-500 font-mono">Topics</div>
          <div className="text-xs font-mono text-white tabular-nums">{cat.topics}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-surface-500 font-mono">Law rate</div>
          <div className={cn('text-xs font-mono tabular-nums', lawRateColor)}>{cat.law_rate}%</div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function VitalsClient() {
  const [data, setData] = useState<VitalsReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/vitals', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load vitals')
      const json = (await res.json()) as VitalsReport
      setData(json)
    } catch {
      setError('Could not load Civic Vitals. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const qualityCfg = data ? (QUALITY_CONFIG[data.quality_label] ?? QUALITY_CONFIG['Fair']) : null
  const QualityIcon = qualityCfg?.icon ?? Activity
  const maxArgs = data ? Math.max(...data.daily.map((d) => d.arguments_posted), 1) : 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Heart className="h-5 w-5 text-against-400" />
              <h1 className="font-mono text-2xl font-bold text-white">Civic Vitals</h1>
            </div>
            <p className="text-sm font-mono text-surface-500">Platform discourse quality · live metrics</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh vitals"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 text-xs font-mono transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
            <Link
              href="/transparency"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 text-xs font-mono transition-colors"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Full Stats
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
            </div>
            <Skeleton className="h-52 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/10 p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-against-400 mx-auto mb-3" />
            <p className="text-sm font-mono text-against-300">{error}</p>
            <button onClick={() => load()} className="mt-3 px-4 py-1.5 rounded-lg bg-surface-200 text-xs font-mono text-white border border-surface-300 hover:border-surface-400">
              Try again
            </button>
          </div>
        ) : data ? (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-5"
            >

              {/* ── Quality Score Hero ───────────────────────────────────────── */}
              <div className={cn(
                'rounded-2xl border p-6 flex items-center gap-5',
                qualityCfg?.glow ?? 'bg-surface-100',
                'border-surface-300',
              )}>
                <div className={cn(
                  'flex-shrink-0 h-20 w-20 rounded-2xl flex items-center justify-center ring-4',
                  qualityCfg?.glow ?? 'bg-surface-200',
                  qualityCfg?.ring ?? 'ring-surface-400',
                )}>
                  <span className={cn('text-4xl font-mono font-black', qualityCfg?.color ?? 'text-white')}>
                    {data.quality_score}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <QualityIcon className={cn('h-4 w-4', qualityCfg?.color)} />
                    <span className={cn('text-lg font-mono font-bold', qualityCfg?.color)}>
                      {data.quality_label}
                    </span>
                    <Badge variant="proposed" className="text-[10px]">
                      Discourse Quality
                    </Badge>
                  </div>
                  <p className="text-sm text-surface-400 font-mono mb-3">
                    Composite score across argument quality, deliberation depth, consensus health, and evidence citation.
                  </p>
                  <div className="flex items-center gap-4 text-xs font-mono text-surface-500">
                    <span className="flex items-center gap-1">
                      <Award className="h-3 w-3 text-emerald" />
                      {data.pct_high_quality}% high-quality args
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-for-400" />
                      {data.deliberators_pct}% voters also argue
                    </span>
                    <span className="flex items-center gap-1">
                      <Gavel className="h-3 w-3 text-gold" />
                      {data.law_rate}% resolve as law
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Key metrics row ──────────────────────────────────────────── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  label="High-quality args"
                  value={`${data.pct_high_quality}%`}
                  sub={`of ${data.total_graded.toLocaleString()} graded`}
                  accent="emerald"
                  icon={Award}
                />
                <StatCard
                  label="Deliberation ratio"
                  value={`${data.deliberation_ratio}`}
                  sub="args per 100 votes"
                  accent="for"
                  icon={ThumbsUp}
                />
                <StatCard
                  label="Law passage rate"
                  value={`${data.law_rate}%`}
                  sub={`${data.resolution_rate}% of topics resolve`}
                  accent="gold"
                  icon={Gavel}
                />
                <StatCard
                  label="Evidence cited"
                  value={`${data.sourced_arguments_pct}%`}
                  sub="arguments with sources"
                  accent="purple"
                  icon={BookOpen}
                />
              </div>

              {/* ── Argument grade distribution ──────────────────────────────── */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                      <Award className="h-4 w-4 text-emerald" />
                      Argument Quality Distribution
                    </h2>
                    <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                      AI-graded across {data.total_graded.toLocaleString()} arguments
                    </p>
                  </div>
                  <Link
                    href="/arguments/top-scored"
                    className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    Top scored <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {['A', 'B', 'C', 'D', 'F'].map((g) => {
                    const row = data.grade_distribution.find((d) => d.grade === g)
                    if (!row) return null
                    return <GradeBar key={g} {...row} />
                  })}
                </div>
              </div>

              {/* ── 7-day trend ──────────────────────────────────────────────── */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-for-400" />
                      7-Day Argument Activity
                    </h2>
                    <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                      Bar height = volume · colour = quality (green = high A/B rate)
                    </p>
                  </div>
                </div>
                <div className="flex items-end gap-1.5 h-28">
                  {data.daily.map((day) => (
                    <DailyBar key={day.date} day={day} maxArgs={maxArgs} />
                  ))}
                </div>
              </div>

              {/* ── Consensus health ─────────────────────────────────────────── */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2 mb-4">
                  <Scale className="h-4 w-4 text-gold" />
                  Consensus Health
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Resolution rate</div>
                    <div className="text-2xl font-mono font-bold text-white tabular-nums">{data.resolution_rate}%</div>
                    <div className="text-[11px] text-surface-500 mt-0.5">of all topics reach a verdict</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Law passage</div>
                    <div className="text-2xl font-mono font-bold text-gold tabular-nums">{data.law_rate}%</div>
                    <div className="text-[11px] text-surface-500 mt-0.5">of resolved topics pass as law</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Avg days to law</div>
                    <div className="text-2xl font-mono font-bold text-white tabular-nums">
                      {data.avg_days_to_law > 0 ? data.avg_days_to_law : '—'}
                    </div>
                    <div className="text-[11px] text-surface-500 mt-0.5">from proposed to established</div>
                  </div>
                </div>
                {data.stuck_topics > 0 && (
                  <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-against-500/10 border border-against-500/30">
                    <AlertTriangle className="h-4 w-4 text-against-400 flex-shrink-0" />
                    <span className="text-xs font-mono text-against-300">
                      {data.stuck_topics} topic{data.stuck_topics !== 1 ? 's' : ''} deadlocked for 30+ days without resolution.
                    </span>
                    <Link href="/split" className="ml-auto text-xs font-mono text-against-300 hover:text-against-200 flex items-center gap-0.5 flex-shrink-0">
                      View <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>

              {/* ── Category breakdown ───────────────────────────────────────── */}
              {data.categories.length > 0 && (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                      <Shield className="h-4 w-4 text-purple" />
                      Category Health
                    </h2>
                    <Link
                      href="/categories"
                      className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      Browse <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div>
                    {data.categories.map((cat) => (
                      <CategoryRow key={cat.category} cat={cat} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Footer links ─────────────────────────────────────────────── */}
              <div className="flex flex-wrap gap-2 pt-2">
                {[
                  { href: '/leaderboard/grades', label: 'Grades Leaderboard', icon: Award },
                  { href: '/arguments/top-scored', label: 'Top Scored Arguments', icon: ThumbsUp },
                  { href: '/accord', label: 'The Accord', icon: CheckCircle2 },
                  { href: '/split', label: 'Deadlocked Topics', icon: Scale },
                  { href: '/transparency', label: 'Full Transparency Report', icon: BarChart2 },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs font-mono text-surface-400 hover:text-white transition-colors"
                  >
                    <link.icon className="h-3 w-3" />
                    {link.label}
                  </Link>
                ))}
              </div>

            </motion.div>
          </AnimatePresence>
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
