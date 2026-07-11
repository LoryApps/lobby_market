'use client'

/**
 * /delegate/inbox — Mirror-Vote Inbox
 *
 * A dedicated action centre for liquid democracy: shows every topic where
 * one of your delegates has already voted but you haven't yet. You can:
 *   • Mirror — cast the same vote as your delegate in one tap
 *   • Skip   — hide the topic for this session
 *   • Open   — read the full topic before deciding
 *
 * Organises pending items by category, shows delegation scope labels
 * ("global delegate", "Economics delegate", "topic delegate"), and
 * surfaces a "Mirror All" batch action when the list is manageable.
 *
 * Distinct from:
 *   /daily         — includes pending mirrors as one section among many
 *   /delegate      — manages which delegations exist (add/revoke)
 *   /delegate/guide — one-time onboarding wizard
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ExternalLink,
  Inbox,
  Loader2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { haptics } from '@/lib/hooks/useHaptics'
import { cn } from '@/lib/utils/cn'
import type { PendingMirrorTopic, PendingMirrorsResponse } from '@/app/api/me/pending-mirrors/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30' },
  Science:     { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Ethics:      { text: 'text-for-300',      bg: 'bg-for-300/10',      border: 'border-for-300/30' },
  Philosophy:  { text: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30' },
  Culture:     { text: 'text-against-300',  bg: 'bg-against-400/10',  border: 'border-against-400/30' },
  Health:      { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Education:   { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' },
}

function catStyle(category: string | null) {
  return category
    ? (CATEGORY_STYLE[category] ?? { text: 'text-surface-400', bg: 'bg-surface-200', border: 'border-surface-300' })
    : { text: 'text-surface-400', bg: 'bg-surface-200', border: 'border-surface-300' }
}

function scopeLabel(scope: 'topic' | 'category' | 'global', category: string | null) {
  if (scope === 'topic') return 'topic delegate'
  if (scope === 'category') return `${category} delegate`
  return 'global delegate'
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function InboxSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-3 w-3/4 rounded" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Skeleton className="h-9 flex-1 rounded-xl" />
            <Skeleton className="h-9 flex-1 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Vote bar mini ─────────────────────────────────────────────────────────────

function VoteBarMini({ bluePct }: { bluePct: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono">
      <span className="text-for-400">{forPct}%</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-300">
        <div
          className="h-full bg-for-500 rounded-full"
          style={{ width: `${forPct}%` }}
        />
      </div>
      <span className="text-against-400">{againstPct}%</span>
    </div>
  )
}

// ─── Single inbox card ────────────────────────────────────────────────────────

interface MirrorCardProps {
  topic: PendingMirrorTopic
  onMirrored: (topicId: string) => void
  onSkipped: (topicId: string) => void
}

function MirrorCard({ topic, onMirrored, onSkipped }: MirrorCardProps) {
  const [mirroring, setMirroring] = useState(false)
  const [done, setDone] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const displayName = topic.delegateDisplayName || `@${topic.delegateUsername}`
  const isFor = topic.delegateSide === 'blue'
  const cs = catStyle(topic.category)
  const scope = scopeLabel(topic.delegationScope, topic.category)

  async function mirror() {
    if (mirroring || done) return
    setMirroring(true)
    haptics.voteFor()
    try {
      const res = await fetch(`/api/topics/${topic.topicId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side: topic.delegateSide }),
      })
      if (res.ok) {
        setDone(true)
        setTimeout(() => onMirrored(topic.topicId), 800)
      }
    } catch {
      // noop — user can retry
    } finally {
      setMirroring(false)
    }
  }

  function skip() {
    setSkipped(true)
    haptics.dismiss()
    setTimeout(() => onSkipped(topic.topicId), 400)
  }

  return (
    <AnimatePresence>
      {!skipped && (
        <motion.div
          layout
          initial={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97, y: -4 }}
          transition={{ duration: 0.3 }}
          className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3"
        >
          {/* Delegate header */}
          <div className="flex items-center gap-2.5">
            <Link href={`/profile/${topic.delegateUsername}`}>
              <Avatar
                src={topic.delegateAvatarUrl}
                fallback={displayName}
                size="xs"
                className="ring-1 ring-surface-400"
              />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-surface-500">
                Your{' '}
                <span className="text-purple font-medium">{scope}</span>{' '}
                voted{' '}
                <span
                  className={cn(
                    'font-semibold',
                    isFor ? 'text-for-400' : 'text-against-400',
                  )}
                >
                  {isFor ? 'FOR' : 'AGAINST'}
                </span>
              </p>
              <Link
                href={`/profile/${topic.delegateUsername}`}
                className="text-[11px] text-surface-400 hover:text-white transition-colors"
              >
                @{topic.delegateUsername}
              </Link>
            </div>
            {topic.category && (
              <span
                className={cn(
                  'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                  cs.text,
                  cs.bg,
                  cs.border,
                )}
              >
                {topic.category}
              </span>
            )}
          </div>

          {/* Topic statement */}
          <div>
            <p className="text-sm text-white font-medium leading-snug line-clamp-2">
              {topic.statement}
            </p>
            <div className="mt-2">
              <VoteBarMini bluePct={topic.bluePct} />
            </div>
            <p className="text-[10px] text-surface-500 mt-1">
              {topic.totalVotes.toLocaleString()} votes cast
            </p>
          </div>

          {/* Actions */}
          {done ? (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold',
                isFor
                  ? 'bg-for-600/20 border border-for-600/30 text-for-400'
                  : 'bg-against-600/20 border border-against-600/30 text-against-400',
              )}
            >
              <Check className="h-4 w-4" />
              Mirrored — voted {isFor ? 'FOR' : 'AGAINST'}
            </motion.div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={mirror}
                disabled={mirroring}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5',
                  'text-xs font-semibold border transition-all',
                  isFor
                    ? 'bg-for-600/20 border-for-600/40 text-for-400 hover:bg-for-600/30'
                    : 'bg-against-600/20 border-against-600/40 text-against-400 hover:bg-against-600/30',
                  'disabled:opacity-60',
                )}
              >
                {mirroring ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isFor ? (
                  <ThumbsUp className="h-3.5 w-3.5" />
                ) : (
                  <ThumbsDown className="h-3.5 w-3.5" />
                )}
                Mirror {isFor ? 'FOR' : 'AGAINST'}
              </button>

              <Link
                href={`/topic/${topic.topicId}`}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5',
                  'text-xs font-semibold border border-surface-400 text-surface-400',
                  'hover:border-surface-300 hover:text-white transition-all',
                )}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Read topic
              </Link>

              <button
                onClick={skip}
                aria-label="Skip this topic"
                className={cn(
                  'rounded-xl px-3 py-2.5 border border-surface-400 text-surface-500',
                  'hover:border-surface-300 hover:text-white transition-all',
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Category section ─────────────────────────────────────────────────────────

function CategorySection({
  category,
  topics,
  onMirrored,
  onSkipped,
}: {
  category: string
  topics: PendingMirrorTopic[]
  onMirrored: (id: string) => void
  onSkipped: (id: string) => void
}) {
  const cs = catStyle(category !== 'Uncategorised' ? category : null)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'text-xs font-semibold px-2.5 py-1 rounded-full border',
            cs.text,
            cs.bg,
            cs.border,
          )}
        >
          {category}
        </span>
        <span className="text-[11px] text-surface-500">
          {topics.length} pending
        </span>
      </div>
      <div className="space-y-3">
        {topics.map((t) => (
          <MirrorCard
            key={t.topicId}
            topic={t}
            onMirrored={onMirrored}
            onSkipped={onSkipped}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function DelegateInboxClient() {
  const router = useRouter()
  const [topics, setTopics] = useState<PendingMirrorTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mirroringAll, setMirroringAll] = useState(false)
  const [allMirrored, setAllMirrored] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/me/pending-mirrors', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const data = (await res.json()) as PendingMirrorsResponse
      setTopics(data.topics)
    } catch {
      setError('Could not load your delegate inbox. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleMirrored = useCallback((topicId: string) => {
    setTopics((prev) => prev.filter((t) => t.topicId !== topicId))
  }, [])

  const handleSkipped = useCallback((topicId: string) => {
    setTopics((prev) => prev.filter((t) => t.topicId !== topicId))
  }, [])

  async function mirrorAll() {
    if (mirroringAll) return
    setMirroringAll(true)
    haptics.success()
    try {
      await Promise.allSettled(
        topics.map((t) =>
          fetch(`/api/topics/${t.topicId}/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ side: t.delegateSide }),
          })
        )
      )
      setAllMirrored(true)
      setTimeout(() => setTopics([]), 1200)
    } finally {
      setMirroringAll(false)
    }
  }

  // Group by category
  const grouped = topics.reduce<Record<string, PendingMirrorTopic[]>>((acc, t) => {
    const key = t.category ?? 'Uncategorised'
    ;(acc[key] ??= []).push(t)
    return acc
  }, {})
  const categories = Object.keys(grouped).sort()

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="mt-1 p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-purple" />
              <h1 className="text-xl font-bold text-white">Delegate Inbox</h1>
              {topics.length > 0 && (
                <span className="text-xs font-mono font-bold text-white bg-purple/80 border border-purple/50 px-2 py-0.5 rounded-full">
                  {topics.length}
                </span>
              )}
            </div>
            <p className="text-sm text-surface-500 mt-0.5">
              Topics your delegates voted on — mirror or decide for yourself.
            </p>
          </div>
        </div>

        {/* Action bar */}
        {!loading && topics.length > 1 && !allMirrored && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-2xl border border-surface-300 bg-surface-100 p-3 mb-6"
          >
            <div className="flex-1">
              <p className="text-xs text-surface-400">
                <span className="text-white font-semibold">{topics.length} pending</span> mirror votes
              </p>
              <p className="text-[11px] text-surface-600">Trust your delegates and mirror all at once</p>
            </div>
            <Button
              size="sm"
              variant="for"
              onClick={mirrorAll}
              disabled={mirroringAll}
              className="gap-1.5 flex-shrink-0"
            >
              {mirroringAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5" />
              )}
              Mirror All
            </Button>
          </motion.div>
        )}

        {/* All-mirrored celebration */}
        <AnimatePresence>
          {allMirrored && topics.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="flex items-center gap-3 rounded-2xl border border-emerald/30 bg-emerald/10 p-4 mb-6"
            >
              <Check className="h-5 w-5 text-emerald flex-shrink-0" />
              <p className="text-sm text-emerald font-medium">All votes mirrored — inbox clear.</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {loading ? (
          <InboxSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 text-center">
            <p className="text-surface-400 text-sm mb-3">{error}</p>
            <Button size="sm" variant="ghost" onClick={load} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </Button>
          </div>
        ) : topics.length === 0 && !allMirrored ? (
          <EmptyState
            icon={Inbox}
            title="Inbox is clear"
            description="Your delegates haven't voted on any new topics yet, or you've already voted on all the topics they've covered."
            action={
              <div className="flex flex-col items-center gap-2 mt-2">
                <Link href="/delegate">
                  <Button size="sm" variant="ghost" className="gap-1.5">
                    <UserCheck className="h-3.5 w-3.5" />
                    Manage delegations
                  </Button>
                </Link>
                <Link href="/delegate/guide">
                  <Button size="sm" variant="ghost" className="gap-1.5 text-purple">
                    <Zap className="h-3.5 w-3.5" />
                    Find a delegate
                  </Button>
                </Link>
              </div>
            }
          />
        ) : (
          <div className="space-y-8">
            {categories.map((cat) => (
              <CategorySection
                key={cat}
                category={cat}
                topics={grouped[cat]}
                onMirrored={handleMirrored}
                onSkipped={handleSkipped}
              />
            ))}
          </div>
        )}

        {/* Footer links */}
        {!loading && (
          <div className="mt-8 pt-6 border-t border-surface-300 flex flex-wrap gap-3 justify-center">
            <Link
              href="/delegate"
              className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
            >
              <UserCheck className="h-3.5 w-3.5" />
              Manage delegations
            </Link>
            <Link
              href="/delegate/history"
              className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
            >
              <Scale className="h-3.5 w-3.5" />
              Delegation history
            </Link>
            <Link
              href="/leaderboard/delegates"
              className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Delegate rankings
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
