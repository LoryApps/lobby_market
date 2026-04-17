'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { HelpCircle, Lock, ArrowRight, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { AchievementTier } from '@/lib/supabase/types'
import type { AchievementProgress, AchievementProgressResponse } from '@/app/api/achievements/progress/route'

// ─── Icon resolver ────────────────────────────────────────────────────────────

function resolveIcon(name: string): LucideIcon {
  const map = Icons as unknown as Record<string, LucideIcon>
  return map[name] ?? HelpCircle
}

// ─── Tier styles ──────────────────────────────────────────────────────────────

const TIER_STYLES: Record<
  AchievementTier,
  { border: string; bg: string; text: string; bar: string; label: string; glow: string }
> = {
  common: {
    border: 'border-surface-400/50',
    bg: 'bg-surface-200/60',
    text: 'text-surface-400',
    bar: 'bg-surface-400',
    label: 'Common',
    glow: '',
  },
  rare: {
    border: 'border-for-500/40',
    bg: 'bg-for-500/10',
    text: 'text-for-400',
    bar: 'bg-for-500',
    label: 'Rare',
    glow: '',
  },
  epic: {
    border: 'border-purple/40',
    bg: 'bg-purple/10',
    text: 'text-purple',
    bar: 'bg-purple',
    label: 'Epic',
    glow: '',
  },
  legendary: {
    border: 'border-gold/50',
    bg: 'bg-gold/10',
    text: 'text-gold',
    bar: 'bg-gold',
    label: 'Legendary',
    glow: 'shadow-gold/20 shadow-sm',
  },
}

// ─── Action hint ──────────────────────────────────────────────────────────────

function actionHint(type: string, remaining: number): string {
  switch (type) {
    case 'total_votes':
      return `Cast ${remaining.toLocaleString()} more vote${remaining !== 1 ? 's' : ''}`
    case 'topics_authored':
      return `Propose ${remaining} more topic${remaining !== 1 ? 's' : ''}`
    case 'laws_authored':
      return `Get ${remaining} more topic${remaining !== 1 ? 's' : ''} passed into law`
    case 'vote_streak':
      return `Vote for ${remaining} more consecutive day${remaining !== 1 ? 's' : ''}`
    case 'minority_wins':
      return `Win ${remaining} more minority position${remaining !== 1 ? 's' : ''}`
    case 'chain_depth':
      return `Reach chain depth ${remaining} in a topic chain`
    case 'signup_rank':
      return 'Available to early members only'
    default:
      return `${remaining} more needed`
  }
}

// ─── Single card ─────────────────────────────────────────────────────────────

function ProgressCard({ item, index }: { item: AchievementProgress; index: number }) {
  const s = TIER_STYLES[item.tier]
  const Icon = resolveIcon(item.icon)
  const hint = actionHint(item.criteriaType, item.remaining)
  const isLocked = item.pct === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'rounded-2xl border p-4 flex items-start gap-3.5 transition-all',
        s.border,
        s.bg,
        s.glow,
        isLocked && 'opacity-60'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center rounded-xl w-11 h-11 border',
          s.border,
          'bg-surface-100/60'
        )}
      >
        {isLocked
          ? <Lock className={cn('h-5 w-5', s.text)} />
          : <Icon className={cn('h-5 w-5', s.text)} />
        }
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-white truncate">{item.name}</span>
          <span className={cn('text-[10px] font-mono uppercase tracking-wide flex-shrink-0', s.text)}>
            {s.label}
          </span>
        </div>
        <p className="text-xs text-surface-500 font-mono leading-relaxed mb-2.5 line-clamp-1">
          {item.description}
        </p>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-surface-500">
              {item.criteriaType === 'signup_rank'
                ? 'Not available'
                : `${item.current.toLocaleString()} / ${item.threshold.toLocaleString()}`
              }
            </span>
            <span className={cn('text-[11px] font-mono font-semibold', s.text)}>
              {item.pct}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300/50 overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', s.bar)}
              initial={{ width: 0 }}
              animate={{ width: `${item.pct}%` }}
              transition={{ duration: 0.6, delay: index * 0.05 + 0.1, ease: 'easeOut' }}
            />
          </div>
          <p className="text-[10px] font-mono text-surface-600">{hint}</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface NextAchievementsPanelProps {
  /** If true, fetches data. Only show for profile owner. */
  userId: string
  /** Limit how many cards to render (default 3) */
  limit?: number
  className?: string
}

export function NextAchievementsPanel({
  userId,
  limit = 3,
  className,
}: NextAchievementsPanelProps) {
  const [data, setData] = useState<AchievementProgressResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/achievements/progress')
      .then((r) => r.ok ? r.json() : null)
      .then((d: AchievementProgressResponse | null) => {
        if (!cancelled) {
          setData(d)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [userId])

  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: limit }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-surface-300 bg-surface-100 p-4 h-[104px] animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (!data || data.inProgress.length === 0) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center',
          className
        )}
      >
        <Trophy className="h-8 w-8 text-gold mx-auto mb-3" />
        <p className="text-sm font-mono text-white font-semibold">All achievements earned!</p>
        <p className="text-xs font-mono text-surface-500 mt-1">
          You&rsquo;ve mastered the Lobby. Check back for new challenges.
        </p>
      </div>
    )
  }

  const shown = data.inProgress.slice(0, limit)

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-sm font-semibold text-white">Next up</h3>
          <p className="text-[11px] font-mono text-surface-500 mt-0.5">
            {data.earnedCount} of {data.totalCount} achievements earned
          </p>
        </div>
        <Link
          href="/achievements"
          className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
        >
          All achievements
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Progress bar summary */}
      <div className="h-1.5 rounded-full bg-surface-300/50 overflow-hidden mb-3">
        <div
          className="h-full rounded-full bg-gradient-to-r from-for-500 to-gold transition-all duration-700"
          style={{ width: `${Math.round((data.earnedCount / data.totalCount) * 100)}%` }}
        />
      </div>

      {/* Cards */}
      {shown.map((item, i) => (
        <ProgressCard key={item.id} item={item} index={i} />
      ))}
    </div>
  )
}
