'use client'

/**
 * AlignmentBadge
 *
 * Displays a "civic alignment" percentage between the logged-in viewer and
 * another user's profile.  Lazy-fetches from /api/analytics/alignment on
 * mount; silently renders nothing on error or insufficient data.
 *
 * Color coding:
 *   ≥ 70 %  → blue  ("Aligned")
 *   40–69 % → neutral/gold ("Mixed")
 *   < 40 %  → red   ("Opposed")
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { AlignmentResponse } from '@/app/api/analytics/alignment/route'

interface AlignmentBadgeProps {
  targetId: string
  className?: string
}

type AlignmentTier = 'aligned' | 'mixed' | 'opposed'

function getTier(pct: number): AlignmentTier {
  if (pct >= 70) return 'aligned'
  if (pct >= 40) return 'mixed'
  return 'opposed'
}

const TIER_STYLES: Record<
  AlignmentTier,
  { label: string; border: string; bg: string; text: string; dot: string }
> = {
  aligned: {
    label: 'Aligned',
    border: 'border-for-500/40',
    bg: 'bg-for-500/10',
    text: 'text-for-400',
    dot: 'bg-for-500',
  },
  mixed: {
    label: 'Mixed',
    border: 'border-gold/40',
    bg: 'bg-gold/10',
    text: 'text-gold',
    dot: 'bg-gold',
  },
  opposed: {
    label: 'Opposed',
    border: 'border-against-500/40',
    bg: 'bg-against-500/10',
    text: 'text-against-400',
    dot: 'bg-against-500',
  },
}

// Session cache so revisiting profiles doesn't refetch.
const cache = new Map<string, AlignmentResponse | null>()

export function AlignmentBadge({ targetId, className }: AlignmentBadgeProps) {
  const [data, setData] = useState<AlignmentResponse | null>(
    cache.has(targetId) ? (cache.get(targetId) ?? null) : null
  )
  const [loading, setLoading] = useState(!cache.has(targetId))

  useEffect(() => {
    if (cache.has(targetId)) return

    let cancelled = false
    setLoading(true)

    fetch(`/api/analytics/alignment?target_id=${encodeURIComponent(targetId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: AlignmentResponse | null) => {
        if (cancelled) return
        cache.set(targetId, json)
        setData(json)
      })
      .catch(() => {
        if (!cancelled) cache.set(targetId, null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [targetId])

  // Nothing to show — insufficient data or error.
  if (loading) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
          'border border-surface-400/30 bg-surface-300/20',
          'text-[11px] font-mono text-surface-600',
          'animate-pulse',
          className
        )}
        aria-label="Loading civic alignment"
      >
        <Users className="h-3 w-3" />
        <span>— %</span>
      </div>
    )
  }

  if (
    !data ||
    data.agreement_pct === null ||
    !data.viewer_has_votes
  ) {
    return null
  }

  const pct = data.agreement_pct
  const tier = getTier(pct)
  const style = TIER_STYLES[tier]
  const common = data.common_topics

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border',
        'text-[11px] font-mono font-semibold',
        style.bg,
        style.border,
        style.text,
        className
      )}
      title={`You and this user agree on ${pct}% of ${common} shared topic${common !== 1 ? 's' : ''}`}
      aria-label={`Civic alignment: ${pct}% on ${common} shared topics`}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', style.dot)}
        aria-hidden="true"
      />
      <Users className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
      <span>{pct}% {style.label}</span>
    </motion.div>
  )
}
