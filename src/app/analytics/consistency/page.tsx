'use client'

/**
 * /analytics/consistency — Civic Consistency Report
 *
 * Reveals how consistently you vote within each category and across the
 * platform. Do you have principled stances or do you judge each topic on
 * its own merits? Where are your "flip" votes — the ones that break your
 * usual pattern?
 *
 * Distinct from:
 *   /analytics/drift      — how aligned you are with consensus over time
 *   /analytics/calibration — prediction accuracy
 *   /analytics/votes      — raw vote history
 *   /fingerprint          — how unique your voice is vs. the median voter
 *   /prescient            — majority alignment rate
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Compass,
  ExternalLink,
  Flame,
  GitMerge,
  Layers,
  RefreshCw,
  Scale,
  Shield,
  Shuffle,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  ConsistencyResponse,
  ConsistencyArchetype,
  CategoryProfile,
  CategoryStance,
  FlipVote,
} from '@/app/api/analytics/consistency/route'

// ─── Archetype styling ────────────────────────────────────────────────────────

const ARCHETYPE_STYLE: Record<
  ConsistencyArchetype,
  { color: string; bg: string; border: string; icon: typeof Compass }
> = {
  principled: {
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: Shield,
  },
  pragmatist: {
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Scale,
  },
  partisan: {
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: Flame,
  },
  contrarian: {
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    icon: Shuffle,
  },
  specialist: {
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    icon: Layers,
  },
}

// ─── Stance styling ───────────────────────────────────────────────────────────

const STANCE_STYLE: Record<
  CategoryStance,
  { label: string; barColor: string; textColor: string; bgColor: string }
> = {
  strong_for: {
    label: 'Strong FOR',
    barColor: 'bg-for-500',
    textColor: 'text-for-300',
    bgColor: 'bg-for-500/10',
  },
  lean_for: {
    label: 'Lean FOR',
    barColor: 'bg-for-600',
    textColor: 'text-for-400',
    bgColor: 'bg-for-600/10',
  },
  mixed: {
    label: 'Mixed',
    barColor: 'bg-surface-400',
    textColor: 'text-surface-400',
    bgColor: 'bg-surface-300/30',
  },
  lean_against: {
    label: 'Lean AGAINST',
    barColor: 'bg-against-600',
    textColor: 'text-against-400',
    bgColor: 'bg-against-600/10',
  },
  strong_against: {
    label: 'Strong AGAINST',
    barColor: 'bg-against-500',
    textColor: 'text-against-300',
    bgColor: 'bg-against-500/10',
  },
}

// ─── Consistency gauge ────────────────────────────────────────────────────────

const SCORE_LABELS: Array<{ min: number; label: string; color: string }> = [
  { min: 80, label: 'Very High', color: 'text-emerald' },
  { min: 60, label: 'High', color: 'text-for-300' },
  { min: 40, label: 'Moderate', color: 'text-gold' },
  { min: 20, label: 'Low', color: 'text-against-400' },
  { min: 0,  label: 'Very Low', color: 'text-against-300' },
]

function scoreLabel(score: number) {
  return SCORE_LABELS.find((l) => score >= l.min) ?? SCORE_LABELS[SCORE_LABELS.length - 1]
}

// ─── Category bar ─────────────────────────────────────────────────────────────

function CategoryBar({ cat, index }: { cat: CategoryProfile; index: number }) {
  const stance = STANCE_STYLE[cat.stance]
  const forWidth = cat.for_pct
  const againstWidth = 100 - cat.for_pct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="rounded-xl bg-surface-100 border border-surface-300 p-4"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-mono font-semibold text-white">{cat.category}</p>
          <p className="text-xs font-mono text-surface-500 mt-0.5">
            {cat.total_votes} vote{cat.total_votes !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={cn(
              'text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border',
              stance.textColor,
              stance.bgColor,
              'border-current/20'
            )}
          >
            {stance.label}
          </span>
          {cat.flip_count > 0 && cat.stance !== 'mixed' && (
            <span className="text-[10px] font-mono text-surface-500">
              {cat.flip_count} flip{cat.flip_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* FOR / AGAINST split bar */}
      <div className="h-2 rounded-full overflow-hidden flex mb-2">
        <div
          className="bg-for-500 transition-all duration-700"
          style={{ width: `${forWidth}%` }}
        />
        <div
          className="bg-against-500 transition-all duration-700"
          style={{ width: `${againstWidth}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-for-400">{cat.for_pct}% For</span>
        <span className="text-surface-500">{cat.consistency_pct}% consistent</span>
        <span className="text-against-400">{100 - cat.for_pct}% Against</span>
      </div>
    </motion.div>
  )
}

// ─── Flip vote row ────────────────────────────────────────────────────────────

function FlipVoteRow({ flip, index }: { flip: FlipVote; index: number }) {
  const stanceStyle = STANCE_STYLE[flip.category_stance]
  const isFor = flip.user_vote === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
    >
      <Link
        href={`/topic/${flip.topic_id}`}
        className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-200/50 transition-colors"
      >
        {/* Flip indicator */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
          <div
            className={cn(
              'flex items-center justify-center h-7 w-7 rounded-lg',
              isFor ? 'bg-for-500/15' : 'bg-against-500/15'
            )}
          >
            {isFor ? (
              <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
            ) : (
              <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-white leading-snug line-clamp-2">{flip.statement}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {flip.category && (
              <span className="text-[11px] font-mono text-surface-500">{flip.category}</span>
            )}
            <span className="text-[11px] font-mono text-surface-600">·</span>
            <span
              className={cn('text-[11px] font-mono font-medium', stanceStyle.textColor)}
            >
              Your usual: {stanceStyle.label}
            </span>
            <span className="text-[11px] font-mono text-surface-600">·</span>
            <span
              className={cn(
                'text-[11px] font-mono font-semibold',
                isFor ? 'text-for-400' : 'text-against-400'
              )}
            >
              Voted {isFor ? 'FOR' : 'AGAINST'}
            </span>
          </div>
        </div>

        <ExternalLink className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 mt-1" />
      </Link>
    </motion.div>
  )
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const dash = (score / 100) * circumference
  const label = scoreLabel(score)

  return (
    <div className="relative flex items-center justify-center h-36 w-36">
      <svg className="absolute inset-0 -rotate-90" width="144" height="144" viewBox="0 0 144 144">
        {/* track */}
        <circle
          cx="72" cy="72" r={radius}
          fill="none" stroke="currentColor"
          className="text-surface-300"
          strokeWidth="10"
        />
        {/* progress */}
        <circle
          cx="72" cy="72" r={radius}
          fill="none"
          stroke={score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#f87171'}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="relative text-center">
        <div className="text-3xl font-mono font-bold text-white">{score}</div>
        <div className={cn('text-xs font-mono font-semibold', label.color)}>{label.label}</div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ConsistencySkeleton() {
  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <Skeleton className="h-36 w-36 rounded-full" />
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <Skeleton className="h-5 w-32 mx-auto sm:mx-0" />
            <Skeleton className="h-8 w-48 mx-auto sm:mx-0" />
            <Skeleton className="h-4 w-full max-w-sm" />
            <Skeleton className="h-4 w-4/5 max-w-sm" />
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>

      {/* Categories */}
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-2 w-full rounded-full mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ConsistencyPage() {
  const router = useRouter()
  const [data, setData] = useState<ConsistencyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/analytics/consistency')
      if (!res.ok) throw new Error('Failed')
      const json = await res.json()
      if (!json.authenticated) {
        router.push('/login')
        return
      }
      setData(json as ConsistencyResponse)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const archStyle = data ? ARCHETYPE_STYLE[data.archetype] : null
  const ArchIcon = archStyle?.icon ?? Compass

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-10">
        {/* Back nav */}
        <div className="flex items-center gap-2 mb-6">
          <Link
            href="/analytics"
            className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Analytics
          </Link>
          <span className="text-surface-600">/</span>
          <span className="text-sm font-mono text-white">Consistency</span>
        </div>

        {/* Page header */}
        <div className="mb-6 flex items-start gap-3">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30">
            <GitMerge className="h-5 w-5 text-emerald" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">Consistency Report</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              How predictably you vote across topics and categories
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Error */}
        {error && !loading && (
          <EmptyState
            icon={BarChart2}
            title="Couldn't load report"
            description="Something went wrong fetching your consistency data."
            actions={[{ label: 'Try again', onClick: load }]}
          />
        )}

        {/* Loading */}
        {loading && <ConsistencySkeleton />}

        {/* Empty — no votes yet */}
        {!loading && !error && data && data.total_votes === 0 && (
          <EmptyState
            icon={GitMerge}
            iconColor="text-emerald"
            iconBg="bg-emerald/10"
            iconBorder="border-emerald/30"
            title="No votes yet"
            description="Cast a few votes across different categories and your consistency profile will appear here."
            actions={[{ label: 'Go vote', href: '/' }]}
          />
        )}

        {/* Content */}
        {!loading && !error && data && data.total_votes > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* ── Archetype hero card ── */}
              <div className={cn('rounded-2xl border p-6', archStyle?.bg, archStyle?.border)}>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* Score ring */}
                  <ScoreRing score={data.overall_consistency_score} />

                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                      <ArchIcon className={cn('h-4 w-4', archStyle?.color)} />
                      <span className={cn('text-xs font-mono font-semibold uppercase tracking-wider', archStyle?.color)}>
                        Your archetype
                      </span>
                    </div>
                    <h2 className="text-2xl font-mono font-bold text-white mb-1">
                      {data.archetype_label}
                    </h2>
                    <p className={cn('text-sm font-mono font-semibold mb-3', archStyle?.color)}>
                      &ldquo;{data.archetype_tagline}&rdquo;
                    </p>
                    <p className="text-sm font-mono text-surface-400 leading-relaxed">
                      {data.archetype_description}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Stats strip ── */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                    Consistency
                  </p>
                  <p className={cn('text-2xl font-mono font-bold', scoreLabel(data.overall_consistency_score).color)}>
                    <AnimatedNumber value={data.overall_consistency_score} />
                    <span className="text-base text-surface-500">/100</span>
                  </p>
                </div>

                <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                    Strong stances
                  </p>
                  <p className="text-2xl font-mono font-bold text-white">
                    <AnimatedNumber value={data.categories_with_strong_stance} />
                    <span className="text-base text-surface-500">/{data.categories.length}</span>
                  </p>
                </div>

                <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                    Overall lean
                  </p>
                  <p
                    className={cn(
                      'text-2xl font-mono font-bold',
                      data.global_for_pct >= 55 ? 'text-for-400' :
                      data.global_for_pct <= 45 ? 'text-against-400' : 'text-surface-400'
                    )}
                  >
                    {data.global_for_pct >= 55
                      ? `${data.global_for_pct}% F`
                      : data.global_for_pct <= 45
                      ? `${100 - data.global_for_pct}% A`
                      : 'Even'}
                  </p>
                </div>
              </div>

              {/* ── Highlights ── */}
              {(data.most_consistent_category || data.most_mixed_category) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.most_consistent_category && (
                    <div className="rounded-xl bg-surface-100 border border-emerald/20 p-4">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Shield className="h-3.5 w-3.5 text-emerald" />
                        <p className="text-[11px] font-mono text-emerald uppercase tracking-wider font-semibold">
                          Most Consistent
                        </p>
                      </div>
                      <p className="text-base font-mono font-bold text-white">
                        {data.most_consistent_category}
                      </p>
                    </div>
                  )}
                  {data.most_mixed_category && (
                    <div className="rounded-xl bg-surface-100 border border-gold/20 p-4">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Scale className="h-3.5 w-3.5 text-gold" />
                        <p className="text-[11px] font-mono text-gold uppercase tracking-wider font-semibold">
                          Most Mixed
                        </p>
                      </div>
                      <p className="text-base font-mono font-bold text-white">
                        {data.most_mixed_category}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Per-category profiles ── */}
              <div>
                <h3 className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <BarChart2 className="h-3.5 w-3.5" />
                  Category Stances
                </h3>
                <div className="space-y-3">
                  {data.categories.map((cat, i) => (
                    <CategoryBar key={cat.category} cat={cat} index={i} />
                  ))}
                </div>
              </div>

              {/* ── Flip votes ── */}
              {data.flip_votes.length > 0 && (
                <div>
                  <h3 className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Shuffle className="h-3.5 w-3.5" />
                    Flip Votes
                    <span className="text-surface-600 normal-case font-normal">
                      — where you broke your pattern
                    </span>
                  </h3>
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden divide-y divide-surface-300/60">
                    {data.flip_votes.map((flip, i) => (
                      <FlipVoteRow key={flip.topic_id} flip={flip} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Explore more ── */}
              <div>
                <h3 className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Related Reports
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { href: '/analytics/drift', icon: Zap, label: 'Drift Report', desc: 'Alignment with consensus over time', color: 'text-against-400' },
                    { href: '/fingerprint', icon: Layers, label: 'Civic Fingerprint', desc: 'How unique your voice is', color: 'text-against-300' },
                    { href: '/prescient', icon: Scale, label: 'Alignment', desc: 'Majority alignment rate', color: 'text-for-300' },
                    { href: '/analytics/votes', icon: BarChart2, label: 'Vote History', desc: 'Full voting record and patterns', color: 'text-purple' },
                  ].map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-300 p-4 hover:border-surface-400 transition-colors group"
                    >
                      <link.icon className={cn('h-4 w-4 flex-shrink-0', link.color)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono font-semibold text-white">{link.label}</p>
                        <p className="text-xs font-mono text-surface-500 truncate">{link.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
