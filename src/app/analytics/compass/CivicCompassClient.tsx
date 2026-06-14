'use client'

/**
 * /analytics/compass — Civic Compass
 *
 * An 8-axis radar chart that maps each user's FOR/AGAINST vote history
 * across civic policy domains, revealing their political profile and
 * assigning a named civic archetype.
 *
 * Data source: GET /api/analytics/compass
 *
 * Distinct from:
 *   /analytics/fingerprint  — deviation from platform average
 *   /analytics/alignment    — comparison with another user
 *   /analytics/bias         — cognitive bias detection
 *   /compass                — platform-wide category heatmap (aggregate)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  Brain,
  ChevronRight,
  Compass,
  Cpu,
  DollarSign,
  FlaskConical,
  Heart,
  Landmark,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CompassData } from '@/app/api/analytics/compass/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const RADAR_SIZE = 280
const CENTER = RADAR_SIZE / 2
const MAX_RADIUS = 100

const COMPASS_AXES: {
  key: string
  label: string
  icon: typeof Landmark
  color: string
  lightColor: string
}[] = [
  { key: 'Politics',    label: 'Politics',    icon: Landmark,      color: '#3b82f6', lightColor: 'text-for-400' },
  { key: 'Economics',   label: 'Economics',   icon: DollarSign,    color: '#f59e0b', lightColor: 'text-gold' },
  { key: 'Technology',  label: 'Technology',  icon: Cpu,           color: '#8b5cf6', lightColor: 'text-purple' },
  { key: 'Ethics',      label: 'Ethics',      icon: Scale,         color: '#10b981', lightColor: 'text-emerald' },
  { key: 'Science',     label: 'Science',     icon: FlaskConical,  color: '#34d399', lightColor: 'text-emerald' },
  { key: 'Culture',     label: 'Culture',     icon: Music2,        color: '#f472b6', lightColor: 'text-against-300' },
  { key: 'Philosophy',  label: 'Philosophy',  icon: BookOpen,      color: '#a78bfa', lightColor: 'text-purple' },
  { key: 'Health',      label: 'Health',      icon: Heart,         color: '#34d399', lightColor: 'text-emerald' },
]

// ─── Radar geometry helpers ───────────────────────────────────────────────────

function polarXY(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  }
}

function buildPolygon(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') + ' Z'
}

// ─── SVG Radar Chart ──────────────────────────────────────────────────────────

function RadarChart({
  stats,
}: {
  stats: CompassData['stats']
}) {
  const n = COMPASS_AXES.length
  const angleStep = 360 / n

  // Map each axis to a value: forPct (0–100) → radius (0–MAX_RADIUS)
  // Also handle axes with no votes (total === 0) → plot at 0
  const userPoints = COMPASS_AXES.map((axis, i) => {
    const stat = stats.find((s) => s.category === axis.key)
    const val = stat && stat.total > 0 ? stat.forPct / 100 : 0
    return polarXY(i * angleStep, val * MAX_RADIUS)
  })

  const rings = [0.25, 0.5, 0.75, 1]

  const axes = COMPASS_AXES.map((axis, i) => {
    const angle = i * angleStep
    const outer = polarXY(angle, MAX_RADIUS)
    // Labels placed slightly beyond the max radius
    const labelDist = MAX_RADIUS + 22
    const labelPt = polarXY(angle, labelDist)
    return { axis, outer, labelPt, angle }
  })

  return (
    <svg
      viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
      className="w-full h-full"
      aria-label="Civic Compass radar chart"
      role="img"
    >
      {/* Grid rings */}
      {rings.map((r) => {
        const ringPts = COMPASS_AXES.map((_, i) =>
          polarXY(i * angleStep, r * MAX_RADIUS)
        )
        return (
          <path
            key={r}
            d={buildPolygon(ringPts)}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        )
      })}

      {/* Axis lines */}
      {axes.map(({ outer }, i) => (
        <line
          key={i}
          x1={CENTER}
          y1={CENTER}
          x2={outer.x}
          y2={outer.y}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}

      {/* User polygon — filled */}
      <path
        d={buildPolygon(userPoints)}
        fill="rgba(59,130,246,0.15)"
        stroke="#3b82f6"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Vertex dots */}
      {userPoints.map((pt, i) => {
        const stat = stats.find((s) => s.category === COMPASS_AXES[i].key)
        const hasVotes = stat && stat.total > 0
        return hasVotes ? (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={3.5}
            fill={COMPASS_AXES[i].color}
            stroke="#0d0f14"
            strokeWidth={1.5}
          />
        ) : null
      })}

      {/* Axis labels */}
      {axes.map(({ axis, labelPt }, i) => {
        const isLeft = labelPt.x < CENTER - 5
        const textAnchor = isLeft ? 'end' : labelPt.x > CENTER + 5 ? 'start' : 'middle'
        return (
          <text
            key={i}
            x={labelPt.x}
            y={labelPt.y}
            textAnchor={textAnchor}
            dominantBaseline="middle"
            fontSize={9}
            fontFamily="'JetBrains Mono', monospace"
            fill="rgba(255,255,255,0.45)"
            letterSpacing="0.05em"
          >
            {axis.label.toUpperCase()}
          </text>
        )
      })}

      {/* Center dot */}
      <circle cx={CENTER} cy={CENTER} r={3} fill="rgba(255,255,255,0.15)" />
    </svg>
  )
}

