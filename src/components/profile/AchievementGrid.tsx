'use client'

import { motion } from 'framer-motion'
import { HelpCircle } from 'lucide-react'
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Achievement, AchievementTier } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface AchievementGridProps {
  earnedAchievementIds: string[]
  allAchievements: Achievement[]
}

const tierStyles: Record<
  AchievementTier,
  { border: string; bg: string; text: string; label: string }
> = {
  common: {
    border: 'border-surface-400/50',
    bg: 'bg-surface-200/50',
    text: 'text-surface-600',
    label: 'Common',
  },
  rare: {
    border: 'border-for-500/50',
    bg: 'bg-for-500/10',
    text: 'text-for-400',
    label: 'Rare',
  },
  epic: {
    border: 'border-purple/50',
    bg: 'bg-purple/10',
    text: 'text-purple',
    label: 'Epic',
  },
  legendary: {
    border: 'border-gold/60',
    bg: 'bg-gold/10',
    text: 'text-gold',
    label: 'Legendary',
  },
}

function resolveIcon(name: string): LucideIcon {
  const iconMap = Icons as unknown as Record<string, LucideIcon>
  return iconMap[name] ?? HelpCircle
}

export function AchievementGrid({
  earnedAchievementIds,
  allAchievements,
}: AchievementGridProps) {
  const earnedSet = new Set(earnedAchievementIds)

  // Sort: earned first, then by tier weight (legendary → common)
  const tierWeight: Record<AchievementTier, number> = {
    legendary: 0,
    epic: 1,
    rare: 2,
    common: 3,
  }
  const sorted = [...allAchievements].sort((a, b) => {
    const ae = earnedSet.has(a.id) ? 0 : 1
    const be = earnedSet.has(b.id) ? 0 : 1
    if (ae !== be) return ae - be
    return tierWeight[a.tier] - tierWeight[b.tier]
  })

  if (allAchievements.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
        <div className="text-sm font-mono text-surface-500">
          Achievements coming soon.
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {sorted.map((achievement, idx) => {
        const earned = earnedSet.has(achievement.id)
        const style = tierStyles[achievement.tier]
        const Icon = earned ? resolveIcon(achievement.icon) : HelpCircle

        return (
          <motion.div
            key={achievement.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            className={cn(
              'group relative rounded-2xl p-4 border-2 transition',
              earned ? style.border : 'border-surface-300',
              earned ? style.bg : 'bg-surface-100 opacity-60 grayscale',
              'hover:scale-[1.02]'
            )}
          >
            <div className="flex flex-col items-center text-center gap-2">
              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full',
                  earned
                    ? `${style.bg} ${style.text}`
                    : 'bg-surface-200 text-surface-500'
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div
                className={cn(
                  'text-sm font-semibold leading-tight',
                  earned ? 'text-white' : 'text-surface-500'
                )}
              >
                {earned ? achievement.name : '???'}
              </div>
              <div
                className={cn(
                  'text-[10px] font-mono uppercase tracking-wider',
                  earned ? style.text : 'text-surface-500'
                )}
              >
                {style.label}
              </div>
            </div>
            {earned && (
              <div className="absolute inset-x-0 bottom-0 p-3 pt-2 opacity-0 group-hover:opacity-100 transition pointer-events-none">
                <div className="rounded-md bg-surface-300/80 backdrop-blur p-2 text-[10px] font-mono text-surface-700 text-center">
                  {achievement.description}
                </div>
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
