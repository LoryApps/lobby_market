'use client'

/**
 * /advisor — AI Civic Advisor
 *
 * Analyses the current user's voting history, preferred categories, and civic
 * archetype, then uses Claude AI to generate a personalised briefing:
 *   • Which topics need their voice most right now
 *   • A suggested side (FOR / AGAINST) based on historical patterns
 *   • What action to take (vote, argue, debate, watch)
 *
 * Distinct from:
 *   /recommended — algorithmic topic discovery without AI reasoning
 *   /coach       — critique of a specific argument you've written
 *   /prep        — full debate dossier for a single topic
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  Bot,
  ChevronRight,
  Flame,
  Loader2,
  MessageSquare,
  Mic,
  RefreshCw,
  Sparkles,
  Star,
  Target,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { AdvisorResponse, AdvisorTopic } from '@/app/api/advisor/route'

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

function statusBadge(status: string) {
  return STATUS_BADGE[status] ?? 'proposed'
}

// ─── Action label + icon ──────────────────────────────────────────────────────

const ACTION_CONFIG: Record<
  string,
  { label: string; icon: typeof ThumbsUp; color: string; href: (id: string) => string }
> = {
  vote: {
    label: 'Vote now',
    icon: ThumbsUp,
    color: 'bg-for-600 hover:bg-for-700 text-white',
    href: (id) => `/topic/${id}`,
  },
  argue: {
    label: 'Write argument',
    icon: MessageSquare,
    color: 'bg-purple/80 hover:bg-purple text-white',
    href: (id) => `/topic/${id}/argue`,
  },
  debate: {
    label: 'Join debate',
    icon: Mic,
    color: 'bg-against-600 hover:bg-against-700 text-white',
    href: (id) => `/topic/${id}`,
  },
  watch: {
    label: 'Watch',
    icon: Zap,
    color: 'bg-surface-300 hover:bg-surface-400 text-white',
    href: (id) => `/topic/${id}/stats`,
  },
}

// ─── Side badge ───────────────────────────────────────────────────────────────

function SuggestedSide({ side }: { side: 'for' | 'against' | null }) {
  if (!side) return null
  const isFor = side === 'for'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold',
        isFor
          ? 'bg-for-500/20 text-for-300 border border-for-500/30'
          : 'bg-against-500/20 text-against-300 border border-against-500/30'
      )}
    >
      {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
      {isFor ? 'FOR' : 'AGAINST'}
    </span>
  )
}

// ─── Priority dot ─────────────────────────────────────────────────────────────

function PriorityDot({ priority }: { priority: 'high' | 'medium' }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full flex-shrink-0 mt-0.5',
        priority === 'high' ? 'bg-gold' : 'bg-surface-500'
      )}
      aria-label={priority === 'high' ? 'High priority' : 'Medium priority'}
    />
  )
}

// ─── Topic recommendation card ────────────────────────────────────────────────

function TopicCard({
  rec,
  index,
}: {
  rec: AdvisorTopic
  index: number
}) {
  const actionCfg = ACTION_CONFIG[rec.action] ?? ACTION_CONFIG.vote
  const ActionIcon = actionCfg.icon
  const forPct = rec.blue_pct
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Priority stripe */}
      {rec.priority === 'high' && (
        <div className="h-0.5 bg-gradient-to-r from-gold/70 via-gold to-gold/70" />
      )}

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-2 mb-2.5">
          <PriorityDot priority={rec.priority} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <Badge variant={statusBadge(rec.status)} size="sm">
                {STATUS_LABEL[rec.status] ?? rec.status}
              </Badge>
              {rec.category && (
                <span className="text-[11px] font-mono text-surface-500">{rec.category}</span>
              )}
              <SuggestedSide side={rec.suggested_side} />
              {rec.priority === 'high' && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-mono font-semibold text-gold">
                  <Star className="h-2.5 w-2.5 fill-gold" />
                  Priority
                </span>
              )}
            </div>

            {/* Statement */}
            <Link href={`/topic/${rec.topic_id}`}>
              <p className="font-mono text-sm font-semibold text-white leading-snug hover:text-for-300 transition-colors line-clamp-3">
                {rec.statement}
              </p>
            </Link>
          </div>
        </div>

        {/* AI reason */}
        <p className="text-xs text-surface-400 font-mono leading-relaxed mb-3 pl-4">
          {rec.reason}
        </p>

        {/* Vote bar + stats */}
        <div className="pl-4 mb-3">
          <div className="flex items-center justify-between text-[11px] font-mono mb-1">
            <span className="text-for-400 font-semibold">{forPct}% For</span>
            <span className="text-surface-500">{rec.total_votes.toLocaleString()} votes</span>
            <span className="text-against-400 font-semibold">{againstPct}% Against</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400"
              style={{ width: `${forPct}%` }}
            />
          </div>
        </div>

        {/* Action button */}
        <div className="pl-4 flex items-center gap-2">
          <Link
            href={actionCfg.href(rec.topic_id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
              'transition-all duration-150',
              actionCfg.color
            )}
          >
            <ActionIcon className="h-3 w-3" />
            {actionCfg.label}
          </Link>
          <Link
            href={`/topic/${rec.topic_id}`}
            className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
            aria-label={`View full topic: ${rec.statement}`}
          >
            View topic
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {/* Summary card */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>

      {/* Topic cards */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-3 w-full mt-2" />
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="flex gap-2 mt-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Phase = 'idle' | 'loading' | 'done' | 'error' | 'unavailable'

export function AdvisorClient() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [data, setData] = useState<AdvisorResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const hasFetched = useRef(false)

  const fetchAdvice = useCallback(async () => {
    if (phase === 'loading') return
    setPhase('loading')
    setError(null)

    try {
      const res = await fetch('/api/advisor', { method: 'POST', cache: 'no-store' })

      if (res.status === 401) {
        router.push('/login')
        return
      }

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`)
      }

      const json = (await res.json()) as AdvisorResponse | { unavailable: true } | { error: string }

      if ('unavailable' in json && json.unavailable) {
        setPhase('unavailable')
        return
      }
      if ('error' in json) {
        throw new Error(json.error)
      }

      setData(json as AdvisorResponse)
      setPhase('done')
    } catch (err) {
      console.error('[advisor]', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('error')
    }
  }, [phase, router])

  // Auto-fetch on mount
  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true
      fetchAdvice()
    }
  }, [fetchAdvice])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Page header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Bot className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Advisor</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Personalised briefing — matched to your civic profile
              </p>
            </div>
          </div>

          {phase === 'done' && (
            <button
              onClick={fetchAdvice}
              disabled={false}
              aria-label="Refresh recommendations"
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-400 border border-surface-400/40 hover:text-white hover:border-surface-400 transition-all"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          )}
        </div>

        {/* Loading */}
        {phase === 'loading' && (
          <div>
            <div className="flex items-center gap-2 mb-4 text-sm font-mono text-surface-400">
              <Loader2 className="h-4 w-4 animate-spin text-for-400" />
              <span>Analysing your civic profile…</span>
            </div>
            <LoadingSkeleton />
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center"
          >
            <AlertCircle className="h-8 w-8 text-against-400 mx-auto mb-3" />
            <p className="font-mono text-sm text-against-300 mb-1">Could not generate advice</p>
            <p className="font-mono text-xs text-surface-500 mb-4">{error}</p>
            <button
              onClick={fetchAdvice}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 text-white text-xs font-mono font-semibold hover:bg-for-700 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Try again
            </button>
          </motion.div>
        )}

        {/* Unavailable (service error) */}
        {phase === 'unavailable' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center"
          >
            <Sparkles className="h-10 w-10 text-surface-500 mx-auto mb-3" />
            <p className="font-mono text-sm font-semibold text-white mb-1">
              No topics to advise on yet
            </p>
            <p className="font-mono text-xs text-surface-500 mb-5">
              The Lobby is quiet right now. Check back once more debates are active.
            </p>
            <div className="flex justify-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-600 text-white text-xs font-mono font-semibold hover:bg-for-700 transition-colors"
              >
                <Flame className="h-3 w-3" />
                Browse feed
              </Link>
              <Link
                href="/recommended"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-300 text-white text-xs font-mono font-semibold hover:bg-surface-400 transition-colors"
              >
                <Target className="h-3 w-3" />
                Recommended
              </Link>
            </div>
          </motion.div>
        )}

        {/* Results */}
        {phase === 'done' && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {/* Summary card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-2"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-for-500/15 border border-for-500/30 flex items-center justify-center mt-0.5">
                    <Sparkles className="h-4 w-4 text-for-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-[11px] font-mono font-semibold text-for-400 uppercase tracking-wider">
                        Your civic briefing
                      </p>
                      {data.focus_area && (
                        <span className="text-[11px] font-mono text-surface-500">
                          · Focus: <span className="text-gold">{data.focus_area}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-mono text-surface-300 leading-relaxed">
                      {data.summary}
                    </p>
                    {data.civic_strength && (
                      <p className="mt-2 text-xs font-mono text-surface-500 italic">
                        {data.civic_strength}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Recommendations header */}
              <div className="flex items-center gap-2 px-1 mb-1">
                <Target className="h-3.5 w-3.5 text-surface-500" />
                <p className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                  {data.recommendations.length} recommended {data.recommendations.length === 1 ? 'topic' : 'topics'}
                </p>
              </div>

              {/* Topic cards */}
              {data.recommendations.map((rec, i) => (
                <TopicCard key={rec.topic_id} rec={rec} index={i} />
              ))}

              {/* Footer links */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-6 grid grid-cols-2 gap-3"
              >
                <Link
                  href="/recommended"
                  className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <div>
                    <p className="text-xs font-mono font-semibold text-white">More recommendations</p>
                    <p className="text-[11px] font-mono text-surface-500">Algorithm-based discovery</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                </Link>
                <Link
                  href="/analytics"
                  className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <div>
                    <p className="text-xs font-mono font-semibold text-white">Your analytics</p>
                    <p className="text-[11px] font-mono text-surface-500">Full voting stats</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                </Link>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
