'use client'

/**
 * /converging — Civic Convergence & Fracture
 *
 * Two distinct phenomena tracked here:
 *   Converging — debates where recent voters reinforce the majority,
 *                pushing consensus toward resolution (approaching law or firm rejection)
 *   Fracturing — debates where recent voters are challenging the existing consensus,
 *                pulling a "settled" debate back toward deadlock
 *
 * Distinct from:
 *   /deadlock   — topics already locked at 50/50 for days
 *   /momentum   — topics gaining raw vote velocity (not direction)
 *   /mandate    — topics with overwhelming existing consensus
 *   /near-law   — topics close to the law threshold by total % alone
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  GitMerge,
  GitBranch,
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  Zap,
  Gavel,
  Scale,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ConvergenceTopic, ConvergenceResponse } from '@/app/api/topics/convergence/route'

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
] as const

type CategoryFilter = (typeof CATEGORIES)[number]
type TabMode = 'converging' | 'fracturing'

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-300',
}

const CATEGORY_BG: Record<string, string> = {
  Economics:   'bg-gold/10 border-gold/30',
  Politics:    'bg-for-500/10 border-for-500/30',
  Technology:  'bg-purple/10 border-purple/30',
  Science:     'bg-emerald/10 border-emerald/30',
  Ethics:      'bg-against-500/10 border-against-500/30',
  Philosophy:  'bg-purple/10 border-purple/30',
  Culture:     'bg-gold/10 border-gold/30',
  Health:      'bg-emerald/10 border-emerald/30',
  Environment: 'bg-emerald/10 border-emerald/30',
  Education:   'bg-for-500/10 border-for-500/30',
}

const STATUS_COLORS: Record<string, string> = {
  proposed: 'text-surface-400 bg-surface-300/50 border-surface-400/30',
  active:   'text-for-400 bg-for-500/10 border-for-500/30',
  voting:   'text-purple bg-purple/10 border-purple/30',
  law:      'text-gold bg-gold/10 border-gold/30',
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
  return `${Math.floor(d / 7)}w ago`
}

function MomentumBar({
  bluePct,
  recentBluePct,
  mode,
}: {
  bluePct: number
  recentBluePct: number
  mode: TabMode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
        <span>Overall</span>
        <span>Recent 7d</span>
      </div>
      <div className="flex items-center gap-2">
        {/* Overall bar */}
        <div className="flex-1 flex items-center gap-0.5 h-2">
          <div
            className="h-full rounded-l-full bg-against-500/60"
            style={{ width: `${100 - bluePct}%` }}
          />
          <div
            className="h-full rounded-r-full bg-for-500/60"
            style={{ width: `${bluePct}%` }}
          />
        </div>
        <div className="text-[10px] font-mono text-surface-400 w-8 text-center">
          {Math.round(bluePct)}%
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Recent bar */}
        <div className="flex-1 flex items-center gap-0.5 h-2">
          <div
            className={cn(
              'h-full rounded-l-full',
              mode === 'converging' ? 'bg-against-500/80' : 'bg-against-400/50'
            )}
            style={{ width: `${100 - recentBluePct}%` }}
          />
          <div
            className={cn(
              'h-full rounded-r-full',
              mode === 'converging' ? 'bg-for-500/80' : 'bg-for-400/50'
            )}
            style={{ width: `${recentBluePct}%` }}
          />
        </div>
        <div
          className={cn(
            'text-[10px] font-mono w-8 text-center font-semibold',
            mode === 'converging' ? 'text-emerald' : 'text-against-300'
          )}
        >
          {Math.round(recentBluePct)}%
        </div>
      </div>
    </div>
  )
}

// ─── Topic Card ───────────────────────────────────────────────────────────────

