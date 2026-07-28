'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  ChevronRight,
  Cpu,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CivicTwinsResponse, TwinProfile } from '@/app/api/civic-twins/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics: TrendingUp,
  Politics: Landmark,
  Technology: Cpu,
  Science: FlaskConical,
  Ethics: Scale,
  Philosophy: BarChart2,
  Culture: Music2,
  Health: Heart,
  Environment: Leaf,
  Education: GraduationCap,
  Other: Sparkles,
}

const CAT_STYLE: Record<string, { color: string; bg: string; bar: string; border: string }> = {
  Economics: { color: 'text-gold', bg: 'bg-gold/10', bar: 'bg-gold', border: 'border-gold/30' },
  Politics: { color: 'text-for-400', bg: 'bg-for-500/10', bar: 'bg-for-500', border: 'border-for-500/30' },
  Technology: { color: 'text-purple', bg: 'bg-purple/10', bar: 'bg-purple', border: 'border-purple/30' },
  Science: { color: 'text-emerald', bg: 'bg-emerald/10', bar: 'bg-emerald', border: 'border-emerald/25' },
  Ethics: { color: 'text-against-400', bg: 'bg-against-500/10', bar: 'bg-against-500', border: 'border-against-500/30' },
  Philosophy: { color: 'text-surface-600', bg: 'bg-surface-300/30', bar: 'bg-surface-500', border: 'border-surface-400/30' },
  Culture: { color: 'text-gold', bg: 'bg-gold/10', bar: 'bg-gold', border: 'border-gold/30' },
  Health: { color: 'text-emerald', bg: 'bg-emerald/10', bar: 'bg-emerald', border: 'border-emerald/25' },
  Environment: { color: 'text-emerald', bg: 'bg-emerald/10', bar: 'bg-emerald', border: 'border-emerald/25' },
  Education: { color: 'text-for-400', bg: 'bg-for-500/10', bar: 'bg-for-500', border: 'border-for-500/30' },
  Other: { color: 'text-surface-500', bg: 'bg-surface-300/20', bar: 'bg-surface-500', border: 'border-surface-400/30' },
}

function getCatStyle(cat: string) {
  return CAT_STYLE[cat] ?? CAT_STYLE.Other
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const fill = (pct / 100) * circ
  const color =
    pct >= 80 ? '#10b981' : pct >= 60 ? '#3b82f6' : pct >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#24242e"
          strokeWidth={4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={`${fill} ${circ - fill}`}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold tabular-nums"
        style={{ color }}
      >
        {pct}%
      </span>
    </div>
  )
}

// ─── Twin card ────────────────────────────────────────────────────────────────

