'use client'

/**
 * /moments — Civic Highlights Feed
 *
 * A TikTok-style full-screen vertical feed of the most significant recent
 * civic moments: laws just established, debates resolved, topics surging
 * toward consensus, and historic vote counts.
 *
 * Each card fills the viewport. Users scroll or click through them.
 * Every moment links to the underlying topic or law for deeper engagement.
 *
 * Distinct from:
 *  - /today       (raw daily stats, not card-format)
 *  - /newspaper   (editorial prose format)
 *  - /weekly      (7-day community digest)
 *  - /catchup     (personalised "what you missed")
 *  - /live        (real-time argument stream)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flame,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Swords,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { SharePanel } from '@/components/ui/SharePanel'
import { cn } from '@/lib/utils/cn'
import type { Moment, MomentsResponse, MomentType } from '@/app/api/moments/route'

// ─── Moment type config ───────────────────────────────────────────────────────

interface MomentConfig {
  icon: typeof Gavel
  iconBg: string
  iconColor: string
  label: string
  accent: string
  glowClass: string
  badgeVariant: 'law' | 'active' | 'proposed' | 'failed'
}

const MOMENT_CONFIG: Record<MomentType, MomentConfig> = {
  law_established: {
    icon: Gavel,
    iconBg: 'bg-emerald/10',
    iconColor: 'text-emerald',
    label: 'New Law Established',
    accent: 'from-emerald/20 via-emerald/5 to-transparent',
    glowClass: 'shadow-emerald/10',
    badgeVariant: 'law',
  },
  voting_open: {
    icon: Scale,
    iconBg: 'bg-purple/10',
    iconColor: 'text-purple',
    label: 'Final Vote Underway',
    accent: 'from-purple/20 via-purple/5 to-transparent',
    glowClass: 'shadow-purple/10',
    badgeVariant: 'active',
  },
  near_law: {
    icon: Sparkles,
    iconBg: 'bg-for-500/10',
    iconColor: 'text-for-400',
    label: 'Approaching Consensus',
    accent: 'from-for-500/20 via-for-500/5 to-transparent',
    glowClass: 'shadow-for-500/10',
    badgeVariant: 'active',
  },
  vote_surge: {
    icon: Flame,
    iconBg: 'bg-gold/10',
    iconColor: 'text-gold',
    label: 'Vote Surge',
    accent: 'from-gold/20 via-gold/5 to-transparent',
    glowClass: 'shadow-gold/10',
    badgeVariant: 'active',
  },
  debate_ended: {
    icon: Swords,
    iconBg: 'bg-against-500/10',
    iconColor: 'text-against-400',
    label: 'Debate Concluded',
    accent: 'from-against-500/20 via-against-500/5 to-transparent',
    glowClass: 'shadow-against-500/10',
    badgeVariant: 'proposed',
  },
  law_milestone: {
    icon: Sparkles,
    iconBg: 'bg-gold/10',
    iconColor: 'text-gold',
    label: 'Civic Milestone',
    accent: 'from-gold/20 via-gold/5 to-transparent',
    glowClass: 'shadow-gold/10',
    badgeVariant: 'law',
  },
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics: 'text-for-400',
  Economics: 'text-gold',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function countdown(isoEnd: string): string {
  const ms = new Date(isoEnd).getTime() - Date.now()
  if (ms <= 0) return 'Ended'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 24) return `${Math.floor(h / 24)}d remaining`
  if (h > 0) return `${h}h ${m}m remaining`
  return `${m}m remaining`
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({ bluePct }: { bluePct: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-1.5 text-for-400">
          <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-semibold">{forPct}%</span>
          <span className="text-surface-500">FOR</span>
        </div>
        <div className="flex items-center gap-1.5 text-against-400">
          <span className="text-surface-500">AGAINST</span>
          <span className="font-semibold">{againstPct}%</span>
          <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden bg-surface-300 flex"
        role="meter"
        aria-valuenow={forPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${forPct}% for, ${againstPct}% against`}
      >
        <motion.div
          className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-l-full"
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
        <motion.div
          className="h-full bg-against-500 rounded-r-full"
          initial={{ width: 0 }}
          animate={{ width: `${againstPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
    </div>
  )
}

// ─── Single moment card ───────────────────────────────────────────────────────

function MomentCard({
  moment,
  index,
  total,
  active,
  onPrev,
  onNext,
}: {
  moment: Moment
  index: number
  total: number
  active: boolean
  onPrev: () => void
  onNext: () => void
}) {
  const cfg = MOMENT_CONFIG[moment.type]
  const Icon = cfg.icon
  const catColor = CATEGORY_COLORS[moment.category ?? ''] ?? 'text-surface-500'
  const [shareOpen, setShareOpen] = useState(false)
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/topic/${moment.topic_id}`

  return (
    <>
      <motion.div
        key={moment.id}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: active ? 1 : 0, y: active ? 0 : 40 }}
        exit={{ opacity: 0, y: -40 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className={cn(
          'relative w-full h-full flex flex-col justify-between',
          'rounded-3xl border border-surface-300 overflow-hidden',
          'bg-surface-100',
          'shadow-2xl', cfg.glowClass,
        )}
        aria-label={`Moment ${index + 1} of ${total}: ${cfg.label}`}
      >
        {/* Top gradient accent */}
        <div
          className={cn(
            'absolute inset-x-0 top-0 h-48 bg-gradient-to-b pointer-events-none',
            cfg.accent,
          )}
          aria-hidden="true"
        />

        {/* Progress dots */}
        <div
          className="absolute top-4 inset-x-0 flex justify-center gap-1.5 z-10"
          aria-label={`${index + 1} of ${total} moments`}
        >
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'rounded-full transition-all duration-300',
                i === index
                  ? 'w-6 h-1.5 bg-white'
                  : i < index
                    ? 'w-1.5 h-1.5 bg-white/50'
                    : 'w-1.5 h-1.5 bg-surface-500',
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-6 pt-14 pb-4">
          {/* Type label + icon */}
          <div className="flex items-center gap-3 mb-5">
            <div
              className={cn(
                'flex items-center justify-center h-12 w-12 rounded-2xl flex-shrink-0',
                'border border-surface-300',
                cfg.iconBg,
              )}
              aria-hidden="true"
            >
              <Icon className={cn('h-6 w-6', cfg.iconColor)} />
            </div>
            <div>
              <p className={cn('text-xs font-mono font-semibold uppercase tracking-widest', cfg.iconColor)}>
                {cfg.label}
              </p>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                {relativeTime(moment.timestamp)}
              </p>
            </div>
            {/* Law ordinal badge */}
            {moment.type === 'law_established' && moment.context.law_number && (
              <div className="ml-auto">
                <span className="text-xs font-mono text-gold bg-gold/10 border border-gold/30 px-2.5 py-1 rounded-lg">
                  #{moment.context.law_number}
                </span>
              </div>
            )}
          </div>

          {/* Category */}
          {moment.category && (
            <p className={cn('text-[11px] font-mono uppercase tracking-widest mb-2', catColor)}>
              {moment.category}
            </p>
          )}

          {/* Statement — the hero text */}
          <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug mb-5">
            {moment.statement}
          </h2>

          {/* Vote bar */}
          <div className="mb-4">
            <VoteBar bluePct={moment.blue_pct} />
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-xs font-mono text-surface-500 mb-4 flex-wrap">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              {fmtNum(moment.total_votes)} votes
            </span>
            {moment.type === 'voting_open' && moment.context.voting_ends_at && (
              <span className="flex items-center gap-1 text-purple">
                <Scale className="h-3.5 w-3.5" aria-hidden="true" />
                {countdown(moment.context.voting_ends_at)}
              </span>
            )}
            {moment.type === 'near_law' && (
              <span className="flex items-center gap-1 text-for-400">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {Math.round(moment.blue_pct)}% consensus — almost law
              </span>
            )}
            {moment.type === 'vote_surge' && (
              <span className="flex items-center gap-1 text-gold">
                <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                Trending now
              </span>
            )}
            {moment.type === 'law_established' && (
              <span className="flex items-center gap-1 text-emerald">
                <Gavel className="h-3.5 w-3.5" aria-hidden="true" />
                Passed by {Math.round(moment.blue_pct)}% majority
              </span>
            )}
          </div>
        </div>

        {/* CTA buttons */}
        <div className="relative z-10 px-6 pb-6 flex items-center gap-3">
          <Link
            href={moment.type === 'law_established'
              ? `/law/${moment.topic_id}`
              : `/topic/${moment.topic_id}`}
            className={cn(
              'flex-1 flex items-center justify-center gap-2',
              'rounded-xl py-3 text-sm font-mono font-semibold',
              'border transition-all duration-150',
              moment.type === 'law_established'
                ? 'bg-emerald/10 border-emerald/40 text-emerald hover:bg-emerald/20'
                : 'bg-for-600 border-for-500/60 text-white hover:bg-for-500',
            )}
            aria-label={moment.type === 'law_established' ? 'View established law' : 'View debate'}
          >
            {moment.type === 'law_established' ? (
              <Gavel className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            )}
            {moment.type === 'law_established' ? 'View Law' : 'Join Debate'}
          </Link>
          <button
            onClick={() => setShareOpen(true)}
            aria-label="Share this moment"
            className={cn(
              'flex items-center justify-center h-12 w-12 rounded-xl',
              'bg-surface-200 border border-surface-300',
              'text-surface-400 hover:text-white hover:bg-surface-300',
              'transition-colors',
            )}
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Tap zones for prev/next (desktop keyboard-accessible) */}
        <button
          onClick={onPrev}
          disabled={index === 0}
          aria-label="Previous moment"
          className="absolute left-0 top-0 bottom-0 w-1/4 opacity-0 cursor-pointer disabled:cursor-default"
        />
        <button
          onClick={onNext}
          disabled={index === total - 1}
          aria-label="Next moment"
          className="absolute right-0 top-0 bottom-0 w-1/4 opacity-0 cursor-pointer disabled:cursor-default"
        />
      </motion.div>

      {/* Share panel */}
      {shareOpen && (
        <SharePanel
          url={shareUrl}
          title={`"${moment.statement}" — ${cfg.label} on Lobby Market`}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  )
}

