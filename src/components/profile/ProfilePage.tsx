'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  BarChart2,
  Clock,
  Coins,
  Flag,
  Hash,
  HelpCircle,
  Layers,
  Link2,
  MessageSquare,
  PenLine,
  Scale,
  Shield,
  Sparkles,
  Star,
  Swords,
  Target,
  Trophy,
  LayoutGrid,
  ThumbsDown,
  ThumbsUp,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { ProfileHeader } from './ProfileHeader'
import { ProfileCompletionBanner } from './ProfileCompletionBanner'
import { VoteHistoryTimeline, type VoteHistoryEntry } from './VoteHistoryTimeline'
import { AchievementGrid } from './AchievementGrid'
import { NextAchievementsPanel } from './NextAchievementsPanel'
import { ProfileArguments, type ProfileArgumentEntry } from './ProfileArguments'
import { PinnedArgumentsShowcase } from './PinnedArgumentsShowcase'
import { VoteDnaPanel, type VoteCategoryBreakdown } from './VoteDnaPanel'
import { VoteCalendar } from './VoteCalendar'
import type {
  Profile,
  Topic,
  Law,
  Achievement,
} from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface DayActivity { date: string; count: number }

interface ProfilePageProps {
  profile: Profile
  isOwner: boolean
  voteHistory: VoteHistoryEntry[]
  topics: Topic[]
  laws: Law[]
  allAchievements: Achievement[]
  earnedAchievementIds: string[]
  profileArguments?: ProfileArgumentEntry[]
  initialFollowing?: boolean
  viewerId?: string | null
  voteCategoryBreakdown?: VoteCategoryBreakdown[]
  dailyActivity?: DayActivity[]
}

type TabId = 'overview' | 'votes' | 'topics' | 'laws' | 'achievements' | 'arguments'

const tabs: { id: TabId; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'votes', label: 'Votes', icon: Activity },
  { id: 'topics', label: 'Topics', icon: MessageSquare },
  { id: 'laws', label: 'Laws', icon: Scale },
  { id: 'achievements', label: 'Achievements', icon: Trophy },
  { id: 'arguments', label: 'Arguments', icon: ThumbsUp },
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

// ─── Hot Takes panel ──────────────────────────────────────────────────────────

