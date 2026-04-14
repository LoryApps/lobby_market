'use client'

import { useMemo, useState } from 'react'
import {
  Flame,
  Trophy,
  ScrollText,
  Activity,
  Sparkles,
  Shield,
  Target,
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
  | 'predictors'

/** Per-user prediction stats passed from the server. */
export interface PredictorStats {
  /** Accuracy as a 0–100 integer. */
  accuracy: number
  /** Total resolved predictions made. */
  total: number
  /** Average Brier score (lower = more accurate; null if no resolved preds). */
  avgBrier: number | null
}

interface LeaderboardTabsProps {
  initial: Record<LeaderboardCategory, Profile[]>
  lawsAuthoredMap: Record<string, number>
  recentVotesMap: Record<string, number>
  /** userId → prediction stats (provided for the 'predictors' tab). */
  predictorsStatsMap: Record<string, PredictorStats>
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
  {
    id: 'predictors',
    label: 'Predictors',
    icon: Target,
    metricLabel: '% Acc',
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
  predictorsStatsMap,
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
        case 'predictors': {
          const stats = predictorsStatsMap[profile.id]
          value = stats?.accuracy ?? 0
          trend = value >= 75 ? 'up' : value >= 50 ? 'flat' : 'down'
          break
        }
      }

      // Build optional sub-metric string for predictors
      let subMetric: string | undefined
      if (activeTab === 'predictors') {
        const stats = predictorsStatsMap[profile.id]
        if (stats) {
          const brierPart =
            stats.avgBrier !== null
              ? `Brier ${stats.avgBrier.toFixed(3)}`
              : null
          const totalPart = `${stats.total} resolved`
          subMetric = [totalPart, brierPart].filter(Boolean).join(' · ')
        }
      }

      return {
        profile,
        rank: idx + 1,
        metricValue: value,
        trend,
        subMetric,
      }
    })
  }, [activeTab, initial, lawsAuthoredMap, recentVotesMap, predictorsStatsMap])

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
          {activeTab === 'predictors'
            ? 'No resolved predictions yet. Be the first to predict a topic outcome!'
            : 'No data in this category yet.'}
        </div>
      )}

      {/* Predictors footnote */}
      {activeTab === 'predictors' && rows.length > 0 && (
        <div className="mt-4 rounded-xl border border-surface-300 bg-surface-100 px-4 py-3">
          <div className="flex flex-wrap items-start gap-x-6 gap-y-2 text-[11px] font-mono text-surface-500">
            <span>
              <span className="text-white font-semibold">% Acc</span> — percentage of resolved predictions that were correct (min. 3 to qualify)
            </span>
            <span>
              <span className="text-white font-semibold">Brier ↓</span> — lower Brier score = better-calibrated confidence
            </span>
            {Object.keys(predictorsStatsMap).length > 0 && (
              <span className="text-surface-600">
                {Object.values(predictorsStatsMap).reduce((s, p) => s + p.total, 0).toLocaleString()} resolved predictions across {Object.keys(predictorsStatsMap).length} predictors
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
