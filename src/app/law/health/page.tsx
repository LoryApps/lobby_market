'use client'

/**
 * /law/health — Law Codex Health Report
 *
 * A real-time dashboard showing the democratic legitimacy and community
 * engagement of the established law codex. Aggregates data across:
 *   - Formal challenges (constitutional, procedural, factual, ethical, practical)
 *   - Community verdict votes (did this law achieve its goals?)
 *   - Collaborative wiki edits (knowledge building)
 *   - Live discussion chat (ongoing civic debate)
 *
 * Health Score formula:
 *   30% verdict coverage + 30% wiki coverage + 20% discussion coverage + 20% challenge coverage
 *   Higher = more civic scrutiny applied to the codex.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  LawHealthResponse,
  ChallengedLaw,
  ContentiousLaw,
  ActiveLaw,
  WikidLaw,
} from '@/app/api/laws/health/route'

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_PILL: Record<string, string> = {
  Economics:   'bg-gold/10 text-gold border-gold/30',
  Politics:    'bg-for-500/10 text-for-400 border-for-500/30',
  Technology:  'bg-purple/10 text-purple border-purple/30',
  Science:     'bg-emerald/10 text-emerald border-emerald/30',
  Ethics:      'bg-against-500/10 text-against-400 border-against-500/30',
  Philosophy:  'bg-for-400/10 text-for-300 border-for-400/30',
  Culture:     'bg-gold/10 text-gold border-gold/30',
  Health:      'bg-emerald/10 text-emerald border-emerald/30',
  Environment: 'bg-emerald/10 text-emerald border-emerald/30',
  Education:   'bg-for-500/10 text-for-400 border-for-500/30',
}

function catPill(cat: string | null) {
  return cat && CAT_PILL[cat]
    ? CAT_PILL[cat]
    : 'bg-surface-300/40 text-surface-500 border-surface-400/40'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d < 1) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  const m = Math.floor(d / 30)
  if (m < 12) return `${m}mo ago`
  return `${Math.floor(m / 12)}yr ago`
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

// ─── Metric coverage gauge ────────────────────────────────────────────────────

function CoverageGauge({
  label,
  pct,
  icon: Icon,
  color,
  description,
}: {
  label: string
  pct: number
  icon: typeof Shield
  color: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center border', color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-mono font-semibold text-white">{label}</p>
          <p className="text-[10px] font-mono text-surface-500">{description}</p>
        </div>
      </div>
      <div className="space-y-1">
        <div className="relative h-2 rounded-full bg-surface-300 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={cn('h-full rounded-full', color.includes('purple') ? 'bg-purple' : color.includes('emerald') ? 'bg-emerald' : color.includes('gold') ? 'bg-gold' : color.includes('against') ? 'bg-against-500' : 'bg-for-500')}
          />
        </div>
        <p className="text-right text-xs font-mono font-bold text-white">{pct}%</p>
      </div>
    </div>
  )
}

// ─── Overall health score ring ────────────────────────────────────────────────

function HealthScoreRing({ score }: { score: number }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (score / 100) * circumference

  const color =
    score >= 70 ? '#10b981' :
    score >= 40 ? '#eab308' :
    '#ef4444'

  const label =
    score >= 70 ? 'Strong' :
    score >= 40 ? 'Developing' :
    'Nascent'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-24 w-24">
        <svg viewBox="0 0 96 96" className="w-full h-full -rotate-90">
          <circle cx="48" cy="48" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
          <motion.circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-mono font-bold text-white">{score}</span>
          <span className="text-[9px] font-mono text-surface-500 uppercase tracking-widest">/100</span>
        </div>
      </div>
      <span
        className="text-xs font-mono font-bold px-3 py-1 rounded-full border"
        style={{
          color,
          borderColor: `${color}50`,
          backgroundColor: `${color}15`,
        }}
      >
        {label}
      </span>
    </div>
  )
}

// ─── Verdict bar ──────────────────────────────────────────────────────────────

function VerdictBar({ summary }: {
  summary: LawHealthResponse['verdict_summary']
}) {
  const { succeeded, mostly_succeeded, mixed, mostly_failed, failed, total } = summary
  if (total === 0) return (
    <p className="text-xs font-mono text-surface-500 italic">No verdict votes recorded yet.</p>
  )

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0
  const segments = [
    { label: 'Succeeded', count: succeeded, pct: pct(succeeded), color: 'bg-emerald', text: 'text-emerald' },
    { label: 'Mostly succeeded', count: mostly_succeeded, pct: pct(mostly_succeeded), color: 'bg-for-500', text: 'text-for-400' },
    { label: 'Mixed', count: mixed, pct: pct(mixed), color: 'bg-gold', text: 'text-gold' },
    { label: 'Mostly failed', count: mostly_failed, pct: pct(mostly_failed), color: 'bg-against-600', text: 'text-against-400' },
    { label: 'Failed', count: failed, pct: pct(failed), color: 'bg-against-500', text: 'text-against-300' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5 bg-surface-300">
        {segments.map((s) => (
          <motion.div
            key={s.label}
            initial={{ width: 0 }}
            animate={{ width: `${s.pct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className={cn('h-full', s.color)}
            title={`${s.label}: ${s.count} votes (${s.pct}%)`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {segments.filter((s) => s.count > 0).map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs font-mono">
            <span className={cn('inline-block h-2 w-2 rounded-full', s.color)} />
            <span className="text-surface-400">{s.label}</span>
            <span className={cn('font-bold', s.text)}>{s.pct}%</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] font-mono text-surface-500">
        Based on {total.toLocaleString()} community verdict {total === 1 ? 'vote' : 'votes'}
      </p>
    </div>
  )
}

// ─── Challenged law card ──────────────────────────────────────────────────────

function ChallengedCard({ law }: { law: ChallengedLaw }) {
  return (
    <Link
      href={`/law/${law.id}/challenge`}
      className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono font-semibold text-white group-hover:text-for-300 transition-colors leading-snug mb-1.5">
          {truncate(law.statement, 80)}
        </p>
        <div className="flex items-center flex-wrap gap-2">
          {law.category && (
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', catPill(law.category))}>
              {law.category}
            </span>
          )}
          <span className="text-[10px] font-mono text-surface-500">{relTime(law.established_at)}</span>
          {law.open_challenges > 0 && (
            <span className="text-[10px] font-mono text-against-400 bg-against-500/10 border border-against-500/30 px-1.5 py-0.5 rounded">
              {law.open_challenges} open
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 flex flex-col items-center gap-0.5 min-w-[40px]">
        <span className="text-lg font-mono font-bold text-against-300">{law.challenge_count}</span>
        <span className="text-[9px] font-mono text-surface-500 uppercase tracking-wide">challenge{law.challenge_count !== 1 ? 's' : ''}</span>
      </div>
    </Link>
  )
}

// ─── Contentious law card ─────────────────────────────────────────────────────

function ContentiousCard({ law }: { law: ContentiousLaw }) {
  const successColor =
    law.success_pct >= 70 ? 'text-emerald' :
    law.success_pct >= 40 ? 'text-gold' :
    'text-against-400'

  return (
    <Link
      href={`/law/${law.id}/verdict`}
      className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono font-semibold text-white group-hover:text-for-300 transition-colors leading-snug mb-1.5">
          {truncate(law.statement, 80)}
        </p>
        <div className="flex items-center flex-wrap gap-2">
          {law.category && (
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', catPill(law.category))}>
              {law.category}
            </span>
          )}
          <span className="text-[10px] font-mono text-surface-500">
            {law.verdict_count} {law.verdict_count === 1 ? 'verdict' : 'verdicts'}
          </span>
        </div>
      </div>
      <div className="flex-shrink-0 flex flex-col items-center gap-0.5 min-w-[40px]">
        <span className={cn('text-lg font-mono font-bold', successColor)}>{law.success_pct}%</span>
        <span className="text-[9px] font-mono text-surface-500 uppercase tracking-wide">success</span>
      </div>
    </Link>
  )
}

// ─── Active law card ──────────────────────────────────────────────────────────

function ActiveCard({ law }: { law: ActiveLaw }) {
  const score = law.chat_count + law.wiki_edits * 2 + law.challenge_count * 3
  return (
    <Link
      href={`/law/${law.id}`}
      className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono font-semibold text-white group-hover:text-for-300 transition-colors leading-snug mb-1.5">
          {truncate(law.statement, 80)}
        </p>
        <div className="flex items-center flex-wrap gap-2">
          {law.category && (
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', catPill(law.category))}>
              {law.category}
            </span>
          )}
          {law.chat_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-mono text-surface-400">
              <MessageSquare className="h-2.5 w-2.5" />{law.chat_count}
            </span>
          )}
          {law.wiki_edits > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-mono text-surface-400">
              <BookOpen className="h-2.5 w-2.5" />{law.wiki_edits}
            </span>
          )}
          {law.challenge_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-mono text-against-400">
              <Shield className="h-2.5 w-2.5" />{law.challenge_count}
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 flex flex-col items-center gap-0.5 min-w-[36px]">
        <span className="text-lg font-mono font-bold text-purple">{score}</span>
        <span className="text-[9px] font-mono text-surface-500 uppercase tracking-wide">activity</span>
      </div>
    </Link>
  )
}

// ─── Wiki law card ────────────────────────────────────────────────────────────

function WikiCard({ law }: { law: WikidLaw }) {
  return (
    <Link
      href={`/law/${law.id}/wiki`}
      className="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono font-semibold text-white group-hover:text-for-300 transition-colors leading-snug mb-1.5">
          {truncate(law.statement, 80)}
        </p>
        <div className="flex items-center flex-wrap gap-2">
          {law.category && (
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', catPill(law.category))}>
              {law.category}
            </span>
          )}
          {law.has_wiki && (
            <span className="text-[10px] font-mono text-emerald bg-emerald/10 border border-emerald/30 px-1.5 py-0.5 rounded">
              Has article
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 flex flex-col items-center gap-0.5 min-w-[36px]">
        <span className="text-lg font-mono font-bold text-for-400">{law.wiki_edits}</span>
        <span className="text-[9px] font-mono text-surface-500 uppercase tracking-wide">edit{law.wiki_edits !== 1 ? 's' : ''}</span>
      </div>
    </Link>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  iconClass,
  title,
  subtitle,
  href,
  children,
}: {
  icon: typeof Shield
  iconClass: string
  title: string
  subtitle: string
  href?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-surface-300">
        <div className="flex items-center gap-2.5">
          <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center border', iconClass)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-mono font-semibold text-white">{title}</h2>
            <p className="text-[10px] font-mono text-surface-500">{subtitle}</p>
          </div>
        </div>
        {href && (
          <Link
            href={href}
            className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </section>
  )
}

// ─── Page skeleton ────────────────────────────────────────────────────────────

function HealthSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LawHealthPage() {
  const [data, setData] = useState<LawHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/laws/health')
      if (!res.ok) throw new Error('failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-2">
          <Link
            href="/law"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Codex
          </Link>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
                  <Activity className="h-5 w-5 text-emerald" />
                </div>
                <div>
                  <h1 className="font-mono text-2xl font-bold text-white">Codex Health</h1>
                  <p className="text-sm font-mono text-surface-500">Democratic vitality of established laws</p>
                </div>
              </div>
              <p className="text-sm font-mono text-surface-400 leading-relaxed max-w-xl">
                How vigorously is the community engaging with established laws?
                This report measures civic scrutiny — challenges filed, verdict votes cast,
                wiki articles written, and discussions held.
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-300 bg-surface-100 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50 flex-shrink-0"
              aria-label="Refresh health report"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {loading && <HealthSkeleton />}

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {!loading && error && (
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6 text-against-400" />}
            title="Couldn't load health data"
            description="Something went wrong. Try refreshing."
            action={
              <button
                onClick={load}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            }
          />
        )}

        {/* ── Data ─────────────────────────────────────────────────────────── */}
        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >

              {/* ── Top stats row ────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Established Laws',
                    value: data.stats.total_laws.toLocaleString(),
                    icon: Gavel,
                    color: 'text-gold',
                    bg: 'bg-gold/10 border-gold/30',
                  },
                  {
                    label: 'Total Votes Cast',
                    value: data.stats.total_votes >= 1_000_000
                      ? `${(data.stats.total_votes / 1_000_000).toFixed(1)}M`
                      : data.stats.total_votes >= 1000
                        ? `${(data.stats.total_votes / 1000).toFixed(1)}k`
                        : data.stats.total_votes.toLocaleString(),
                    icon: Users,
                    color: 'text-for-400',
                    bg: 'bg-for-500/10 border-for-500/30',
                  },
                  {
                    label: 'Avg Consensus',
                    value: `${data.stats.avg_blue_pct}% FOR`,
                    icon: Scale,
                    color: 'text-purple',
                    bg: 'bg-purple/10 border-purple/30',
                  },
                  {
                    label: 'Health Score',
                    value: null,
                    icon: Activity,
                    color: 'text-emerald',
                    bg: 'bg-emerald/10 border-emerald/30',
                    custom: <HealthScoreRing score={data.metrics.overall_health_score} />,
                  },
                ].map(({ label, value, icon: Icon, color, bg, custom }) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'rounded-2xl border p-4 flex flex-col items-center justify-center text-center gap-2',
                      'bg-surface-100',
                    )}
                  >
                    {custom ?? (
                      <>
                        <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl border', bg)}>
                          <Icon className={cn('h-4 w-4', color)} />
                        </div>
                        <div>
                          <p className={cn('text-xl font-mono font-bold', color)}>{value}</p>
                          <p className="text-[10px] font-mono text-surface-500 mt-0.5">{label}</p>
                        </div>
                      </>
                    )}
                    {custom && (
                      <p className="text-[10px] font-mono text-surface-500">{label}</p>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* ── Coverage gauges ───────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <CoverageGauge
                  label="Challenges"
                  pct={data.metrics.challenge_coverage}
                  icon={Shield}
                  color="text-against-400 bg-against-500/10 border-against-500/30"
                  description="Laws formally challenged"
                />
                <CoverageGauge
                  label="Verdicts"
                  pct={data.metrics.verdict_coverage}
                  icon={Star}
                  color="text-gold bg-gold/10 border-gold/30"
                  description="Laws with verdict votes"
                />
                <CoverageGauge
                  label="Wiki articles"
                  pct={data.metrics.wiki_coverage}
                  icon={BookOpen}
                  color="text-for-400 bg-for-500/10 border-for-500/30"
                  description="Laws with wiki content"
                />
                <CoverageGauge
                  label="Discussions"
                  pct={data.metrics.discussion_coverage}
                  icon={MessageSquare}
                  color="text-purple bg-purple/10 border-purple/30"
                  description="Laws with chat activity"
                />
              </div>

              {/* ── Community Verdict Summary ─────────────────────────── */}
              <section className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
                <div className="flex items-center gap-2.5 px-5 py-4 border-b border-surface-300">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center border bg-gold/10 border-gold/30">
                    <Star className="h-3.5 w-3.5 text-gold" />
                  </div>
                  <div>
                    <h2 className="text-sm font-mono font-semibold text-white">Community Verdicts</h2>
                    <p className="text-[10px] font-mono text-surface-500">Did these laws achieve their goals?</p>
                  </div>
                  <Link
                    href="/law/verdicts"
                    className="ml-auto flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
                  >
                    Browse all <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="p-5">
                  <VerdictBar summary={data.verdict_summary} />
                </div>
              </section>

              {/* ── Category breakdown ────────────────────────────────── */}
              {data.stats.categories.length > 0 && (
                <section className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
                  <div className="flex items-center gap-2.5 px-5 py-4 border-b border-surface-300">
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center border bg-purple/10 border-purple/30">
                      <TrendingUp className="h-3.5 w-3.5 text-purple" />
                    </div>
                    <div>
                      <h2 className="text-sm font-mono font-semibold text-white">Laws by Category</h2>
                      <p className="text-[10px] font-mono text-surface-500">Distribution across all 10 civic areas</p>
                    </div>
                    <Link
                      href="/law/categories"
                      className="ml-auto flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
                    >
                      Browse <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="p-4">
                    <div className="space-y-2">
                      {data.stats.categories.map(({ category, count }) => {
                        const pct = Math.round((count / data.stats.total_laws) * 100)
                        return (
                          <Link
                            key={category}
                            href={`/law/categories?category=${encodeURIComponent(category)}`}
                            className="flex items-center gap-3 group"
                          >
                            <span className={cn('text-[10px] font-mono w-24 shrink-0 truncate font-semibold', catPill(category).split(' ')[1])}>
                              {category}
                            </span>
                            <div className="flex-1 relative h-1.5 rounded-full bg-surface-300">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                className={cn('absolute h-full rounded-full', catPill(category).includes('gold') ? 'bg-gold' : catPill(category).includes('purple') ? 'bg-purple' : catPill(category).includes('emerald') ? 'bg-emerald' : catPill(category).includes('against') ? 'bg-against-500' : 'bg-for-500')}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-surface-400 w-10 text-right shrink-0">
                              {count}
                            </span>
                            <ChevronRight className="h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors shrink-0" />
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </section>
              )}

              {/* ── Most challenged ───────────────────────────────────── */}
              {data.most_challenged.length > 0 && (
                <Section
                  icon={Shield}
                  iconClass="text-against-400 bg-against-500/10 border-against-500/30"
                  title="Most Challenged"
                  subtitle="Laws with the most formal challenges filed"
                  href="/law/challenges"
                >
                  {data.most_challenged.map((law) => (
                    <ChallengedCard key={law.id} law={law} />
                  ))}
                </Section>
              )}

              {/* ── Most contentious verdicts ─────────────────────────── */}
              {data.most_contentious.length > 0 && (
                <Section
                  icon={Scale}
                  iconClass="text-gold bg-gold/10 border-gold/30"
                  title="Most Debated Verdicts"
                  subtitle="Laws with most community disagreement on effectiveness"
                  href="/law/verdicts"
                >
                  {data.most_contentious.map((law) => (
                    <ContentiousCard key={law.id} law={law} />
                  ))}
                </Section>
              )}

              {/* ── Most active ───────────────────────────────────────── */}
              {data.most_active.length > 0 && (
                <Section
                  icon={Zap}
                  iconClass="text-purple bg-purple/10 border-purple/30"
                  title="Most Active Laws"
                  subtitle="Highest combined chat, wiki, and challenge activity"
                >
                  {data.most_active.map((law) => (
                    <ActiveCard key={law.id} law={law} />
                  ))}
                </Section>
              )}

              {/* ── Most wiki-edited ──────────────────────────────────── */}
              {data.most_wikied.length > 0 && (
                <Section
                  icon={BookOpen}
                  iconClass="text-for-400 bg-for-500/10 border-for-500/30"
                  title="Most Documented"
                  subtitle="Laws with the most collaborative wiki edits"
                  href="/law/wiki/recent"
                >
                  {data.most_wikied.map((law) => (
                    <WikiCard key={law.id} law={law} />
                  ))}
                </Section>
              )}

              {/* ── Empty codex ───────────────────────────────────────── */}
              {data.most_challenged.length === 0 && data.most_contentious.length === 0 &&
               data.most_active.length === 0 && data.most_wikied.length === 0 && (
                <EmptyState
                  icon={<Gavel className="h-6 w-6 text-gold" />}
                  title="No activity yet"
                  description="Be the first to challenge, review, or document an established law."
                  action={
                    <Link
                      href="/law"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold/10 border border-gold/30 text-xs font-mono text-gold hover:bg-gold/20 transition-colors"
                    >
                      Browse the Codex <ArrowRight className="h-3 w-3" />
                    </Link>
                  }
                />
              )}

              {/* ── CTA strip ─────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="rounded-2xl border border-surface-300 bg-surface-100 p-5"
              >
                <h3 className="font-mono text-sm font-semibold text-white mb-3">
                  Contribute to civic scrutiny
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { href: '/law/challenges', icon: Shield, label: 'File a challenge', color: 'text-against-400 border-against-500/30 hover:bg-against-500/10' },
                    { href: '/law/verdicts', icon: Star, label: 'Cast a verdict', color: 'text-gold border-gold/30 hover:bg-gold/10' },
                    { href: '/law', icon: BookOpen, label: 'Edit a wiki', color: 'text-for-400 border-for-500/30 hover:bg-for-500/10' },
                    { href: '/law', icon: MessageSquare, label: 'Join a discussion', color: 'text-purple border-purple/30 hover:bg-purple/10' },
                  ].map(({ href, icon: Icon, label, color }) => (
                    <Link
                      key={label}
                      href={href}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-mono font-semibold transition-colors',
                        color,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {label}
                    </Link>
                  ))}
                </div>
              </motion.div>

              {/* ── Generated at ─────────────────────────────────────── */}
              <p className="text-[10px] font-mono text-surface-600 text-center">
                Generated at {new Date(data.generated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} UTC
              </p>

            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
