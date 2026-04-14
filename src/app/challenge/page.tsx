'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Circle,
  Coins,
  ExternalLink,
  Flame,
  Loader2,
  RefreshCw,
  Scale,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import { useVoteStore } from '@/lib/stores/vote-store'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuorumTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  feed_score: number
}

interface ChallengeData {
  date: string
  topics: QuorumTopic[]
  topicIds: string[]
  votedTopicIds: string[]
  votedCount: number
  total: number
  isComplete: boolean
  alreadyClaimed: boolean
  cloutReward: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

const STATUS_CONFIG: Record<
  string,
  { label: string; badge: 'proposed' | 'active' | 'law' | 'failed'; dot: string }
> = {
  proposed: { label: 'Proposed', badge: 'proposed', dot: 'bg-surface-400' },
  active: { label: 'Active', badge: 'active', dot: 'bg-for-500' },
  voting: { label: 'Voting', badge: 'active', dot: 'bg-purple' },
  law: { label: 'LAW', badge: 'law', dot: 'bg-gold' },
  failed: { label: 'Failed', badge: 'failed', dot: 'bg-against-500' },
}

// ─── SVG Progress Ring ────────────────────────────────────────────────────────

function ProgressRing({
  voted,
  total,
  claimed,
}: {
  voted: number
  total: number
  claimed: boolean
}) {
  const radius = 44
  const circumference = 2 * Math.PI * radius
  const pct = total > 0 ? voted / total : 0
  const offset = circumference * (1 - pct)

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-28 h-28"
      aria-label={`${voted} of ${total} quorum votes cast`}
      role="img"
    >
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        strokeWidth="8"
        className="stroke-surface-300"
      />
      <motion.circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
        className={claimed ? 'stroke-gold' : 'stroke-for-500'}
        initial={false}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
      <text
        x="50"
        y="44"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-white font-mono"
        fontSize="22"
        fontWeight="700"
      >
        {claimed ? '✓' : `${voted}/${total}`}
      </text>
      <text
        x="50"
        y="63"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-surface-500 font-mono"
        fontSize="10"
      >
        {claimed ? 'COMPLETE' : 'VOTES'}
      </text>
    </svg>
  )
}

// ─── Topic Row ────────────────────────────────────────────────────────────────

