'use client'

/**
 * /civic-impact — Civic Impact Score
 *
 * A composite 0–1000 score that captures a user's total civic influence:
 *   • Vote Power      (25%) — voting frequency, streak, consistency
 *   • Argument Strength (30%) — argument quality scores, upvotes received
 *   • Debate Record   (15%) — live debate participations and wins
 *   • Law Making      (20%) — topics shaped into law; laws proposed
 *   • Civic Network   (10%) — followers, achievements earned
 *
 * Distinct from:
 *   /leaderboard/civic-score — platform-wide ranking table
 *   /reputation              — reputation_score formula and milestones
 *   /analytics/impact        — argument-specific impact archetype
 *   /karma                   — multi-axis karma breakdown
 *   /report-card             — academic letter-grade scoring
 *
 * This is the ONE number that answers: "How much am I actually contributing?"
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BarChart2,
  ChevronRight,
  Gavel,
  Info,
  Loader2,
  MessageSquare,
  Mic,
  RefreshCw,
  Scale,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CivicImpactResponse, CivicImpactDimension } from '@/app/api/civic-impact/route'

// ─── Dimension icon map ────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Scale,
  MessageSquare,
  Mic,
  Gavel,
  Users,
}

// ─── Color map → Tailwind classes ─────────────────────────────────────────────

const COLOR = {
  for:        { ring: 'ring-for-500/40',     bg: 'bg-for-500/10',     bar: 'bg-for-500',     text: 'text-for-400',     border: 'border-for-500/30'     },
  purple:     { ring: 'ring-purple/40',      bg: 'bg-purple/10',      bar: 'bg-purple',      text: 'text-purple',      border: 'border-purple/30'      },
  against:    { ring: 'ring-against-500/40', bg: 'bg-against-500/10', bar: 'bg-against-500', text: 'text-against-400', border: 'border-against-500/30' },
  gold:       { ring: 'ring-gold/40',        bg: 'bg-gold/10',        bar: 'bg-gold',        text: 'text-gold',        border: 'border-gold/30'        },
  emerald:    { ring: 'ring-emerald/40',     bg: 'bg-emerald/10',     bar: 'bg-emerald',     text: 'text-emerald',     border: 'border-emerald/30'     },
} as const

type ColorKey = keyof typeof COLOR

// ─── Tier badge ───────────────────────────────────────────────────────────────

const TIER_STYLES: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  observer:  { border: 'border-surface-500/40', bg: 'bg-surface-500/10', text: 'text-surface-500', glow: '' },
  citizen:   { border: 'border-surface-600/50', bg: 'bg-surface-600/10', text: 'text-surface-600', glow: '' },
  activist:  { border: 'border-for-500/50',     bg: 'bg-for-500/10',     text: 'text-for-400',     glow: 'shadow-[0_0_20px_rgba(59,130,246,.18)]' },
  champion:  { border: 'border-purple/50',      bg: 'bg-purple/10',      text: 'text-purple',      glow: 'shadow-[0_0_24px_rgba(139,92,246,.22)]' },
  elder:     { border: 'border-emerald/50',     bg: 'bg-emerald/10',     text: 'text-emerald',     glow: 'shadow-[0_0_28px_rgba(16,185,129,.24)]' },
  lawmaker:  { border: 'border-gold/50',        bg: 'bg-gold/10',        text: 'text-gold',        glow: 'shadow-[0_0_32px_rgba(245,158,11,.28)]' },
}

// ─── Animated score ring ───────────────────────────────────────────────────────

function ScoreRing({ score, tier }: { score: number; tier: string }) {
  const styles = TIER_STYLES[tier] ?? TIER_STYLES.citizen
  const circumference = 2 * Math.PI * 52
  const fill = (score / 1000) * circumference

  return (
    <div className={cn(
      'relative flex items-center justify-center w-40 h-40 rounded-full border-2',
      styles.border,
      styles.glow,
    )}>
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
        {/* Track */}
        <circle
          cx="60" cy="60" r="52"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-surface-300/40"
        />
        {/* Fill */}
        <motion.circle
          cx="60" cy="60" r="52"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - fill }}
          transition={{ duration: 1.4, ease: 'easeOut', delay: 0.3 }}
          className={styles.text}
        />
      </svg>
      <div className="text-center z-10">
        <motion.div
          className={cn('text-4xl font-mono font-bold tabular-nums', styles.text)}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          {score}
        </motion.div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mt-0.5">
          / 1000
        </div>
      </div>
    </div>
  )
}