function TwinCard({ twin, rank }: { twin: TwinProfile; rank: number }) {
  const catStyle = twin.strongest_category ? getCatStyle(twin.strongest_category) : null
  const CatIcon = twin.strongest_category ? (CAT_ICON[twin.strongest_category] ?? Sparkles) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-4 hover:border-surface-400 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Rank */}
        <div className="flex-shrink-0 w-6 text-center text-xs font-mono text-surface-500 mt-1">
          #{rank + 1}
        </div>

        {/* Avatar */}
        <Avatar
          src={twin.avatar_url}
          fallback={twin.display_name ?? twin.username}
          size="md"
        />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm truncate">
                {twin.display_name ?? twin.username}
              </p>
              <p className="text-xs text-surface-500">@{twin.username}</p>
            </div>
            <ScoreRing pct={twin.agreement_pct} size={48} />
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-surface-500">
              <Scale className="h-3 w-3" />
              {twin.common_topics} topics in common
            </span>
            {twin.strongest_category && (
              <span
                className={cn(
                  'flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
                  catStyle?.bg,
                  catStyle?.color
                )}
              >
                {CatIcon && <CatIcon className="h-3 w-3" />}
                {twin.strongest_category} {twin.strongest_category_pct}%
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            <Link
              href={`/align/${twin.username}`}
              className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-for-600/20 border border-for-600/30 text-for-300 hover:bg-for-600/30 hover:text-white transition-colors"
            >
              <Zap className="h-3 w-3" />
              Compare
            </Link>
            <Link
              href={`/profile/${twin.username}`}
              className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-600 hover:bg-surface-300 hover:text-white transition-colors"
            >
              Profile
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Fingerprint bar ──────────────────────────────────────────────────────────

function FingerprintBar({
  category,
  for_pct,
  total,
}: {
  category: string
  for_pct: number
  total: number
}) {
  const style = getCatStyle(category)
  const Icon = CAT_ICON[category] ?? Sparkles
  const against_pct = 100 - for_pct

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className={cn('h-3 w-3 flex-shrink-0', style.color)} />
          <span className="text-xs text-white truncate">{category}</span>
          <span className="text-[10px] text-surface-500 font-mono flex-shrink-0">
            {total}v
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono flex-shrink-0">
          <span className="text-for-400">{for_pct}% For</span>
          <span className="text-surface-600">/</span>
          <span className="text-against-400">{against_pct}% Against</span>
        </div>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
        <div
          className="h-full bg-for-500 transition-all duration-500"
          style={{ width: `${for_pct}%` }}
        />
        <div
          className="h-full bg-against-500 flex-1 transition-all duration-500"
          style={{ width: `${against_pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function TwinsClient() {
  const [data, setData] = useState<CivicTwinsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/civic-twins')
      if (!res.ok) {
        if (res.status === 401) {
          setError('Sign in to discover your civic twins.')
        } else {
          setError('Failed to load civic twins.')
        }
        return
      }
      setData(await res.json())
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-5 w-5 text-for-400" />
            <h1 className="text-xl font-bold text-white font-mono">Civic Twins</h1>
          </div>
          <p className="text-sm text-surface-500">
            Citizens who voted most like you — sorted by agreement rate across shared topics.
          </p>
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <p className="text-surface-500 text-sm mb-4">{error}</p>
            {error.includes('Sign in') ? (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 text-white text-sm font-mono font-semibold hover:bg-for-500 transition-colors"
              >
                Sign in
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                onClick={load}
                className="inline-flex items-center gap-2 text-sm text-for-400 hover:text-white transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              {/* Your civic fingerprint */}
              {data && data.fingerprint.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-purple" />
                      <h2 className="text-sm font-mono font-semibold text-white">
                        Your Civic Fingerprint
                      </h2>
                    </div>
                    <span className="text-xs font-mono text-surface-500">
                      {data.my_vote_count} votes cast
                    </span>
                  </div>
                  <div className="space-y-3">
                    {data.fingerprint.map((f) => (
                      <FingerprintBar
                        key={f.category}
                        category={f.category}
                        for_pct={f.for_pct}
                        total={f.total}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-surface-600 mt-3 border-t border-surface-300 pt-3">
                    Comparing your votes against everyone else on Lobby Market to find your best matches.
                  </p>
                </motion.div>
              )}

              {/* Not enough votes */}
              {data && data.my_vote_count < 3 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
                  <div className="flex justify-center mb-3"><Sparkles className="h-8 w-8 text-surface-500" /></div>
                  <p className="text-white font-semibold mb-1">Cast more votes to find your twins</p>
                  <p className="text-sm text-surface-500 mb-4">
                    You need at least 3 votes to start matching. Head to the feed and weigh in.
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 text-white text-sm font-mono font-semibold hover:bg-for-500 transition-colors"
                  >
                    Go to Feed
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}

              {/* Twin results */}
              {data && data.my_vote_count >= 3 && (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                      {data.twins.length === 0
                        ? 'No matches yet'
                        : `${data.twins.length} Civic Twin${data.twins.length !== 1 ? 's' : ''} Found`}
                    </h2>
                    <button
                      onClick={load}
                      className="text-xs text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Refresh
                    </button>
                  </div>

                  {data.twins.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="No twins found yet"
                      description="Other citizens need to vote on the same topics as you. Keep voting — your twins will appear as the community grows."
                    />
                  ) : (
                    <div className="space-y-3">
                      {data.twins.map((twin, i) => (
                        <TwinCard key={twin.user_id} twin={twin} rank={i} />
                      ))}
                    </div>
                  )}

                  {/* Footer hint */}
                  {data.twins.length > 0 && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="text-xs text-center text-surface-600"
                    >
                      Agreement based on shared topics only — cast more votes to refine your matches.{' '}
                      <Link href="/delegation" className="text-for-400 hover:underline">
                        Delegate your vote
                      </Link>{' '}
                      to your top twin.
                    </motion.p>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
