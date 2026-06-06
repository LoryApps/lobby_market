'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  Cpu,
  FlaskConical,
  GraduationCap,
  Globe,
  Heart,
  Landmark,
  Leaf,
  Loader2,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { SparkTopic, SparkResponse } from '@/app/api/topics/spark/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { icon: typeof Globe; color: string; bg: string; border: string }> = {
  Politics:    { icon: Landmark,      color: 'text-for-400',    bg: 'bg-for-500/10',    border: 'border-for-500/30'    },
  Economics:   { icon: TrendingUp,    color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  Technology:  { icon: Cpu,           color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
  Science:     { icon: FlaskConical,  color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Ethics:      { icon: Scale,         color: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/30'     },
  Philosophy:  { icon: BookOpen,      color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
  Culture:     { icon: Music2,        color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Health:      { icon: Heart,         color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Education:   { icon: GraduationCap, color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  Environment: { icon: Leaf,          color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
}

function getCategoryConfig(name: string | null) {
  return (name && CATEGORY_CONFIG[name]) ?? {
    icon: Globe,
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
  }
}

// ─── Status pill ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:  { label: 'Active',  color: 'text-for-400'    },
  voting:  { label: 'Voting',  color: 'text-purple'      },
  proposed:{ label: 'Proposed',color: 'text-surface-400' },
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({ bluePct, className }: { bluePct: number; className?: string }) {
  const red = Math.round(100 - bluePct)
  const blue = Math.round(bluePct)
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-for-400 font-semibold">{blue}% FOR</span>
        <span className="text-against-400 font-semibold">{red}% AGAINST</span>
      </div>
      <div className="h-2 w-full bg-surface-300 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full transition-all duration-700"
          style={{ width: `${bluePct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Argument snippet ─────────────────────────────────────────────────────────

function ArgumentSnippet({
  content,
  side,
  upvotes,
}: {
  content: string
  side: 'blue' | 'red'
  upvotes: number
}) {
  const isFor = side === 'blue'
  return (
    <div
      className={cn(
        'rounded-xl border p-3.5 space-y-2',
        isFor
          ? 'bg-for-500/5 border-for-500/25'
          : 'bg-against-500/5 border-against-500/25'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'text-[10px] font-mono font-bold uppercase tracking-wider',
            isFor ? 'text-for-400' : 'text-against-400'
          )}
        >
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
          <ThumbsUp className="h-3 w-3" />
          {upvotes}
        </span>
      </div>
      <p className="text-sm text-surface-700 leading-relaxed line-clamp-3">
        {content}
      </p>
    </div>
  )
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SparkSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <Skeleton className="h-8 w-8 rounded-xl" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-16 ml-auto" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-6 w-2/3" />
      <div className="space-y-1.5 pt-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-2 w-full" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SparkClient() {
  const [topic, setTopic] = useState<SparkTopic | null>(null)
  const [totalEligible, setTotalEligible] = useState(0)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [votedSide, setVotedSide] = useState<'blue' | 'red' | null>(null)
  const [showVoteConfirm, setShowVoteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastIdRef = useRef<string | null>(null)

  const fetchSpark = useCallback(async (excludeId?: string) => {
    setLoading(true)
    setError(null)
    setShowVoteConfirm(false)
    try {
      const url = excludeId
        ? `/api/topics/spark?exclude=${excludeId}`
        : '/api/topics/spark'
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch')
      const data: SparkResponse = await res.json()
      if (data.topic) {
        setTopic(data.topic)
        setVotedSide(data.topic.user_vote_side)
        setTotalEligible(data.total_eligible)
        lastIdRef.current = data.topic.id
      } else {
        setError('No eligible debates found. Try again later.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSpark()
  }, [fetchSpark])

  async function castVote(side: 'blue' | 'red') {
    if (!topic || voting || votedSide) return
    setVoting(true)
    try {
      const res = await fetch(`/api/topics/${topic.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side }),
      })
      if (res.ok) {
        setVotedSide(side)
        setShowVoteConfirm(true)
      }
    } catch {
      // best-effort
    } finally {
      setVoting(false)
    }
  }

  const catConfig = getCategoryConfig(topic?.category ?? null)
  const CatIcon = catConfig.icon
  const statusCfg = topic ? (STATUS_CONFIG[topic.status] ?? { label: topic.status, color: 'text-surface-400' }) : null
  const bluePct = topic ? Math.round(topic.blue_pct) : 50

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-8 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30">
              <Sparkles className="h-5 w-5 text-gold" />
            </div>
          </div>
          <h1 className="font-mono text-2xl font-bold text-white mb-1">Civic Spark</h1>
          <p className="text-sm font-mono text-surface-500">
            A hidden debate, waiting for your voice
            {totalEligible > 0 && (
              <> &middot; <span className="text-surface-400">{totalEligible} eligible debates</span></>
            )}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-surface-100 border border-surface-300 rounded-2xl p-6"
            >
              <SparkSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center py-20 space-y-4"
            >
              <p className="font-mono text-surface-500">{error}</p>
              <button
                onClick={() => fetchSpark()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </motion.div>
          ) : topic ? (
            <motion.div
              key={topic.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="bg-surface-100 border border-surface-300 rounded-2xl overflow-hidden"
            >
              {/* Card header: category + scope + status */}
              <div className="px-6 pt-5 pb-4 border-b border-surface-300/60">
                <div className="flex items-center gap-2 flex-wrap">
                  {topic.category && (
                    <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-medium', catConfig.bg, catConfig.border, catConfig.color)}>
                      <CatIcon className="h-3.5 w-3.5" />
                      {topic.category}
                    </div>
                  )}
                  {topic.scope && topic.scope !== 'Global' && (
                    <span className="text-[10px] font-mono text-surface-500 bg-surface-200 border border-surface-300 px-2 py-0.5 rounded-md">
                      {topic.scope}
                    </span>
                  )}
                  {statusCfg && (
                    <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider ml-auto', statusCfg.color)}>
                      {statusCfg.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Topic statement */}
              <div className="px-6 py-5">
                <p className="font-mono text-xl font-bold text-white leading-snug mb-3">
                  {topic.statement}
                </p>
                {topic.description && (
                  <p className="text-sm font-mono text-surface-500 leading-relaxed line-clamp-3">
                    {topic.description}
                  </p>
                )}
              </div>

              {/* Vote bar */}
              <div className="px-6 pb-4">
                <VoteBar bluePct={bluePct} />
                <div className="flex items-center justify-between text-[10px] font-mono text-surface-600 mt-2">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {topic.total_votes.toLocaleString()} votes
                  </span>
                  {topic.tags && topic.tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {topic.tags.slice(0, 3).map(tag => (
                        <Link
                          key={tag}
                          href={`/tags/${encodeURIComponent(tag)}`}
                          className="text-surface-500 hover:text-surface-300 transition-colors"
                        >
                          #{tag}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Arguments preview */}
              {(topic.top_for_argument || topic.top_against_argument) && (
                <div className="px-6 pb-5 space-y-3">
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-surface-600 flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3" />
                    Top Arguments
                  </p>
                  {topic.top_for_argument && (
                    <ArgumentSnippet
                      content={topic.top_for_argument.content}
                      side="blue"
                      upvotes={topic.top_for_argument.upvotes}
                    />
                  )}
                  {topic.top_against_argument && (
                    <ArgumentSnippet
                      content={topic.top_against_argument.content}
                      side="red"
                      upvotes={topic.top_against_argument.upvotes}
                    />
                  )}
                </div>
              )}

              {/* Voting */}
              <div className="px-6 pb-6 border-t border-surface-300/60 pt-4 space-y-3">
                <AnimatePresence>
                  {showVoteConfirm && votedSide && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={cn(
                        'text-sm font-mono text-center font-semibold',
                        votedSide === 'blue' ? 'text-for-400' : 'text-against-400'
                      )}
                    >
                      Vote cast — {votedSide === 'blue' ? 'FOR' : 'AGAINST'}
                    </motion.p>
                  )}
                </AnimatePresence>

                {!votedSide && topic.status !== 'proposed' ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => castVote('blue')}
                      disabled={voting}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-mono font-semibold text-sm transition-colors',
                        'bg-for-600 text-white hover:bg-for-700 disabled:opacity-50'
                      )}
                    >
                      {voting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                      FOR
                    </button>
                    <button
                      onClick={() => castVote('red')}
                      disabled={voting}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-mono font-semibold text-sm transition-colors',
                        'bg-against-600 text-white hover:bg-against-700 disabled:opacity-50'
                      )}
                    >
                      {voting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
                      AGAINST
                    </button>
                  </div>
                ) : votedSide ? (
                  <div className={cn(
                    'flex items-center justify-center gap-2 py-3 rounded-xl font-mono font-semibold text-sm border',
                    votedSide === 'blue'
                      ? 'bg-for-500/10 border-for-500/30 text-for-400'
                      : 'bg-against-500/10 border-against-500/30 text-against-400'
                  )}>
                    {votedSide === 'blue' ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
                    You voted {votedSide === 'blue' ? 'FOR' : 'AGAINST'}
                  </div>
                ) : (
                  <div className="py-3 rounded-xl bg-surface-200 border border-surface-300 text-center text-sm font-mono text-surface-500">
                    Topic is in proposal phase — support to activate voting
                  </div>
                )}

                {/* Actions row */}
                <div className="flex items-center gap-2 pt-1">
                  <Link
                    href={`/topic/${topic.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-mono font-medium text-surface-400 bg-surface-200 border border-surface-300 hover:text-white hover:border-surface-400 transition-colors"
                  >
                    Full debate
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={() => fetchSpark(lastIdRef.current ?? undefined)}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-mono font-medium text-gold bg-gold/10 border border-gold/30 hover:bg-gold/20 transition-colors disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    Next spark
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Platform stat strip */}
        <div className="mt-6 text-center">
          <p className="text-[11px] font-mono text-surface-600">
            Every vote shapes civic consensus &middot;{' '}
            <Link href="/topics" className="text-surface-500 hover:text-surface-300 transition-colors">
              Browse all debates →
            </Link>
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
