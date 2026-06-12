'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  ChevronRight,
  Flame,
  Mic,
  Plus,
  RefreshCw,
  Swords,
  Trophy,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { SeriesListItem, SeriesListResponse } from '@/app/api/debate-series/route'

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

function formatLabel(format: SeriesListItem['format']): string {
  const map: Record<SeriesListItem['format'], string> = {
    best_of_3: 'Best of 3',
    best_of_5: 'Best of 5',
    best_of_7: 'Best of 7',
    fixed: 'Fixed',
  }
  return map[format]
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function SeriesScoreBar({ blueWins, redWins, format }: { blueWins: number; redWins: number; format: SeriesListItem['format'] }) {
  const totalRounds = format === 'best_of_3' ? 3 : format === 'best_of_5' ? 5 : format === 'best_of_7' ? 7 : blueWins + redWins
  const dots = Array.from({ length: totalRounds }, (_, i) => {
    if (i < blueWins) return 'blue'
    if (i >= totalRounds - redWins) return 'red'
    return 'empty'
  })
  return (
    <div className="flex items-center gap-1.5">
      {dots.map((dot, i) => (
        <span
          key={i}
          className={cn(
            'w-3.5 h-3.5 rounded-full border transition-colors',
            dot === 'blue' && 'bg-for-500 border-for-500',
            dot === 'red' && 'bg-against-500 border-against-500',
            dot === 'empty' && 'bg-transparent border-surface-500/40',
          )}
        />
      ))}
    </div>
  )
}

// ─── Series card ──────────────────────────────────────────────────────────────

function SeriesCard({ series }: { series: SeriesListItem }) {
  const isComplete = series.status === 'completed'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
    >
      <Link href={`/debate/series/${series.id}`}>
        <div className={cn(
          'rounded-xl border bg-surface-100 p-4 transition-all hover:border-surface-400',
          isComplete ? 'border-surface-300/50' : 'border-surface-300',
        )}>
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                  isComplete
                    ? 'text-emerald border-emerald/30 bg-emerald/10'
                    : 'text-gold border-gold/30 bg-gold/10',
                )}>
                  {isComplete ? <CheckCircle2 className="h-3 w-3" /> : <Flame className="h-3 w-3" />}
                  {isComplete ? 'Complete' : 'Ongoing'}
                </span>
                <span className="text-[10px] font-mono text-surface-500 border border-surface-500/30 bg-surface-200/50 px-2 py-0.5 rounded-full">
                  {formatLabel(series.format)}
                </span>
              </div>
              <h3 className="font-semibold text-surface-900 group-hover:text-for-300 transition-colors leading-tight">
                {series.title}
              </h3>
              {series.topic && (
                <p className="text-xs text-surface-500 mt-0.5 truncate">
                  On: {series.topic.statement}
                </p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-1 transition-colors" />
          </div>

          {/* Score */}
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-2xl font-black text-for-400 leading-none">{series.blue_wins}</div>
                <div className="text-[9px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">FOR</div>
              </div>
              <div className="text-surface-600 font-mono text-sm font-bold">–</div>
              <div className="text-center">
                <div className="text-2xl font-black text-against-400 leading-none">{series.red_wins}</div>
                <div className="text-[9px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">AGAINST</div>
              </div>
            </div>
            <SeriesScoreBar
              blueWins={series.blue_wins}
              redWins={series.red_wins}
              format={series.format}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-surface-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Mic className="h-3 w-3" />
                {series.debate_count} debate{series.debate_count !== 1 ? 's' : ''}
              </span>
              {series.topic?.category && (
                <span className="text-surface-600">{series.topic.category}</span>
              )}
            </div>
            <span>{relativeTime(series.created_at)}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SeriesSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex gap-2 mb-1">
        <Skeleton className="h-4 w-16 rounded-full" />
        <Skeleton className="h-4 w-20 rounded-full" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-16" />
        <div className="flex gap-1.5">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-3.5 w-3.5 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DebateSeriesListClient() {
  const [series, setSeries] = useState<SeriesListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'ongoing' | 'completed'>('ongoing')
  const load = useCallback(async (status: 'ongoing' | 'completed') => {
    setLoading(true)
    try {
      const res = await fetch(`/api/debate-series?status=${status}&limit=20`)
      if (!res.ok) return
      const { series: data } = (await res.json()) as SeriesListResponse
      setSeries(data)
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(tab) }, [load, tab])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
              <Swords className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-surface-900">Debate Series</h1>
              <p className="text-xs text-surface-500">Multi-round competitions</p>
            </div>
          </div>
          <Link href="/debate/series/create">
            <Button
              size="sm"
              variant="ghost"
              className="flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" />
              New Series
            </Button>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 bg-surface-200 rounded-lg">
          {(['ongoing', 'completed'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all',
                tab === t
                  ? 'bg-surface-100 text-surface-900 shadow-sm'
                  : 'text-surface-500 hover:text-surface-400',
              )}
            >
              {t === 'ongoing' ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Flame className="h-3 w-3" /> Ongoing
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <Trophy className="h-3 w-3" /> Completed
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={() => load(tab)}
          className="mb-4 flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-300 transition-colors"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => <SeriesSkeleton key={i} />)}
            </motion.div>
          ) : series.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Swords}
                title={tab === 'ongoing' ? 'No active series' : 'No completed series'}
                description={
                  tab === 'ongoing'
                    ? 'Start a debate series to compete in multi-round matches.'
                    : 'Completed series will appear here.'
                }
              />
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {series.map((s) => (
                <SeriesCard key={s.id} series={s} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />

    </div>
  )
}
