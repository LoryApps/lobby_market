'use client'

/**
 * /karma — Civic Karma Score
 *
 * A holistic civic credit score that breaks down your engagement across
 * five dimensions: Discourse Quality, Predictive Accuracy, Civic Breadth,
 * Engagement Depth, and Community Trust.
 *
 * Distinct from:
 *  - /analytics   (raw statistics)
 *  - /impact      (which laws you helped shape)
 *  - /report-card (academic-style letter grades)
 *  - /influence   (visual vote network)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Flame,
  Gavel,
  Info,
  MessageSquare,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { KarmaData, KarmaDimension, KarmaTier } from '@/app/api/karma/route'

// ─── Dimension icons ──────────────────────────────────────────────────────────

const DIM_ICONS: Record<string, React.ElementType> = {
  discourse: MessageSquare,
  predictions: Target,
  breadth: BarChart2,
  engagement: Flame,
  trust: Shield,
}

const DIM_COLORS: Record<string, { bar: string; glow: string; text: string; bg: string }> = {
  discourse:   { bar: 'bg-for-500',    glow: 'shadow-for-500/30',   text: 'text-for-400',   bg: 'bg-for-500/10' },
  predictions: { bar: 'bg-gold',       glow: 'shadow-gold/30',      text: 'text-gold',      bg: 'bg-gold/10' },
  breadth:     { bar: 'bg-emerald',    glow: 'shadow-emerald/30',   text: 'text-emerald',   bg: 'bg-emerald/10' },
  engagement:  { bar: 'bg-against-400',glow: 'shadow-against/30',  text: 'text-against-300',bg: 'bg-against-400/10' },
  trust:       { bar: 'bg-purple',     glow: 'shadow-purple/30',    text: 'text-purple',    bg: 'bg-purple/10' },
}

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  KarmaTier,
  { icon: React.ElementType; ring: string; bg: string; text: string; border: string; desc: string }
> = {
  'Newcomer': {
    icon: Star,
    ring: 'ring-surface-500/40',
    bg: 'bg-surface-300/20',
    text: 'text-surface-400',
    border: 'border-surface-500/30',
    desc: 'Just getting started — cast votes, write arguments, make predictions.',
  },
  'Observer': {
    icon: BookOpen,
    ring: 'ring-for-600/40',
    bg: 'bg-for-600/10',
    text: 'text-for-300',
    border: 'border-for-600/30',
    desc: 'Building a record — keep voting and exploring new categories.',
  },
  'Participant': {
    icon: Users,
    ring: 'ring-emerald/40',
    bg: 'bg-emerald/10',
    text: 'text-emerald',
    border: 'border-emerald/30',
    desc: 'Active contributor — your arguments are gaining traction.',
  },
  'Contributor': {
    icon: Zap,
    ring: 'ring-gold/40',
    bg: 'bg-gold/10',
    text: 'text-gold',
    border: 'border-gold/30',
    desc: 'Recognised voice — the community values your engagement.',
  },
  'Advocate': {
    icon: TrendingUp,
    ring: 'ring-purple/40',
    bg: 'bg-purple/10',
    text: 'text-purple',
    border: 'border-purple/30',
    desc: 'Influential debater — your consistency sets the standard.',
  },
  'Elder': {
    icon: Shield,
    ring: 'ring-purple/60',
    bg: 'bg-purple/20',
    text: 'text-purple',
    border: 'border-purple/40',
    desc: 'Senior statesperson — deep expertise and consistent engagement.',
  },
  'Civic Champion': {
    icon: Trophy,
    ring: 'ring-gold/60',
    bg: 'bg-gold/20',
    text: 'text-gold',
    border: 'border-gold/40',
    desc: 'The highest civic honour — elite discourse, trust, and breadth.',
  },
}

// ─── Score ring (SVG) ─────────────────────────────────────────────────────────

interface ScoreRingProps {
  score: number
  max: number
  size?: number
  strokeWidth?: number
  className?: string
}

function ScoreRing({ score, max, size = 180, strokeWidth = 14, className }: ScoreRingProps) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.min(score / max, 1)
  const dash = pct * circ

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('rotate-[-90deg]', className)}
      aria-hidden="true"
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-surface-300"
      />
      {/* Progress */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#karmaGrad)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
      <defs>
        <linearGradient id="karmaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ─── Dimension card ───────────────────────────────────────────────────────────

interface DimCardProps {
  dim: KarmaDimension
  index: number
}

