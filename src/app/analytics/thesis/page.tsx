'use client'

/**
 * /analytics/thesis — Civic Thesis Analytics
 *
 * Shows personal statistics for the user's civic theses: how many they've
 * published, their vindication rate, category breakdown, and their most
 * popular and most contested predictions.
 *
 * Distinct from:
 *   /thesis              — browse all public theses (create new ones)
 *   /thesis/[id]         — single thesis detail view
 *   /analytics/calibration — vote prediction accuracy (separate from theses)
 *   /analytics/predictions — formal prediction market stats
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Scroll,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { ThesisAnalyticsData, ThesisSummary, ThesisCategoryStats } from '@/app/api/analytics/thesis/route'
import type { ThesisCategory } from '@/lib/types/thesis'

// ─── Color maps ───────────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  economics: 'text-gold',
  politics: 'text-for-400',
  technology: 'text-purple',
  science: 'text-emerald',
  ethics: 'text-against-300',
  philosophy: 'text-for-300',
  culture: 'text-pink-400',
  health: 'text-green-400',
  environment: 'text-teal-400',
  education: 'text-indigo-400',
}

const CAT_BG: Record<string, string> = {
  economics: 'bg-gold/10 border-gold/30',
  politics: 'bg-for-500/10 border-for-500/30',
  technology: 'bg-purple/10 border-purple/30',
  science: 'bg-emerald/10 border-emerald/30',
  ethics: 'bg-against-500/10 border-against-500/30',
  philosophy: 'bg-for-300/10 border-for-300/30',
  culture: 'bg-pink-500/10 border-pink-500/30',
  health: 'bg-green-500/10 border-green-500/30',
  environment: 'bg-teal-500/10 border-teal-500/30',
  education: 'bg-indigo-500/10 border-indigo-500/30',
}

const STATUS_CONFIG = {
  active:     { label: 'Active',      icon: CircleDot,    color: 'text-for-400',      bg: 'bg-for-500/10 border-for-500/30' },
  vindicated: { label: 'Vindicated',  icon: Trophy,       color: 'text-gold',         bg: 'bg-gold/10 border-gold/30' },
  refuted:    { label: 'Refuted',     icon: X,            color: 'text-against-400',  bg: 'bg-against-500/10 border-against-500/30' },
  expired:    { label: 'Expired',     icon: Clock,        color: 'text-surface-500',  bg: 'bg-surface-200 border-surface-300' },
}

function catColor(c: string) { return CAT_COLOR[c.toLowerCase()] ?? 'text-surface-400' }
function catBg(c: string)    { return CAT_BG[c.toLowerCase()] ?? 'bg-surface-200 border-surface-300' }

// ─── Accuracy ring ────────────────────────────────────────────────────────────

function AccuracyRing({ pct, size = 96 }: { pct: number; size?: number }) {
  const r = size * 0.4
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ

  const color =
    pct >= 70 ? 'text-emerald' :
    pct >= 50 ? 'text-for-400' :
    pct >= 30 ? 'text-gold' : 'text-against-400'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r}
          stroke="currentColor" strokeWidth={size * 0.08}
          fill="none" className="text-surface-300"
        />
        <circle cx={size / 2} cy={size / 2} r={r}
          stroke="currentColor" strokeWidth={size * 0.08}
          fill="none" strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn('text-xl font-bold font-mono leading-none', color)}>
          {pct}%
        </span>
        <span className="text-[10px] font-mono text-surface-500 mt-0.5">accuracy</span>
      </div>
    </div>
  )
}

// ─── Thesis mini-card ─────────────────────────────────────────────────────────

function ThesisMiniCard({ thesis }: { thesis: ThesisSummary }) {
  const cfg = STATUS_CONFIG[thesis.status] ?? STATUS_CONFIG.active
  const Icon = cfg.icon
  return (
    <Link
      href={`/thesis/${thesis.id}`}
      className="block p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400 transition-colors group"
    >
      <div className="flex items-start gap-2.5">
        <div className={cn('flex-shrink-0 mt-0.5 flex items-center justify-center h-5 w-5 rounded-full border', cfg.bg)}>
          <Icon className={cn('h-2.5 w-2.5', cfg.color)} />
        </div>
        <p className="flex-1 text-xs text-surface-700 group-hover:text-white transition-colors line-clamp-2 leading-relaxed">
          {thesis.statement}
        </p>
        <ExternalLink className="h-3 w-3 text-surface-600 flex-shrink-0 mt-0.5" />
      </div>
      <div className="flex items-center gap-3 mt-2 pl-7">
        <span className={cn('text-[11px] font-mono', catColor(thesis.category))}>
          {thesis.category}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-surface-500">
          <ThumbsUp className="h-2.5 w-2.5 text-for-400" />
          {thesis.agree_count}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-surface-500">
          <ThumbsDown className="h-2.5 w-2.5 text-against-400" />
          {thesis.disagree_count}
        </span>
      </div>
    </Link>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ stat }: { stat: ThesisCategoryStats }) {
  const resolved = stat.vindicated + stat.refuted
  const winBar = resolved > 0 ? (stat.vindicated / resolved) * 100 : 0

  return (
    <div className="py-3 border-b border-surface-300 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className={cn('text-sm font-medium capitalize', catColor(stat.category))}>
          {stat.category}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-500 font-mono">
            {stat.total} thesis{stat.total !== 1 ? 'es' : ''}
          </span>
          {resolved > 0 && (
            <span
              className={cn(
                'text-xs font-mono font-semibold',
                stat.accuracy >= 60 ? 'text-emerald' : stat.accuracy >= 40 ? 'text-gold' : 'text-against-400'
              )}
            >
              {stat.accuracy}% win
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
          {resolved > 0 ? (
            <div
              className="h-full rounded-full transition-all duration-700 bg-emerald"
              style={{ width: `${winBar}%` }}
            />
          ) : (
            <div className="h-full rounded-full bg-for-500/30" style={{ width: '100%' }} />
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px] font-mono text-surface-500">
          {stat.vindicated > 0 && (
            <span className="text-emerald">+{stat.vindicated}</span>
          )}
          {stat.refuted > 0 && (
            <span className="text-against-400">-{stat.refuted}</span>
          )}
          {stat.active > 0 && (
            <span className="text-for-300">~{stat.active}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ThesisAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<ThesisAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/thesis')
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load thesis analytics')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const cardClass = 'rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white font-mono flex items-center gap-2">
              <Scroll className="h-5 w-5 text-gold flex-shrink-0" />
              Thesis Analytics
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">Your civic prediction track record</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <Skeleton className="h-4 w-32 mb-4" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl bg-surface-100 border border-against-500/30 p-5 text-center">
            <p className="text-sm text-against-400 mb-3">{error}</p>
            <button onClick={load} className="text-xs font-mono text-surface-500 hover:text-white transition-colors">
              Try again
            </button>
          </div>
        )}

        {/* Empty state — no theses yet */}
        {!loading && !error && data?.total === 0 && (
          <div className={cardClass}>
            <EmptyState
              icon={Scroll}
              iconColor="text-gold"
              iconBg="bg-gold/10"
              iconBorder="border-gold/30"
              title="No theses yet"
              description="Publish your first civic thesis — a bold prediction about the future of society. Stake your reputation and see if history proves you right."
              action={{ label: 'Write a thesis', href: '/thesis' }}
            />
          </div>
        )}

        {/* Main content */}
        {!loading && !error && data && data.total > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >

              {/* ── Overview ───────────────────────────────────────── */}
              <div className={cardClass}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200">
                    <Trophy className="h-3.5 w-3.5 text-gold" />
                  </div>
                  <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                    Overview
                  </h2>
                </div>

                <div className="flex items-center gap-6">
                  {/* Accuracy ring */}
                  <div className="flex-shrink-0">
                    {(data.vindicated + data.refuted) > 0 ? (
                      <AccuracyRing pct={data.accuracy} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-24 w-24 rounded-full border-2 border-dashed border-surface-400">
                        <Clock className="h-5 w-5 text-surface-500 mb-1" />
                        <span className="text-[10px] font-mono text-surface-500 text-center leading-tight">
                          none<br/>resolved
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Stat grid */}
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    {[
                      { label: 'Total', value: data.total, color: 'text-white' },
                      { label: 'Active', value: data.active, color: 'text-for-400' },
                      { label: 'Vindicated', value: data.vindicated, color: 'text-emerald' },
                      { label: 'Refuted', value: data.refuted, color: 'text-against-400' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-surface-200/60 rounded-xl p-2.5">
                        <p className={cn('text-lg font-bold font-mono leading-none', color)}>
                          <AnimatedNumber value={value} />
                        </p>
                        <p className="text-[11px] text-surface-500 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Platform comparison */}
                {(data.vindicated + data.refuted) > 0 && (
                  <div className="mt-4 pt-4 border-t border-surface-300 flex items-center justify-between">
                    <span className="text-xs text-surface-500">Platform accuracy</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-surface-400">
                        {data.platformStats.platform_accuracy}%
                      </span>
                      <span className={cn(
                        'text-xs font-mono font-semibold',
                        data.accuracy > data.platformStats.platform_accuracy
                          ? 'text-emerald' : 'text-against-400'
                      )}>
                        {data.accuracy > data.platformStats.platform_accuracy
                          ? `+${data.accuracy - data.platformStats.platform_accuracy}% above avg`
                          : `${data.accuracy - data.platformStats.platform_accuracy}% below avg`
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Agreement stats ─────────────────────────────────── */}
              {(data.totalAgreements + data.totalDisagreements) > 0 && (
                <div className={cardClass}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200">
                      <Users className="h-3.5 w-3.5 text-surface-500" />
                    </div>
                    <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                      Community Response
                    </h2>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-for-500/10 border border-for-500/30 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold font-mono text-for-400">
                        <AnimatedNumber value={data.totalAgreements} />
                      </p>
                      <p className="text-xs text-surface-500 mt-0.5 flex items-center justify-center gap-1">
                        <ThumbsUp className="h-3 w-3 text-for-400" />
                        Total agrees
                      </p>
                    </div>
                    <div className="bg-against-500/10 border border-against-500/30 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold font-mono text-against-400">
                        <AnimatedNumber value={data.totalDisagreements} />
                      </p>
                      <p className="text-xs text-surface-500 mt-0.5 flex items-center justify-center gap-1">
                        <ThumbsDown className="h-3 w-3 text-against-400" />
                        Total disagrees
                      </p>
                    </div>
                  </div>

                  {/* Agreement ratio bar */}
                  {data.totalAgreements + data.totalDisagreements > 0 && (
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-surface-500 mb-1">
                        <span>Community support</span>
                        <span>
                          {Math.round((data.totalAgreements / (data.totalAgreements + data.totalDisagreements)) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-for-500 transition-all duration-700"
                          style={{
                            width: `${(data.totalAgreements / (data.totalAgreements + data.totalDisagreements)) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Category breakdown ──────────────────────────────── */}
              {data.byCategory.length > 0 && (
                <div className={cardClass}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200">
                        <BookOpen className="h-3.5 w-3.5 text-surface-500" />
                      </div>
                      <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                        By Category
                      </h2>
                    </div>
                    {data.bestCategory && (
                      <div className="flex items-center gap-1.5">
                        <Trophy className="h-3 w-3 text-gold flex-shrink-0" />
                        <span className={cn('text-xs font-mono capitalize', catColor(data.bestCategory))}>
                          {data.bestCategory}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    {data.byCategory
                      .sort((a, b) => b.total - a.total)
                      .map(stat => (
                        <CategoryRow key={stat.category} stat={stat} />
                      ))
                    }
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-[11px] font-mono text-surface-600">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald inline-block" />Vindicated</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-against-400 inline-block" />Refuted</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-for-400 inline-block" />Active</span>
                  </div>
                </div>
              )}

              {/* ── Recent resolved ─────────────────────────────────── */}
              {data.recentResolved.length > 0 && (
                <div className={cardClass}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200">
                      <CheckCircle2 className="h-3.5 w-3.5 text-surface-500" />
                    </div>
                    <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                      Recently Resolved
                    </h2>
                  </div>
                  <div className="space-y-2">
                    {data.recentResolved.map(t => (
                      <ThesisMiniCard key={t.id} thesis={t} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Spotlight theses ────────────────────────────────── */}
              {(data.mostAgreed || data.mostContested) && (
                <div className={cardClass}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200">
                      <Zap className="h-3.5 w-3.5 text-surface-500" />
                    </div>
                    <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                      Spotlight
                    </h2>
                  </div>

                  {data.mostAgreed && data.mostAgreed.agree_count > 0 && (
                    <div className="mb-3">
                      <p className="text-[11px] font-mono text-for-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3" /> Most supported
                      </p>
                      <ThesisMiniCard thesis={data.mostAgreed} />
                    </div>
                  )}

                  {data.mostContested && data.mostContested.disagree_count > 0 &&
                   data.mostContested.id !== data.mostAgreed?.id && (
                    <div>
                      <p className="text-[11px] font-mono text-against-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <ThumbsDown className="h-3 w-3" /> Most challenged
                      </p>
                      <ThesisMiniCard thesis={data.mostContested} />
                    </div>
                  )}
                </div>
              )}

              {/* ── CTA ─────────────────────────────────────────────── */}
              <div className="flex items-center gap-3">
                <Link
                  href="/thesis"
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors text-sm font-mono font-semibold text-white"
                >
                  <Scroll className="h-4 w-4 text-gold" />
                  Browse all theses
                </Link>
                <Link
                  href="/thesis?action=create"
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gold/20 border border-gold/40 hover:bg-gold/30 transition-colors text-sm font-mono font-semibold text-gold"
                >
                  <Plus className="h-4 w-4" />
                  New thesis
                </Link>
              </div>

            </motion.div>
          </AnimatePresence>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
