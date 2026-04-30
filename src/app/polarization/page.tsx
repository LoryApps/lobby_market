'use client'

/**
 * /polarization — Civic Polarization Index
 *
 * Platform-wide consensus health dashboard: how divided or united is the Lobby?
 *
 * Shows:
 *   • A platform consensus score (0–100) with health label
 *   • Week-over-week trend (are we moving toward consensus or division?)
 *   • Per-category polarization bars (which topics generate the most heat?)
 *   • Most divided topics (closest to 50/50)
 *   • Most united topics (strongest community consensus)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Flame,
  Gavel,
  GitMerge,
  Minus,
  RefreshCw,
  Scale,
  Shield,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  PolarizationResponse,
  CategoryPolarization,
  PolarizationTopic,
} from '@/app/api/stats/polarization/route'

// ─── Category config ───────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, { text: string; fill: string; border: string }> = {
  Economics:   { text: 'text-gold',        fill: 'bg-gold',        border: 'border-gold/40' },
  Politics:    { text: 'text-for-400',     fill: 'bg-for-500',     border: 'border-for-500/40' },
  Technology:  { text: 'text-purple',      fill: 'bg-purple',      border: 'border-purple/40' },
  Science:     { text: 'text-emerald',     fill: 'bg-emerald',     border: 'border-emerald/40' },
  Ethics:      { text: 'text-against-400', fill: 'bg-against-500', border: 'border-against-500/40' },
  Philosophy:  { text: 'text-for-300',     fill: 'bg-for-400',     border: 'border-for-400/40' },
  Culture:     { text: 'text-gold',        fill: 'bg-gold',        border: 'border-gold/40' },
  Health:      { text: 'text-emerald',     fill: 'bg-emerald',     border: 'border-emerald/40' },
  Environment: { text: 'text-emerald',     fill: 'bg-emerald',     border: 'border-emerald/40' },
  Education:   { text: 'text-purple',      fill: 'bg-purple',      border: 'border-purple/40' },
}

function catColor(cat: string) {
  return CATEGORY_COLOR[cat] ?? { text: 'text-surface-400', fill: 'bg-surface-400', border: 'border-surface-400/40' }
}

// ─── Status badge map ─────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active:   'Active',
  voting:   'Voting',
  law:      'LAW',
  failed:   'Failed',
}

// ─── Health config ─────────────────────────────────────────────────────────────

const HEALTH_CONFIG = {
  unified: {
    label: 'Strong Consensus',
    sub: 'The Lobby is largely united. Most topics resolve with clear majorities.',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    ring: 'ring-emerald/20',
    glow: 'shadow-emerald/10',
    scoreColor: 'text-emerald',
  },
  healthy: {
    label: 'Healthy Debate',
    sub: 'Good balance of contested topics and clear consensus. Democracy working as intended.',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    ring: 'ring-for-500/20',
    glow: 'shadow-for-500/10',
    scoreColor: 'text-for-400',
  },
  contested: {
    label: 'Contested',
    sub: 'Many topics are closely fought. The community is actively deliberating.',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    ring: 'ring-gold/20',
    glow: 'shadow-gold/10',
    scoreColor: 'text-gold',
  },
  divided: {
    label: 'Deeply Divided',
    sub: 'Most topics are closely split. More debate and evidence is needed.',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    ring: 'ring-against-500/20',
    glow: 'shadow-against-500/10',
    scoreColor: 'text-against-400',
  },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  sub,
  color = 'text-white',
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500">{label}</span>
      <span className={cn('text-xl font-mono font-bold tabular-nums', color)}>{value}</span>
      {sub && <span className="text-[11px] font-mono text-surface-600">{sub}</span>}
    </div>
  )
}

function CategoryBar({ cat }: { cat: CategoryPolarization }) {
  const cc = catColor(cat.category)
  // consensusScore 0-100 → bar fill 0–100%
  const fill = Math.max(4, cat.consensusScore)
  const divided = cat.consensusScore < 40

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="flex items-center gap-3"
    >
      {/* Category label */}
      <span className={cn('w-24 text-xs font-mono font-semibold flex-shrink-0 truncate', cc.text)}>
        {cat.category}
      </span>

      {/* Bar track */}
      <div className="flex-1 h-2.5 rounded-full bg-surface-300/40 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', divided ? 'bg-against-500/70' : cc.fill)}
          initial={{ width: 0 }}
          animate={{ width: `${fill}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
          style={{ opacity: 0.85 }}
        />
      </div>

      {/* Score */}
      <span
        className={cn(
          'w-10 text-right text-xs font-mono font-bold flex-shrink-0 tabular-nums',
          divided ? 'text-against-400' : cc.text,
        )}
      >
        {cat.consensusScore}
      </span>

      {/* Topic count */}
      <span className="w-8 text-right text-[10px] font-mono text-surface-600 flex-shrink-0 tabular-nums">
        {cat.votedTopicCount}
      </span>
    </motion.div>
  )
}

function TopicRow({
  topic,
  mode,
}: {
  topic: PolarizationTopic
  mode: 'divided' | 'united'
}) {
  const forPct = topic.blue_pct
  const againstPct = 100 - forPct
  const cc = catColor(topic.category ?? '')

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/50 hover:border-surface-400/60 hover:bg-surface-200/80 transition-all group"
    >
      {/* Split indicator */}
      <div className="flex-shrink-0 mt-0.5">
        {mode === 'divided' ? (
          <Scale className="h-4 w-4 text-against-400" />
        ) : (
          <Shield className="h-4 w-4 text-emerald" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
          {topic.statement}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {topic.category && (
            <span className={cn('text-[10px] font-mono font-semibold', cc.text)}>
              {topic.category}
            </span>
          )}
          <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="xs">
            {STATUS_LABEL[topic.status] ?? topic.status}
          </Badge>
          <span className="text-[10px] font-mono text-surface-600">
            {fmtVotes(topic.total_votes)} votes
          </span>
        </div>

        {/* Vote bar */}
        <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-surface-300/40 flex">
          <div
            className="h-full bg-gradient-to-r from-for-700 to-for-500 rounded-l-full"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="h-full bg-against-600 rounded-r-full"
            style={{ width: `${againstPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] font-mono font-semibold text-for-400">{forPct}%</span>
          <span className="text-[10px] font-mono font-semibold text-against-400">{againstPct}%</span>
        </div>
      </div>

      <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 mt-1 group-hover:text-surface-400 transition-colors" />
    </Link>
  )
}

