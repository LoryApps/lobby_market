'use client'

/**
 * /relays/[id]/scorecard — Relay Chain Performance Breakdown
 *
 * Detailed quality analysis of a relay chain:
 *   • Per-leg upvote distribution (bar chart)
 *   • MVP leg highlight
 *   • Compelling vote score
 *   • Comparison against the opposing relay (if one exists)
 *   • Platform percentile ranking (for voted relays)
 *
 * Distinct from:
 *   /relays/[id]             — main relay detail (read + contribute)
 *   /relays/[id]/intelligence — AI narrative analysis
 *   /relays/[id]/transcript  — plain-text position paper
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  ChevronRight,
  ExternalLink,
  FileText,
  GitMerge,
  Loader2,
  RefreshCw,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { ScorecardData, ScorecardLeg } from '@/app/api/relays/[id]/scorecard/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function gradeLabel(pct: number): { label: string; cls: string } {
  if (pct >= 80) return { label: 'S', cls: 'text-gold border-gold/50 bg-gold/10' }
  if (pct >= 65) return { label: 'A', cls: 'text-emerald border-emerald/50 bg-emerald/10' }
  if (pct >= 50) return { label: 'B', cls: 'text-for-400 border-for-500/40 bg-for-500/10' }
  if (pct >= 35) return { label: 'C', cls: 'text-surface-300 border-surface-400/40 bg-surface-300/10' }
  return { label: 'D', cls: 'text-against-400 border-against-500/40 bg-against-500/10' }
}

// ─── Leg scorecard row ────────────────────────────────────────────────────────

function LegRow({ leg, isFor, maxUpvotes }: { leg: ScorecardLeg; isFor: boolean; maxUpvotes: number }) {
  const barWidth = maxUpvotes > 0 ? (leg.upvote_count / maxUpvotes) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative rounded-2xl border p-4 space-y-3 transition-colors',
        leg.is_mvp
          ? 'border-gold/40 bg-gold/5'
          : 'border-surface-300 bg-surface-100'
      )}
    >
      {/* MVP badge */}
      {leg.is_mvp && (
        <div className="absolute -top-2.5 left-4 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/20 border border-gold/40 text-gold text-[10px] font-mono font-bold">
          <Trophy className="h-2.5 w-2.5" />
          MVP LEG
        </div>
      )}

      {/* Leg number + author */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={cn(
            'inline-flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-black font-mono',
            isFor
              ? 'bg-for-600/20 text-for-300 border border-for-600/30'
              : 'bg-against-600/20 text-against-300 border border-against-600/30'
          )}>
            {leg.leg_number}
          </span>
          <Link
            href={`/profile/${leg.author_username}`}
            className="flex items-center gap-1.5 group"
          >
            <Avatar
              src={leg.author_avatar_url}
              fallback={leg.author_display_name || leg.author_username}
              size="xs"
            />
            <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
              {leg.author_display_name || `@${leg.author_username}`}
            </span>
          </Link>
          <span className="text-[10px] font-mono text-surface-600">
            {relativeTime(leg.created_at)}
          </span>
        </div>

        {/* Star count */}
        <div className="flex items-center gap-1 text-xs font-mono">
          <Star className={cn('h-3.5 w-3.5', leg.upvote_count > 0 ? 'text-gold fill-gold' : 'text-surface-500')} />
          <span className={leg.upvote_count > 0 ? 'text-gold' : 'text-surface-500'}>
            {leg.upvote_count}
          </span>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-surface-200 leading-relaxed font-sans">
        {leg.content}
      </p>

      {/* Upvote bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
          <span>Star share</span>
          <span>{leg.score_pct}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', isFor ? 'bg-for-500' : 'bg-against-500')}
            initial={{ width: 0 }}
            animate={{ width: `${barWidth}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 * leg.leg_number }}
          />
        </div>
      </div>
    </motion.div>
  )
}

// ─── Head-to-head block ───────────────────────────────────────────────────────

function HeadToHead({
  data,
  isFor,
}: {
  data: ScorecardData
  isFor: boolean
}) {
  const opp = data.opposing_relay
  if (!opp) return null

  const myPct = data.compelling_pct
  const oppPct = opp.compelling_pct
  const myStars = data.total_upvotes
  const oppStars = opp.total_upvotes
  const starMax = Math.max(myStars, oppStars, 1)

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-mono font-bold text-white">
        <GitMerge className="h-4 w-4 text-purple" />
        FOR vs AGAINST
      </div>
      <p className="text-xs font-mono text-surface-500">
        How this relay compares to the opposing side on the same topic
      </p>

      {/* Compelling pct bar */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Compelling votes</div>
        <div className="space-y-2">
          {/* FOR bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className={isFor ? 'text-for-300 font-bold' : 'text-surface-400'}>FOR{isFor ? ' (this)' : ''}</span>
              <span className={isFor ? 'text-for-300' : 'text-surface-400'}>
                {isFor ? myPct : oppPct}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-300 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-for-500"
                initial={{ width: 0 }}
                animate={{ width: `${isFor ? myPct : oppPct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>
          </div>
          {/* AGAINST bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className={!isFor ? 'text-against-300 font-bold' : 'text-surface-400'}>AGAINST{!isFor ? ' (this)' : ''}</span>
              <span className={!isFor ? 'text-against-300' : 'text-surface-400'}>
                {!isFor ? myPct : oppPct}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-300 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-against-500"
                initial={{ width: 0 }}
                animate={{ width: `${!isFor ? myPct : oppPct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stars comparison */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Community stars</div>
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className={isFor ? 'text-for-300 font-bold' : 'text-surface-400'}>
                FOR{isFor ? ' (this)' : ''}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 text-gold fill-gold" />
                <span className={isFor ? 'text-gold' : 'text-surface-400'}>
                  {isFor ? myStars : oppStars}
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-for-500"
                initial={{ width: 0 }}
                animate={{ width: `${((isFor ? myStars : oppStars) / starMax) * 100}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className={!isFor ? 'text-against-300 font-bold' : 'text-surface-400'}>
                AGAINST{!isFor ? ' (this)' : ''}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 text-gold fill-gold" />
                <span className={!isFor ? 'text-gold' : 'text-surface-400'}>
                  {!isFor ? myStars : oppStars}
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-against-500"
                initial={{ width: 0 }}
                animate={{ width: `${((!isFor ? myStars : oppStars) / starMax) * 100}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Link to showdown */}
      <Link
        href="/relays/showdown"
        className="flex items-center gap-2 text-xs font-mono text-purple hover:text-purple/80 transition-colors"
      >
        View full showdown
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RelayScorecardClient() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const [data, setData] = useState<ScorecardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/relays/${id}/scorecard`)
      if (!res.ok) throw new Error('Failed to load scorecard')
      const json: ScorecardData = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const isFor = data?.side === 'for'
  const grade = data ? gradeLabel(data.compelling_pct) : null
  const maxUpvotes = data ? Math.max(...data.legs.map((l) => l.upvote_count), 1) : 1

  return (
    <div className="relative min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-4 pb-32 space-y-5">

        {/* ── Nav bar ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-xl hover:bg-surface-200 transition-colors text-surface-400 hover:text-white"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <BarChart2 className="h-4 w-4 text-gold flex-shrink-0" />
            <span className="text-sm font-mono text-surface-500 truncate">
              Relay Scorecard
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/relays/${id}/transcript`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono"
            >
              <FileText className="h-3.5 w-3.5" />
              Read
            </Link>
            <Link
              href={`/relays/${id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono"
            >
              <GitMerge className="h-3.5 w-3.5" />
              Relay
            </Link>
          </div>
        </div>

        {/* ── Loading ────────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 text-gold animate-spin" />
            <p className="text-sm font-mono text-surface-500">Loading scorecard…</p>
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────────── */}
        {!loading && error && (
          <div className="rounded-2xl border border-against-600/30 bg-against-600/10 p-6 text-center space-y-3">
            <p className="text-sm font-mono text-against-300">{error}</p>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 mx-auto text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* ── Content ────────────────────────────────────────────── */}
        {!loading && !error && data && (
          <>
            {/* Topic */}
            {data.topic_statement && (
              <Link
                href={data.topic_id ? `/topic/${data.topic_id}` : '#'}
                className="block rounded-2xl border border-surface-300 bg-surface-100 p-4 hover:border-surface-400 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <ExternalLink className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    {data.topic_category && (
                      <div className="text-[10px] font-mono text-surface-500 mb-1 uppercase tracking-wider">
                        {data.topic_category}
                      </div>
                    )}
                    <p className="text-sm font-sans text-surface-200 group-hover:text-white transition-colors leading-snug">
                      {data.topic_statement}
                    </p>
                  </div>
                </div>
              </Link>
            )}

            {/* ── Headline stats ──────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Side + Grade */}
              <div className={cn(
                'rounded-2xl border p-4 space-y-1 col-span-1',
                isFor
                  ? 'border-for-600/30 bg-for-600/10'
                  : 'border-against-600/30 bg-against-600/10'
              )}>
                <div className={cn(
                  'text-xs font-mono uppercase tracking-widest font-black',
                  isFor ? 'text-for-300' : 'text-against-300'
                )}>
                  {isFor ? 'FOR' : 'AGAINST'}
                </div>
                <div className="text-[10px] font-mono text-surface-500">Side</div>
              </div>

              {/* Compelling % + Grade */}
              {grade && (
                <div className={cn(
                  'rounded-2xl border p-4 space-y-1',
                  grade.cls.includes('gold') ? 'border-gold/30 bg-gold/5' : 'border-surface-300 bg-surface-100'
                )}>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-2xl font-black font-mono',
                      grade.cls.split(' ').find((c) => c.startsWith('text-'))
                    )}>
                      {grade.label}
                    </span>
                    <span className={cn(
                      'text-sm font-mono',
                      data.total_votes > 0 ? 'text-white' : 'text-surface-500'
                    )}>
                      {data.total_votes > 0 ? `${data.compelling_pct}%` : '—'}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-surface-500">
                    {data.total_votes > 0 ? 'Compelling' : 'Not yet voted'}
                  </div>
                </div>
              )}

              {/* Total upvotes / stars */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-gold fill-gold" />
                  <span className="text-xl font-black font-mono text-white">{data.total_upvotes}</span>
                </div>
                <div className="text-[10px] font-mono text-surface-500">
                  Total stars
                </div>
              </div>

              {/* Votes cast */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-purple" />
                  <span className="text-xl font-black font-mono text-white">{data.total_votes}</span>
                </div>
                <div className="text-[10px] font-mono text-surface-500">
                  Votes cast
                </div>
              </div>
            </div>

            {/* Compelling vote breakdown */}
            {data.total_votes > 0 && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1.5 text-emerald">
                    <ThumbsUp className="h-3.5 w-3.5" />
                    <span>{data.vote_compelling} Compelling</span>
                  </div>
                  <span className="text-surface-500 font-bold">{data.compelling_pct}%</span>
                  <div className="flex items-center gap-1.5 text-against-400">
                    <span>{data.vote_not_compelling} Not compelling</span>
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="relative h-3 rounded-full overflow-hidden bg-against-600/30">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-emerald rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.compelling_pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                {data.relay_percentile !== null && (
                  <div className="flex items-center gap-2 text-[11px] font-mono text-surface-500">
                    <Trophy className="h-3.5 w-3.5 text-gold" />
                    <span>Top {100 - data.relay_percentile}% of all relay chains</span>
                  </div>
                )}
              </div>
            )}

            {/* Status info for incomplete relays */}
            {(data.status === 'open' || data.status === 'in_progress') && (
              <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4 flex items-center gap-3">
                <Zap className="h-4 w-4 text-gold flex-shrink-0" />
                <div className="text-xs font-mono text-surface-300">
                  <span className="text-gold font-bold">{data.legs.length}/{data.max_legs} legs filled</span>
                  {' '}— this relay is still open. Scores update as more legs and stars are added.
                </div>
              </div>
            )}

            {/* ── Per-leg breakdown ───────────────────────────────── */}
            {data.legs.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-mono font-bold text-white">
                  <Award className="h-4 w-4 text-gold" />
                  Leg-by-Leg Breakdown
                </div>

                {/* Overview bar chart */}
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                  <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                    Star distribution across legs
                  </div>
                  <div className="flex items-end gap-2 h-16">
                    {data.legs.map((leg) => {
                      const barH = maxUpvotes > 0 ? (leg.upvote_count / maxUpvotes) * 100 : 0
                      return (
                        <div key={leg.id} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full relative" style={{ height: '48px' }}>
                            <motion.div
                              className={cn(
                                'absolute bottom-0 w-full rounded-t-sm',
                                leg.is_mvp
                                  ? 'bg-gold'
                                  : isFor ? 'bg-for-500/60' : 'bg-against-500/60'
                              )}
                              initial={{ height: 0 }}
                              animate={{ height: `${barH}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 * leg.leg_number }}
                            />
                          </div>
                          <span className={cn(
                            'text-[10px] font-mono',
                            leg.is_mvp ? 'text-gold' : 'text-surface-500'
                          )}>
                            {leg.leg_number}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-surface-600">
                    <Star className="h-2.5 w-2.5 text-gold fill-gold" />
                    avg {data.avg_upvotes_per_leg} stars per leg
                  </div>
                </div>

                {/* Individual leg rows */}
                <div className="space-y-3">
                  {data.legs.map((leg) => (
                    <LegRow
                      key={leg.id}
                      leg={leg}
                      isFor={isFor}
                      maxUpvotes={maxUpvotes}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center space-y-2">
                <GitMerge className="h-8 w-8 text-surface-500 mx-auto" />
                <p className="text-sm font-mono text-surface-400">No legs yet</p>
                <Link
                  href={`/relays/${id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-purple hover:text-purple/80 transition-colors"
                >
                  Be the first to contribute
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            {/* ── Head-to-head ────────────────────────────────────── */}
            <HeadToHead data={data} isFor={isFor} />

            {/* ── Footer ─────────────────────────────────────────── */}
            <div className="rounded-2xl border border-surface-300/60 bg-surface-100/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono text-surface-500">
                <span>Relay started by</span>
                <Link
                  href={`/profile/${data.starter_username}`}
                  className="flex items-center gap-1.5 text-surface-400 hover:text-white transition-colors"
                >
                  <Avatar
                    src={data.starter_avatar_url}
                    fallback={data.starter_display_name || data.starter_username}
                    size="xs"
                  />
                  {data.starter_display_name || `@${data.starter_username}`}
                </Link>
                <span>·</span>
                <span>{relativeTime(data.created_at)}</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <Link
                  href={`/relays/${id}`}
                  className="text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                >
                  <GitMerge className="h-3 w-3" />
                  Full relay
                </Link>
                <span className="text-surface-600">·</span>
                <Link
                  href={`/relays/${id}/transcript`}
                  className="text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                >
                  <FileText className="h-3 w-3" />
                  Transcript
                </Link>
                <span className="text-surface-600">·</span>
                <Link
                  href="/relays"
                  className="text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  All relays
                </Link>
              </div>
            </div>
          </>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