// ─── Dimension card ────────────────────────────────────────────────────────────

function DimensionCard({ dim, index }: { dim: CivicImpactDimension; index: number }) {
  const colorKey = (dim.color in COLOR ? dim.color : 'for') as ColorKey
  const c = COLOR[colorKey]
  const Icon = ICON_MAP[dim.icon] ?? Scale

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.5 + index * 0.07 }}
      className={cn(
        'rounded-xl border p-4 flex flex-col gap-3',
        'bg-surface-100',
        c.border,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn('flex items-center justify-center w-7 h-7 rounded-lg', c.bg)}>
            <Icon className={cn('w-3.5 h-3.5', c.text)} />
          </div>
          <div>
            <p className="font-mono text-sm font-semibold text-white leading-tight">
              {dim.label}
            </p>
            <p className="font-mono text-[10px] text-surface-500 leading-tight">
              {dim.description}
            </p>
          </div>
        </div>
        <div className={cn('font-mono text-xl font-bold tabular-nums', c.text)}>
          {dim.score}
          <span className="text-surface-500 text-xs font-normal">/100</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-surface-300/50 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', c.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${dim.score}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.6 + index * 0.07 }}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] text-surface-500 leading-relaxed">
          {dim.detail}
        </p>
        <span className={cn('font-mono text-[10px] font-semibold', c.text)}>
          +{dim.contribution}pts
        </span>
      </div>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function CivicImpactClient() {
  const router = useRouter()
  const [data, setData] = useState<CivicImpactResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [copied, setCopied] = useState(false)
  const fetchedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/civic-impact')
      if (res.status === 401) {
        router.push('/sign-in?next=/civic-impact')
        return
      }
      if (!res.ok) throw new Error('Failed to load your Civic Impact Score')
      const json = await res.json() as CivicImpactResponse
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    load()
  }, [load])

  function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({
        title: `My Civic Impact Score: ${data?.totalScore ?? 0} / 1000`,
        text: `I'm a ${data?.tierLabel ?? 'Citizen'} on Lobby Market with a Civic Impact Score of ${data?.totalScore ?? 0}. See how civic engagement shapes democracy!`,
        url,
      }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }).catch(() => {})
    }
  }

  const tierStyles = TIER_STYLES[data?.tier ?? 'citizen'] ?? TIER_STYLES.citizen

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-for-500/10 border border-for-500/30">
            <Sparkles className="w-5 h-5 text-for-400" />
          </div>
          <div>
            <h1 className="font-mono text-xl font-bold text-white">
              Civic Impact Score
            </h1>
            <p className="font-mono text-xs text-surface-500 mt-0.5">
              Your composite civic influence on the Lobby
            </p>
          </div>
          <button
            onClick={() => setShowInfo((v) => !v)}
            className="ml-auto text-surface-500 hover:text-surface-600 transition-colors"
            aria-label="How is this calculated?"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        {/* ── Info panel ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 text-xs font-mono text-surface-500 space-y-2">
                <p className="text-white font-semibold text-sm">How it&apos;s calculated</p>
                <p>Your Civic Impact Score (0–1000) is a weighted composite of five dimensions:</p>
                <ul className="space-y-1 pl-3">
                  <li><span className="text-for-400">Vote Power (25%)</span> — total votes, streak consistency</li>
                  <li><span className="text-purple">Argument Strength (30%)</span> — upvotes received, A/B grade arguments</li>
                  <li><span className="text-against-400">Debate Record (15%)</span> — participations and wins</li>
                  <li><span className="text-gold">Law Making (20%)</span> — topics shaped into law, proposals</li>
                  <li><span className="text-emerald">Civic Network (10%)</span> — followers, achievements</li>
                </ul>
                <p>Scores use logarithmic scaling — early gains come quickly; mastery is harder to achieve.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Loading ──────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <Skeleton className="w-40 h-40 rounded-full" />
              <Skeleton className="h-8 w-32" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────────── */}
        {!loading && error && (
          <EmptyState
            icon={<Sparkles className="w-8 h-8 text-surface-600" />}
            title="Couldn't load your score"
            description={error}
            action={
              <Button onClick={load} variant="ghost" size="sm" className="gap-2">
                <RefreshCw className="w-4 h-4" /> Retry
              </Button>
            }
          />
        )}

        {/* ── Data ─────────────────────────────────────────────────────── */}
        {!loading && data && (
          <div className="space-y-6">

            {/* Score hero */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center gap-5 py-6"
            >
              <ScoreRing score={data.totalScore} tier={data.tier} />

              <div className="text-center space-y-2">
                <div className={cn(
                  'inline-flex items-center gap-2 px-4 py-1.5 rounded-full border font-mono text-sm font-bold uppercase tracking-widest',
                  tierStyles.border,
                  tierStyles.bg,
                  tierStyles.text,
                )}>
                  <Award className="w-3.5 h-3.5" />
                  {data.tierLabel}
                </div>
                <p className="font-mono text-xs text-surface-500">
                  Top {100 - data.percentile}% of citizens ·{' '}
                  {data.daysActive} day{data.daysActive === 1 ? '' : 's'} on the Lobby
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleShare}
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-xs"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Share'}
                </Button>
                <Link href="/leaderboard/civic-score">
                  <Button variant="ghost" size="sm" className="gap-2 text-xs">
                    <BarChart2 className="w-3.5 h-3.5" />
                    Leaderboard
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Dimension cards */}
            <div>
              <h2 className="font-mono text-xs uppercase tracking-widest text-surface-500 mb-3">
                Score Breakdown
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.dimensions.map((dim, i) => (
                  <DimensionCard key={dim.key} dim={dim} index={i} />
                ))}
              </div>
            </div>

            {/* Highlights */}
            {data.highlights.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.9 }}
                className="rounded-xl border border-gold/30 bg-gold/5 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-gold" />
                  <span className="font-mono text-sm font-semibold text-gold">Highlights</span>
                </div>
                <ul className="space-y-1.5">
                  {data.highlights.map((h) => (
                    <li key={h} className="flex items-center gap-2 font-mono text-xs text-surface-600">
                      <span className="w-1 h-1 rounded-full bg-gold shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Next actions */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 1.0 }}
              className="rounded-xl border border-surface-300 bg-surface-100 p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-for-400" />
                <span className="font-mono text-sm font-semibold text-white">Boost Your Score</span>
              </div>
              <ul className="space-y-2">
                {data.nextActions.map((action) => (
                  <li key={action} className="flex items-start gap-2 font-mono text-xs text-surface-600">
                    <ChevronRight className="w-3.5 h-3.5 text-for-400 shrink-0 mt-0.5" />
                    {action}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* CTA links */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 1.1 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              {[
                { href: '/',           icon: Scale,          label: 'Vote now',    color: 'text-for-400'     },
                { href: '/arguments',  icon: MessageSquare,  label: 'Write arg',   color: 'text-purple'      },
                { href: '/debate',     icon: Mic,            label: 'Debates',     color: 'text-against-400' },
                { href: '/analytics',  icon: BarChart2,      label: 'Analytics',   color: 'text-emerald'     },
              ].map(({ href, icon: Icon, label, color }) => (
                <Link key={href} href={href}>
                  <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 transition-colors cursor-pointer">
                    <Icon className={cn('w-4 h-4', color)} />
                    <span className="font-mono text-[10px] text-surface-500">{label}</span>
                  </div>
                </Link>
              ))}
            </motion.div>

            {/* Related links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 1.2 }}
              className="flex flex-wrap gap-2 pt-2"
            >
              {[
                { href: '/reputation',         label: 'Reputation Ladder' },
                { href: '/analytics/impact',   label: 'Argument Impact'  },
                { href: '/analytics/journey',  label: 'Civic Journey'    },
                { href: '/leaderboard',        label: 'Leaderboard'      },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="font-mono text-[10px] text-surface-500 hover:text-surface-600 transition-colors flex items-center gap-1"
                >
                  {label}
                  <ArrowRight className="w-3 h-3" />
                </Link>
              ))}
            </motion.div>

          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
