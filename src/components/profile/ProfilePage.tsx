'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  MessageSquare,
  Scale,
  Trophy,
  LayoutGrid,
} from 'lucide-react'
import { ProfileHeader } from './ProfileHeader'
import { ProfileCompletionBanner } from './ProfileCompletionBanner'
import { VoteHistoryTimeline, type VoteHistoryEntry } from './VoteHistoryTimeline'
import { AchievementGrid } from './AchievementGrid'
import type {
  Profile,
  Topic,
  Law,
  Achievement,
} from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface ProfilePageProps {
  profile: Profile
  isOwner: boolean
  voteHistory: VoteHistoryEntry[]
  topics: Topic[]
  laws: Law[]
  allAchievements: Achievement[]
  earnedAchievementIds: string[]
  initialFollowing?: boolean
  viewerId?: string | null
}

type TabId = 'overview' | 'votes' | 'topics' | 'laws' | 'achievements'

const tabs: { id: TabId; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'votes', label: 'Votes', icon: Activity },
  { id: 'topics', label: 'Topics', icon: MessageSquare },
  { id: 'laws', label: 'Laws', icon: Scale },
  { id: 'achievements', label: 'Achievements', icon: Trophy },
]

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number | string
  accent?: 'for' | 'against' | 'emerald' | 'gold'
}) {
  const colorMap = {
    for: 'text-for-400',
    against: 'text-against-400',
    emerald: 'text-emerald',
    gold: 'text-gold',
  } as const

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
      <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div
        className={cn(
          'font-mono text-2xl font-bold',
          accent ? colorMap[accent] : 'text-white'
        )}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  )
}

export function ProfilePage({
  profile,
  isOwner,
  voteHistory,
  topics,
  laws,
  allAchievements,
  earnedAchievementIds,
  initialFollowing = false,
  viewerId = null,
}: ProfilePageProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  // Arrow-key navigation between tabs (ARIA tabs pattern)
  function handleTabKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = tabs[(index + 1) % tabs.length]
      setActiveTab(next.id)
      document.getElementById(`tab-${next.id}`)?.focus()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = tabs[(index - 1 + tabs.length) % tabs.length]
      setActiveTab(prev.id)
      document.getElementById(`tab-${prev.id}`)?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActiveTab(tabs[0].id)
      document.getElementById(`tab-${tabs[0].id}`)?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      const last = tabs[tabs.length - 1]
      setActiveTab(last.id)
      document.getElementById(`tab-${last.id}`)?.focus()
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <ProfileHeader
        profile={profile}
        isOwner={isOwner}
        initialFollowing={initialFollowing}
        viewerId={viewerId}
      />

      {/* Profile completion prompt — only visible to owner when profile is incomplete */}
      {isOwner && (
        <ProfileCompletionBanner profile={profile} userId={profile.id} />
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total votes" value={profile.total_votes} accent="for" />
        <StatCard label="Topics" value={topics.length} />
        <StatCard
          label="Laws influenced"
          value={laws.length}
          accent="emerald"
        />
        <StatCard
          label="Streak"
          value={`${profile.vote_streak} days`}
          accent="gold"
        />
      </div>

      {/* Tabs */}
      <div className="sticky top-14 z-20 -mx-4 px-4 py-2 bg-surface-50/80 backdrop-blur border-b border-surface-300">
        <div
          role="tablist"
          aria-label="Profile sections"
          className="flex items-center gap-1 overflow-x-auto"
        >
          {tabs.map((tab, index) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, index)}
                className={cn(
                  'flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition',
                  isActive
                    ? 'bg-for-500/15 text-for-400 border border-for-500/30'
                    : 'text-surface-500 hover:text-surface-700 hover:bg-surface-200'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
        className="min-h-[300px] focus:outline-none"
      >
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <VoteHistoryTimeline votes={voteHistory} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                  <h3 className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-3">
                    Recent topics
                  </h3>
                  {topics.length === 0 ? (
                    <div className="text-sm font-mono text-surface-500">
                      No topics yet.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {topics.slice(0, 5).map((topic) => (
                        <li key={topic.id}>
                          <Link
                            href={`/topic/${topic.id}`}
                            className="block text-sm text-surface-700 hover:text-white transition-colors"
                          >
                            <span className="line-clamp-1">
                              {topic.statement}
                            </span>
                            <span className="text-[10px] font-mono text-surface-500 mt-0.5">
                              {topic.total_votes} votes · {topic.status}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                  <h3 className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-3">
                    Laws influenced
                  </h3>
                  {laws.length === 0 ? (
                    <div className="text-sm font-mono text-surface-500">
                      No laws yet.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {laws.slice(0, 5).map((law) => (
                        <li key={law.id}>
                          <Link
                            href={`/law/${law.id}`}
                            className="block text-sm text-surface-700 hover:text-white transition-colors"
                          >
                            <span className="line-clamp-1">
                              {law.statement}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'votes' && (
            <motion.div
              key="votes"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <VoteHistoryTimeline votes={voteHistory} />
              <div className="rounded-2xl border border-surface-300 bg-surface-100 divide-y divide-surface-300">
                {voteHistory.length === 0 && (
                  <div className="p-6 text-center text-sm font-mono text-surface-500">
                    No votes cast yet.
                  </div>
                )}
                {voteHistory.map((vote) => (
                  <Link
                    key={vote.id}
                    href={`/topic/${vote.topic_id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-surface-200 transition-colors"
                  >
                    <span
                      className={cn(
                        'h-2.5 w-2.5 rounded-full flex-shrink-0',
                        vote.side === 'blue' ? 'bg-for-500' : 'bg-against-500'
                      )}
                    />
                    <span className="flex-1 min-w-0 text-sm text-surface-700 truncate">
                      {vote.topic_statement ?? 'Topic'}
                    </span>
                    <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
                      {new Date(vote.created_at).toLocaleDateString()}
                    </span>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'topics' && (
            <motion.div
              key="topics"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl border border-surface-300 bg-surface-100 divide-y divide-surface-300"
            >
              {topics.length === 0 ? (
                <div className="p-6 text-center text-sm font-mono text-surface-500">
                  No topics authored yet.
                </div>
              ) : (
                topics.map((topic) => (
                  <Link
                    key={topic.id}
                    href={`/topic/${topic.id}`}
                    className="block px-5 py-4 hover:bg-surface-200 transition-colors"
                  >
                    <div className="text-sm text-surface-700 line-clamp-2 mb-1">
                      {topic.statement}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                      <span>{topic.status}</span>
                      <span>{topic.total_votes} votes</span>
                      <span>{Math.round(topic.blue_pct)}% for</span>
                    </div>
                  </Link>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'laws' && (
            <motion.div
              key="laws"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
            >
              {laws.length === 0 ? (
                <div className="md:col-span-2 rounded-2xl border border-surface-300 bg-surface-100 p-6 text-center text-sm font-mono text-surface-500">
                  No laws yet. Keep pushing consensus.
                </div>
              ) : (
                laws.map((law) => (
                  <Link
                    key={law.id}
                    href={`/law/${law.id}`}
                    className="rounded-2xl border border-emerald/30 bg-emerald/5 p-4 hover:bg-emerald/10 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-[10px] font-mono text-emerald uppercase tracking-wider mb-2">
                      <Scale className="h-3.5 w-3.5" />
                      Law
                    </div>
                    <div className="text-sm text-white line-clamp-3">
                      {law.statement}
                    </div>
                  </Link>
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'achievements' && (
            <motion.div
              key="achievements"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <AchievementGrid
                earnedAchievementIds={earnedAchievementIds}
                allAchievements={allAchievements}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
