'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { DuelResponse, DuelArgument } from '@/app/api/duel/route'

// ─── Local storage key for tracking picks ─────────────────────────────────────

const PICK_KEY = 'lm_duel_picks_v1'

interface PickRecord {
  topicId: string
  pickedSide: 'blue' | 'red'
  ts: number
}

function loadPicks(): PickRecord[] {
  try {
    return JSON.parse(localStorage.getItem(PICK_KEY) ?? '[]')
  } catch {
    return []
  }
}

function savePick(topicId: string, pickedSide: 'blue' | 'red') {
  try {
    const picks = loadPicks().filter((p) => p.topicId !== topicId)
    picks.unshift({ topicId, pickedSide, ts: Date.now() })
    localStorage.setItem(PICK_KEY, JSON.stringify(picks.slice(0, 100)))
  } catch {
    // best-effort
  }
}

function getPick(topicId: string): 'blue' | 'red' | null {
  return loadPicks().find((p) => p.topicId === topicId)?.pickedSide ?? null
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

function statusBadge(status: string): 'proposed' | 'active' | 'law' | 'failed' {
  if (status === 'law') return 'law'
  if (status === 'failed') return 'failed'
  if (status === 'proposed') return 'proposed'
  return 'active'
}

function StatusIcon({ status }: { status: string }) {
  const cls = 'h-3.5 w-3.5'
  if (status === 'law') return <Gavel className={cn(cls, 'text-gold')} aria-hidden />
  if (status === 'voting') return <Scale className={cn(cls, 'text-purple')} aria-hidden />
  if (status === 'active') return <Zap className={cn(cls, 'text-for-400')} aria-hidden />
  return <MessageSquare className={cn(cls, 'text-surface-500')} aria-hidden />
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  side,
  state,
  onPick,
  communityWinner,
}: {
  arg: DuelArgument
  side: 'blue' | 'red'
  state: 'idle' | 'chosen' | 'rejected' | 'revealed'
  onPick?: () => void
  communityWinner: 'blue' | 'red' | 'tie' | null
}) {
  const isFor = side === 'blue'
  const isChosen = state === 'chosen'
  const isRejected = state === 'rejected'
  const isRevealed = state === 'revealed'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{
        opacity: isRejected ? 0.45 : 1,
        y: 0,
        scale: isChosen ? 1.01 : 1,
      }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'relative flex flex-col rounded-2xl border p-5 cursor-pointer select-none',
        'transition-all duration-300',
        isFor
          ? 'bg-for-500/5 border-for-500/30 hover:border-for-500/60 hover:bg-for-500/10'
          : 'bg-against-500/5 border-against-500/30 hover:border-against-500/60 hover:bg-against-500/10',
        isChosen && (isFor
          ? 'ring-2 ring-for-500/60 border-for-500/80 bg-for-500/12'
          : 'ring-2 ring-against-500/60 border-against-500/80 bg-against-500/12'),
        state === 'idle' && 'active:scale-[0.99]',
      )}
      onClick={state === 'idle' ? onPick : undefined}
      role={state === 'idle' ? 'button' : undefined}
      tabIndex={state === 'idle' ? 0 : undefined}
      onKeyDown={state === 'idle' ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick?.() } } : undefined}
      aria-label={state === 'idle' ? `Choose ${isFor ? 'FOR' : 'AGAINST'} argument` : undefined}
      aria-pressed={isChosen ? true : undefined}
    >
      {/* Side label */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border',
            isFor
              ? 'bg-for-500/20 border-for-500/40 text-for-300'
              : 'bg-against-500/20 border-against-500/40 text-against-300',
          )}
        >
          {isFor ? <ThumbsUp className="h-3 w-3" aria-hidden /> : <ThumbsDown className="h-3 w-3" aria-hidden />}
          {isFor ? 'FOR' : 'AGAINST'}
        </span>

        {/* Upvote count — shown immediately */}
        <span className="flex items-center gap-1 text-xs font-mono text-surface-500">
          <ChevronLeft className="h-3 w-3 rotate-90" aria-hidden />
          {arg.upvotes}
        </span>
      </div>

      {/* Argument content */}
      <p className={cn(
        'flex-1 text-sm leading-relaxed font-mono mb-4',
        isRejected ? 'text-surface-600' : 'text-surface-800',
      )}>
        {arg.content}
      </p>

      {/* Author row */}
      {arg.author && (
        <div className="flex items-center gap-2 pt-3 border-t border-surface-300/60">
          <Avatar
            src={arg.author.avatar_url}
            fallback={arg.author.display_name ?? arg.author.username}
            size="xs"
          />
          <span className="text-[11px] font-mono text-surface-500 truncate">
            @{arg.author.username}
          </span>
          <span className="text-[10px] font-mono text-surface-600 ml-auto flex-shrink-0">
            {relativeTime(arg.created_at)}
          </span>
        </div>
      )}

      {/* Winner badge — revealed after vote */}
      <AnimatePresence>
        {isRevealed && communityWinner !== null && communityWinner !== 'tie' && communityWinner === side && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              'absolute -top-3 -right-3 flex items-center gap-1',
              'px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border shadow-lg',
              isFor
                ? 'bg-for-600 border-for-500 text-white'
                : 'bg-against-600 border-against-500 text-white',
            )}
          >
            <Trophy className="h-3 w-3" aria-hidden />
            Community pick
          </motion.div>
        )}
        {isRevealed && communityWinner === 'tie' && isFor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border bg-surface-200 border-surface-400 text-surface-600 shadow-lg"
          >
            Tied!
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ forVotes, againstVotes }: { forVotes: number; againstVotes: number }) {
  const total = forVotes + againstVotes
  const forPct = total > 0 ? Math.round((forVotes / total) * 100) : 50

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px] font-mono">
        <span className="text-for-400">{forPct}% FOR</span>
        <span className="text-against-400">{100 - forPct}% AGAINST</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-surface-300 flex">
        <div
          className="h-full bg-gradient-to-r from-for-700 to-for-500 transition-all duration-700"
          style={{ width: `${forPct}%` }}
        />
        <div
          className="h-full bg-against-600 transition-all duration-700"
          style={{ width: `${100 - forPct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-surface-600">
        <span>{forVotes} upvotes</span>
        <span>{againstVotes} upvotes</span>
      </div>
    </div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function CategoryTag({ category }: { category: string | null }) {
  const colorMap: Record<string, string> = {
    Economics: 'text-gold',
    Politics: 'text-for-400',
    Technology: 'text-purple',
    Science: 'text-emerald',
    Ethics: 'text-against-300',
    Philosophy: 'text-for-300',
    Culture: 'text-gold',
    Health: 'text-against-300',
    Environment: 'text-emerald',
    Education: 'text-purple',
  }
  if (!category) return null
  return (
    <span className={cn('text-xs font-mono font-semibold', colorMap[category] ?? 'text-surface-500')}>
      {category}
    </span>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DuelSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="text-center space-y-3">
        <Skeleton className="h-4 w-24 mx-auto" />
        <Skeleton className="h-7 w-3/4 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type PickState = 'idle' | 'picked'

export default function DuelPage() {
  const [data, setData] = useState<DuelResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [duelIndex, setDuelIndex] = useState(0)
  const [pickState, setPickState] = useState<PickState>('idle')
  const [pickedSide, setPickedSide] = useState<'blue' | 'red' | null>(null)
  const [sessionStats, setSessionStats] = useState({ for: 0, against: 0, duels: 0 })
  const loadedRef = useRef(false)

  const fetchDuel = useCallback(async (idx: number) => {
    setLoading(true)
    setError(null)
    setPickState('idle')
    setPickedSide(null)
    try {
      const res = await fetch(`/api/duel?index=${idx}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to load duel' }))
        throw new Error(err.error ?? 'Failed to load duel')
      }
      const json: DuelResponse = await res.json()
      setData(json)
      setDuelIndex(json.duelIndex)

      // If the user already picked this topic, restore state
      const prior = getPick(json.topic.id)
      if (prior) {
        setPickedSide(prior)
        setPickState('picked')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    fetchDuel(Math.floor(Math.random() * 1000))
  }, [fetchDuel])

  function handlePick(side: 'blue' | 'red') {
    if (!data || pickState !== 'idle') return
    setPickedSide(side)
    setPickState('picked')
    savePick(data.topic.id, side)
    setSessionStats((s) => ({
      for: s.for + (side === 'blue' ? 1 : 0),
      against: s.against + (side === 'red' ? 1 : 0),
      duels: s.duels + 1,
    }))
  }

  function handleNext() {
    fetchDuel(duelIndex + 1)
  }

  function handlePrev() {
    fetchDuel(duelIndex - 1)
  }

  // Determine community winner
  const communityWinner: 'blue' | 'red' | 'tie' | null = (() => {
    if (!data || pickState !== 'picked') return null
    const fv = data.forArgument.upvotes
    const av = data.againstArgument.upvotes
    if (fv === av) return 'tie'
    return fv > av ? 'blue' : 'red'
  })()

  const agreed = pickedSide !== null && communityWinner !== null && communityWinner !== 'tie'
    ? pickedSide === communityWinner
    : null

  const cardState = (side: 'blue' | 'red'): 'idle' | 'chosen' | 'rejected' | 'revealed' => {
    if (pickState === 'idle') return 'idle'
    if (side === pickedSide) return communityWinner !== null ? 'revealed' : 'chosen'
    return 'rejected'
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-12" id="main-content">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-mono font-bold text-white flex items-center gap-2">
              <Swords className="h-5 w-5 text-for-400" aria-hidden />
              Argument Duel
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Two arguments. One topic. Which makes the better case?
            </p>
          </div>

          {/* Session stats */}
          {sessionStats.duels > 0 && (
            <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1 text-for-400">
                <ThumbsUp className="h-3 w-3" aria-hidden />
                {sessionStats.for}
              </span>
              <span className="text-surface-600">vs</span>
              <span className="flex items-center gap-1 text-against-400">
                <ThumbsDown className="h-3 w-3" aria-hidden />
                {sessionStats.against}
              </span>
              <span className="text-surface-600">·</span>
              <span className="text-surface-500">{sessionStats.duels} duels</span>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DuelSkeleton />
            </motion.div>
          )}

          {!loading && error && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={Swords}
                iconColor="text-surface-500"
                title="No duels available"
                description={error === 'No matched duels available'
                  ? 'No topics have both FOR and AGAINST arguments yet. Be the first to argue.'
                  : error}
                actions={[
                  { label: 'Refresh', onClick: () => fetchDuel(0) },
                  { label: 'Browse topics', href: '/', variant: 'secondary' },
                ]}
              />
            </motion.div>
          )}

          {!loading && !error && data && (
            <motion.div
              key={data.topic.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
              className="space-y-5"
            >
              {/* ── Topic header ────────────────────────────────────────────── */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 text-center space-y-3">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <CategoryTag category={data.topic.category} />
                  <Badge variant={statusBadge(data.topic.status)}>
                    <StatusIcon status={data.topic.status} />
                    {data.topic.status === 'voting' ? 'Voting' : data.topic.status === 'law' ? 'LAW' : data.topic.status === 'active' ? 'Active' : 'Proposed'}
                  </Badge>
                  <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
                    <Users className="h-3 w-3" aria-hidden />
                    {data.topic.total_votes.toLocaleString()} votes
                  </span>
                </div>

                <Link
                  href={`/topic/${data.topic.id}`}
                  className="block text-base font-mono font-semibold text-white hover:text-for-300 transition-colors leading-snug"
                >
                  {data.topic.statement}
                </Link>

                {/* Community vote bar */}
                <div className="max-w-xs mx-auto">
                  <div className="h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
                    <div
                      className="h-full bg-gradient-to-r from-for-700 to-for-500 transition-all"
                      style={{ width: `${Math.round(data.topic.blue_pct)}%` }}
                    />
                    <div
                      className="h-full bg-against-600"
                      style={{ width: `${100 - Math.round(data.topic.blue_pct)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* ── Prompt ──────────────────────────────────────────────────── */}
              <AnimatePresence mode="wait">
                {pickState === 'idle' && (
                  <motion.p
                    key="prompt"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center text-sm font-mono text-surface-500"
                  >
                    Which argument makes the stronger case? Tap to choose.
                  </motion.p>
                )}
                {pickState === 'picked' && (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-1"
                  >
                    {communityWinner === 'tie' ? (
                      <p className="text-sm font-mono text-surface-500">
                        It&apos;s a tie! Both arguments have equal upvotes.
                      </p>
                    ) : agreed === true ? (
                      <p className="text-sm font-mono text-emerald">
                        You agree with the community! The {communityWinner === 'blue' ? 'FOR' : 'AGAINST'} argument leads.
                      </p>
                    ) : agreed === false ? (
                      <p className="text-sm font-mono text-against-400">
                        Bold choice! You sided with the minority — the {communityWinner === 'blue' ? 'FOR' : 'AGAINST'} argument has more community support.
                      </p>
                    ) : null}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Argument cards ───────────────────────────────────────────── */}
              <div className="grid md:grid-cols-2 gap-4">
                <ArgumentCard
                  arg={data.forArgument}
                  side="blue"
                  state={cardState('blue')}
                  onPick={() => handlePick('blue')}
                  communityWinner={communityWinner}
                />
                <ArgumentCard
                  arg={data.againstArgument}
                  side="red"
                  state={cardState('red')}
                  onPick={() => handlePick('red')}
                  communityWinner={communityWinner}
                />
              </div>

              {/* ── Score reveal ─────────────────────────────────────────────── */}
              <AnimatePresence>
                {pickState === 'picked' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4 overflow-hidden"
                  >
                    <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider text-center">
                      Community upvote score
                    </p>
                    <ScoreBar
                      forVotes={data.forArgument.upvotes}
                      againstVotes={data.againstArgument.upvotes}
                    />

                    <div className="flex items-center justify-center gap-3 pt-1">
                      <Link
                        href={`/topic/${data.topic.id}#arguments`}
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                      >
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                        See full discussion
                        <ArrowRight className="h-3 w-3" aria-hidden />
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Navigation ───────────────────────────────────────────────── */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrev}
                  aria-label="Previous duel"
                  className={cn(
                    'flex items-center justify-center h-10 w-10 rounded-xl border',
                    'bg-surface-200 border-surface-300 text-surface-500',
                    'hover:bg-surface-300 hover:text-white transition-colors',
                  )}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>

                <button
                  onClick={handleNext}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border text-sm font-mono font-semibold',
                    pickState === 'idle'
                      ? 'bg-surface-200 border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white'
                      : 'bg-for-600 border-for-500/50 text-white hover:bg-for-500',
                    'transition-colors',
                  )}
                >
                  {pickState === 'idle' ? (
                    <>
                      <Flame className="h-4 w-4" aria-hidden />
                      Skip
                    </>
                  ) : (
                    <>
                      Next Duel
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </>
                  )}
                </button>

                <button
                  onClick={() => fetchDuel(Math.floor(Math.random() * 1000))}
                  aria-label="Random duel"
                  className={cn(
                    'flex items-center justify-center h-10 w-10 rounded-xl border',
                    'bg-surface-200 border-surface-300 text-surface-500',
                    'hover:bg-surface-300 hover:text-white transition-colors',
                  )}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {/* ── Progress indicator ────────────────────────────────────────── */}
              <p className="text-center text-[10px] font-mono text-surface-600">
                Duel {duelIndex + 1} of {data.totalDuels} available matchups
              </p>

              {/* ── Sidebar hints ─────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-surface-300">
                <Link
                  href="/arguments"
                  className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-colors"
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/20 flex-shrink-0">
                    <ThumbsUp className="h-4 w-4 text-for-400" aria-hidden />
                  </div>
                  <div>
                    <p className="text-xs font-mono font-semibold text-white">Top Arguments</p>
                    <p className="text-[10px] font-mono text-surface-500">All-time best</p>
                  </div>
                </Link>
                <Link
                  href="/pulse"
                  className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-colors"
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-against-500/10 border border-against-500/20 flex-shrink-0">
                    <Zap className="h-4 w-4 text-against-400" aria-hidden />
                  </div>
                  <div>
                    <p className="text-xs font-mono font-semibold text-white">Argument Pulse</p>
                    <p className="text-[10px] font-mono text-surface-500">Live stream</p>
                  </div>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
