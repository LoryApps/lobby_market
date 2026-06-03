'use client'

/**
 * /lighthouse — The Civic Lighthouse
 *
 * Spots neglected debates that have gone dark — topics stuck in proposed or
 * active status with few votes and no recent activity. A civic "rescue
 * mission": every vote cast here re-lights a debate the community forgot.
 *
 * Neglect Score = days_old / (total_votes + 1)
 * High score → old with almost no engagement = most in need.
 *
 * Distinct from:
 *   /spotlight   — highlights the BEST content (most engaging)
 *   /stalemate   — perfectly deadlocked at 50/50
 *   /tipping-point — topics nearest the law/fail threshold
 *   /dormant     — topics that have failed or stalled indefinitely
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Flame,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Lightbulb,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  ThumbsUp,
  TrendingUp,
  Cpu,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { LighthouseTopic, LighthouseResponse } from '@/app/api/civic/lighthouse/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
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
  Economics: TrendingUp,
  Politics: Landmark,
  Technology: Cpu,
  Science: FlaskConical,
  Ethics: Scale,
  Philosophy: MessageSquare,
  Culture: Music2,
  Health: Heart,
  Environment: Leaf,
  Education: GraduationCap,
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function neglectLabel(score: number): { label: string; color: string } {
  if (score >= 10) return { label: 'Critical', color: 'text-against-400' }
  if (score >= 5)  return { label: 'High',     color: 'text-against-300' }
  if (score >= 2)  return { label: 'Medium',   color: 'text-gold' }
  return                  { label: 'Low',      color: 'text-surface-500' }
}

function beamIntensity(score: number): number {
  const clamped = Math.min(score, 20)
  return Math.round((clamped / 20) * 100)
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LighthouseSkeletons() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
        >
          <div className="flex items-start gap-4">
            <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
              <div className="flex items-center gap-3 pt-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
              <Skeleton className="h-2 w-full rounded-full mt-1" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({ topic, rank }: { topic: LighthouseTopic; rank: number }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const { label: urgency, color: urgencyColor } = neglectLabel(topic.neglect_score)
  const intensity = beamIntensity(topic.neglect_score)
  const CategoryIcon = CATEGORY_ICONS[topic.category ?? ''] ?? Lightbulb

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05, duration: 0.3 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className="group block rounded-2xl bg-surface-100 border border-surface-300 hover:border-for-500/40 hover:bg-surface-200 transition-all duration-200"
      >
        <div className="p-5">
          <div className="flex items-start gap-4">
            {/* Rank + icon */}
            <div className="relative flex-shrink-0">
              <div className={cn(
                'h-10 w-10 rounded-xl flex items-center justify-center',
                'bg-surface-200 border border-surface-300 group-hover:border-for-500/30 transition-colors'
              )}>
                <CategoryIcon className="h-4.5 w-4.5 text-surface-500" />
              </div>
              {/* Beam intensity indicator */}
              <div
                className={cn(
                  'absolute -top-1 -right-1 h-3 w-3 rounded-full border border-surface-100',
                  intensity >= 80 ? 'bg-against-500 animate-pulse' :
                  intensity >= 50 ? 'bg-gold' :
                  'bg-surface-400'
                )}
                aria-label={`Urgency: ${urgency}`}
              />
            </div>

            <div className="flex-1 min-w-0">
              {/* Badges */}
              <div className="flex items-center flex-wrap gap-1.5 mb-2">
                <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
                  {topic.status === 'active' ? (
                    <><Zap className="h-2.5 w-2.5 mr-1" />Active</>
                  ) : (
                    <><Scale className="h-2.5 w-2.5 mr-1" />Proposed</>
                  )}
                </Badge>
                {topic.category && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-300/60 text-surface-500 border border-surface-300">
                    {topic.category}
                  </span>
                )}
                <span className={cn('text-[10px] font-mono ml-auto', urgencyColor)}>
                  {urgency} neglect
                </span>
              </div>

              {/* Statement */}
              <p className="font-mono text-sm text-white leading-snug mb-3 group-hover:text-for-100 transition-colors line-clamp-2">
                {topic.statement}
              </p>

              {/* Meta row */}
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-surface-600 mb-3">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {topic.days_dark === 0 ? 'Today' : `${topic.days_dark}d in the dark`}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {topic.total_votes.toLocaleString()} vote{topic.total_votes !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1 ml-auto text-for-400 group-hover:text-for-300 transition-colors">
                  Shine a light
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>

              {/* Vote bar */}
              <div className="space-y-1">
                <div className="h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
                  <div
                    className="h-full bg-gradient-to-r from-for-700 to-for-500 transition-all duration-500"
                    style={{ width: `${forPct}%` }}
                  />
                  <div
                    className="h-full bg-against-600"
                    style={{ width: `${againstPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-for-500">{forPct}% FOR</span>
                  <span className="text-against-500">{againstPct}% AGAINST</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ data }: { data: LighthouseResponse }) {
  const { stats } = data

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {[
        {
          label: 'Debates in the dark',
          value: stats.neglected_count,
          icon: Lightbulb,
          color: 'text-against-400',
        },
        {
          label: 'Votes needed',
          value: stats.neglected_count * 20,
          icon: ThumbsUp,
          color: 'text-gold',
        },
        {
          label: 'Longest in dark',
          value: stats.longest_dark_days,
          suffix: 'd',
          icon: Clock,
          color: 'text-for-400',
        },
      ].map((stat) => {
        const Icon = stat.icon
        return (
          <div
            key={stat.label}
            className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center"
          >
            <Icon className={cn('h-4 w-4 mx-auto mb-1', stat.color)} />
            <div className={cn('font-mono text-lg font-bold tabular-nums', stat.color)}>
              <AnimatedNumber value={stat.value} />
              {stat.suffix && <span className="text-sm">{stat.suffix}</span>}
            </div>
            <div className="text-[10px] font-mono text-surface-600 mt-0.5 leading-tight">
              {stat.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LighthouseClient() {
  const [data, setData] = useState<LighthouseResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(
    async (cat: string | null, isRefresh = false) => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        if (cat) params.set('category', cat)
        const res = await fetch(`/api/civic/lighthouse?${params}`, {
          signal: ctrl.signal,
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('Failed to load')
        const json = (await res.json()) as LighthouseResponse
        setData(json)
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'AbortError') return
        setError('Could not load the lighthouse data. Try again.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    []
  )

  useEffect(() => {
    load(category)
  }, [load, category])

  function handleCategory(cat: string | null) {
    setCategory(cat)
    setData(null)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Back + header ─────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to feed
          </Link>

          <div className="flex items-start gap-3 mb-3">
            {/* Lighthouse beam animation */}
            <div className="relative flex-shrink-0 mt-0.5">
              <div className="h-11 w-11 rounded-2xl bg-gold/10 border border-gold/30 flex items-center justify-center">
                <Lightbulb className="h-5.5 w-5.5 text-gold" />
              </div>
              {/* Animated beacon */}
              <motion.div
                className="absolute -inset-1 rounded-2xl border border-gold/40"
                animate={{ opacity: [0.3, 0.8, 0.3], scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
              />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white leading-tight">
                The Civic Lighthouse
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-1 leading-relaxed">
                Debates that have gone dark — old topics with little engagement waiting for civic light.
                Your vote re-ignites these forgotten conversations.
              </p>
            </div>
          </div>
        </div>

        {/* ── Category filter ───────────────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none">
          <button
            onClick={() => handleCategory(null)}
            className={cn(
              'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono border transition-colors',
              category === null
                ? 'bg-gold/20 text-gold border-gold/40'
                : 'bg-surface-200 text-surface-500 border-surface-300 hover:text-white hover:border-surface-400'
            )}
          >
            All categories
          </button>
          {CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat] ?? Lightbulb
            return (
              <button
                key={cat}
                onClick={() => handleCategory(cat)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition-colors',
                  category === cat
                    ? 'bg-for-500/20 text-for-300 border-for-500/40'
                    : 'bg-surface-200 text-surface-500 border-surface-300 hover:text-white hover:border-surface-400'
                )}
              >
                <Icon className="h-3 w-3" />
                {cat}
              </button>
            )
          })}
        </div>

        {/* ── Refresh ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-[11px] font-mono text-surface-600">
            Showing debates with {'<'} 100 votes, {'>'} 3 days old
          </p>
          <button
            onClick={() => load(category, true)}
            disabled={refreshing || loading}
            className={cn(
              'flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg border',
              'bg-surface-200 text-surface-500 border-surface-300',
              'hover:text-white hover:border-surface-400 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Stats ────────────────────────────────────────────────────── */}
        {data && !loading && <StatsBar data={data} />}

        {/* ── Content ──────────────────────────────────────────────────── */}
        {loading ? (
          <LighthouseSkeletons />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <Lightbulb className="h-8 w-8 text-surface-600 mx-auto mb-2" />
            <p className="text-sm font-mono text-surface-500">{error}</p>
            <button
              onClick={() => load(category, true)}
              className="mt-3 text-xs font-mono text-for-400 hover:text-for-300 underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : data?.topics.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="All debates are lit"
            description={
              category
                ? `Every ${category} topic is getting attention right now. Check another category or come back later.`
                : 'Every active debate is getting community attention right now. The Lobby is fully engaged.'
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={category ?? 'all'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {data?.topics.map((topic, i) => (
                <TopicCard key={topic.id} topic={topic} rank={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── CTA footer ───────────────────────────────────────────────── */}
        {data && data.topics.length > 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 rounded-2xl bg-surface-100 border border-surface-300 p-5 text-center"
          >
            <Lightbulb className="h-6 w-6 text-gold mx-auto mb-2" />
            <p className="text-sm font-mono text-surface-400 mb-3">
              Every vote you cast re-lights a debate the community forgot.
              <br />
              <span className="text-white">Be the spark.</span>
            </p>
            <Link
              href="/"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-xl',
                'text-xs font-mono bg-for-600/80 border border-for-500/40 text-white',
                'hover:bg-for-500 transition-colors'
              )}
            >
              <Flame className="h-3.5 w-3.5" />
              Back to the full feed
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
