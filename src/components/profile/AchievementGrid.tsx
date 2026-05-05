'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bookmark,
  Coins,
  HelpCircle,
  Landmark,
  Mic,
  Star,
  Swords,
  ThumbsUp,
  Users,
} from 'lucide-react'
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Achievement, AchievementTier } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface AchievementGridProps {
  earnedAchievementIds: string[]
  allAchievements: Achievement[]
}

// ─── Tier styles ─────────────────────────────────────────────────────────────

const tierStyles: Record<
  AchievementTier,
  { border: string; bg: string; text: string; label: string; glow: string }
> = {
  common: {
    border: 'border-surface-400/50',
    bg: 'bg-surface-200/50',
    text: 'text-surface-400',
    label: 'Common',
    glow: '',
  },
  rare: {
    border: 'border-for-500/60',
    bg: 'bg-for-500/10',
    text: 'text-for-400',
    label: 'Rare',
    glow: 'shadow-[0_0_12px_rgba(59,130,246,0.2)]',
  },
  epic: {
    border: 'border-purple/60',
    bg: 'bg-purple/10',
    text: 'text-purple',
    label: 'Epic',
    glow: 'shadow-[0_0_12px_rgba(139,92,246,0.25)]',
  },
  legendary: {
    border: 'border-gold/70',
    bg: 'bg-gold/10',
    text: 'text-gold',
    label: 'Legendary',
    glow: 'shadow-[0_0_16px_rgba(201,168,76,0.3)]',
  },
}

// ─── Category config ──────────────────────────────────────────────────────────

interface CategoryConfig {
  label: string
  Icon: LucideIcon
  accent: string
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  voter:      { label: 'Voter',      Icon: ThumbsUp,  accent: 'text-for-400' },
  orator:     { label: 'Orator',     Icon: Mic,       accent: 'text-purple' },
  scholar:    { label: 'Scholar',    Icon: Bookmark,  accent: 'text-emerald' },
  economist:  { label: 'Economist',  Icon: Coins,     accent: 'text-gold' },
  strategist: { label: 'Strategist', Icon: Swords,    accent: 'text-against-400' },
  citizen:    { label: 'Citizen',    Icon: Users,     accent: 'text-cyan-400' },
  general:    { label: 'General',    Icon: Star,      accent: 'text-surface-400' },
}

const CATEGORY_ORDER = ['voter', 'orator', 'scholar', 'economist', 'strategist', 'citizen', 'general']