// ─── Category bar ─────────────────────────────────────────────────────────────

function CategoryBar({
  axis,
  stat,
  index,
}: {
  axis: (typeof COMPASS_AXES)[0]
  stat: CompassData['stats'][0] | undefined
  index: number
}) {
  const Icon = axis.icon
  const hasVotes = stat && stat.total > 0
  const forPct = hasVotes ? stat.forPct : 50
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-surface-400/60 transition-colors"
    >
      <div
        className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center border"
        style={{
          backgroundColor: `${axis.color}18`,
          borderColor: `${axis.color}40`,
        }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color: axis.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-white">{axis.label}</span>
          {hasVotes ? (
            <span className="text-[10px] font-mono text-surface-500">
              {stat.total} vote{stat.total !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-[10px] text-surface-600">no votes</span>
          )}
        </div>

        {hasVotes ? (
          <div className="relative h-1.5 rounded-full bg-surface-300/50 overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-for-500 transition-all duration-700"
              style={{ width: `${forPct}%` }}
            />
          </div>
        ) : (
          <div className="h-1.5 rounded-full bg-surface-300/30" />
        )}

        {hasVotes && (
          <div className="flex justify-between mt-1">
            <span className="text-[10px] font-mono text-for-400">{forPct}% FOR</span>
            <span className="text-[10px] font-mono text-against-400">{againstPct}% AGAINST</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Archetype card ───────────────────────────────────────────────────────────

function ArchetypeCard({ archetype }: { archetype: CompassData['archetype'] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative rounded-2xl border overflow-hidden"
      style={{
        borderColor: `${archetype.color}40`,
        background: `linear-gradient(135deg, ${archetype.color}12, transparent 60%)`,
      }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center border"
            style={{
              backgroundColor: `${archetype.color}20`,
              borderColor: `${archetype.color}50`,
            }}
          >
            <Brain className="h-4.5 w-4.5" style={{ color: archetype.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-0.5">
              Your civic archetype
            </p>
            <h3 className="text-base font-bold text-white leading-tight">{archetype.label}</h3>
            <p
              className="text-xs font-mono mt-0.5"
              style={{ color: archetype.color }}
            >
              {archetype.subtitle}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-surface-500 leading-relaxed">{archetype.description}</p>
      </div>
    </motion.div>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Vote
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface-100 border border-surface-300/60 flex-1">
      <Icon className="h-4 w-4" style={{ color }} />
      <span className="text-base font-bold font-mono text-white leading-none">{value}</span>
      <span className="text-[10px] text-surface-500 text-center leading-tight">{label}</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CivicCompassClient() {
  const router = useRouter()
  const [data, setData] = useState<CompassData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/compass')
      if (res.status === 401) {
        router.push('/auth/signin?next=/analytics/compass')
        return
      }
      if (!res.ok) throw new Error('Failed to load compass data')
      const json = (await res.json()) as CompassData
      setData(json)
    } catch {
      setError('Unable to load your Civic Compass. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  // ── Render: loading ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Render: error ────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 pt-20 pb-24">
          <EmptyState
            icon={Compass}
            iconColor="text-surface-500"
            title="Compass unavailable"
            description={error ?? 'Failed to load your Civic Compass.'}
            actions={[
              { label: 'Retry', onClick: () => load() },
              { label: 'Analytics home', href: '/analytics' },
            ]}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const overallLean =
    data.overallForPct >= 60
      ? 'FOR-leaning'
      : data.overallForPct <= 40
      ? 'AGAINST-leaning'
      : 'Balanced'

  const leanColor =
    data.overallForPct >= 60
      ? '#3b82f6'
      : data.overallForPct <= 40
      ? '#ef4444'
      : '#10b981'

  // ── Render: main ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-4">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Link
              href="/analytics"
              aria-label="Back to analytics"
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-surface-500" aria-hidden="true" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-white leading-tight flex items-center gap-1.5">
                <Compass className="h-4 w-4 text-for-400" aria-hidden="true" />
                Civic Compass
              </h1>
              <p className="text-xs text-surface-500">8-axis political radar</p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh compass data"
            className="h-8 w-8 flex items-center justify-center rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5 text-surface-500', refreshing && 'animate-spin')}
              aria-hidden="true"
            />
          </button>
        </motion.div>

        {/* ── Quick stats row ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="flex gap-2"
        >
          <StatPill
            icon={Vote}
            label="Total votes"
            value={data.totalVotes.toLocaleString()}
            color="#3b82f6"
          />
          <StatPill
            icon={Zap}
            label="Vote streak"
            value={`${data.voteStreak}d`}
            color="#f59e0b"
          />
          <StatPill
            icon={MessageSquare}
            label="Arguments"
            value={data.totalArguments.toLocaleString()}
            color="#8b5cf6"
          />
          <StatPill
            icon={TrendingUp}
            label="Overall lean"
            value={`${data.overallForPct}%`}
            color={leanColor}
          />
        </motion.div>

        {/* ── Radar chart card ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.08, duration: 0.4 }}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500">
                Vote distribution
              </p>
              <h2 className="text-sm font-bold text-white mt-0.5">
                Policy Domain Radar
              </h2>
            </div>
            <Badge
              variant={
                data.overallForPct >= 60
                  ? 'active'
                  : data.overallForPct <= 40
                  ? 'failed'
                  : 'proposed'
              }
              size="sm"
            >
              {overallLean}
            </Badge>
          </div>

          {data.totalVotes === 0 ? (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <Compass className="h-10 w-10 text-surface-600" aria-hidden="true" />
              <p className="text-sm font-semibold text-white">No votes cast yet</p>
              <p className="text-xs text-surface-500 max-w-xs">
                Cast your first votes to see your Civic Compass take shape. The radar updates
                automatically as you engage with topics.
              </p>
              <Link
                href="/"
                className="mt-1 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-semibold transition-colors"
              >
                Explore Topics
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <div className="w-full max-w-xs aspect-square">
                <RadarChart stats={data.stats} />
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mt-3 flex items-center gap-4 justify-center">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-5 rounded-full bg-for-500 opacity-70" />
              <span className="text-[10px] text-surface-500">FOR lean</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-px w-5 border-t border-white/20 border-dashed" />
              <span className="text-[10px] text-surface-500">No votes</span>
            </div>
          </div>
        </motion.div>

        {/* ── Archetype card ──────────────────────────────────────────────── */}
        <ArchetypeCard archetype={data.archetype} />

        {/* ── Category breakdown ──────────────────────────────────────────── */}
        <section aria-label="Category breakdown">
          <h2 className="text-xs font-mono uppercase tracking-widest text-surface-500 mb-3">
            Category Breakdown
          </h2>
          <div className="space-y-2">
            {COMPASS_AXES.map((axis, i) => {
              const stat = data.stats.find((s) => s.category === axis.key)
              return (
                <CategoryBar
                  key={axis.key}
                  axis={axis}
                  stat={stat}
                  index={i}
                />
              )
            })}
          </div>
        </section>

        {/* ── Related analytics links ─────────────────────────────────────── */}
        <section aria-label="Related analytics">
          <h2 className="text-xs font-mono uppercase tracking-widest text-surface-500 mb-3">
            Explore More
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { href: '/analytics/fingerprint', icon: Sparkles, label: 'Civic Fingerprint', sub: 'How you differ from consensus', color: '#3b82f6' },
              { href: '/analytics/bias',        icon: Scale,     label: 'Bias Detector',     sub: 'Ideological consistency check', color: '#ef4444' },
              { href: '/analytics/alignment',   icon: BarChart2, label: 'Alignment',          sub: 'Compare with another voter',   color: '#8b5cf6' },
              { href: '/analytics/diversity',   icon: TrendingUp,label: 'Diversity Score',   sub: 'Breadth of civic engagement',  color: '#10b981' },
            ].map(({ href, icon: Icon, label, sub, color }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
              >
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center border flex-shrink-0"
                  style={{ backgroundColor: `${color}18`, borderColor: `${color}40` }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color }} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{label}</p>
                  <p className="text-[11px] text-surface-500 truncate">{sub}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

      </main>
      <BottomNav />
    </div>
  )
}
