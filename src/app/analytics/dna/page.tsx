'use client'

/**
 * /analytics/dna — Argument DNA
 *
 * Deep analysis of your rhetorical style: what kind of civic arguer are you?
 * Surfaces your dominant archetype, six-dimensional style scores, grade
 * distribution, and your best arguments tagged by style.
 *
 * Uses /api/arguments/dna — no additional DB schema needed.
 *
 * Distinct from:
 *   /analytics/rhetoric   — writing pattern analysis (length, monthly trends)
 *   /analytics/arguments  — argument portfolio (arena record, grades by category)
 *   /analytics/sentiment  — emotional tone analysis
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  BookOpen,
  Brain,
  ExternalLink,
  Flame,
  MessageSquare,
  RefreshCw,
  Scale,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  TrendingUp,
  Zap,
  Check,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { DnaResponse, DnaArgument, DnaArchetype } from '@/app/api/arguments/dna/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

// ─── Style label + colour ─────────────────────────────────────────────────────

const STYLE_META: Record<string, { label: string; color: string; bar: string; desc: string }> = {
  empirical:  { label: 'Empirical',  color: 'text-for-400',     bar: 'bg-for-500',     desc: 'Evidence & data-driven' },
  moral:      { label: 'Moral',      color: 'text-purple',      bar: 'bg-purple',      desc: 'Values & ethics-based' },
  economic:   { label: 'Economic',   color: 'text-gold',        bar: 'bg-gold',        desc: 'Cost-benefit focused' },
  social:     { label: 'Social',     color: 'text-emerald',     bar: 'bg-emerald',     desc: 'People & community' },
  visionary:  { label: 'Visionary',  color: 'text-against-300', bar: 'bg-against-400', desc: 'Future-oriented' },
  pragmatic:  { label: 'Pragmatic',  color: 'text-surface-300', bar: 'bg-surface-400', desc: 'Solutions & realism' },
}

const GRADE_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  A:  { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  B:  { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  C:  { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  D:  { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  F:  { text: 'text-surface-500', bg: 'bg-surface-300/10', border: 'border-surface-300/30' },
}

const REACTION_LABELS: Record<string, { label: string; icon: typeof ThumbsUp }> = {
  insightful:    { label: 'Insightful',    icon: Brain },
  compelling:    { label: 'Compelling',    icon: Zap },
  balanced:      { label: 'Balanced',      icon: Scale },
  needs_evidence: { label: 'Needs Evidence', icon: BookOpen },
}

// ─── Radar / Spider chart ─────────────────────────────────────────────────────

const STYLE_DIMS = ['empirical', 'moral', 'economic', 'social', 'visionary', 'pragmatic']
const CHART_SIZE = 220
const CENTER = CHART_SIZE / 2
const MAX_R = CENTER - 28

function polarToXY(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) }
}

function RadarChart({
  scores,
  platformAvg,
}: {
  scores: Record<string, number>
  platformAvg: Record<string, number>
}) {
  const n = STYLE_DIMS.length
  const angleStep = 360 / n

  // Build polygon points for user + platform avg
  const userPts = STYLE_DIMS.map((d, i) => {
    const r = ((scores[d] ?? 0) / 100) * MAX_R
    return polarToXY(i * angleStep, r)
  })
  const avgPts = STYLE_DIMS.map((d, i) => {
    const r = ((platformAvg[d] ?? 0) / 100) * MAX_R
    return polarToXY(i * angleStep, r)
  })

  function polyPts(pts: { x: number; y: number }[]) {
    return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  }

  // Grid rings
  const rings = [25, 50, 75, 100]

  // Axis labels
  const axes = STYLE_DIMS.map((d, i) => {
    const angle = i * angleStep
    const labelR = MAX_R + 18
    const { x, y } = polarToXY(angle, labelR)
    const meta = STYLE_META[d]
    return { d, x, y, label: meta?.label ?? d, color: meta?.color ?? 'text-surface-500' }
  })

  return (
    <svg
      viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
      width={CHART_SIZE}
      height={CHART_SIZE}
      aria-label="Rhetorical style radar chart"
      className="overflow-visible"
    >
      {/* Grid rings */}
      {rings.map((pct) => {
        const r = (pct / 100) * MAX_R
        const pts = STYLE_DIMS.map((_, i) => polarToXY(i * angleStep, r))
        return (
          <polygon
            key={pct}
            points={polyPts(pts)}
            fill="none"
            stroke="#3f3f46"
            strokeWidth="1"
          />
        )
      })}

      {/* Axis spokes */}
      {STYLE_DIMS.map((_, i) => {
        const outer = polarToXY(i * angleStep, MAX_R)
        return (
          <line
            key={i}
            x1={CENTER} y1={CENTER}
            x2={outer.x.toFixed(1)} y2={outer.y.toFixed(1)}
            stroke="#3f3f46"
            strokeWidth="1"
          />
        )
      })}

      {/* Platform average area */}
      <polygon
        points={polyPts(avgPts)}
        fill="rgba(113,113,122,0.15)"
        stroke="#52525b"
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />

      {/* User area */}
      <motion.polygon
        points={polyPts(userPts)}
        fill="rgba(59,130,246,0.18)"
        stroke="#3b82f6"
        strokeWidth="2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      />

      {/* User dots */}
      {userPts.map((pt, i) => (
        <motion.circle
          key={i}
          cx={pt.x.toFixed(1)}
          cy={pt.y.toFixed(1)}
          r="3.5"
          fill="#3b82f6"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.4 + i * 0.05 }}
        />
      ))}

      {/* Axis labels */}
      {axes.map(({ d, x, y, label }) => {
        const meta = STYLE_META[d]
        return (
          <text
            key={d}
            x={x.toFixed(1)}
            y={y.toFixed(1)}
            textAnchor="middle"
            dominantBaseline="middle"
            className={cn('font-mono text-[9px] font-semibold uppercase tracking-wider', meta?.color)}
            fill="currentColor"
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}

// ─── Style dimension bar ──────────────────────────────────────────────────────

function StyleBar({
  dimension,
  score,
  platformAvg,
}: {
  dimension: string
  score: number
  platformAvg: number
}) {
  const meta = STYLE_META[dimension]
  if (!meta) return null

  return (
    <div className="flex items-center gap-3">
      <span className={cn('text-xs font-mono font-semibold w-20 shrink-0', meta.color)}>{meta.label}</span>
      <div className="flex-1 relative h-3 rounded-full bg-surface-200 overflow-hidden">
        {/* Platform avg marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-surface-500/60 z-10"
          style={{ left: `${platformAvg}%` }}
          title={`Platform avg: ${platformAvg}%`}
        />
        {/* User bar */}
        <motion.div
          className={cn('h-full rounded-full', meta.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-mono text-white w-8 text-right tabular-nums">{score}</span>
    </div>
  )
}

// ─── Archetype card ───────────────────────────────────────────────────────────

function ArchetypeCard({ archetype }: { archetype: DnaArchetype }) {
  const [copied, setCopied] = useState(false)

  function copyLink() {
    const url = `${window.location.origin}/analytics/dna`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        'relative rounded-2xl border-2 p-6 overflow-hidden',
        archetype.border,
        archetype.bg
      )}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 opacity-[0.06] blur-2xl rounded-2xl"
        style={{ background: 'radial-gradient(circle at 30% 40%, currentColor 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Icon */}
        <div className={cn('w-16 h-16 rounded-2xl flex items-center justify-center shrink-0', archetype.bg, 'border', archetype.border)}>
          <Brain className={cn('h-8 w-8', archetype.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className={cn('text-xs font-mono uppercase tracking-widest mb-1', archetype.color)}>
            Your Argument Archetype
          </div>
          <h2 className="text-2xl font-bold text-white leading-tight">{archetype.name}</h2>
          <p className={cn('text-sm font-mono mt-0.5', archetype.color)}>{archetype.tagline}</p>
          <p className="text-sm text-surface-400 mt-2 leading-relaxed">{archetype.description}</p>
        </div>

        <button
          onClick={copyLink}
          aria-label="Copy link"
          className={cn(
            'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
            copied
              ? 'bg-emerald/10 border-emerald/30 text-emerald'
              : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
          )}
        >
          {copied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
          {copied ? 'Copied!' : 'Share'}
        </button>
      </div>
    </motion.div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg }: { arg: DnaArgument }) {
  const isFor = arg.side === 'blue'
  const styleMeta = STYLE_META[arg.dominantStyle]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-surface-100 border border-surface-200 p-4 hover:border-surface-300 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg shrink-0 mt-0.5 text-xs font-bold', isFor ? 'bg-for-500/20 text-for-400' : 'bg-against-500/20 text-against-400')}>
          {isFor ? <ThumbsUp className="h-3.5 w-3.5" /> : <ThumbsDown className="h-3.5 w-3.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-surface-400 mb-1 font-mono">{truncate(arg.topic_statement, 80)}</p>
          <p className="text-sm text-white leading-relaxed">{truncate(arg.content, 180)}</p>
          <div className="flex items-center gap-3 mt-2.5 flex-wrap">
            {arg.ai_grade && (
              <span className={cn('text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border', GRADE_STYLES[arg.ai_grade.charAt(0)]?.text, GRADE_STYLES[arg.ai_grade.charAt(0)]?.bg, GRADE_STYLES[arg.ai_grade.charAt(0)]?.border)}>
                {arg.ai_grade}
              </span>
            )}
            {styleMeta && (
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-full border', styleMeta.color, 'bg-surface-200 border-surface-300')}>
                {styleMeta.label}
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
              <ThumbsUp className="h-3 w-3" />
              {arg.upvotes}
            </span>
            <span className="text-[10px] font-mono text-surface-600">{relDate(arg.created_at)}</span>
            <Link
              href={`/topic/${arg.topic_id}`}
              className="ml-auto text-[10px] font-mono text-surface-500 hover:text-white flex items-center gap-1 transition-colors"
            >
              View topic <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DnaSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-36 rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-56 rounded-xl" />
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 rounded-lg" />)}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArgumentDnaPage() {
  const router = useRouter()
  const [data, setData] = useState<DnaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'top' | 'recent'>('top')
  const loadedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/arguments/dna', { cache: 'no-store' })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load DNA')
      const json = (await res.json()) as DnaResponse
      if (!json.authenticated) {
        router.push('/login')
        return
      }
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    void load()
  }, [load])

  const displayArgs = tab === 'top' ? data?.topArguments ?? [] : data?.recentArguments ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 mb-6"
        >
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors shrink-0 mt-0.5"
            aria-label="Back to analytics"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-2xl font-bold text-white">Argument DNA</h1>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple/10 border border-purple/30">
                <Sparkles className="h-3 w-3 text-purple" />
                <span className="text-[10px] font-mono text-purple uppercase tracking-wide">Style Analysis</span>
              </div>
            </div>
            <p className="text-sm text-surface-500 font-mono mt-1">
              {data
                ? `${data.totalArguments} arguments analysed — ${data.forCount} FOR · ${data.againstCount} AGAINST`
                : 'Decoding your rhetorical fingerprint'}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="shrink-0 p-2 rounded-lg border border-surface-200 text-surface-500 hover:text-white hover:border-surface-300 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </motion.div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DnaSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={BarChart2}
                title="DNA Analysis Failed"
                description={error}
                actions={[{ label: 'Retry', onClick: load }]}
              />
            </motion.div>
          ) : !data || data.totalArguments === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={MessageSquare}
                title="No Arguments Yet"
                description="Write your first civic argument to unlock your Argument DNA."
                actions={[{ label: 'Browse Topics', href: '/' }]}
              />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* ── Archetype ──────────────────────────────────────────── */}
              <ArchetypeCard archetype={data.archetype} />

              {/* ── Radar + Bars ────────────────────────────────────────── */}
              <section aria-labelledby="style-heading">
                <h2 id="style-heading" className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Style Dimensions
                </h2>
                <div className="rounded-xl bg-surface-100 border border-surface-200 p-5">
                  <div className="flex flex-col sm:flex-row gap-6 items-center">
                    {/* Radar chart */}
                    <div className="shrink-0">
                      <RadarChart scores={data.styleScores} platformAvg={data.platformAvg} />
                      <p className="text-[10px] font-mono text-surface-600 text-center mt-1">
                        <span className="inline-block w-3 border-t border-dashed border-surface-500 mr-1" style={{ verticalAlign: 'middle' }} />
                        Platform avg
                      </p>
                    </div>

                    {/* Bar chart */}
                    <div className="flex-1 w-full space-y-3">
                      {STYLE_DIMS.map((dim) => (
                        <StyleBar
                          key={dim}
                          dimension={dim}
                          score={data.styleScores[dim] ?? 0}
                          platformAvg={data.platformAvg[dim] ?? 0}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Stats row ──────────────────────────────────────────── */}
              <section aria-labelledby="stats-heading">
                <h2 id="stats-heading" className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Snapshot
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([
                    { label: 'Total Args', value: data.totalArguments, icon: MessageSquare, color: 'text-for-400' },
                    { label: 'Avg Upvotes', value: data.avgUpvotes.toFixed(1), icon: ThumbsUp, color: 'text-emerald' },
                    { label: 'Avg Words', value: data.avgWordCount, icon: BookOpen, color: 'text-gold' },
                    { label: 'Best Streak', value: `${data.longestStreak}d`, icon: Flame, color: 'text-against-300' },
                  ] as const).map((stat) => (
                    <div key={stat.label} className="rounded-xl bg-surface-100 border border-surface-200 p-3.5 flex items-center gap-3">
                      <stat.icon className={cn('h-4 w-4 shrink-0', stat.color)} />
                      <div>
                        <p className="text-base font-bold text-white leading-none tabular-nums">{stat.value}</p>
                        <p className="text-[10px] font-mono text-surface-500 mt-0.5">{stat.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Grade distribution ─────────────────────────────────── */}
              {data.gradeDistribution.length > 0 && (
                <section aria-labelledby="grades-heading">
                  <h2 id="grades-heading" className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                    Grade Distribution
                  </h2>
                  <div className="rounded-xl bg-surface-100 border border-surface-200 p-4 space-y-2.5">
                    {data.gradeDistribution.map((g) => {
                      const gs = GRADE_STYLES[g.grade.charAt(0)] ?? GRADE_STYLES['C']
                      return (
                        <div key={g.grade} className="flex items-center gap-3">
                          <span className={cn('text-xs font-mono font-bold w-6 text-center rounded px-1 py-0.5 border', gs.text, gs.bg, gs.border)}>
                            {g.grade}
                          </span>
                          <div className="flex-1 h-2.5 rounded-full bg-surface-200 overflow-hidden">
                            <motion.div
                              className={cn('h-full rounded-full', gs.bg.replace('bg-', 'bg-').replace('/10', ''))}
                              style={{ background: g.grade.startsWith('A') ? '#10b981' : g.grade.startsWith('B') ? '#3b82f6' : g.grade.startsWith('C') ? '#f59e0b' : '#ef4444' }}
                              initial={{ width: 0 }}
                              animate={{ width: `${g.pct}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                          </div>
                          <span className="text-xs font-mono text-surface-400 w-14 text-right tabular-nums">
                            {g.count} ({g.pct}%)
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* ── Reactions ─────────────────────────────────────────── */}
              {Object.values(data.reactionTotals).some((v) => v > 0) && (
                <section aria-labelledby="reactions-heading">
                  <h2 id="reactions-heading" className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                    How Others React
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(REACTION_LABELS).map(([key, { label, icon: Icon }]) => {
                      const count = data.reactionTotals[key] ?? 0
                      return (
                        <div key={key} className="rounded-xl bg-surface-100 border border-surface-200 p-3 text-center">
                          <Icon className="h-5 w-5 mx-auto mb-1 text-surface-400" />
                          <p className="text-base font-bold text-white tabular-nums">{count}</p>
                          <p className="text-[10px] font-mono text-surface-500 mt-0.5">{label}</p>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* ── Category breakdown ────────────────────────────────── */}
              {data.categoryBreakdown.length > 0 && (
                <section aria-labelledby="categories-heading">
                  <h2 id="categories-heading" className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                    Category Activity
                  </h2>
                  <div className="rounded-xl bg-surface-100 border border-surface-200 overflow-hidden">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-surface-200">
                          <th className="text-left text-surface-500 font-medium py-2 px-4">Category</th>
                          <th className="text-right text-surface-500 font-medium py-2 px-3">Args</th>
                          <th className="text-right text-surface-500 font-medium py-2 px-3 hidden sm:table-cell">FOR</th>
                          <th className="text-right text-surface-500 font-medium py-2 px-3 hidden sm:table-cell">AGAINST</th>
                          <th className="text-right text-surface-500 font-medium py-2 px-4">Avg ↑</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.categoryBreakdown.map((row, i) => (
                          <motion.tr
                            key={row.category}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="border-b border-surface-200/60 last:border-0 hover:bg-surface-200/30 transition-colors"
                          >
                            <td className="py-2.5 px-4 text-white">{row.category}</td>
                            <td className="py-2.5 px-3 text-right text-surface-400">{row.count}</td>
                            <td className="py-2.5 px-3 text-right text-for-400 hidden sm:table-cell">{row.forCount}</td>
                            <td className="py-2.5 px-3 text-right text-against-400 hidden sm:table-cell">{row.againstCount}</td>
                            <td className="py-2.5 px-4 text-right text-emerald">{row.avgUpvotes.toFixed(1)}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* ── Top / Recent arguments ─────────────────────────────── */}
              <section aria-labelledby="arguments-heading">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 id="arguments-heading" className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                    Arguments
                  </h2>
                  <div className="flex rounded-lg border border-surface-300 overflow-hidden">
                    {(['top', 'recent'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={cn(
                          'px-3 py-1 text-xs font-mono capitalize transition-colors',
                          tab === t
                            ? 'bg-surface-300 text-white'
                            : 'bg-surface-100 text-surface-400 hover:text-white'
                        )}
                      >
                        {t === 'top' ? 'Top' : 'Recent'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  {displayArgs.length === 0 ? (
                    <div className="rounded-xl bg-surface-100 border border-surface-200 p-6 text-center text-sm text-surface-500 font-mono">
                      No arguments to display.
                    </div>
                  ) : (
                    displayArgs.map((arg) => (
                      <ArgumentCard key={arg.id} arg={arg} />
                    ))
                  )}
                </div>
              </section>

              {/* ── Related pages ───────────────────────────────────────── */}
              <section aria-labelledby="related-heading">
                <h2 id="related-heading" className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Related Analytics
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    { href: '/analytics/rhetoric',  label: 'Rhetorical Style',   sub: 'Writing patterns & monthly evolution',   icon: Trophy,      color: 'text-gold' },
                    { href: '/analytics/arguments', label: 'Argument Portfolio', sub: 'Grades, arena record, category breakdown', icon: Award,       color: 'text-purple' },
                    { href: '/analytics/sentiment', label: 'Emotional Tone',     sub: 'How your arguments feel emotionally',     icon: BarChart2,   color: 'text-for-400' },
                    { href: '/analytics/depth',     label: 'Engagement Depth',   sub: 'How deeply you engage with each topic',   icon: TrendingUp,  color: 'text-emerald' },
                  ] as const).map((link) => (
                    <Link key={link.href} href={link.href}>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-200 hover:border-surface-300 transition-colors group">
                        <link.icon className={cn('h-4 w-4 shrink-0', link.color)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{link.label}</p>
                          <p className="text-xs text-surface-500 truncate">{link.sub}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-white transition-colors shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
