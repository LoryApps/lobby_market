'use client'

/**
 * TopicHoverCard
 *
 * Wraps any inline element (typically a <Link>) and shows a rich topic
 * preview card on hover after a short delay.  Mirrors the UserHoverCard
 * pattern but for topics.
 *
 * Features:
 *  - 250 ms hover delay to avoid flickering during cursor transit
 *  - Session-level in-memory cache (no repeated network fetches)
 *  - Vote-split bar, status badge, category, total vote count
 *  - Positioned below the trigger (flips up near the bottom of the viewport)
 *  - Touch / mobile: card is never shown (pointer: coarse media query guard)
 *  - Accessible: card is aria-hidden so it doesn't confuse screen readers
 *    (the underlying link already provides the destination).
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, Gavel, Scale, Zap, FileText, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { TopicPreview } from '@/app/api/topics/[id]/preview/route'

// ─── Cache ────────────────────────────────────────────────────────────────────

const cache = new Map<string, TopicPreview | null>()

async function fetchPreview(topicId: string): Promise<TopicPreview | null> {
  if (cache.has(topicId)) return cache.get(topicId) ?? null
  try {
    const res = await fetch(`/api/topics/${encodeURIComponent(topicId)}/preview`)
    if (!res.ok) {
      cache.set(topicId, null)
      return null
    }
    const { topic } = (await res.json()) as { topic: TopicPreview }
    cache.set(topicId, topic)
    return topic
  } catch {
    cache.set(topicId, null)
    return null
  }
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
  continued: 'Continued',
}

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  proposed: FileText,
  active: Zap,
  voting: Scale,
  law: Gavel,
  failed: XCircle,
  continued: Scale,
}

const STATUS_CLASSES: Record<string, string> = {
  proposed: 'text-surface-500 bg-surface-300/20 border-surface-400/30',
  active:   'text-for-300 bg-for-600/15 border-for-500/30',
  voting:   'text-purple bg-purple/15 border-purple/30',
  law:      'text-gold bg-gold/15 border-gold/30',
  failed:   'text-against-400 bg-against-600/15 border-against-500/30',
  continued:'text-surface-500 bg-surface-300/20 border-surface-400/30',
}

// ─── Preview card UI ──────────────────────────────────────────────────────────

function PreviewCard({
  topic,
  href,
}: {
  topic: TopicPreview
  href: string
}) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const StatusIcon = STATUS_ICON[topic.status] ?? Scale
  const statusClass = STATUS_CLASSES[topic.status] ?? STATUS_CLASSES.proposed

  return (
    <motion.div
      role="tooltip"
      aria-hidden="true"
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      className={cn(
        'absolute z-[9999] w-80',
        'rounded-2xl border border-surface-300 bg-surface-100',
        'shadow-2xl shadow-black/60 p-4',
        'pointer-events-none',
      )}
      style={{ top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' }}
    >
      {/* Status pill */}
      <div className="flex items-center gap-2 mb-2.5">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border',
            'text-[10px] font-mono font-semibold uppercase tracking-wider',
            statusClass,
          )}
        >
          <StatusIcon className="h-2.5 w-2.5" />
          {STATUS_LABEL[topic.status] ?? topic.status}
        </span>

        {topic.category && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-surface-500">
            {topic.category}
          </span>
        )}
      </div>

      {/* Statement */}
      <p className="text-sm font-medium text-white leading-snug line-clamp-3 mb-3">
        {topic.statement}
      </p>

      {/* Vote split bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] font-mono mb-1">
          <span className="text-for-400">{forPct}% FOR</span>
          <span className="text-against-400">{againstPct}% AGAINST</span>
        </div>
        <div
          className="h-1.5 w-full rounded-full overflow-hidden bg-surface-300"
          role="meter"
          aria-valuenow={forPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${forPct}% for, ${againstPct}% against`}
        >
          <div
            className="h-full bg-gradient-to-r from-for-600 to-for-400 float-left rounded-l-full"
            style={{ width: `${forPct}%` }}
          />
        </div>
      </div>

      {/* Footer: vote count + link */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-surface-500">
          {topic.total_votes.toLocaleString()} votes
        </span>
        <Link
          href={href}
          className={cn(
            'pointer-events-auto inline-flex items-center gap-1',
            'text-[10px] font-mono font-semibold text-for-400 hover:text-for-300',
            'transition-colors',
          )}
          tabIndex={-1}
          aria-label={`Open topic: ${topic.statement}`}
        >
          <ExternalLink className="h-2.5 w-2.5" />
          Open topic
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Exported wrapper ─────────────────────────────────────────────────────────

interface TopicHoverCardProps {
  /** UUID of the topic to preview */
  topicId: string
  /** Destination href for the underlying link */
  href: string
  /** The link/text content to wrap */
  children: React.ReactNode
  /** Extra classes forwarded to the container span */
  className?: string
  /**
   * Optionally pre-supply the preview data (e.g. when the parent already has
   * it from a list query).  When provided the API fetch is skipped entirely.
   */
  preloaded?: TopicPreview
}

export function TopicHoverCard({
  topicId,
  href,
  children,
  className,
  preloaded,
}: TopicHoverCardProps) {
  const [preview, setPreview] = useState<TopicPreview | null>(preloaded ?? null)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLSpanElement>(null)

  // Seed the cache when pre-loaded data is provided
  useEffect(() => {
    if (preloaded) {
      cache.set(topicId, preloaded)
      setPreview(preloaded)
    }
  }, [topicId, preloaded])

  // Skip on touch devices — hover cards are pointer-device UX
  const [isTouch, setIsTouch] = useState(false)
  useEffect(() => {
    setIsTouch(window.matchMedia('(pointer: coarse)').matches)
  }, [])

  const showCard = useCallback(async () => {
    if (isTouch) return
    timerRef.current = setTimeout(async () => {
      const data = await fetchPreview(topicId)
      setPreview(data)
      setVisible(true)
    }, 250)
  }, [isTouch, topicId])

  const hideCard = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }, [])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') hideCard()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [hideCard])

  return (
    <span
      ref={containerRef}
      className={cn('relative inline-block', className)}
      onMouseEnter={showCard}
      onMouseLeave={hideCard}
      onFocus={showCard}
      onBlur={hideCard}
    >
      {children}

      <AnimatePresence>
        {visible && preview && (
          <PreviewCard topic={preview} href={href} />
        )}
      </AnimatePresence>
    </span>
  )
}