const tierWeight: Record<AchievementTier, number> = {
  legendary: 0,
  epic: 1,
  rare: 2,
  common: 3,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveIcon(name: string): LucideIcon {
  const iconMap = Icons as unknown as Record<string, LucideIcon>
  return iconMap[name] ?? HelpCircle
}

// ─── AchievementCard ─────────────────────────────────────────────────────────

function AchievementCard({
  achievement,
  earned,
  idx,
}: {
  achievement: Achievement
  earned: boolean
  idx: number
}) {
  const [showTooltip, setShowTooltip] = useState(false)
  const style = tierStyles[achievement.tier as AchievementTier] ?? tierStyles.common
  const Icon = earned ? resolveIcon(achievement.icon) : HelpCircle

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.025, 0.5) }}
      className={cn(
        'group relative rounded-2xl p-4 border-2 transition cursor-default select-none',
        earned ? style.border : 'border-surface-300',
        earned ? style.bg : 'bg-surface-100 opacity-50 grayscale',
        earned && style.glow,
        'hover:scale-[1.03] hover:z-10'
      )}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex flex-col items-center text-center gap-2">
        <div
          className={cn(
            'h-10 w-10 rounded-xl flex items-center justify-center',
            earned ? style.bg : 'bg-surface-200'
          )}
        >
          <Icon
            className={cn(
              'h-5 w-5',
              earned ? style.text : 'text-surface-500'
            )}
          />
        </div>

        <div className="space-y-0.5">
          <p className={cn('text-xs font-semibold leading-tight', earned ? 'text-white' : 'text-surface-500')}>
            {earned ? achievement.name : '???'}
          </p>
          <p className={cn('text-[10px] font-mono uppercase tracking-wide', earned ? style.text : 'text-surface-600')}>
            {style.label}
          </p>
        </div>
      </div>

      {/* Tooltip on hover */}
      <AnimatePresence>
        {showTooltip && earned && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 w-44 rounded-xl bg-surface-100 border border-surface-300 p-3 text-center shadow-xl pointer-events-none"
          >
            <p className="text-xs font-semibold text-white mb-1">{achievement.name}</p>
            <p className="text-[11px] text-surface-400 leading-snug">{achievement.description}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── AchievementGrid ─────────────────────────────────────────────────────────

export function AchievementGrid({
  earnedAchievementIds,
  allAchievements,
}: AchievementGridProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  if (allAchievements.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
        <Landmark className="h-8 w-8 text-surface-500 mx-auto mb-3" />
        <p className="text-sm font-mono text-surface-500">Achievements coming soon.</p>
      </div>
    )
  }

  const earnedSet = new Set(earnedAchievementIds)
  const totalEarned = earnedAchievementIds.length
  const totalCount = allAchievements.length

  // Group by category
  const grouped = new Map<string, Achievement[]>()
  for (const ach of allAchievements) {
    const cat = (ach as Achievement & { category?: string }).category ?? 'general'
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(ach)
  }

  // Sort within each category: earned first, then by tier
  for (const [, list] of grouped) {
    list.sort((a, b) => {
      const ae = earnedSet.has(a.id) ? 0 : 1
      const be = earnedSet.has(b.id) ? 0 : 1
      if (ae !== be) return ae - be
      return (tierWeight[a.tier as AchievementTier] ?? 3) - (tierWeight[b.tier as AchievementTier] ?? 3)
    })
  }

  const categories = CATEGORY_ORDER.filter((c) => grouped.has(c))
  const displayCategories = activeCategory ? [activeCategory] : categories

  let globalIdx = 0

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="flex items-center justify-between gap-4 px-1">
        <p className="text-sm text-surface-400 shrink-0">
          <span className="text-white font-semibold">{totalEarned}</span>
          {' / '}
          <span>{totalCount}</span>
          {' earned'}
        </p>
        <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gold rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${totalCount > 0 ? (totalEarned / totalCount) * 100 : 0}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
        <p className="text-xs font-mono text-gold shrink-0">
          {totalCount > 0 ? Math.round((totalEarned / totalCount) * 100) : 0}%
        </p>
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={cn(
            'px-3 h-7 rounded-full text-xs font-mono border transition-colors',
            activeCategory === null
              ? 'bg-surface-300 border-surface-400 text-white'
              : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
          )}
        >
          All
        </button>
        {categories.map((cat) => {
          const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.general
          const list = grouped.get(cat) ?? []
          const catEarned = list.filter((a) => earnedSet.has(a.id)).length
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={cn(
                'flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-mono border transition-colors',
                activeCategory === cat
                  ? 'bg-surface-300 border-surface-400 text-white'
                  : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
              )}
            >
              <cfg.Icon className={cn('h-3 w-3', activeCategory === cat ? 'text-white' : cfg.accent)} />
              {cfg.label}
              <span className="opacity-50">{catEarned}/{list.length}</span>
            </button>
          )
        })}
      </div>

      {/* Sections */}
      {displayCategories.map((cat) => {
        const list = grouped.get(cat) ?? []
        const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.general
        const catEarned = list.filter((a) => earnedSet.has(a.id)).length

        return (
          <div key={cat} className="space-y-3">
            <div className="flex items-center gap-2">
              <cfg.Icon className={cn('h-4 w-4 shrink-0', cfg.accent)} />
              <h3 className="text-sm font-semibold text-white">{cfg.label}</h3>
              <span className="text-xs font-mono text-surface-500">
                {catEarned}/{list.length}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {list.map((achievement) => {
                const cardIdx = globalIdx++
                return (
                  <AchievementCard
                    key={achievement.id}
                    achievement={achievement}
                    earned={earnedSet.has(achievement.id)}
                    idx={cardIdx}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
