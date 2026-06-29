'use client'

/**
 * /shifting — Shifting Tides
 *
 * Topics where community opinion has moved significantly in the last 24 hours —
 * debates surging FOR (recent voters leaning more blue than the lifetime average)
 * or surging AGAINST (recent voters leaning more red).
 *
 * Distinct from:
 *   /pivot       — 7-day window vs lifetime average (slower, structural shifts)
 *   /divergence  — week-to-week oscillation between two recent windows
 *   /momentum    — topics growing total engagement, not directional shift
 *   /frontlines  — currently near-50/50 (not about direction change)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Cpu,
  Filter,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Music2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ShiftingTopic, ShiftingResponse } from '@/app/api/topics/shifting/route'

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
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

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics:   TrendingUp,
  Politics:    Landmark,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  Scale,
  Culture:     Music2,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function shiftClass(delta: number): { label: string; color: string; bg: string; border: string } {
  const abs = Math.abs(delta)
  if (abs >= 35) return {
    label: 'Seismic',
    color: 'text-against-300',
    bg: 'bg-against-600/20',
    border: 'border-against-600/50',
  }
  if (abs >= 20) return {
    label: 'Major',
    color: 'text-gold',
    bg: 'bg-gold/15',
    border: 'border-gold/40',
  }
  return {
    label: 'Notable',
    color: 'text-surface-400',
    bg: 'bg-surface-300/40',
    border: 'border-surface-400/40',
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Topic card ─────────────────────────────────────────────────────────────────

function TopicCard({
  topic,
  side,
  index,
}: {
  topic: ShiftingTopic
  side: 'for' | 'against'
  index: number
}) {
  const isSurgingFor = side === 'for'
  const cls = shiftClass(topic.delta)
  const CatIcon = CATEGORY_ICONS[topic.category ?? ''] ?? Activity

  const historicalPct = Math.round(topic.blue_pct)
  const recentPct = topic.recent_blue_pct
  const deltaPp = Math.abs(topic.delta)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'flex flex-col gap-3 p-4 rounded-xl border transition-all group',
          'bg-surface-100/60 hover:bg-surface-100',
          isSurgingFor
            ? 'border-for-600/30 hover:border-for-600/60'
            : 'border-against-600/30 hover:border-against-600/60'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <CatIcon className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />
            <span className="text-[10px] text-surface-500 uppercase tracking-wide truncate">
              {topic.category ?? 'General'}
            </span>
          </div>
          <div className={cn(
            'flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border',
            cls.bg,
            cls.border,
            cls.color
          )}>
            {cls.label}
          </div>
        </div>

        {/* Statement */}
        <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
          {topic.statement}
        </p>

        {/* Shift visualization */}
        <div className="space-y-1.5">
          {/* Historical bar */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-surface-500 w-16">Lifetime</span>
            <div className="flex-1 h-1.5 rounded-full bg-surface-400/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-for-700/60 transition-all"
                style={{ width: `${historicalPct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-surface-500 w-8 text-right">
              {historicalPct}%
            </span>
          </div>

          {/* Recent bar */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-for-400 w-16">24h ago</span>
            <div className="flex-1 h-1.5 rounded-full bg-surface-400/30 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  isSurgingFor ? 'bg-for-500' : 'bg-against-500'
                )}
                style={{ width: `${recentPct}%` }}
              />
            </div>
            <span className={cn(
              'text-[10px] font-mono font-bold w-8 text-right',
              isSurgingFor ? 'text-for-400' : 'text-against-400'
            )}>
              {recentPct}%
            </span>
          </div>
        </div>

        {/* Delta + stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {isSurgingFor ? (
              <ArrowUp className="w-3.5 h-3.5 text-for-400" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-against-400" />
            )}
            <span className={cn(
              'text-sm font-bold font-mono',
              isSurgingFor ? 'text-for-400' : 'text-against-400'
            )}>
              +{deltaPp}pp
            </span>
            <span className="text-[11px] text-surface-500">
              {isSurgingFor ? 'FOR surge' : 'AGAINST surge'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-surface-500">
            <Zap className="w-3 h-3" />
            <span className="font-mono">{topic.votes_24h}</span>
            <span>recent</span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Stats bar ─────────────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-3 rounded-xl bg-surface-100/60 border border-surface-300/60">
      <span className={cn('text-lg font-bold font-mono', color)}>{value}</span>
      <span className="text-[10px] text-surface-500 text-center leading-tight">{label}</span>
    </div>
  )
}

// ─── Main client ────────────────────────────────────────────────────────────────

export function ShiftingClient() {
  const [data, setData] = useState<ShiftingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory] = useState('All')
  const [showFilters, setShowFilters] = useState(false)
  const [activeTab, setActiveTab] = useState<'both' | 'for' | 'against'>('both')

  const fetchData = useCallback(async (cat: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams()
      if (cat !== 'All') params.set('category', cat)
      const res = await fetch(`/api/topics/shifting?${params}`)
      if (!res.ok) throw new Error('Failed')
      const json: ShiftingResponse = await res.json()
      setData(json)
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData(category)
  }, [category, fetchData])

  const surgingFor = data?.surging_for ?? []
  const surgingAgainst = data?.surging_against ?? []
  const totalShifting = surgingFor.length + surgingAgainst.length
  const strongestFor = surgingFor[0]
  const strongestAgainst = surgingAgainst[0]
  const maxDelta = Math.max(
    strongestFor ? Math.abs(strongestFor.delta) : 0,
    strongestAgainst ? Math.abs(strongestAgainst.delta) : 0
  )

  const showFor = activeTab === 'both' || activeTab === 'for'
  const showAgainst = activeTab === 'both' || activeTab === 'against'

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24">
        {/* Hero */}
        <div className="relative overflow-hidden border-b border-surface-300/60 bg-surface-100/40">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-0 left-1/4 w-72 h-40 rounded-full bg-for-600/6 blur-3xl" />
            <div className="absolute top-0 right-1/4 w-72 h-40 rounded-full bg-against-600/6 blur-3xl" />
          </div>

          <div className="relative max-w-3xl mx-auto px-4 pt-6 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Link
                  href="/"
                  className="flex-shrink-0 p-2 rounded-lg bg-surface-200/60 border border-surface-300/60 text-surface-500 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Link>
                <div>
                  <div className="flex items-center gap-2">
                    <Waves className="w-4 h-4 text-for-400" />
                    <h1 className="text-base font-bold text-white tracking-tight">
                      Shifting Tides
                    </h1>
                    <div className="w-2 h-2 rounded-full bg-for-500 animate-pulse" />
                  </div>
                  <p className="text-xs text-surface-500 mt-0.5">
                    Opinion moving right now — surges FOR and AGAINST in the last 24 h
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowFilters((f) => !f)}
                  className={cn(
                    'p-2 rounded-lg border text-xs transition-all',
                    showFilters
                      ? 'bg-for-600/20 border-for-600/40 text-for-400'
                      : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-white'
                  )}
                >
                  <Filter className="w-4 h-4" />
                </button>
                <button
                  onClick={() => fetchData(category, true)}
                  disabled={refreshing}
                  className="p-2 rounded-lg bg-surface-200/60 border border-surface-300/60 text-surface-500 hover:text-white transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
                </button>
              </div>
            </div>

            {/* Category filter */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 pt-3 border-t border-surface-300/40">
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setCategory(cat)}
                          className={cn(
                            'px-3 py-1 rounded-full text-xs font-medium transition-all border',
                            category === cat
                              ? 'bg-for-600/20 border-for-600/40 text-for-400'
                              : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-white'
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-5 space-y-6">
          {loading ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-44 rounded-xl" />
                ))}
              </div>
            </>
          ) : totalShifting === 0 ? (
            <EmptyState
              icon={Waves}
              title="No significant shifts"
              description={
                category !== 'All'
                  ? `No ${category} debates have shifted significantly in the last 24 hours. Try a different category or check back later.`
                  : "No debates have shifted significantly in the last 24 hours. Activity may be low or consensus is stable."
              }
            />
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatChip
                  label="Shifting now"
                  value={totalShifting}
                  color="text-white"
                />
                <StatChip
                  label="FOR surges"
                  value={surgingFor.length}
                  color="text-for-400"
                />
                <StatChip
                  label="AGAINST surges"
                  value={surgingAgainst.length}
                  color="text-against-400"
                />
                <StatChip
                  label="Biggest swing"
                  value={`${maxDelta}pp`}
                  color="text-gold"
                />
              </div>

              {/* Tab bar */}
              <div className="flex gap-1.5 p-1 rounded-xl bg-surface-200/60 border border-surface-300/60">
                {[
                  { id: 'both' as const, label: 'All shifts', icon: Waves },
                  { id: 'for' as const, label: `FOR (${surgingFor.length})`, icon: ThumbsUp },
                  { id: 'against' as const, label: `AGAINST (${surgingAgainst.length})`, icon: ThumbsDown },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all',
                      activeTab === id
                        ? id === 'for'
                          ? 'bg-for-600/30 text-for-300 border border-for-600/40'
                          : id === 'against'
                          ? 'bg-against-600/30 text-against-300 border border-against-600/40'
                          : 'bg-surface-300/60 text-white border border-surface-400/60'
                        : 'text-surface-500 hover:text-white'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* FOR surges */}
              <AnimatePresence mode="wait">
                {showFor && surgingFor.length > 0 && (
                  <motion.div
                    key="for"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2 px-1">
                      <div className="p-1.5 rounded-lg bg-for-600/15 border border-for-600/30">
                        <TrendingUp className="w-3.5 h-3.5 text-for-400" />
                      </div>
                      <span className="text-sm font-bold text-for-400">Surging FOR</span>
                      <span className="text-xs text-surface-500">
                        — recent voters leaning more blue than the lifetime average
                      </span>
                      <span className="ml-auto text-[11px] font-mono text-for-500 bg-for-600/10 px-2 py-0.5 rounded-full">
                        {surgingFor.length}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {surgingFor.map((topic, i) => (
                        <TopicCard key={topic.id} topic={topic} side="for" index={i} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* AGAINST surges */}
              <AnimatePresence mode="wait">
                {showAgainst && surgingAgainst.length > 0 && (
                  <motion.div
                    key="against"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2 px-1">
                      <div className="p-1.5 rounded-lg bg-against-600/15 border border-against-600/30">
                        <TrendingDown className="w-3.5 h-3.5 text-against-400" />
                      </div>
                      <span className="text-sm font-bold text-against-400">Surging AGAINST</span>
                      <span className="text-xs text-surface-500">
                        — recent voters leaning more red than the lifetime average
                      </span>
                      <span className="ml-auto text-[11px] font-mono text-against-500 bg-against-600/10 px-2 py-0.5 rounded-full">
                        {surgingAgainst.length}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {surgingAgainst.map((topic, i) => (
                        <TopicCard key={topic.id} topic={topic} side="against" index={i} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer CTA */}
              <div className="pt-4 border-t border-surface-300/40 flex items-center justify-between">
                <div className="text-[11px] text-surface-600">
                  {data && `Updated ${relativeTime(data.generated_at)}`}
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href="/pivot"
                    className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
                  >
                    7-day shifts
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link
                    href="/momentum"
                    className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
                  >
                    Momentum
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
