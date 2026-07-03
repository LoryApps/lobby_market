'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BookOpen, Star } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { ExpertiseTier } from '@/app/api/questions/expertise/[userId]/route'

// ─── Tier display config ──────────────────────────────────────────────────────

const TIER_CONFIG = {
  sage: {
    label: 'Sage',
    chipClass: 'bg-gold/10 border-gold/30 text-gold',
    dotClass: 'bg-gold',
  },
  expert: {
    label: 'Expert',
    chipClass: 'bg-for-500/10 border-for-500/30 text-for-300',
    dotClass: 'bg-for-400',
  },
  contributor: {
    label: 'Contributor',
    chipClass: 'bg-surface-300/30 border-surface-400/40 text-surface-500',
    dotClass: 'bg-surface-500',
  },
} as const

// Show only expert and sage tiers on profiles (contributor is too common to surface)
const VISIBLE_TIERS = new Set<string>(['expert', 'sage'])

// ─── Component ────────────────────────────────────────────────────────────────

interface QAExpertiseBadgesProps {
  userId: string
  /** When true, also show 'contributor' tier badges */
  showAll?: boolean
  className?: string
}

export function QAExpertiseBadges({ userId, showAll = false, className }: QAExpertiseBadgesProps) {
  const [expertise, setExpertise] = useState<ExpertiseTier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetch(`/api/questions/expertise/${userId}`)
      .then((r) => r.ok ? r.json() : { expertise: [] })
      .then((data) => {
        if (!cancelled) setExpertise(data.expertise ?? [])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  const visible = showAll
    ? expertise
    : expertise.filter((e) => VISIBLE_TIERS.has(e.tier))

  if (loading || visible.length === 0) return null

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-surface-600 uppercase tracking-wider">
        <BookOpen className="h-3 w-3" />
        Q&A Expertise
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((e) => {
          const cfg = TIER_CONFIG[e.tier as keyof typeof TIER_CONFIG] ?? TIER_CONFIG.contributor
          return (
            <Link
              key={`${e.tier}-${e.category}`}
              href={`/questions?category=${encodeURIComponent(e.category)}`}
              title={`${e.accepted_count} accepted answer${e.accepted_count !== 1 ? 's' : ''} in ${e.category}`}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border',
                'text-[10px] font-mono font-semibold transition-opacity hover:opacity-80',
                cfg.chipClass
              )}
            >
              <span
                className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', cfg.dotClass)}
                aria-hidden
              />
              {cfg.label}: {e.category}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Inline expert indicator for Q&A threads ─────────────────────────────────

interface ExpertChipProps {
  category: string
  tier: 'expert' | 'sage'
  className?: string
}

export function ExpertChip({ category, tier, className }: ExpertChipProps) {
  const cfg = TIER_CONFIG[tier]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border',
        'text-[9px] font-mono font-semibold flex-shrink-0',
        cfg.chipClass,
        className
      )}
      title={`${cfg.label} in ${category}`}
    >
      <Star className="h-2.5 w-2.5" aria-hidden />
      {cfg.label}
    </span>
  )
}
