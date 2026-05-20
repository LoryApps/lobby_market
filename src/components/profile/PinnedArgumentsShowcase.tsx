'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowUpRight,
  ChevronUp,
  Loader2,
  Pin,
  PinOff,
  Star,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { PinnedArgumentEntry } from '@/app/api/profile/pinned-arguments/route'

// ─── Grade badge ──────────────────────────────────────────────────────────────

const GRADE_COLOR: Record<string, string> = {
  'A+': 'text-emerald border-emerald/40 bg-emerald/10',
  A:   'text-emerald border-emerald/40 bg-emerald/10',
  'A-': 'text-emerald border-emerald/30 bg-emerald/8',
  'B+': 'text-for-300 border-for-400/40 bg-for-500/10',
  B:   'text-for-300 border-for-400/40 bg-for-500/10',
  'B-': 'text-for-300 border-for-400/30 bg-for-500/8',
  'C+': 'text-gold border-gold/40 bg-gold/10',
  C:   'text-gold border-gold/40 bg-gold/10',
  'C-': 'text-gold border-gold/30 bg-gold/8',
}

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null
  const cls = GRADE_COLOR[grade] ?? 'text-surface-400 border-surface-500/30 bg-surface-300/20'
  return (
    <span className={cn('text-[10px] font-mono font-bold border rounded px-1.5 py-0.5 flex-shrink-0', cls)}>
      {grade}
    </span>
  )
}

// ─── Individual pin card ──────────────────────────────────────────────────────

function PinCard({
  entry,
  isOwner,
  onUnpin,
}: {
  entry: PinnedArgumentEntry
  isOwner: boolean
  onUnpin: (argumentId: string) => void
}) {
  const { argument } = entry
  const topic = argument.topic
  const isFor = argument.side === 'blue'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={cn(
        'rounded-xl border p-4 space-y-3 group relative overflow-hidden',
        isFor
          ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/40'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/40',
        'transition-colors',
      )}
    >
      {/* Position indicator */}
      <div
        className={cn(
          'absolute top-0 left-0 h-full w-0.5 rounded-l-xl',
          isFor ? 'bg-for-500/40' : 'bg-against-500/40',
        )}
      />

      {/* Header: side pill + grade + unpin */}
      <div className="flex items-center gap-2 pl-1">
        <span
          className={cn(
            'text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
            isFor
              ? 'text-for-300 bg-for-500/15 border-for-500/30'
              : 'text-against-300 bg-against-500/15 border-against-500/30',
          )}
        >
          {isFor ? 'FOR' : 'AGAINST'}
        </span>

        <GradeBadge grade={argument.ai_grade} />

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs font-mono text-surface-500">
            <ChevronUp className="h-3.5 w-3.5" />
            <span>{argument.upvotes}</span>
          </div>

          {isOwner && (
            <button
              onClick={() => onUnpin(argument.id)}
              title="Remove from spotlight"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-500 hover:text-against-400"
            >
              <PinOff className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Argument content */}
      <p className="text-sm font-mono text-surface-300 leading-relaxed line-clamp-3 pl-1">
        {argument.content}
      </p>

      {/* Topic link */}
      {topic && (
        <Link
          href={`/topic/${topic.id}`}
          className="flex items-center gap-1.5 pl-1 group/link"
        >
          <span className="text-[11px] font-mono text-surface-500 group-hover/link:text-surface-300 line-clamp-1 flex-1 transition-colors">
            {topic.statement}
          </span>
          <ArrowUpRight className="h-3 w-3 text-surface-600 group-hover/link:text-surface-400 flex-shrink-0 transition-colors" />
        </Link>
      )}
    </motion.div>
  )
}

// ─── Empty slot ───────────────────────────────────────────────────────────────

function EmptySlot({ slot }: { slot: number }) {
  return (
    <div className="rounded-xl border border-dashed border-surface-400/40 p-4 flex items-center justify-center h-28">
      <span className="text-xs font-mono text-surface-600">
        Slot {slot} — pin an argument from the thread
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PinnedArgumentsShowcaseProps {
  username: string
  isOwner: boolean
}

export function PinnedArgumentsShowcase({ username, isOwner }: PinnedArgumentsShowcaseProps) {
  const [pins, setPins] = useState<PinnedArgumentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [unpinning, setUnpinning] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = isOwner
        ? '/api/profile/pinned-arguments'
        : `/api/users/pinned-arguments?username=${encodeURIComponent(username)}`
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json() as { pins: PinnedArgumentEntry[] }
        setPins(data.pins)
      }
    } catch {
      // non-critical
    } finally {
      setLoading(false)
    }
  }, [username, isOwner])

  useEffect(() => { load() }, [load])

  const handleUnpin = useCallback(async (argumentId: string) => {
    setUnpinning(argumentId)
    try {
      const res = await fetch('/api/profile/pinned-arguments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ argument_id: argumentId, action: 'unpin' }),
      })
      if (res.ok) {
        setPins((prev) => prev.filter((p) => p.argument_id !== argumentId))
      }
    } catch {
      // non-critical
    } finally {
      setUnpinning(null)
    }
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Pin className="h-4 w-4 text-gold" />
          <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">Argument Spotlight</span>
        </div>
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl bg-surface-200/50 h-28 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // Don't render empty spotlight for non-owners
  if (!isOwner && pins.length === 0) return null

  const filledSlots = pins.length
  const emptySlots = isOwner ? Math.max(0, 1 - filledSlots) : 0

  return (
    <div className="rounded-2xl border border-gold/20 bg-surface-100 p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gold/10 border border-gold/20 flex-shrink-0">
          <Star className="h-3.5 w-3.5 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-mono font-semibold text-white">Argument Spotlight</h3>
          <p className="text-[10px] font-mono text-surface-500">
            {isOwner
              ? `${filledSlots}/3 pinned — pin your best arguments from any debate`
              : `${filledSlots} pinned argument${filledSlots !== 1 ? 's' : ''}`}
          </p>
        </div>
        {unpinning && (
          <Loader2 className="h-3.5 w-3.5 text-surface-500 animate-spin flex-shrink-0" />
        )}
      </div>

      {/* Pin cards */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {pins.map((pin) => (
            <PinCard
              key={pin.id}
              entry={pin}
              isOwner={isOwner}
              onUnpin={handleUnpin}
            />
          ))}
        </AnimatePresence>

        {/* Empty slots for owner */}
        {isOwner && emptySlots > 0 && pins.length === 0 && (
          <EmptySlot slot={1} />
        )}
      </div>

      {isOwner && (
        <p className="mt-4 text-[10px] font-mono text-surface-600 text-center">
          Open any argument you wrote and tap{' '}
          <Pin className="h-3 w-3 inline text-gold" />{' '}
          to pin it here
        </p>
      )}
    </div>
  )
}
