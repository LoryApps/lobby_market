'use client'

/**
 * /swipe — Civic Swipe Stack
 *
 * Full-screen, deliberate card-by-card voting experience.
 * No timer. No score. Just focused civic engagement.
 *
 * Controls:
 *   • Drag right  → vote FOR  (blue overlay)
 *   • Drag left   → vote AGAINST (red overlay)
 *   • Tap ↑ button → skip to next topic
 *   • Tap FOR / AGAINST buttons → vote without dragging
 *
 * Mobile-first. Works on desktop too via mouse drag.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  animate,
} from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Gavel,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { useVoteStore } from '@/lib/stores/vote-store'
import { Badge } from '@/components/ui/Badge'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { TopicWithAuthor } from '@/lib/supabase/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 90   // px before vote commits
const BATCH_SIZE = 20
const PREFETCH_WHEN_LEFT = 5  // fetch next batch when ≤5 cards remain

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_ICON: Record<string, typeof Zap> = {
  proposed: Scale,
  active: Zap,
  voting: Scale,
  law: Gavel,
  failed: Scale,
}

const CATEGORY_COLORS: Record<string, { text: string; bg: string; dot: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        dot: 'bg-gold' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     dot: 'bg-for-500' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      dot: 'bg-purple' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     dot: 'bg-emerald' },
  Ethics:      { text: 'text-against-300', bg: 'bg-against-500/10', dot: 'bg-against-500' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-400/10',     dot: 'bg-for-400' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        dot: 'bg-gold' },
  Health:      { text: 'text-against-300', bg: 'bg-against-400/10', dot: 'bg-against-400' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     dot: 'bg-emerald' },
  Education:   { text: 'text-purple',      bg: 'bg-purple/10',      dot: 'bg-purple' },
}

function catStyle(cat: string | null) {
  return CATEGORY_COLORS[cat ?? ''] ?? {
    text: 'text-surface-500',
    bg: 'bg-surface-300/10',
    dot: 'bg-surface-500',
  }
}

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ─── Session storage key ──────────────────────────────────────────────────────

const SEEN_KEY = 'lm_swipe_seen_v1'

function getSeenIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function addSeenId(id: string) {
  try {
    const ids = getSeenIds()
    ids.add(id)
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(ids)))
  } catch {
    // sessionStorage may be unavailable
  }
}

// ─── Swipe card ───────────────────────────────────────────────────────────────

interface SwipeCardProps {
  topic: TopicWithAuthor
  onVote: (side: 'blue' | 'red') => void
  onSkip: () => void
  isTop: boolean
  stackIndex: number // 0=top, 1=behind, 2=far behind
}

function SwipeCard({ topic, onVote, onSkip, isTop, stackIndex }: SwipeCardProps) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-18, 18])
  // FOR label fades in as we drag right
  const forOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1])
  // AGAINST label fades in as we drag left
  const againstOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0])
  // Background tint
  const bgColor = useTransform(
    x,
    [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
    ['rgba(220, 38, 38, 0.12)', 'rgba(0,0,0,0)', 'rgba(37, 99, 235, 0.12)']
  )

  const { castVote } = useVoteStore()

  const commit = useCallback(
    async (side: 'blue' | 'red') => {
      await castVote(topic.id, side)
      onVote(side)
    },
    [castVote, onVote, topic.id]
  )

  const handleDragEnd = useCallback(
    (_e: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      const dx = info.offset.x
      const vx = info.velocity.x

      if (dx > SWIPE_THRESHOLD || vx > 450) {
        // swipe right → FOR
        animate(x, 600, { duration: 0.3 }).then(() => commit('blue'))
      } else if (dx < -SWIPE_THRESHOLD || vx < -450) {
        // swipe left → AGAINST
        animate(x, -600, { duration: 0.3 }).then(() => commit('red'))
      } else {
        // snap back
        animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 })
      }
    },
    [x, commit]
  )

  const StatusIcon = STATUS_ICON[topic.status] ?? Scale
  const cat = catStyle(topic.category)
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  // Stack offset animation for cards behind the top
  const scale = 1 - stackIndex * 0.04
  const yOffset = stackIndex * 10

  return (
    <motion.div
      className={cn(
        'absolute inset-x-4 top-0 bottom-0',
        'flex flex-col',
        isTop ? 'cursor-grab active:cursor-grabbing z-30' : stackIndex === 1 ? 'z-20' : 'z-10'
      )}
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        scale,
        y: yOffset,
        backgroundColor: isTop ? bgColor : undefined,
        borderRadius: '1.25rem',
      }}
      drag={isTop ? 'x' : false}
      dragDirectionLock
      dragElastic={{ left: 0.15, right: 0.15 }}
      dragConstraints={{ left: 0, right: 0 }}
      dragMomentum={false}
      onDragEnd={isTop ? handleDragEnd : undefined}
    >
      {/* Card shell */}
      <div className="flex-1 flex flex-col bg-surface-200 border border-surface-300 rounded-[1.25rem] overflow-hidden shadow-2xl">

        {/* FOR overlay — right drag */}
        {isTop && (
          <motion.div
            className="absolute inset-0 z-40 rounded-[1.25rem] flex items-center justify-center pointer-events-none"
            style={{ opacity: forOpacity }}
          >
            <div className="px-5 py-2.5 rounded-2xl border-4 border-for-400 rotate-[-12deg]">
              <span className="text-for-400 text-4xl font-black tracking-widest font-mono">FOR</span>
            </div>
          </motion.div>
        )}

        {/* AGAINST overlay — left drag */}
        {isTop && (
          <motion.div
            className="absolute inset-0 z-40 rounded-[1.25rem] flex items-center justify-center pointer-events-none"
            style={{ opacity: againstOpacity }}
          >
            <div className="px-5 py-2.5 rounded-2xl border-4 border-against-400 rotate-[12deg]">
              <span className="text-against-400 text-4xl font-black tracking-widest font-mono">AGAINST</span>
            </div>
          </motion.div>
        )}

        {/* Header — category + status */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          {topic.category ? (
            <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold', cat.bg, cat.text)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', cat.dot)} />
              {topic.category}
            </div>
          ) : (
            <div />
          )}
          <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
            <StatusIcon className="h-3 w-3 mr-1" aria-hidden />
            {STATUS_LABEL[topic.status] ?? topic.status}
          </Badge>
        </div>

        {/* Topic statement */}
        <div className="flex-1 flex items-center px-5 py-2 min-h-0">
          <p className="text-white text-xl font-semibold leading-snug line-clamp-6 tracking-tight">
            {topic.statement}
          </p>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 px-5 pt-2 pb-4 flex-shrink-0">
          {/* Vote split bar */}
          <div className="flex-1 flex flex-col gap-1">
            <div className="flex justify-between text-[10px] font-mono text-surface-500 mb-0.5">
              <span className="text-for-400 font-semibold">{forPct}% For</span>
              <span className="text-against-400 font-semibold">{againstPct}% Against</span>
            </div>
            <div className="relative h-1.5 rounded-full overflow-hidden bg-surface-300">
              <div
                className="absolute inset-y-0 left-0 bg-for-500 rounded-l-full"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="absolute inset-y-0 right-0 bg-against-500 rounded-r-full"
                style={{ width: `${againstPct}%` }}
              />
            </div>
          </div>

          {/* Vote count */}
          <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500 flex-shrink-0">
            <Users className="h-3 w-3" aria-hidden />
            <span>{formatVotes(topic.total_votes ?? 0)}</span>
          </div>
        </div>

        {/* Action buttons */}
        {isTop && (
          <div className="flex items-center gap-3 px-5 pb-5 flex-shrink-0">
            {/* AGAINST */}
            <button
              onClick={() => {
                animate(x, -600, { duration: 0.3 }).then(() => commit('red'))
              }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl',
                'bg-against-600/15 border border-against-600/30',
                'text-against-400 font-mono font-semibold text-sm',
                'hover:bg-against-600/25 active:scale-95 transition-all',
              )}
              aria-label="Vote against"
            >
              <ThumbsDown className="h-4 w-4" aria-hidden />
              Against
            </button>

            {/* Skip */}
            <button
              onClick={onSkip}
              className={cn(
                'flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center',
                'bg-surface-300/80 border border-surface-400/40',
                'text-surface-500 hover:text-white hover:bg-surface-300 transition-all active:scale-95',
              )}
              aria-label="Skip topic"
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>

            {/* FOR */}
            <button
              onClick={() => {
                animate(x, 600, { duration: 0.3 }).then(() => commit('blue'))
              }}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl',
                'bg-for-600/15 border border-for-600/30',
                'text-for-400 font-mono font-semibold text-sm',
                'hover:bg-for-600/25 active:scale-95 transition-all',
              )}
              aria-label="Vote for"
            >
              <ThumbsUp className="h-4 w-4" aria-hidden />
              For
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Session summary ──────────────────────────────────────────────────────────