function QuorumTopicRow({
  topic,
  index,
  voted,
}: {
  topic: QuorumTopic
  index: number
  voted: boolean
}) {
  const cfg = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.proposed
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={cn(
        'group relative rounded-2xl border p-5 transition-all',
        voted
          ? 'border-for-500/40 bg-for-600/10'
          : 'border-surface-300 bg-surface-100 hover:border-surface-400'
      )}
    >
      {voted && (
        <div className="absolute top-4 right-4 flex items-center gap-1.5 text-for-400 text-xs font-mono font-semibold">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Voted
        </div>
      )}

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className={cn('h-2 w-2 rounded-full flex-shrink-0', cfg.dot)} aria-hidden="true" />
        <Badge variant={cfg.badge}>{cfg.label}</Badge>
        {topic.category && (
          <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
            {topic.category}
          </span>
        )}
      </div>

      <p className="text-base font-semibold text-white leading-snug mb-4 pr-16">
        {topic.statement}
      </p>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-mono text-for-400 w-8 text-right shrink-0">
          {forPct}%
        </span>
        <div className="flex-1 h-2 rounded-full overflow-hidden bg-surface-300">
          <motion.div
            className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${forPct}%` }}
            transition={{ duration: 0.6, delay: index * 0.08 + 0.2 }}
          />
        </div>
        <span className="text-xs font-mono text-against-400 w-8 shrink-0">
          {againstPct}%
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-surface-500">
          {topic.total_votes.toLocaleString()} vote{topic.total_votes !== 1 ? 's' : ''} cast
        </span>
        <Link
          href={`/topic/${topic.id}`}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
            voted
              ? 'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
              : 'bg-for-600 hover:bg-for-500 text-white'
          )}
        >
          {voted ? (
            <>
              <ExternalLink className="h-3 w-3" />
              View
            </>
          ) : (
            <>
              <Zap className="h-3 w-3" />
              Vote now
              <ArrowRight className="h-3 w-3" />
            </>
          )}
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Completion Banner ────────────────────────────────────────────────────────

function CompletionBanner({
  cloutReward,
  alreadyClaimed,
  onClaim,
  claiming,
  claimed,
  newBalance,
}: {
  cloutReward: number
  alreadyClaimed: boolean
  onClaim: () => void
  claiming: boolean
  claimed: boolean
  newBalance: number | null
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border border-gold/40 bg-gold/10 p-6 text-center"
    >
      <div className="flex items-center justify-center h-14 w-14 rounded-full bg-gold/20 border border-gold/40 mx-auto mb-4">
        <Award className="h-7 w-7 text-gold" aria-hidden="true" />
      </div>
      <h3 className="font-mono text-xl font-bold text-gold mb-1">
        Quorum Complete
      </h3>
      <p className="text-sm text-surface-400 mb-5">
        You voted on all 3 of today&rsquo;s topics.
      </p>

      {alreadyClaimed || claimed ? (
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold/10 border border-gold/30 text-gold font-mono text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4" />
          {newBalance !== null
            ? `+${cloutReward} Clout claimed — balance: ${newBalance.toLocaleString()}`
            : `+${cloutReward} Clout already claimed`}
        </div>
      ) : (
        <button
          onClick={onClaim}
          disabled={claiming}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl',
            'bg-gold hover:bg-yellow-400 text-surface-900 font-mono text-sm font-bold',
            'transition-all disabled:opacity-60 disabled:cursor-not-allowed',
            'shadow-lg shadow-gold/20'
          )}
        >
          {claiming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Coins className="h-4 w-4" />
          )}
          Claim +{cloutReward} Clout
        </button>
      )}
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ChallengeSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center py-6">
        <div className="h-28 w-28 rounded-full bg-surface-300 animate-pulse" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
          <div className="flex gap-2">
            <div className="h-5 w-16 bg-surface-300 rounded-full animate-pulse" />
            <div className="h-5 w-20 bg-surface-300 rounded-full animate-pulse" />
          </div>
          <div className="h-6 w-4/5 bg-surface-300 rounded animate-pulse" />
          <div className="h-6 w-2/3 bg-surface-300 rounded animate-pulse" />
          <div className="h-2 w-full bg-surface-300 rounded-full animate-pulse" />
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChallengePage() {
  const { hasVoted } = useVoteStore()

  const [data, setData] = useState<ChallengeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [newBalance, setNewBalance] = useState<number | null>(null)

  const lastFocus = useRef<number>(Date.now())

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/challenge', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load quorum')
      const json: ChallengeData = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const handler = () => {
      const now = Date.now()
      if (now - lastFocus.current > 5_000) {
        lastFocus.current = now
        load()
      }
    }
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [load])

  const handleClaim = async () => {
    if (!data || claiming || claimed) return
    setClaiming(true)
    try {
      const res = await fetch('/api/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicIds: data.topicIds }),
      })
      const json = await res.json()
      if (json.status === 'claimed') {
        setClaimed(true)
        setNewBalance(json.new_balance ?? null)
      } else if (json.status === 'already_claimed') {
        setClaimed(true)
        setNewBalance(json.new_balance ?? null)
      } else if (json.status === 'incomplete') {
        await load()
      }
    } catch {
      // silent fail
    } finally {
      setClaiming(false)
    }
  }

  const localVotedIds = data?.topicIds.filter((id) => hasVoted(id)) ?? []
  const mergedVotedIds = data
    ? Array.from(new Set([...data.votedTopicIds, ...localVotedIds]))
    : []
  const mergedVotedCount = mergedVotedIds.length
  const mergedComplete =
    data !== null && mergedVotedCount >= data.total && data.total > 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-600/20 border border-for-500/30">
              <Flame className="h-5 w-5 text-for-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white tracking-tight">
                Daily Quorum
              </h1>
              {data && (
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  {formatDate(data.date)}
                </p>
              )}
            </div>
          </div>
          <p className="text-sm text-surface-400 leading-relaxed mt-3">
            Vote on today&rsquo;s 3 curated topics to complete the Quorum and
            earn bonus Clout. Topics refresh each day at midnight UTC.
          </p>
        </div>

        {loading && <ChallengeSkeleton />}

        {!loading && error && (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/10 p-6 text-center">
            <Scale className="h-8 w-8 text-against-400 mx-auto mb-3" />
            <p className="text-sm text-against-300 mb-4">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-white text-sm font-mono hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && data && data.topics.length === 0 && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-10 text-center">
            <Scale className="h-10 w-10 text-surface-500 mx-auto mb-4" />
            <h2 className="font-mono text-lg font-bold text-white mb-2">
              No active topics today
            </h2>
            <p className="text-sm text-surface-500 mb-6">
              There aren&rsquo;t enough active topics for a Quorum right now.
              Check back after new topics are activated.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium transition-colors"
            >
              <Flame className="h-4 w-4" />
              Browse the feed
            </Link>
          </div>
        )}

        {!loading && !error && data && data.topics.length > 0 && (
          <div className="space-y-6">

            {/* Progress ring + stats */}
            <div className="flex items-center gap-6 rounded-2xl border border-surface-300 bg-surface-100 p-5">
              <ProgressRing
                voted={mergedVotedCount}
                total={data.total}
                claimed={data.alreadyClaimed || claimed}
              />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm font-semibold text-white mb-1">
                  {data.alreadyClaimed || claimed
                    ? 'Quorum complete!'
                    : mergedVotedCount === 0
                    ? 'Cast your votes'
                    : mergedVotedCount < data.total
                    ? `${data.total - mergedVotedCount} vote${data.total - mergedVotedCount !== 1 ? 's' : ''} remaining`
                    : 'All votes cast — claim your reward!'}
                </p>
                <p className="text-xs text-surface-500 font-mono mb-3">
                  {data.alreadyClaimed || claimed
                    ? `+${data.cloutReward} Clout earned today`
                    : `Complete all ${data.total} to earn +${data.cloutReward} Clout`}
                </p>
                <div className="flex gap-2">
                  {data.topics.map((t, i) => {
                    const done = mergedVotedIds.includes(t.id)
                    return (
                      <div
                        key={t.id}
                        className={cn(
                          'flex items-center justify-center h-7 w-7 rounded-full border text-xs font-mono font-bold transition-all',
                          done
                            ? 'border-for-500 bg-for-600/20 text-for-400'
                            : 'border-surface-400 bg-surface-200 text-surface-500'
                        )}
                        aria-label={`Topic ${i + 1}: ${done ? 'voted' : 'not voted'}`}
                      >
                        {done ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Circle className="h-3.5 w-3.5" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <AnimatePresence>
              {mergedComplete && (
                <CompletionBanner
                  cloutReward={data.cloutReward}
                  alreadyClaimed={data.alreadyClaimed}
                  onClaim={handleClaim}
                  claiming={claiming}
                  claimed={claimed}
                  newBalance={newBalance}
                />
              )}
            </AnimatePresence>

            <div className="space-y-3">
              {data.topics.map((topic, i) => (
                <QuorumTopicRow
                  key={topic.id}
                  topic={topic}
                  index={i}
                  voted={mergedVotedIds.includes(topic.id)}
                />
              ))}
            </div>

            <p className="text-xs font-mono text-surface-600 text-center">
              Tap &ldquo;Vote now&rdquo; to open the topic, then return here once you&rsquo;ve voted.
              Progress syncs automatically.
            </p>
          </div>
        )}

        {!loading && !error && (
          <div className="mt-8 pt-6 border-t border-surface-300 flex items-center justify-between">
            <div className="text-xs font-mono text-surface-600">
              Streak builds with consecutive daily completions.
            </div>
            <Link
              href="/analytics"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              View your stats
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
