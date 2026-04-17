'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, Lock, Users } from 'lucide-react'
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import type { Achievement, AchievementTier } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface AchievementsGalleryProps {
  allAchievements: Achievement[]
  earnMap: Record<string, number>
  totalProfiles: number
  myEarnedIds: string[]
}

type TierFilter = 'all' | AchievementTier

const TIER_FILTERS: { id: TierFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'legendary', label: 'Legendary' },
  { id: 'epic', label: 'Epic' },
  { id: 'rare', label: 'Rare' },
  { id: 'common', label: 'Common' },
]

const TIER_STYLES: Record<
  AchievementTier,
  {
    label: string
    border: string
    bg: string
    text: string
    iconBg: string
    pill: string
  }
> = {
  legendary: {
    label: 'Legendary',
    border: 'border-gold/50',
    bg: 'bg-gold/10',
    text: 'text-gold',
    iconBg: 'bg-gold/15',
    pill: 'bg-gold/15 border-gold/40 text-gold',
  },
  epic: {
    label: 'Epic',
    border: 'border-purple/50',
    bg: 'bg-purple/10',
    text: 'text-purple',
    iconBg: 'bg-purple/15',
    pill: 'bg-purple/15 border-purple/40 text-purple',
  },
  rare: {
    label: 'Rare',
    border: 'border-for-500/50',
    bg: 'bg-for-500/10',
    text: 'text-for-400',
    iconBg: 'bg-for-500/15',
    pill: 'bg-for-500/15 border-for-500/40 text-for-400',
  },
  common: {
    label: 'Common',
    border: 'border-surface-400/30',
    bg: 'bg-surface-200/40',
    text: 'text-surface-400',
    iconBg: 'bg-surface-300/40',
    pill: 'bg-surface-300/30 border-surface-400/30 text-surface-500',
  },
}

const TIER_ORDER: AchievementTier[] = ['legendary', 'epic', 'rare', 'common']

function resolveIcon(name: string): LucideIcon {
  const map = Icons as unknown as Record<string, LucideIcon>
  return map[name] ?? HelpCircle
}

export function AchievementsGallery({
  allAchievements,
  earnMap,
  totalProfiles,
  myEarnedIds,
}: AchievementsGalleryProps) {
  const [activeFilter, setActiveFilter] = useState<TierFilter>('all')
  const myEarnedSet = new Set(myEarnedIds)

  const filtered =
    activeFilter === 'all'
      ? allAchievements
      : allAchievements.filter((a) => a.tier === activeFilter)

  // Sort: earned first, then tier order, then name
  const sorted = [...filtered].sort((a, b) => {
    const ae = myEarnedSet.has(a.id) ? 0 : 1
    const be = myEarnedSet.has(b.id) ? 0 : 1
    if (ae !== be) return ae - be
    const tierDiff = TIER_ORDER.indexOf(a.tier as AchievementTier) - TIER_ORDER.indexOf(b.tier as AchievementTier)
    if (tierDiff !== 0) return tierDiff
    return a.name.localeCompare(b.name)
  })

  if (allAchievements.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-12 text-center">
        <Trophy className="h-8 w-8 text-surface-500 mx-auto mb-3" />
        <p className="text-sm font-mono text-surface-500">No achievements defined yet.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Tier filter pills */}
      <div className="flex gap-2 flex-wrap mb-6" role="group" aria-label="Filter by tier">
        {TIER_FILTERS.map((f) => {
          const isActive = activeFilter === f.id
          const tierStyle = f.id !== 'all' ? TIER_STYLES[f.id as AchievementTier] : null
          return (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              aria-pressed={isActive}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-mono font-medium border transition-all',
                isActive
                  ? tierStyle
                    ? tierStyle.pill
                    : 'bg-white/10 border-white/20 text-white'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300',
              )}
            >
              {f.label}
              {f.id !== 'all' && (
                <span className="ml-1.5 opacity-60">
                  {allAchievements.filter((a) => a.tier === f.id).length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {sorted.map((achievement, idx) => {
            const earned = myEarnedSet.has(achievement.id)
            const tier = achievement.tier as AchievementTier
            const style = TIER_STYLES[tier]
            const Icon = resolveIcon(achievement.icon ?? '')
            const earnCount = earnMap[achievement.id] ?? 0
            const rarityPct =
              totalProfiles > 0
                ? Math.round((earnCount / totalProfiles) * 100 * 10) / 10
                : 0

            return (
              <motion.div
                key={achievement.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.3) }}
              >
                <Link
                  href={`/achievements/${achievement.id}`}
                  className={cn(
                    'group relative flex items-start gap-4 rounded-2xl border p-4 transition-all',
                    'hover:scale-[1.01] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
                    earned
                      ? cn(style.border, style.bg)
                      : 'border-surface-300 bg-surface-100 opacity-70',
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl',
                      earned ? style.iconBg : 'bg-surface-300/40',
                    )}
                    aria-hidden
                  >
                    {earned ? (
                      <Icon className={cn('h-5 w-5', style.text)} />
                    ) : (
                      <Lock className="h-5 w-5 text-surface-600" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span
                        className={cn(
                          'text-sm font-semibold font-mono truncate',
                          earned ? 'text-white' : 'text-surface-500',
                        )}
                      >
                        {achievement.name}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border flex-shrink-0',
                          style.pill,
                        )}
                      >
                        {style.label}
                      </span>
                    </div>

                    <p
                      className={cn(
                        'text-xs font-mono leading-relaxed line-clamp-2',
                        earned ? 'text-surface-400' : 'text-surface-600',
                      )}
                    >
                      {achievement.description}
                    </p>

                    {/* Rarity */}
                    <div className="flex items-center gap-1 mt-2">
                      <Users className="h-3 w-3 text-surface-600 flex-shrink-0" aria-hidden />
                      <span className="text-[10px] font-mono text-surface-600">
                        {earnCount === 0
                          ? 'No earners yet'
                          : earnCount === 1
                          ? '1 earner'
                          : `${earnCount.toLocaleString()} earners`}
                        {totalProfiles > 0 && earnCount > 0
                          ? ` · ${rarityPct < 0.1 ? '<0.1' : rarityPct}%`
                          : ''}
                      </span>
                    </div>
                  </div>

                  {/* Earned check */}
                  {earned && (
                    <div
                      aria-label="Earned"
                      className={cn(
                        'absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full',
                        style.bg,
                        style.text,
                        'border',
                        style.border,
                      )}
                    >
                      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </Link>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {sorted.length === 0 && (
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-10 text-center">
          <p className="text-sm font-mono text-surface-500">No achievements in this tier.</p>
        </div>
      )}
    </div>
  )
}

// Needed as a fallback for the empty-state icon import
function Trophy(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 2h12M6 2v6a6 6 0 0012 0V2M6 2H4a2 2 0 00-2 2v2a4 4 0 004 4h.06M18 2h2a2 2 0 012 2v2a4 4 0 01-4 4h-.06M12 14v4M8 22h8"
      />
    </svg>
  )
}