function HotTakesPanel({ votes }: { votes: VoteHistoryEntry[] }) {
  const hotTakes = votes.filter((v) => v.reason)
  if (hotTakes.length === 0) return null

  return (
    <div className="rounded-2xl border border-gold/20 bg-gold/5 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
        <span className="text-[11px] font-mono uppercase tracking-widest text-gold">
          Hot Takes · {hotTakes.length} {hotTakes.length === 1 ? 'reason' : 'reasons'} given
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {hotTakes.slice(0, 6).map((vote) => {
          const isFor = vote.side === 'blue'
          return (
            <Link
              key={vote.id}
              href={`/topic/${vote.topic_id}`}
              className={cn(
                'group rounded-xl border px-4 py-3 transition-colors space-y-2',
                isFor
                  ? 'bg-for-600/10 border-for-600/30 hover:border-for-500/50'
                  : 'bg-against-600/10 border-against-600/30 hover:border-against-500/50'
              )}
            >
              {/* Stance badge */}
              <div className="flex items-center gap-1.5">
                {isFor
                  ? <ThumbsUp className="h-3 w-3 text-for-400" aria-hidden="true" />
                  : <ThumbsDown className="h-3 w-3 text-against-400" aria-hidden="true" />}
                <span className={cn(
                  'text-[10px] font-mono font-bold uppercase tracking-wider',
                  isFor ? 'text-for-400' : 'text-against-400'
                )}>
                  {isFor ? 'FOR' : 'AGAINST'}
                </span>
              </div>
              {/* Topic */}
              <p className="text-[11px] font-mono text-surface-500 leading-snug line-clamp-2 group-hover:text-surface-400 transition-colors">
                {vote.topic_statement ?? 'Topic'}
              </p>
              {/* Reason */}
              <p className={cn(
                'text-xs font-mono italic leading-snug',
                isFor ? 'text-for-300' : 'text-against-300'
              )}>
                &ldquo;{vote.reason}&rdquo;
              </p>
              {/* Date */}
              <p className="text-[10px] font-mono text-surface-600">
                {new Date(vote.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </Link>
          )
        })}
      </div>
      {hotTakes.length > 6 && (
        <p className="text-[11px] font-mono text-surface-500 text-center pt-1">
          +{hotTakes.length - 6} more hot takes in vote history above
        </p>
      )}
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
  profileArguments = [],
  initialFollowing = false,
  viewerId = null,
  voteCategoryBreakdown = [],
  dailyActivity = [],
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
        <StatCard label="Arguments" value={profile.total_arguments ?? profileArguments.length} />
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
              {/* Activity calendar heatmap */}
              {(dailyActivity.length > 0 || profile.total_votes > 0) && (
                <VoteCalendar days={dailyActivity} />
              )}

              <VoteHistoryTimeline votes={voteHistory} />

              {/* Vote DNA: stance split + category breakdown */}
              {profile.total_votes > 0 && (
                <VoteDnaPanel
                  bluePct={
                    profile.total_votes > 0
                      ? Math.round((profile.blue_vote_count / profile.total_votes) * 100)
                      : 50
                  }
                  redPct={
                    profile.total_votes > 0
                      ? Math.round((profile.red_vote_count / profile.total_votes) * 100)
                      : 50
                  }
                  totalVotes={profile.total_votes}
                  categoryBreakdown={voteCategoryBreakdown}
                />
              )}

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
                    <>
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
                      {topics.length > 5 && (
                        <Link
                          href={`/profile/${profile.username}/topics`}
                          className="mt-3 block text-[11px] font-mono text-for-300 hover:text-for-200 transition-colors"
                        >
                          View all {topics.length} topics →
                        </Link>
                      )}
                    </>
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

              {/* Next achievements — compact preview for owner */}
              {isOwner && (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
                      Next achievements
                    </h3>
                    <button
                      onClick={() => setActiveTab('achievements')}
                      className="text-[10px] font-mono text-for-400 hover:text-for-300 transition-colors"
                    >
                      View all →
                    </button>
                  </div>
                  <NextAchievementsPanel userId={profile.id} limit={2} />
                </div>
              )}

              {/* Argument Spotlight — pinned arguments showcase */}
              {(profile.total_arguments ?? 0) > 0 && (
                <PinnedArgumentsShowcase
                  username={profile.username}
                  isOwner={isOwner}
                />
              )}

              {/* Debate record teaser */}
              <Link
                href={`/profile/${profile.username}/debates`}
                className="block rounded-2xl border border-purple/20 bg-purple/5 hover:bg-purple/10 hover:border-purple/30 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Swords className="h-4 w-4 text-purple" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-purple uppercase tracking-wider">
                      Debate Record
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-purple/70 hover:text-purple transition-colors">
                    View all →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Every arena {profile.display_name ?? profile.username} has stepped into — sides argued, outcomes, and top messages.
                </p>
              </Link>

              {/* Challenge Record teaser */}
              <Link
                href={`/profile/${profile.username}/challenges`}
                className="block rounded-2xl border border-against-500/20 bg-against-500/5 hover:bg-against-500/10 hover:border-against-500/30 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-against-400" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-against-400 uppercase tracking-wider">
                      Challenge Record
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-against-400/70 hover:text-against-400 transition-colors">
                    View all →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Debate duels sent and received, plus formal law challenges filed — every civic confrontation and its outcome.
                </p>
              </Link>

              {/* Vote Record teaser */}
              <Link
                href={`/profile/${profile.username}/votes`}
                className="block rounded-2xl border border-for-500/20 bg-for-500/5 hover:bg-for-500/10 hover:border-for-500/30 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Vote className="h-4 w-4 text-for-400" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-for-400 uppercase tracking-wider">
                      Vote Record
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-for-400/70 hover:text-for-400 transition-colors">
                    View all →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Every vote {profile.display_name ?? profile.username} has cast — stance, accuracy on resolved topics, and category breakdown.
                </p>
              </Link>

              {/* Civic Positions teaser */}
              <Link
                href={`/profile/${profile.username}/positions`}
                className="block rounded-2xl border border-for-700/20 bg-for-900/20 hover:bg-for-900/30 hover:border-for-700/30 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-for-300" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-for-300 uppercase tracking-wider">
                      Civic Positions
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-for-300/70 hover:text-for-300 transition-colors">
                    View record →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Public stance record — FOR and AGAINST positions grouped by category, with consensus comparison and contrarian highlights.
                </p>
              </Link>

              {/* Civic Impact teaser */}
              <Link
                href={`/profile/${profile.username}/impact`}
                className="block rounded-2xl border border-gold/20 bg-gold/5 hover:bg-gold/10 hover:border-gold/30 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-gold" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-gold uppercase tracking-wider">
                      Civic Impact
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-gold/70 hover:text-gold transition-colors">
                    View impact →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Laws shaped, top arguments, impact score, and civic footprint — the full measure of {profile.display_name ?? profile.username}&apos;s influence.
                </p>
              </Link>

              {/* Laws Record teaser */}
              <Link
                href={`/profile/${profile.username}/laws`}
                className="block rounded-2xl border border-emerald/20 bg-emerald/5 hover:bg-emerald/10 hover:border-emerald/30 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-emerald" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-emerald uppercase tracking-wider">
                      Laws Record
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-emerald/70 hover:text-emerald transition-colors">
                    View record →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Every law {profile.display_name ?? profile.username} backed, proposed, or argued about — the full civic law footprint.
                </p>
              </Link>

              {/* Civic Network teaser */}
              <Link
                href={`/profile/${profile.username}/network`}
                className="block rounded-2xl border border-for-500/20 bg-for-500/5 hover:bg-for-500/10 hover:border-for-500/30 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-for-400" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-for-400 uppercase tracking-wider">
                      Civic Network
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-for-400/70 hover:text-for-400 transition-colors">
                    View network →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  {profile.display_name ?? profile.username}&apos;s followers, following, and mutual connections in the Lobby.
                </p>
              </Link>

              {/* Prediction Record teaser */}
              <Link
                href={`/profile/${profile.username}/predictions`}
                className="block rounded-2xl border border-gold/20 bg-gold/5 hover:bg-gold/10 hover:border-gold/30 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-gold" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-gold uppercase tracking-wider">
                      Prediction Record
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-gold/70 hover:text-gold transition-colors">
                    View record →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Every market call {profile.display_name ?? profile.username} has staked — topic outcomes, debate predictions, accuracy rate, and clout earned.
                </p>
              </Link>

              {/* Exchange Profile teaser */}
              <Link
                href={`/profile/${profile.username}/exchange`}
                className="block rounded-2xl border border-gold/20 bg-surface-100 hover:bg-gold/5 hover:border-gold/30 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-gold" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-gold uppercase tracking-wider">
                      Exchange Profile
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-gold/70 hover:text-gold transition-colors">
                    View profile →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Market ideas, prediction tournament history, and analyst record on the Lobby Exchange — {profile.display_name ?? profile.username}&apos;s civic trading footprint.
                </p>
              </Link>

              {/* Coalitions teaser */}
              <Link
                href={`/profile/${profile.username}/coalitions`}
                className="block rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 hover:border-surface-400 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-surface-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    <h3 className="text-[11px] font-mono text-surface-400 uppercase tracking-wider">
                      Coalitions
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors">
                    View all →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Every civic alliance {profile.display_name ?? profile.username} is part of — roles held, coalition influence, and wins.
                </p>
              </Link>
              {/* Podium Record teaser */}
              <Link
                href={`/profile/${profile.username}/podium`}
                className="block rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 hover:border-surface-400 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-gold" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-surface-400 uppercase tracking-wider">
                      Podium Record
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors">
                    View record →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Every weekly top-3 finish {profile.display_name ?? profile.username} has earned — medals, categories, scores, and career highlights.
                </p>
              </Link>

              {/* Civic Moments teaser */}
              <Link
                href={`/profile/${profile.username}/moments`}
                className="block rounded-2xl border border-gold/30 bg-gold/5 hover:bg-gold/10 hover:border-gold/50 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-gold" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-surface-400 uppercase tracking-wider">
                      Civic Moments
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors">
                    View moments →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  The defining highlights of {profile.display_name ?? profile.username}&apos;s civic story — first vote, best argument, biggest prediction win, and more.
                </p>
              </Link>

              {/* Civic Timeline teaser */}
              <Link
                href={`/profile/${profile.username}/timeline`}
                className="block rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 hover:border-surface-400 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-for-300" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-surface-400 uppercase tracking-wider">
                      Civic Timeline
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors">
                    View timeline →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Every vote, argument, debate, achievement, and coalition join — the full chronological record of {profile.display_name ?? profile.username}&apos;s civic journey.
                </p>
              </Link>

              {/* Civic Growth teaser */}
              <Link
                href={`/profile/${profile.username}/growth`}
                className="block rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 hover:border-surface-400 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-emerald" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-surface-400 uppercase tracking-wider">
                      Civic Growth
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors">
                    View growth →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Monthly activity charts, clout growth curve, and civic milestones — the full arc of {profile.display_name ?? profile.username}&apos;s civic journey.
                </p>
              </Link>

              {/* Civic Journey teaser */}
              <Link
                href={`/profile/${profile.username}/journey`}
                className="block rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 hover:border-surface-400 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-gold" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-surface-400 uppercase tracking-wider">
                      Civic Journey
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors">
                    View journey →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  A narrative timeline of {profile.display_name ?? profile.username}&apos;s civic story — first vote, first argument, key achievements, and laws helped create.
                </p>
              </Link>

              {/* Civic Analytics teaser */}
              <Link
                href={`/profile/${profile.username}/analytics`}
                className="block rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 hover:border-surface-400 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-for-400" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-surface-400 uppercase tracking-wider">
                      Analytics
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors">
                    View analytics →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Category breakdown, voting accuracy, argument quality, and how {profile.display_name ?? profile.username}&apos;s civic engagement compares to the platform.
                </p>
              </Link>

              {/* Argument Style teaser */}
              <Link
                href={`/profile/${profile.username}/style`}
                className="block rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 hover:border-surface-400 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PenLine className="h-4 w-4 text-purple" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-surface-400 uppercase tracking-wider">
                      Argument Style
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors">
                    View style →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Writing archetype, grade distribution, topic focus, peak activity times, and signature arguments — how {profile.display_name ?? profile.username} argues.
                </p>
              </Link>

              {/* Law Reviews teaser */}
              <Link
                href={`/profile/${profile.username}/reviews`}
                className="block rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 hover:border-surface-400 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-gold" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-surface-400 uppercase tracking-wider">
                      Law Reviews
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors">
                    View reviews →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Star ratings and written reviews {profile.display_name ?? profile.username} has left on established laws — reflecting on civic outcomes in practice.
                </p>
              </Link>

              {/* Civic Relays */}
              <Link
                href={`/profile/${profile.username}/relays`}
                className="block rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 hover:border-surface-400 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-purple" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-surface-400 uppercase tracking-wider">
                      Civic Relays
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors">
                    View relays →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Collaborative argument chains {profile.display_name ?? profile.username} has started or contributed legs to — collective cases built with fellow citizens.
                </p>
              </Link>

              {/* Topic Collections */}
              <Link
                href={`/profile/${profile.username}/collections`}
                className="block rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 hover:border-surface-400 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-for-400" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-surface-400 uppercase tracking-wider">
                      Topic Collections
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors">
                    View collections →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Curated reading lists of civic debates {profile.display_name ?? profile.username} has organised — handpicked topics by theme, category, or personal interest.
                </p>
              </Link>

              {/* Evidence Submissions */}
              <Link
                href={`/profile/${profile.username}/evidence`}
                className="block rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 hover:border-surface-400 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-purple" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-surface-400 uppercase tracking-wider">
                      Evidence Submissions
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors">
                    View sources →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Research sources and external evidence {profile.display_name ?? profile.username} has submitted to debates — links backing the FOR and AGAINST sides.
                </p>
              </Link>

              {/* Bounties */}
              <Link
                href={`/profile/${profile.username}/bounties`}
                className="block rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 hover:border-surface-400 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-gold" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-surface-400 uppercase tracking-wider">
                      Bounties
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors">
                    View bounties →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Clout bounties {profile.display_name ?? profile.username} has posted to commission arguments — and rewards won by writing the best civic case.
                </p>
              </Link>

              {/* Pledges quick-link */}
              <Link
                href={`/profile/${profile.username}/pledges`}
                className="block rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 hover:border-surface-400 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flag className="h-4 w-4 text-emerald" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-surface-400 uppercase tracking-wider">
                      Civic Pledges
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors">
                    View pledges →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Public civic commitments {profile.display_name ?? profile.username} has made — with community witness accountability.
                </p>
              </Link>

              {/* Tag Follows quick-link */}
              <Link
                href={`/profile/${profile.username}/tags`}
                className="block rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 hover:border-surface-400 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-purple" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-surface-400 uppercase tracking-wider">
                      Tag Subscriptions
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors">
                    View tags →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Civic topic tags {profile.display_name ?? profile.username} follows — their curated lens on the policy landscape.
                </p>
              </Link>

              {/* Q&A Activity quick-link */}
              <Link
                href={`/profile/${profile.username}/questions`}
                className="block rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 hover:border-surface-400 transition-colors p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-purple" aria-hidden="true" />
                    <h3 className="text-[11px] font-mono text-surface-400 uppercase tracking-wider">
                      Q&amp;A Activity
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors">
                    View Q&amp;A →
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-500 mt-2">
                  Questions {profile.display_name ?? profile.username} has asked and answered — plus expertise badges earned by category.
                </p>
              </Link>

              {/* Top arguments preview */}
              {profileArguments.length > 0 && (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
                      Top arguments
                    </h3>
                    <button
                      onClick={() => setActiveTab('arguments')}
                      className="text-[10px] font-mono text-for-400 hover:text-for-300 transition-colors"
                    >
                      View all →
                    </button>
                  </div>
                  <ul className="space-y-3">
                    {profileArguments.slice(0, 3).map((arg) => (
                      <li
                        key={arg.id}
                        className={cn(
                          'flex items-start gap-2.5 rounded-xl p-3 border',
                          arg.side === 'blue'
                            ? 'bg-for-500/5 border-for-500/15'
                            : 'bg-against-500/5 border-against-500/15'
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 h-2 w-2 rounded-full flex-shrink-0',
                            arg.side === 'blue' ? 'bg-for-500' : 'bg-against-500'
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-surface-700 line-clamp-2">
                            {arg.content}
                          </p>
                          {arg.topic_statement && (
                            <Link
                              href={`/topic/${arg.topic_id}`}
                              className="text-[10px] font-mono text-surface-500 hover:text-surface-700 transition-colors line-clamp-1 mt-1 block"
                            >
                              {arg.topic_statement}
                            </Link>
                          )}
                        </div>
                        {arg.upvotes > 0 && (
                          <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] font-mono text-gold">
                            <ThumbsUp className="h-2.5 w-2.5" aria-hidden="true" />
                            {arg.upvotes}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
                    className="flex items-start gap-3 px-5 py-3 hover:bg-surface-200 transition-colors"
                  >
                    <span
                      className={cn(
                        'mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0',
                        vote.side === 'blue' ? 'bg-for-500' : 'bg-against-500'
                      )}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-surface-700 truncate">
                        {vote.topic_statement ?? 'Topic'}
                      </span>
                      {vote.reason && (
                        <span className={cn(
                          'mt-0.5 flex items-start gap-1.5',
                          vote.side === 'blue' ? 'text-for-400' : 'text-against-400'
                        )}>
                          <MessageSquare className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
                          <span className="text-[11px] font-mono italic leading-snug line-clamp-2">
                            &ldquo;{vote.reason}&rdquo;
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] font-mono text-surface-500 flex-shrink-0 mt-0.5">
                      {new Date(vote.created_at).toLocaleDateString()}
                    </span>
                  </Link>
                ))}
              </div>

              {/* ── My Hot Takes panel ─────────────────────────────────────── */}
              <HotTakesPanel votes={voteHistory} />

              {/* ── Link to full vote record ──────────────────────────────── */}
              <Link
                href={`/profile/${profile.username}/votes`}
                className="block text-center py-2.5 rounded-xl border border-for-500/20 bg-for-500/5 hover:bg-for-500/10 text-for-400 text-xs font-mono font-semibold transition-colors"
              >
                View full vote record →
              </Link>
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
                topics.slice(0, 5).map((topic) => (
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
              {topics.length > 0 && (
                <Link
                  href={`/profile/${profile.username}/topics`}
                  className="block px-5 py-3 text-center text-[11px] font-mono text-for-300 hover:text-for-200 hover:bg-surface-200 transition-colors border-t border-surface-300"
                >
                  See all {topics.length} topics →
                </Link>
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
              {laws.length > 0 && (
                <div className="flex justify-center pt-2">
                  <a
                    href={`/profile/${profile.username}/laws`}
                    className="text-xs font-mono text-emerald hover:text-emerald/80 transition-colors underline underline-offset-2"
                  >
                    Full laws record ↗
                  </a>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'achievements' && (
            <motion.div
              key="achievements"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              {/* Next achievements progress — only for profile owner */}
              {isOwner && (
                <NextAchievementsPanel userId={profile.id} limit={3} />
              )}

              {/* Full earned/unearned grid */}
              <AchievementGrid
                earnedAchievementIds={earnedAchievementIds}
                allAchievements={allAchievements}
              />
              <div className="mt-4 flex items-center justify-center gap-4 text-xs font-mono text-surface-500">
                <a
                  href={`/profile/${profile.username}/achievements`}
                  className="hover:text-for-400 transition-colors underline underline-offset-2"
                >
                  Shareable achievement page ↗
                </a>
                <span className="text-surface-600">·</span>
                <a
                  href="/achievements"
                  className="hover:text-surface-300 transition-colors underline underline-offset-2"
                >
                  Full catalog →
                </a>
              </div>
            </motion.div>
          )}

          {activeTab === 'arguments' && (
            <motion.div
              key="arguments"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <ProfileArguments
                arguments={profileArguments}
                username={profile.username}
              />
              <div className="mt-4 flex items-center justify-center gap-4 text-xs font-mono text-surface-500 flex-wrap">
                <a
                  href={`/profile/${profile.username}/arguments`}
                  className="hover:text-for-400 transition-colors underline underline-offset-2"
                >
                  Full argument portfolio ↗
                </a>
                <span className="text-surface-600">·</span>
                <a
                  href={`/profile/${profile.username}/debates`}
                  className="hover:text-purple transition-colors underline underline-offset-2"
                >
                  Debate record ↗
                </a>
                <span className="text-surface-600">·</span>
                <a
                  href={`/profile/${profile.username}/impact`}
                  className="hover:text-gold transition-colors underline underline-offset-2"
                >
                  Civic impact ↗
                </a>
                <span className="text-surface-600">·</span>
                <a
                  href={`/profile/${profile.username}/laws`}
                  className="hover:text-emerald transition-colors underline underline-offset-2"
                >
                  Laws record ↗
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