function TrendCard({
  trend,
}: {
  trend: PolarizationResponse['trend']
}) {
  const improving = trend.direction === 'toward_consensus'
  const worsening = trend.direction === 'toward_division'
  const stable = trend.direction === 'stable'

  const Icon = improving ? TrendingUp : worsening ? TrendingDown : Minus
  const color = improving ? 'text-emerald' : worsening ? 'text-against-400' : 'text-surface-400'
  const bg = improving ? 'bg-emerald/10' : worsening ? 'bg-against-500/10' : 'bg-surface-300/20'
  const border = improving ? 'border-emerald/30' : worsening ? 'border-against-500/30' : 'border-surface-400/30'
  const label = improving
    ? 'Moving toward consensus'
    : worsening
    ? 'Moving toward division'
    : 'Holding steady'
  const delta = Math.abs(trend.deltaPct)

  // Mini sparkline data: [twoWeeksAgo, lastWeek, thisWeek]
  const points = [trend.twoWeeksAgo, trend.lastWeek, trend.thisWeek]
  const max = Math.max(...points, 1)
  const sparkPoints = points
    .map((v, i) => `${i * 40},${20 - (v / max) * 18}`)
    .join(' ')

  return (
    <div className={cn('rounded-xl border p-4', bg, border)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', color)} />
          <span className={cn('text-sm font-mono font-semibold', color)}>{label}</span>
        </div>
        {!stable && (
          <span className={cn('text-xs font-mono font-bold', color)}>
            {improving ? '+' : '−'}{delta.toFixed(1)} pts/wk
          </span>
        )}
      </div>

      {/* Sparkline */}
      <div className="flex items-end gap-4">
        <svg width="88" height="24" className="flex-shrink-0">
          <polyline
            points={sparkPoints}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={color}
            opacity="0.7"
          />
          {points.map((_, i) => (
            <circle
              key={i}
              cx={i * 40}
              cy={20 - (points[i] / max) * 18}
              r="2"
              fill="currentColor"
              className={color}
            />
          ))}
        </svg>

        <div className="flex gap-5 text-[10px] font-mono text-surface-600">
          <div>
            <div className="text-surface-500">2 wks ago</div>
            <div className="text-white font-semibold">{trend.twoWeeksAgo}</div>
          </div>
          <div>
            <div className="text-surface-500">Last week</div>
            <div className="text-white font-semibold">{trend.lastWeek}</div>
          </div>
          <div>
            <div className="text-surface-500">This week</div>
            <div className={cn('font-semibold', color)}>{trend.thisWeek}</div>
          </div>
        </div>
      </div>

      <p className="text-[10px] font-mono text-surface-600 mt-2">
        Avg. contestedness score (|50 − FOR%|). Higher = closer to 50/50 = more divided.
      </p>
    </div>
  )
}

// ─── Skeleton loaders ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      {/* Health card */}
      <div className="rounded-2xl border border-surface-300 p-5 bg-surface-200/40">
        <Skeleton className="h-24 w-full mb-4" />
        <div className="flex gap-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-24" />
          ))}
        </div>
      </div>

      {/* Category bars */}
      <Skeleton className="h-48 w-full rounded-xl" />

      {/* Two topic lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PolarizationPage() {
  const [data, setData] = useState<PolarizationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<'divided' | 'united'>('divided')

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/stats/polarization')
      if (!res.ok) throw new Error('fetch failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const health = data ? HEALTH_CONFIG[data.platform.health] : null

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 pt-5 pb-24 md:pb-8 flex flex-col gap-5">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link
            href="/stats"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Back to stats"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white tracking-tight">
              Civic Polarization Index
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              How united — or divided — is the Lobby right now?
            </p>
          </div>

          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
              'disabled:opacity-40',
            )}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Loading / error ────────────────────────────────────────────────── */}
        {loading && !data && <LoadingSkeleton />}

        {error && !data && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Activity className="h-8 w-8 text-surface-500" />
            <p className="text-sm font-mono text-surface-500">Could not load polarization data.</p>
            <button
              onClick={load}
              className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {data && health && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-5"
            >

              {/* ── Platform Health Card ─────────────────────────────────────── */}
              <div
                className={cn(
                  'rounded-2xl border p-5',
                  health.bg,
                  health.border,
                  'shadow-lg',
                  health.glow,
                )}
              >
                {/* Score + label row */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className={cn('font-mono text-5xl font-black tabular-nums', health.scoreColor)}>
                        {data.platform.consensusScore}
                      </span>
                      <span className="text-surface-500 font-mono text-lg">/100</span>
                    </div>
                    <span className={cn('font-mono text-sm font-bold', health.color)}>
                      {health.label}
                    </span>
                  </div>

                  {/* Gauge arc (SVG) */}
                  <svg width="72" height="44" viewBox="0 0 72 44" className="flex-shrink-0 mt-1" aria-hidden>
                    {/* Track */}
                    <path
                      d="M 8 40 A 28 28 0 0 1 64 40"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="5"
                      strokeLinecap="round"
                      className="text-surface-300/40"
                    />
                    {/* Fill — strokeDasharray based on score */}
                    <path
                      d="M 8 40 A 28 28 0 0 1 64 40"
                      fill="none"
                      strokeWidth="5"
                      strokeLinecap="round"
                      stroke="currentColor"
                      strokeDasharray={`${(data.platform.consensusScore / 100) * 88} 88`}
                      className={health.color}
                    />
                    {/* Needle dot */}
                    <circle
                      cx={8 + (data.platform.consensusScore / 100) * 56}
                      cy={40 - Math.sin((data.platform.consensusScore / 100) * Math.PI) * 28}
                      r="3.5"
                      fill="currentColor"
                      className={health.color}
                    />
                  </svg>
                </div>

                <p className="text-xs font-mono text-surface-500 mb-4 leading-relaxed">
                  {health.sub}
                </p>

                {/* Stats row */}
                <div className="flex flex-wrap gap-6">
                  <StatBox
                    label="Topics"
                    value={data.platform.totalVotedTopics.toLocaleString()}
                    sub="with votes"
                    color="text-white"
                  />
                  <StatBox
                    label="Total votes"
                    value={fmtVotes(data.platform.totalVotes)}
                    color="text-white"
                  />
                  <StatBox
                    label="Avg. split"
                    value={`${data.platform.avgContestedness}pts`}
                    sub="from 50/50"
                    color={health.scoreColor}
                  />
                  <StatBox
                    label="Law pass rate"
                    value={`${data.platform.lawPassRate}%`}
                    sub="of resolved"
                    color="text-gold"
                  />
                </div>
              </div>

              {/* ── Week-over-week trend ──────────────────────────────────────── */}
              <TrendCard trend={data.trend} />

              {/* ── Category breakdown ────────────────────────────────────────── */}
              <div className="rounded-xl border border-surface-300 bg-surface-200/40 p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-surface-500" />
                    <h2 className="font-mono text-sm font-bold text-white">Consensus by Category</h2>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-surface-600">
                    <span>Score</span>
                    <span>Topics</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mb-3 text-[10px] font-mono text-surface-600">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-8 rounded-full bg-against-500/70" />
                    <span>Most divided (0)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-8 rounded-full bg-emerald" />
                    <span>Most united (100)</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  {data.categories.map((cat) => (
                    <CategoryBar key={cat.category} cat={cat} />
                  ))}
                </div>
              </div>

              {/* ── Topic Lists ────────────────────────────────────────────────── */}
              <div className="rounded-xl border border-surface-300 bg-surface-200/40 overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-surface-300">
                  {(['divided', 'united'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-3 text-xs font-mono font-semibold transition-colors',
                        tab === t
                          ? t === 'divided'
                            ? 'text-against-400 bg-against-500/8 border-b-2 border-against-500'
                            : 'text-emerald bg-emerald/8 border-b-2 border-emerald'
                          : 'text-surface-500 hover:text-surface-300 hover:bg-surface-300/20',
                      )}
                    >
                      {t === 'divided' ? (
                        <>
                          <Scale className="h-3.5 w-3.5" />
                          Most Divided
                        </>
                      ) : (
                        <>
                          <Shield className="h-3.5 w-3.5" />
                          Most United
                        </>
                      )}
                    </button>
                  ))}
                </div>

                {/* Topic list */}
                <div className="p-3 flex flex-col gap-2">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={tab}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="flex flex-col gap-2"
                    >
                      {(tab === 'divided' ? data.mostDivided : data.mostUnited).map((topic) => (
                        <TopicRow key={topic.id} topic={topic} mode={tab} />
                      ))}
                    </motion.div>
                  </AnimatePresence>

                  {tab === 'divided' ? (
                    <p className="text-[10px] font-mono text-surface-700 px-1 pt-1">
                      Topics with vote splits closest to 50/50 — where the community is most evenly matched.
                    </p>
                  ) : (
                    <p className="text-[10px] font-mono text-surface-700 px-1 pt-1">
                      Topics with the strongest community consensus — overwhelming agreement FOR or AGAINST.
                    </p>
                  )}
                </div>
              </div>

              {/* ── Footer links ──────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { href: '/split',    label: 'Most Contested',  icon: Scale },
                  { href: '/surge',    label: 'About to Vote',   icon: Zap },
                  { href: '/drift',    label: 'Opinion Drift',   icon: TrendingUp },
                  { href: '/heatmap',  label: 'Activity Heatmap', icon: Flame },
                  { href: '/law',      label: 'Law Codex',       icon: Gavel },
                  { href: '/spectrum', label: 'Civic Spectrum',  icon: GitMerge },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-lg',
                      'bg-surface-200/60 border border-surface-300/60',
                      'hover:border-surface-400/60 hover:bg-surface-200/90 transition-colors',
                      'text-xs font-mono text-surface-400 hover:text-white',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{label}</span>
                    <ArrowRight className="h-3 w-3 ml-auto flex-shrink-0" />
                  </Link>
                ))}
              </div>

              {/* Generated at */}
              <p className="text-[10px] font-mono text-surface-700 text-center">
                Refreshed {relativeTime(data.generated_at)} &middot; Topics with fewer than 5 votes excluded
              </p>

            </motion.div>
          </AnimatePresence>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
