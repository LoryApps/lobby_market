'use client'

/**
 * /law/endorsements — Law Endorsements Hub
 *
 * Platform-wide leaderboard of the most formally endorsed established laws.
 * Citizens endorse laws they actively stand behind — distinct from the
 * original FOR vote (which created the law) and the community verdict
 * (which judges whether it succeeded).
 *
 * An endorsement is a live public commitment: "I stand behind this law today."
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  Check,
  ChevronDown,
  Clock,
  Filter,
  Gavel,
  Heart,
  Loader2,
  RefreshCw,
  Sparkles,
  SlidersHorizontal,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { EndorsedLaw, LawEndorsementsResponse } from '@/app/api/laws/endorsements/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'all',
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
}

function getCatStyle(cat: string | null) {
  return cat && CAT_COLOR[cat]
    ? CAT_COLOR[cat]
    : { text: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/40' }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EndorsementsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-10 w-20 rounded-xl flex-shrink-0" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Law Card ─────────────────────────────────────────────────────────────────

interface LawCardProps {
  law: EndorsedLaw
  rank: number
}

function EndorsedLawCard({ law, rank }: LawCardProps) {
  const catStyle = getCatStyle(law.law_category)
  const forPct = Math.round(law.law_blue_pct ?? 50)
  const isTop3 = rank <= 3
  const rankColor = rank === 1 ? 'text-gold' : rank === 2 ? 'text-surface-400' : rank === 3 ? 'text-amber-600' : 'text-surface-600'
  const rankBg = rank === 1 ? 'bg-gold/10 border-gold/30' : rank === 2 ? 'bg-surface-300/40 border-surface-400/40' : rank === 3 ? 'bg-amber-900/20 border-amber-700/30' : 'bg-surface-200 border-surface-300/60'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(rank * 0.04, 0.3) }}
    >
      <Link href={`/law/${law.law_id}/endorse`} className="block group">
        <div className={cn(
          'rounded-2xl border p-4 transition-all duration-200',
          'bg-surface-100 border-surface-300',
          'hover:border-surface-400 hover:bg-surface-200/50',
          law.user_has_endorsed && 'ring-1 ring-for-500/30'
        )}>
          <div className="flex items-start gap-3">
            {/* Rank badge */}
            <div className={cn(
              'flex-shrink-0 h-8 w-8 rounded-lg border flex items-center justify-center text-xs font-bold font-mono',
              rankBg, rankColor,
              isTop3 && 'h-9 w-9 text-sm'
            )}>
              {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
            </div>

            {/* Law info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
                {law.law_statement}
              </p>

              <div className="flex flex-wrap items-center gap-2 mt-2">
                {law.law_category && (
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', catStyle.text, catStyle.bg, catStyle.border)}>
                    {law.law_category}
                  </span>
                )}
                <span className="text-xs text-gold font-medium px-2 py-0.5 rounded-full bg-gold/10 border border-gold/25">
                  LAW
                </span>
                <span className="text-xs text-surface-500">
                  {forPct}% For · {(law.law_total_votes ?? 0).toLocaleString()} votes
                </span>
                {law.latest_endorsement_at && (
                  <span className="text-xs text-surface-600">
                    Last endorsed {relTime(law.latest_endorsement_at)}
                  </span>
                )}
              </div>
            </div>

            {/* Endorsement count */}
            <div className="flex-shrink-0 flex flex-col items-center gap-1">
              <div className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl border',
                law.user_has_endorsed
                  ? 'bg-for-500/20 border-for-500/40 text-for-300'
                  : 'bg-surface-200 border-surface-300 text-surface-400'
              )}>
                <Heart className={cn('h-4 w-4', law.user_has_endorsed && 'fill-current')} />
                <span className="text-sm font-bold font-mono">
                  {formatCount(law.endorsement_count)}
                </span>
              </div>
              {law.user_has_endorsed && (
                <span className="text-xs text-for-400 flex items-center gap-0.5">
                  <Check className="h-3 w-3" />
                  endorsed
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LawEndorsementsPage() {
  const [data, setData] = useState<LawEndorsementsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<'count' | 'recent'>('count')
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ sort, limit: '60' })
      if (category !== 'all') params.set('category', category)
      const res = await fetch(`/api/laws/endorsements?${params}`)
      if (!res.ok) throw new Error('Failed to load endorsements')
      const json = await res.json() as LawEndorsementsResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [category, sort])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back */}
        <Link
          href="/law"
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Law Codex
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-for-500/15 border border-for-500/30 flex items-center justify-center">
              <Heart className="h-5 w-5 text-for-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Law Endorsements</h1>
              <p className="text-sm text-surface-500">Most formally endorsed established laws</p>
            </div>
          </div>

          {/* Platform stats */}
          {data && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 grid grid-cols-3 gap-3"
            >
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
                <p className="text-lg font-bold text-for-300 font-mono">{data.total_endorsements.toLocaleString()}</p>
                <p className="text-xs text-surface-500 mt-0.5">Total endorsements</p>
              </div>
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
                <p className="text-lg font-bold text-gold font-mono">{data.total_endorsed_laws}</p>
                <p className="text-xs text-surface-500 mt-0.5">Laws endorsed</p>
              </div>
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
                <p className="text-lg font-bold text-purple font-mono">{data.top_endorser_count}</p>
                <p className="text-xs text-surface-500 mt-0.5">Top endorser count</p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setShowFilters(f => !f)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
              showFilters
                ? 'bg-for-500/20 border-for-500/40 text-for-300'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            <ChevronDown className={cn('h-3 w-3 transition-transform', showFilters && 'rotate-180')} />
          </button>

          {/* Sort */}
          <div className="flex gap-1.5 ml-auto">
            {(['count', 'recent'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={cn(
                  'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                  sort === s
                    ? 'bg-for-500/20 border-for-500/40 text-for-300'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                {s === 'count' ? <Award className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {s === 'count' ? 'Most endorsed' : 'Recent'}
              </button>
            ))}
          </div>
        </div>

        {/* Category filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-1.5 mb-4 pb-4 border-b border-surface-300">
                {CATEGORIES.map(cat => {
                  const style = cat === 'all' ? null : getCatStyle(cat)
                  const active = category === cat
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-full border font-medium transition-colors capitalize',
                        active
                          ? cat === 'all'
                            ? 'bg-surface-300 text-white border-surface-400'
                            : cn(style?.bg, style?.text, style?.border)
                          : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                      )}
                    >
                      {cat === 'all' ? 'All categories' : cat}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {loading ? (
          <EndorsementsSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-against-900/30 border border-against-700/40 p-6 text-center">
            <p className="text-against-400 text-sm">{error}</p>
            <button
              onClick={load}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-surface-400 hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : !data || data.laws.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No endorsements yet"
            description={
              category !== 'all'
                ? `No laws in ${category} have been formally endorsed yet.`
                : 'Be the first to formally endorse an established law you stand behind.'
            }
            action={
              <Link
                href="/law"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-medium hover:bg-for-500 transition-colors"
              >
                <Gavel className="h-4 w-4" />
                Browse Laws
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {data.laws.map((law, i) => (
              <EndorsedLawCard key={law.law_id} law={law} rank={i + 1} />
            ))}

            {/* CTA to endorse more */}
            <div className="mt-6 rounded-2xl bg-for-900/30 border border-for-700/30 p-5 text-center">
              <Heart className="h-6 w-6 text-for-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-white mb-1">Stand behind the laws you believe in</p>
              <p className="text-xs text-surface-500 mb-3">
                Formal endorsements are your public commitment that a law should remain.
              </p>
              <Link
                href="/law"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600/80 text-white text-sm font-medium hover:bg-for-500 transition-colors"
              >
                <Gavel className="h-4 w-4" />
                Browse Laws to Endorse
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Top Endorsers link */}
            <Link
              href="/leaderboard/endorsements"
              className="flex items-center justify-between rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 hover:bg-gold/10 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-gold" />
                <div>
                  <p className="text-sm font-mono font-semibold text-white">Top Law Endorsers</p>
                  <p className="text-xs font-mono text-surface-500">Who stands behind the most laws?</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
