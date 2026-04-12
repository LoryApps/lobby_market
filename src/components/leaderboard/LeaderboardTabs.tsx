'use client'

import { useMemo, useState } from 'react'
import {
  Flame,
  Trophy,
  ScrollText,
  Activity,
  Sparkles,
  Shield,
} from 'lucide-react'
import { LeaderboardHero } from './LeaderboardHero'
import { LeaderboardTable, type LeaderboardRow, type TrendDirection } from './LeaderboardTable'
import type { Profile } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

export type LeaderboardCategory =
  | 'overall'
  | 'votes'
  | 'authors'
  | 'active'
  | 'rising'
  | 'troll_catchers'

interface LeaderboardTabsProps {
  initial: Record<LeaderboardCategory, Profile[]>
  lawsAuthoredMap: Record<string, number>
  recentVotesMap: Record<string, number>
}

const tabs: {
  id: LeaderboardCategory
  label: string
  icon: typeof Flame
  metricLabel: string
}[] = [
  { id: 'overall', label: 'Overall', icon: Trophy, metricLabel: 'Influence' },
  { id: 'votes', label: 'Most Votes', icon: Flame, metricLabel: 'Votes' },
  { id: 'authors', label: 'Top Authors', icon: ScrollText, metricLabel: 'Laws' },
  { id: 'active', label: 'Most Active', icon: Activity, metricLabel: 'Recent' },
  {
    id: 'rising',
    label: 'Rising Stars',
    icon: Sparkles,
    metricLabel: 'Momentum',
  },
  {
    id: 'troll_catchers',
    label: 'Troll Catchers',
    icon: Shield,
    metricLabel: 'Accuracy',
  },
]

function daysSince(iso: string): number {
  return Math.max(
    0,
    (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)
  )
}

export function LeaderboardTabs({
  initial,
  lawsAuthoredMap,
  recentVotesMap,
}: LeaderboardTabsProps) {
  const [activeTab, setActiveTab] = useState<LeaderboardCategory>('overall')
  const activeConfig = tabs.find((t) => t.id === activeTab)!

  const rows: LeaderboardRow[] = useMemo(() => {
    const profiles = initial[activeTab] ?? []
    return profiles.map((profile, idx) => {
      let value = 0
      let trend: TrendDirection = 'flat'
      switch (activeTab) {
        case 'overall':
          value = Math.round(profile.reputation_score)
          trend = idx < 3 ? 'up' : 'flat'
          break
        case 'votes':
          value = profile.total_votes
          trend = profile.total_votes > 50 ? 'up' : 'flat'
          break
        case 'authors':
          value = lawsAuthoredMap[profile.id] ?? 0
          trend = value > 0 ? 'up' : 'flat'
          break
        case 'active':
          value = recentVotesMap[profile.id] ?? 0
          trend = value > 0 ? 'up' : 'flat'
          break
        case 'rising': {
          const days = daysSince(profile.created_at)
          const momentum = Math.round(
            profile.reputation_score / Math.max(1, days)
          )
          value = momentum
          trend = 'up'
          break
        }
        case 'troll_catchers':
          value = Math.round(profile.reputation_score)
          trend = 'flat'
          break
      }
      return {
        profile,
        rank: idx + 1,
        metricValue: value,
        trend,
      }
    })
  }, [activeTab, initial, lawsAuthoredMap, recentVotesMap])

  const topThree = rows.slice(0, 3).map((r) => r.profile)

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 overflow-x-auto mb-6 pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap transition',
                isActive
                  ? 'bg-for-500/15 text-for-400 border border-for-500/30'
                  : 'text-surface-500 hover:text-surface-700 hover:bg-surface-200'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Hero podium */}
      <LeaderboardHero
        topThree={topThree}
        metricLabel={activeConfig.metricLabel}
        getMetricValue={(p) => {
          const row = rows.find((r) => r.profile.id === p.id)
          return row?.metricValue ?? 0
        }}
      />

      {/* Table of the rest (4..n) */}
      {rows.length > 3 && (
        <LeaderboardTable
          rows={rows}
          metricLabel={activeConfig.metricLabel}
          startIndex={3}
        />
      )}

      {rows.length === 0 && (
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center text-sm font-mono text-surface-500">
          No data in this category yet.
        </div>
      )}
    </div>
  )
}