interface SessionStats {
  for: number
  against: number
  skipped: number
}

function SessionSummary({ stats, onReset }: { stats: SessionStats; onReset: () => void }) {
  const total = stats.for + stats.against
  const forPct = total > 0 ? Math.round((stats.for / total) * 100) : 50

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center flex-1 px-6 gap-6 text-center"
    >
      <div className="h-16 w-16 rounded-2xl bg-for-600/20 border border-for-500/30 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-for-400" aria-hidden />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white font-mono mb-1">Session complete</h2>
        <p className="text-surface-500 text-sm">You&apos;ve gone through all available topics.</p>
      </div>

      {/* Stats */}
      <div className="w-full max-w-xs bg-surface-200 border border-surface-300 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-surface-300">
          <div className="flex flex-col items-center py-4 gap-0.5">
            <span className="text-2xl font-mono font-bold text-for-400">{stats.for}</span>
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">For</span>
          </div>
          <div className="flex flex-col items-center py-4 gap-0.5">
            <span className="text-2xl font-mono font-bold text-against-400">{stats.against}</span>
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">Against</span>
          </div>
          <div className="flex flex-col items-center py-4 gap-0.5">
            <span className="text-2xl font-mono font-bold text-surface-400">{stats.skipped}</span>
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">Skipped</span>
          </div>
        </div>
        {total > 0 && (
          <div className="px-4 pb-4 pt-2">
            <div className="flex justify-between text-[10px] font-mono text-surface-500 mb-1">
              <span className="text-for-400">{forPct}% agreed</span>
              <span className="text-against-400">{100 - forPct}% disagreed</span>
            </div>
            <div className="relative h-2 rounded-full overflow-hidden bg-surface-300">
              <div
                className="absolute inset-y-0 left-0 bg-for-500 rounded-l-full transition-all"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="absolute inset-y-0 right-0 bg-against-500 rounded-r-full transition-all"
                style={{ width: `${100 - forPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Links */}
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-for-600/20 border border-for-600/30 text-for-400 font-mono font-semibold text-sm hover:bg-for-600/30 transition-all"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Start over
        </button>
        <Link
          href="/analytics"
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 font-mono text-sm hover:text-white hover:border-surface-400 transition-all"
        >
          <BarChart2 className="h-4 w-4" aria-hidden />
          View my analytics
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <Link
          href="/"
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 font-mono text-sm hover:text-white hover:border-surface-400 transition-all"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to feed
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SwipeClient() {
  const router = useRouter()

  const [deck, setDeck] = useState<TopicWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [done, setDone] = useState(false)
  const [stats, setStats] = useState<SessionStats>({ for: 0, against: 0, skipped: 0 })
  const [toast, setToast] = useState<{ msg: string; color: 'blue' | 'red' } | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seen = useRef<Set<string>>(new Set())

  const { hasVoted } = useVoteStore()

  // Fetch topics and filter out already-seen ones
  const fetchTopics = useCallback(async (currentOffset: number) => {
    if (fetching) return
    setFetching(true)

    try {
      const params = new URLSearchParams({
        limit: String(BATCH_SIZE),
        offset: String(currentOffset),
        sort: 'hot',
        status: 'active',
      })

      const res = await fetch(`/api/feed?${params.toString()}`)
      if (!res.ok) return

      const fresh = (await res.json()) as TopicWithAuthor[]

      // Filter out already-seen in this session
      const sessionSeen = getSeenIds()
      const newTopics = fresh.filter(
        (t) => !seen.current.has(t.id) && !sessionSeen.has(t.id) && !hasVoted(t.id)
      )

      if (fresh.length < BATCH_SIZE) setHasMore(false)

      setDeck((prev) => [...prev, ...newTopics])
      setOffset(currentOffset + fresh.length)
    } catch {
      // best-effort
    } finally {
      setFetching(false)
      setLoading(false)
    }
  }, [fetching, hasVoted])

  // Initial load
  useEffect(() => {
    fetchTopics(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Prefetch when deck is running low
  useEffect(() => {
    if (!loading && deck.length <= PREFETCH_WHEN_LEFT && hasMore && !fetching) {
      fetchTopics(offset)
    }
  }, [deck.length, loading, hasMore, fetching, fetchTopics, offset])

  const showToast = useCallback((msg: string, color: 'blue' | 'red') => {
    setToast({ msg, color })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1500)
  }, [])

  const advance = useCallback(
    (votedSide: 'blue' | 'red' | 'skip') => {
      setDeck((prev) => {
        if (prev.length === 0) return prev
        const [current, ...rest] = prev
        seen.current.add(current.id)
        addSeenId(current.id)

        if (rest.length === 0 && !hasMore) {
          setDone(true)
        }
        return rest
      })

      if (votedSide === 'blue') {
        setStats((s) => ({ ...s, for: s.for + 1 }))
        showToast('Voted FOR', 'blue')
      } else if (votedSide === 'red') {
        setStats((s) => ({ ...s, against: s.against + 1 }))
        showToast('Voted AGAINST', 'red')
      } else {
        setStats((s) => ({ ...s, skipped: s.skipped + 1 }))
      }
    },
    [hasMore, showToast]
  )

  const handleVote = useCallback((side: 'blue' | 'red') => advance(side), [advance])
  const handleSkip = useCallback(() => advance('skip'), [advance])

  const handleReset = useCallback(() => {
    try { sessionStorage.removeItem(SEEN_KEY) } catch { /* noop */ }
    seen.current = new Set()
    setDeck([])
    setOffset(0)
    setHasMore(true)
    setDone(false)
    setStats({ for: 0, against: 0, skipped: 0 })
    setLoading(true)
    setFetching(false)
    fetchTopics(0)
  }, [fetchTopics])

  const totalVoted = stats.for + stats.against

  return (
    <div className="flex flex-col h-[100dvh] bg-surface-50 overflow-hidden">
      <TopBar />

      {/* Header bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-3 pb-2">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-surface-500 hover:text-white text-sm font-mono transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back
        </button>

        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs font-mono text-surface-500 uppercase tracking-widest">Swipe & Vote</span>
          {!done && totalVoted > 0 && (
            <span className="text-[10px] font-mono text-surface-600">
              {totalVoted} voted · {stats.skipped} skipped
            </span>
          )}
        </div>

        <Link
          href="/positions"
          className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
        >
          My votes
        </Link>
      </div>

      {/* Instructions strip (shown until first vote) */}
      {totalVoted === 0 && !loading && !done && deck.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-shrink-0 flex items-center justify-center gap-5 px-4 pb-2"
        >
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-600">
            <ArrowLeft className="h-3 w-3 text-against-500" aria-hidden />
            <span>Against</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-600">
            <ArrowUp className="h-3 w-3 text-surface-500" aria-hidden />
            <span>Skip</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-600">
            <span>For</span>
            <ArrowRight className="h-3 w-3 text-for-500" aria-hidden />
          </div>
        </motion.div>
      )}

      {/* Card stack area */}
      <div className="flex-1 min-h-0 relative px-4 pb-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="h-8 w-8 text-for-400 animate-spin" aria-hidden />
            <p className="text-sm font-mono text-surface-500">Loading topics…</p>
          </div>
        ) : done ? (
          <SessionSummary stats={stats} onReset={handleReset} />
        ) : deck.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
            <MessageSquare className="h-10 w-10 text-surface-400" aria-hidden />
            <div>
              <p className="text-white font-semibold mb-1">No more topics</p>
              <p className="text-surface-500 text-sm">You&apos;ve seen everything — come back later for fresh debates.</p>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-for-600/20 border border-for-600/30 text-for-400 font-mono font-semibold text-sm hover:bg-for-600/30 transition-all"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Start over
            </button>
          </div>
        ) : (
          <AnimatePresence>
            {deck.slice(0, 3).map((topic, idx) => (
              <SwipeCard
                key={topic.id}
                topic={topic}
                onVote={handleVote}
                onSkip={handleSkip}
                isTop={idx === 0}
                stackIndex={idx}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Toast confirmation */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-50',
              'flex items-center gap-2 px-4 py-2.5 rounded-full font-mono font-semibold text-sm shadow-2xl border',
              toast.color === 'blue'
                ? 'bg-for-700 border-for-500/50 text-for-200'
                : 'bg-against-700 border-against-500/50 text-against-200',
            )}
            aria-live="polite"
          >
            {toast.color === 'blue' ? (
              <ThumbsUp className="h-4 w-4" aria-hidden />
            ) : (
              <ThumbsDown className="h-4 w-4" aria-hidden />
            )}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  )
}