function DimCard({ dim, index }: DimCardProps) {
  const [expanded, setExpanded] = useState(false)
  const Icon = DIM_ICONS[dim.id] ?? BarChart2
  const cols = DIM_COLORS[dim.id] ?? DIM_COLORS.discourse

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index }}
      className="bg-surface-100 rounded-xl border border-surface-300 overflow-hidden"
    >
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface-200/40 transition-colors"
        aria-expanded={expanded}
      >
        <div className={cn('flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0', cols.bg)}>
          <Icon className={cn('h-4 w-4', cols.text)} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-mono font-semibold text-white">{dim.label}</span>
            <span className={cn('text-sm font-mono font-bold tabular-nums', cols.text)}>
              {dim.score}<span className="text-surface-500 font-normal">/{dim.maxScore}</span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', cols.bar)}
              initial={{ width: 0 }}
              animate={{ width: `${dim.pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.05 * index }}
            />
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-1 border-t border-surface-300 space-y-2">
              <p className="text-xs font-mono text-surface-500">{dim.description}</p>
              <p className="text-xs font-mono text-surface-600">{dim.detail}</p>
              {dim.tip && (
                <div className="flex items-start gap-2 rounded-lg bg-surface-200 px-3 py-2">
                  <Info className="h-3.5 w-3.5 text-for-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs font-mono text-surface-400">{dim.tip}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function KarmaPage() {
  const [data, setData] = useState<KarmaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/karma')
      if (res.status === 401) {
        setError('auth')
        return
      }
      if (!res.ok) throw new Error('Failed to load karma')
      const json: KarmaData = await res.json()
      setData(json)
    } catch {
      setError('load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ── Error states ─────────────────────────────────────────────────────────

  if (!loading && error === 'auth') {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-24">
          <EmptyState
            icon={Shield}
            title="Sign in to view your Karma"
            description="Your Civic Karma Score is personalised — sign in to see how you rank."
            action={{ label: 'Sign in', href: '/login' }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!loading && error === 'load') {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-24">
          <EmptyState
            icon={Sparkles}
            title="Could not load Karma"
            description="Something went wrong fetching your score. Please try again."
            action={{ label: 'Retry', onClick: load }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-5 pb-24 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </main>
        <BottomNav />
      </div>
    )
  }

  const tierCfg = TIER_CONFIG[data.tier]
  const TierIcon = tierCfg.icon

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-5 pb-24 md:pb-8 space-y-4">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link
            href="/analytics"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Back to analytics"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-mono text-xl font-bold text-white">Civic Karma</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              @{data.profile.username} · {data.profile.memberDays}d member
            </p>
          </div>
          <button
            onClick={load}
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Refresh karma"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* ── Score card ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-surface-100 rounded-2xl border border-surface-300 overflow-hidden"
        >
          <div className="flex flex-col items-center pt-7 pb-5 px-6 gap-4">
            {/* Ring + score */}
            <div className="relative flex items-center justify-center">
              <ScoreRing score={data.totalScore} max={data.maxScore} size={176} strokeWidth={14} />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                <span className="font-mono text-4xl font-black text-white tabular-nums">
                  <AnimatedNumber value={data.totalScore} />
                </span>
                <span className="font-mono text-xs text-surface-500">/ 100</span>
              </div>
            </div>

            {/* Tier badge */}
            <div className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-full border',
              tierCfg.bg, tierCfg.border,
            )}>
              <TierIcon className={cn('h-4 w-4', tierCfg.text)} aria-hidden="true" />
              <span className={cn('font-mono text-sm font-bold', tierCfg.text)}>
                {data.tier}
              </span>
            </div>

            <p className="text-xs font-mono text-surface-500 text-center max-w-xs">
              {tierCfg.desc}
            </p>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-4 border-t border-surface-300 divide-x divide-surface-300">
            {[
              { label: 'Votes', value: data.profile.totalVotes },
              { label: 'Arguments', value: data.profile.totalArguments },
              { label: 'Streak', value: data.profile.voteStreak },
              { label: 'Clout', value: data.profile.clout },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center py-3 gap-0.5">
                <span className="font-mono text-sm font-bold text-white tabular-nums">
                  {value.toLocaleString()}
                </span>
                <span className="font-mono text-[10px] text-surface-500 uppercase tracking-wide">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Dimension breakdown ──────────────────────────────────────────── */}
        <div className="space-y-2">
          <h2 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-widest px-1">
            Score Breakdown
          </h2>
          {data.dimensions.map((dim, i) => (
            <DimCard key={dim.id} dim={dim} index={i} />
          ))}
        </div>

        {/* ── Recent boosts ────────────────────────────────────────────────── */}
        {data.recentBoosts.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-widest px-1">
              Active Strengths
            </h2>
            <div className="bg-surface-100 rounded-xl border border-surface-300 divide-y divide-surface-300">
              {data.recentBoosts.map((boost) => (
                <div key={boost} className="flex items-center gap-3 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0" aria-hidden="true" />
                  <span className="text-sm font-mono text-surface-400">{boost}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tier ladder ──────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <h2 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-widest px-1">
            Karma Tiers
          </h2>
          <div className="bg-surface-100 rounded-xl border border-surface-300 overflow-hidden">
            {(
              [
                ['Newcomer', '0–20', 'text-surface-400'],
                ['Observer', '21–40', 'text-for-300'],
                ['Participant', '41–55', 'text-emerald'],
                ['Contributor', '56–70', 'text-gold'],
                ['Advocate', '71–85', 'text-purple'],
                ['Elder', '86–95', 'text-purple'],
                ['Civic Champion', '96–100', 'text-gold'],
              ] as [KarmaTier, string, string][]
            ).map(([t, range, cls]) => (
              <div
                key={t}
                className={cn(
                  'flex items-center justify-between px-4 py-2.5',
                  t === data.tier
                    ? 'bg-surface-200/70 border-l-2 border-l-for-500'
                    : 'opacity-60',
                )}
              >
                <span className={cn('font-mono text-sm font-semibold', cls)}>
                  {t}
                  {t === data.tier && (
                    <span className="ml-2 text-[10px] text-surface-500 font-normal uppercase tracking-wide">
                      You are here
                    </span>
                  )}
                </span>
                <span className="font-mono text-xs text-surface-500 tabular-nums">{range}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA links ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: '/arguments', label: 'Write Arguments', icon: MessageSquare },
            { href: '/prescient', label: 'Vote Alignment', icon: Target },
            { href: '/topic/categories', label: 'Explore Categories', icon: BarChart2 },
            { href: '/impact', label: 'View Impact', icon: Gavel },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center justify-between gap-2 px-4 py-3 rounded-xl',
                'bg-surface-100 border border-surface-300',
                'hover:border-for-500/50 hover:bg-surface-200/50 transition-colors group',
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-for-400 group-hover:text-for-300 transition-colors" aria-hidden="true" />
                <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
                  {label}
                </span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" aria-hidden="true" />
            </Link>
          ))}
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
