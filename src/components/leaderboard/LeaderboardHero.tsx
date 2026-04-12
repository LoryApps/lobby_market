'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Crown, Medal, Trophy } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { RoleBadge } from '@/components/profile/RoleBadge'
import type { Profile } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface LeaderboardHeroProps {
  topThree: Profile[]
  metricLabel: string
  getMetricValue: (profile: Profile) => number
}

const podiumConfig = [
  {
    rank: 1,
    className: 'order-1 md:order-2 md:-translate-y-4',
    accentRing: 'ring-gold',
    accentBg: 'from-gold/25 to-gold/5',
    accentText: 'text-gold',
    icon: Crown,
    size: 'h-24 w-24',
    label: '1st',
  },
  {
    rank: 2,
    className: 'order-2 md:order-1',
    accentRing: 'ring-surface-500',
    accentBg: 'from-surface-500/25 to-surface-500/5',
    accentText: 'text-surface-600',
    icon: Medal,
    size: 'h-20 w-20',
    label: '2nd',
  },
  {
    rank: 3,
    className: 'order-3 md:order-3',
    accentRing: 'ring-[#cd7f32]',
    accentBg: 'from-[#cd7f32]/25 to-[#cd7f32]/5',
    accentText: 'text-[#cd7f32]',
    icon: Trophy,
    size: 'h-20 w-20',
    label: '3rd',
  },
] as const

export function LeaderboardHero({
  topThree,
  metricLabel,
  getMetricValue,
}: LeaderboardHeroProps) {
  if (topThree.length === 0) return null

  const slots = podiumConfig.map((cfg, idx) => ({
    ...cfg,
    profile: topThree[idx],
  }))

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {slots.map((slot) => {
        if (!slot.profile) return null
        const displayName = slot.profile.display_name || slot.profile.username
        const value = getMetricValue(slot.profile)
        const Icon = slot.icon

        return (
          <motion.div
            key={slot.rank}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: slot.rank * 0.1 }}
            className={slot.className}
          >
            <Link
              href={`/profile/${slot.profile.username}`}
              className={cn(
                'block relative overflow-hidden rounded-3xl border border-surface-300 p-6',
                `bg-gradient-to-br ${slot.accentBg}`,
                'hover:scale-[1.02] transition-transform'
              )}
            >
              <div className="absolute top-4 right-4">
                <Icon className={cn('h-5 w-5', slot.accentText)} />
              </div>

              <div className="flex flex-col items-center text-center">
                <div
                  className={cn(
                    'rounded-full ring-4 ring-offset-4 ring-offset-surface-100 mb-3',
                    slot.accentRing
                  )}
                >
                  <Avatar
                    src={slot.profile.avatar_url}
                    fallback={displayName}
                    size="lg"
                    className={slot.size}
                  />
                </div>

                <div
                  className={cn(
                    'font-mono text-[10px] uppercase tracking-wider mb-1',
                    slot.accentText
                  )}
                >
                  {slot.label}
                </div>

                <div className="text-lg font-bold text-white truncate max-w-full">
                  {displayName}
                </div>
                <div className="text-xs font-mono text-surface-500 mb-3">
                  @{slot.profile.username}
                </div>

                <RoleBadge role={slot.profile.role} size="sm" />

                <div className="mt-4 pt-4 border-t border-surface-300 w-full">
                  <div
                    className={cn(
                      'font-mono text-3xl font-bold',
                      slot.accentText
                    )}
                  >
                    {value.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                    {metricLabel}
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        )
      })}
    </div>
  )
}