// ─── Skeleton placeholder ─────────────────────────────────────────────────────

function MomentSkeleton() {
  return (
    <div className="w-full h-full rounded-3xl border border-surface-300 bg-surface-100 animate-pulse flex flex-col justify-center p-8 gap-5">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-surface-300" />
        <div className="space-y-2 flex-1">
          <div className="h-3 w-32 rounded bg-surface-300" />
          <div className="h-3 w-20 rounded bg-surface-300" />
        </div>
      </div>
      <div className="h-3 w-20 rounded bg-surface-300" />
      <div className="space-y-3">
        <div className="h-7 w-full rounded bg-surface-300" />
        <div className="h-7 w-5/6 rounded bg-surface-300" />
        <div className="h-7 w-4/6 rounded bg-surface-300" />
      </div>
      <div className="h-2 w-full rounded-full bg-surface-300" />
      <div className="flex gap-3">
        <div className="h-12 flex-1 rounded-xl bg-surface-300" />
        <div className="h-12 w-12 rounded-xl bg-surface-300" />
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyMoments({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="w-full h-full rounded-3xl border border-surface-300 bg-surface-100 flex flex-col items-center justify-center gap-5 p-8">
      <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-for-500/10 border border-for-500/30">
        <Zap className="h-8 w-8 text-for-400" aria-hidden="true" />
      </div>
      <div className="text-center space-y-2">
        <p className="font-mono text-lg font-bold text-white">No moments yet</p>
        <p className="text-sm font-mono text-surface-500 max-w-xs leading-relaxed">
          Moments appear when laws pass, debates resolve, or topics surge toward consensus.
          Check back soon.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Link
          href="/"
          className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-mono font-semibold bg-for-600 border border-for-500/60 text-white hover:bg-for-500 transition-colors"
        >
          Browse Feed
        </Link>
        <button
          onClick={onRefresh}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-mono text-surface-400 bg-surface-200 border border-surface-300 hover:text-white hover:bg-surface-300 transition-colors"
          aria-label="Refresh moments"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MomentsPage() {
  const [moments, setMoments] = useState<Moment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/moments')
      if (!res.ok) throw new Error('Failed to load moments')
      const data = (await res.json()) as MomentsResponse
      setMoments(data.moments)
      setCurrent(0)
    } catch {
      setError('Could not load moments. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), [])
  const next = useCallback(() => setCurrent((c) => Math.min((moments.length || 1) - 1, c + 1)), [moments.length])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next])

  // Touch/swipe navigation
  function onTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null) return
    const dy = touchStartY.current - e.changedTouches[0].clientY
    if (Math.abs(dy) > 50) {
      if (dy > 0) next()
      else prev()
    }
    touchStartY.current = null
  }

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4 pb-24 md:pb-12 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
              aria-label="Back to feed"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="font-mono text-xl font-bold text-white flex items-center gap-2">
                <Flame className="h-5 w-5 text-gold" aria-hidden="true" />
                Moments
              </h1>
              <p className="text-xs font-mono text-surface-500">
                {moments.length > 0
                  ? `${current + 1} / ${moments.length}`
                  : 'Civic highlights'}
              </p>
            </div>
          </div>

          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh moments"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>

        {/* Card area — flexible height, fills remaining space */}
        <div
          ref={containerRef}
          className="flex-1 relative min-h-[520px]"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{ minHeight: 'clamp(480px, 70vh, 700px)' }}
        >
          <AnimatePresence mode="wait">
            {loading ? (
              <div key="skeleton" className="absolute inset-0">
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-for-400 animate-spin" />
                </div>
                <MomentSkeleton />
              </div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-3xl border border-against-500/30 bg-surface-100 p-8"
              >
                <p className="text-sm font-mono text-against-400">{error}</p>
                <button
                  onClick={load}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono bg-surface-200 text-white hover:bg-surface-300 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try again
                </button>
              </motion.div>
            ) : moments.length === 0 ? (
              <div key="empty" className="absolute inset-0">
                <EmptyMoments onRefresh={load} />
              </div>
            ) : (
              <div key={`card-${current}`} className="absolute inset-0">
                <MomentCard
                  moment={moments[current]}
                  index={current}
                  total={moments.length}
                  active={true}
                  onPrev={prev}
                  onNext={next}
                />
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation controls */}
        {!loading && moments.length > 1 && (
          <div className="flex items-center justify-center gap-4 flex-shrink-0">
            <button
              onClick={prev}
              disabled={current === 0}
              aria-label="Previous moment"
              className={cn(
                'flex items-center justify-center h-10 w-10 rounded-full',
                'border border-surface-300 bg-surface-200',
                'text-surface-400 transition-all duration-150',
                current === 0
                  ? 'opacity-30 cursor-not-allowed'
                  : 'hover:bg-surface-300 hover:text-white cursor-pointer',
              )}
            >
              <ChevronUp className="h-5 w-5" aria-hidden="true" />
            </button>

            {/* Dot indicators */}
            <div className="flex items-center gap-1.5" aria-label={`${current + 1} of ${moments.length}`}>
              {moments.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  aria-label={`Go to moment ${i + 1}`}
                  className={cn(
                    'rounded-full transition-all duration-200',
                    i === current
                      ? 'w-5 h-2 bg-for-400'
                      : 'w-2 h-2 bg-surface-400 hover:bg-surface-300',
                  )}
                />
              ))}
            </div>

            <button
              onClick={next}
              disabled={current === moments.length - 1}
              aria-label="Next moment"
              className={cn(
                'flex items-center justify-center h-10 w-10 rounded-full',
                'border border-surface-300 bg-surface-200',
                'text-surface-400 transition-all duration-150',
                current === moments.length - 1
                  ? 'opacity-30 cursor-not-allowed'
                  : 'hover:bg-surface-300 hover:text-white cursor-pointer',
              )}
            >
              <ChevronDown className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Footer nav links */}
        {!loading && moments.length > 0 && (
          <div className="flex items-center justify-center gap-4 text-xs font-mono text-surface-500 flex-shrink-0">
            <Link href="/today" className="hover:text-surface-300 transition-colors flex items-center gap-1">
              <ArrowRight className="h-3 w-3" />
              Today&apos;s stats
            </Link>
            <span className="text-surface-600">·</span>
            <Link href="/weekly" className="hover:text-surface-300 transition-colors flex items-center gap-1">
              <ArrowRight className="h-3 w-3" />
              Weekly roundup
            </Link>
            <span className="text-surface-600">·</span>
            <Link href="/law" className="hover:text-surface-300 transition-colors flex items-center gap-1">
              <Gavel className="h-3 w-3" />
              All Laws
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