function ConvergenceCard({
  topic,
  index,
  mode,
}: {
  topic: ConvergenceTopic
  index: number
  mode: TabMode
}) {
  const momentum = Math.abs(topic.convergence_momentum)
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const isConverging = mode === 'converging'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
    >
      <Link href={`/topic/${topic.id}`}>
        <div
          className={cn(
            'group relative p-4 rounded-xl border transition-all duration-200',
            'bg-surface-100/50 hover:bg-surface-200/50',
            isConverging
              ? 'border-emerald/20 hover:border-emerald/40'
              : 'border-against-500/20 hover:border-against-500/40'
          )}
        >
          {/* Rank + momentum badge */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-surface-600 w-5 flex-shrink-0">
                #{index + 1}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
                  isConverging
                    ? 'text-emerald bg-emerald/10 border-emerald/30'
                    : 'text-against-300 bg-against-500/10 border-against-500/30'
                )}
              >
                {isConverging ? (
                  <ArrowUp className="h-2.5 w-2.5" />
                ) : (
                  <ArrowDown className="h-2.5 w-2.5" />
                )}
                {momentum.toFixed(1)}pts
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {topic.category && (
                <span
                  className={cn(
                    'text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-md border',
                    CATEGORY_COLORS[topic.category] ?? 'text-surface-400',
                    CATEGORY_BG[topic.category] ?? 'bg-surface-300/30 border-surface-400/20'
                  )}
                >
                  {topic.category}
                </span>
              )}
              <span
                className={cn(
                  'text-[10px] font-mono px-1.5 py-0.5 rounded-md border',
                  STATUS_COLORS[topic.status] ?? 'text-surface-500 bg-surface-300/30 border-surface-400/20'
                )}
              >
                {topic.status === 'law' ? 'LAW' : topic.status}
              </span>
            </div>
          </div>

          {/* Statement */}
          <p className="text-sm font-medium text-white/90 leading-snug mb-3 group-hover:text-white transition-colors line-clamp-2">
            {topic.statement}
          </p>

          {/* Momentum bars */}
          <MomentumBar
            bluePct={topic.blue_pct}
            recentBluePct={topic.recent_blue_pct}
            mode={mode}
          />

          {/* Footer stats */}
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-surface-300/30">
            <div className="flex items-center gap-3 text-[11px] font-mono text-surface-500">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {topic.total_votes.toLocaleString()} total
              </span>
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-emerald" />
                {topic.recent_vote_count} recent
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono">
              <span className="text-for-400 font-semibold">{forPct}%</span>
              <span className="text-surface-600">·</span>
              <span className="text-against-400 font-semibold">{againstPct}%</span>
              <ChevronRight className="h-3.5 w-3.5 text-surface-600 ml-1 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-surface-300/30 bg-surface-100/30 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <div className="space-y-2">
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-2 w-full" />
      </div>
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function ConvergingClient() {
  const [tab, setTab] = useState<TabMode>('converging')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [data, setData] = useState<ConvergenceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/topics/convergence', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json: ConvergenceResponse = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const topics = data ? (tab === 'converging' ? data.converging : data.fracturing) : []
  const filtered =
    category === 'all' ? topics : topics.filter((t) => t.category === category)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Feed
          </Link>

          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
              <GitMerge className="h-5 w-5 text-emerald" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white leading-tight">
                Civic Convergence
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-1 leading-relaxed">
                Track how community opinion is shifting — debates building toward resolution, and settled questions being challenged.
              </p>
            </div>
          </div>

          {/* Stats row */}
          {data && !loading && (
            <div className="flex items-center gap-4 mt-4 p-3 rounded-xl bg-surface-200/40 border border-surface-300/40">
              <div className="flex items-center gap-2">
                <GitMerge className="h-3.5 w-3.5 text-emerald" />
                <span className="text-xs font-mono text-surface-400">
                  <span className="text-emerald font-semibold">{data.converging.length}</span> converging
                </span>
              </div>
              <div className="w-px h-4 bg-surface-400/30" />
              <div className="flex items-center gap-2">
                <GitBranch className="h-3.5 w-3.5 text-against-400" />
                <span className="text-xs font-mono text-surface-400">
                  <span className="text-against-400 font-semibold">{data.fracturing.length}</span> fracturing
                </span>
              </div>
              <div className="w-px h-4 bg-surface-400/30" />
              <span className="text-[11px] font-mono text-surface-600">
                7-day window
              </span>
              <button
                onClick={fetchData}
                aria-label="Refresh"
                className="ml-auto text-surface-500 hover:text-surface-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* ── Tab bar ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-200/50 border border-surface-300/40 mb-4">
          <button
            onClick={() => setTab('converging')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-mono font-semibold transition-all duration-200',
              tab === 'converging'
                ? 'bg-emerald/20 text-emerald shadow-sm'
                : 'text-surface-500 hover:text-surface-300'
            )}
          >
            <TrendingUp className="h-4 w-4" />
            Converging
          </button>
          <button
            onClick={() => setTab('fracturing')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-mono font-semibold transition-all duration-200',
              tab === 'fracturing'
                ? 'bg-against-500/20 text-against-300 shadow-sm'
                : 'text-surface-500 hover:text-surface-300'
            )}
          >
            <TrendingDown className="h-4 w-4" />
            Fracturing
          </button>
        </div>

        {/* ── Tab description ─────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'p-3 rounded-xl border mb-4 text-xs font-mono leading-relaxed',
              tab === 'converging'
                ? 'text-emerald/70 bg-emerald/5 border-emerald/20'
                : 'text-against-300/70 bg-against-500/5 border-against-500/20'
            )}
          >
            {tab === 'converging' ? (
              <>
                <span className="font-semibold text-emerald">Converging —</span>{' '}
                Recent voters are reinforcing the majority. These debates are building toward a decisive majority or resolution.
                The momentum score shows how strongly recent votes outpace the historical average.
              </>
            ) : (
              <>
                <span className="font-semibold text-against-300">Fracturing —</span>{' '}
                Recent voters are challenging the existing consensus. Previously settled debates are being pulled back toward deadlock.
                Watch these: they may be reversing toward law or collapsing entirely.
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* ── Category filter ──────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          role="group"
          aria-label="Filter by category"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border transition-all duration-150',
                category === cat
                  ? cat === 'all'
                    ? 'bg-surface-300 text-white border-surface-400'
                    : cn(CATEGORY_COLORS[cat], CATEGORY_BG[cat])
                  : 'text-surface-500 border-surface-400/30 hover:text-surface-300 hover:border-surface-400/50'
              )}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={Scale}
            title="Couldn't load convergence data"
            description="Unable to fetch momentum data. Try refreshing."
            action={{ label: 'Retry', onClick: fetchData }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={tab === 'converging' ? GitMerge : GitBranch}
            title={
              category !== 'all'
                ? `No ${tab} debates in ${category}`
                : tab === 'converging'
                ? 'No debates building consensus right now'
                : 'No fracturing debates right now'
            }
            description={
              category !== 'all'
                ? 'Try a different category filter.'
                : tab === 'converging'
                ? 'The community is evenly split or in deadlock. Check back soon.'
                : 'All debates are stable — no consensus being challenged right now.'
            }
            action={
              category !== 'all'
                ? { label: 'Clear filter', onClick: () => setCategory('all') }
                : undefined
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${tab}-${category}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {filtered.map((topic, index) => (
                <ConvergenceCard
                  key={topic.id}
                  topic={topic}
                  index={index}
                  mode={tab}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Related pages ────────────────────────────────────────────────── */}
        {!loading && !error && (
          <div className="mt-8 pt-6 border-t border-surface-300/30">
            <p className="text-[11px] font-mono text-surface-600 mb-3 uppercase tracking-wider">
              Related
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/deadlock', label: 'Deadlock', icon: Scale, color: 'text-against-400', desc: 'Stuck at 50/50' },
                { href: '/mandate', label: 'Mandate', icon: Gavel, color: 'text-gold', desc: 'Overwhelming majority' },
                { href: '/near-law', label: 'Near Law', icon: Gavel, color: 'text-emerald', desc: 'Close to resolution' },
                { href: '/momentum', label: 'Momentum', icon: Zap, color: 'text-for-400', desc: 'Rising vote velocity' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-100/40 border border-surface-300/30 hover:border-surface-400/50 hover:bg-surface-200/40 transition-all duration-200"
                >
                  <link.icon className={cn('h-4 w-4 flex-shrink-0', link.color)} />
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-semibold text-white truncate">{link.label}</p>
                    <p className="text-[10px] font-mono text-surface-500 truncate">{link.desc}</p>
                  </div>
                  <ArrowRight className="h-3 w-3 text-surface-600 ml-auto flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
