'use client'

/**
 * /coalitions/[id]/war-room — Coalition War Room
 *
 * A tactical command centre for coalition leaders and officers:
 *   - Live campaign status (active stances on ongoing debates)
 *   - Recent intelligence (bulletin board posts)
 *   - Roster (member list ranked by role then reputation)
 *   - Quick-action panel for leaders/officers
 *
 * Distinct from:
 *   /coalitions/[id]          — public profile + member management
 *   /coalitions/[id]/analytics — historical metrics and alignment breakdown
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Bell,
  Crown,
  Megaphone,
  Pin,
  Scale,
  Shield,
  Swords,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  WarRoomResponse,
  ActiveCampaign,
  RecentPost,
  WarRoomContributor,
} from '@/app/api/coalitions/[id]/war-room/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STANCE_CONFIG = {
  for: {
    label: 'FOR',
    icon: ThumbsUp,
    text: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    dot: 'bg-for-500',
  },
  against: {
    label: 'AGAINST',
    icon: ThumbsDown,
    text: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    dot: 'bg-against-500',
  },
  neutral: {
    label: 'NEUTRAL',
    icon: Scale,
    text: 'text-surface-400',
    bg: 'bg-surface-300/30',
    border: 'border-surface-400/30',
    dot: 'bg-surface-400',
  },
}

const ROLE_CONFIG = {
  leader: { label: 'Leader', Icon: Crown, color: 'text-gold' },
  officer: { label: 'Officer', Icon: Shield, color: 'text-purple' },
  member: { label: 'Member', Icon: Users, color: 'text-surface-400' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-400' },
  active: { label: 'Active', color: 'text-for-400' },
  voting: { label: 'Voting', color: 'text-gold' },
  law: { label: 'Law', color: 'text-emerald' },
  failed: { label: 'Failed', color: 'text-against-400' },
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({ pct, compact = false }: { pct: number; compact?: boolean }) {
  const h = compact ? 'h-1' : 'h-1.5'
  return (
    <div className={cn('w-full rounded-full bg-surface-300 overflow-hidden', h)}>
      <div
        className="h-full bg-for-500 rounded-full transition-all duration-500"
        style={{ width: `${Math.max(2, Math.min(98, pct))}%` }}
      />
    </div>
  )
}

// ─── Campaign card ────────────────────────────────────────────────────────────

function CampaignCard({ campaign }: { campaign: ActiveCampaign }) {
  const stance = STANCE_CONFIG[campaign.stance]
  const status = STATUS_CONFIG[campaign.topicStatus] ?? { label: campaign.topicStatus, color: 'text-surface-400' }
  const forPct = Math.round(campaign.bluePct)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative p-4 rounded-xl border bg-surface-100/60 hover:bg-surface-100 transition-colors',
        stance.border,
      )}
    >
      {/* Stance badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border',
            stance.text, stance.bg, stance.border,
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', stance.dot)} />
          {stance.label}
        </span>

        <span className={cn('text-[11px] font-mono font-semibold', status.color)}>
          {status.label}
        </span>
      </div>

      {/* Topic */}
      <Link
        href={`/topic/${campaign.topicId}`}
        className="block text-sm font-semibold text-white leading-snug hover:text-for-300 transition-colors mb-3 line-clamp-2"
      >
        {campaign.topicStatement}
      </Link>

      {/* Stance statement */}
      {campaign.stanceStatement && (
        <p className="text-xs text-surface-400 italic mb-3 line-clamp-2">
          &ldquo;{campaign.stanceStatement}&rdquo;
        </p>
      )}

      {/* Vote bar */}
      <div className="space-y-1.5">
        <VoteBar pct={campaign.bluePct} />
        <div className="flex justify-between text-[11px] font-mono">
          <span className="text-for-400">{forPct}% For</span>
          <span className="text-surface-500">
            {campaign.totalVotes.toLocaleString()} votes
          </span>
          <span className="text-against-400">{100 - forPct}% Against</span>
        </div>
      </div>

      {/* Category + link */}
      <div className="flex items-center justify-between mt-3">
        {campaign.topicCategory && (
          <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
            {campaign.topicCategory}
          </span>
        )}
        <Link
          href={`/topic/${campaign.topicId}`}
          className="ml-auto flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
        >
          View debate
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({ post }: { post: RecentPost }) {
  return (
    <div className="flex gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/60">
      <Avatar
        src={post.author?.avatarUrl ?? null}
        fallback={post.author?.displayName ?? post.author?.username ?? '?'}
        size="sm"
        className="flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {post.author && (
            <Link
              href={`/profile/${post.author.username}`}
              className="text-xs font-semibold text-white hover:text-for-300 transition-colors"
            >
              {post.author.displayName ?? post.author.username}
            </Link>
          )}
          {post.isPinned && (
            <span className="flex items-center gap-0.5 text-[10px] font-mono text-gold">
              <Pin className="h-2.5 w-2.5" />
              Pinned
            </span>
          )}
          <span className="text-[10px] font-mono text-surface-500 ml-auto">
            {relativeTime(post.createdAt)}
          </span>
        </div>
        <p className="text-xs text-surface-300 leading-relaxed line-clamp-3">
          {post.content}
        </p>
      </div>
    </div>
  )
}

// ─── Contributor row ──────────────────────────────────────────────────────────

function ContributorRow({
  contributor,
  rank,
}: {
  contributor: WarRoomContributor
  rank: number
}) {
  const role = ROLE_CONFIG[contributor.coalitionRole]
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-surface-200/50 transition-colors">
      <span className="w-5 text-center text-[11px] font-mono text-surface-500">
        {rank}
      </span>
      <Avatar
        src={contributor.avatarUrl}
        fallback={contributor.displayName ?? contributor.username}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${contributor.username}`}
          className="text-xs font-semibold text-white hover:text-for-300 transition-colors truncate block"
        >
          {contributor.displayName ?? contributor.username}
        </Link>
        <p className="text-[10px] font-mono text-surface-500 truncate">
          @{contributor.username}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <role.Icon className={cn('h-3 w-3', role.color)} />
        <span className={cn('text-[10px] font-mono', role.color)}>{role.label}</span>
      </div>
      <div className="flex items-center gap-1 text-[11px] font-mono text-gold">
        <Zap className="h-3 w-3" />
        {contributor.clout.toLocaleString()}
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function WarRoomSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-24 rounded-2xl bg-surface-200" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-surface-200" />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-surface-200" />
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WarRoomPage() {
  const params = useParams<{ id: string }>()
  const coalitionId = params.id

  const [data, setData] = useState<WarRoomResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'campaigns' | 'intel' | 'roster'>('campaigns')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/war-room`)
      if (res.status === 403) {
        setError('This coalition is private. Join to access the war room.')
        return
      }
      if (!res.ok) {
        setError('Coalition not found.')
        return
      }
      const json = (await res.json()) as WarRoomResponse
      setData(json)
    } catch {
      setError('Failed to load war room. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [coalitionId])

  useEffect(() => {
    load()
  }, [load])

  const canPost =
    data?.currentUserRole === 'leader' || data?.currentUserRole === 'officer'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-28 md:pb-10 space-y-6">

        {/* ─── Back link ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link
            href={data ? `/coalitions/${coalitionId}` : '/coalitions'}
            className="flex items-center gap-1.5 text-sm font-mono text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {data ? data.coalition.name : 'Coalitions'}
          </Link>
        </div>

        {/* ─── Header ─────────────────────────────────────────────────── */}
        {loading ? (
          <WarRoomSkeleton />
        ) : error ? (
          <EmptyState
            icon={Shield}
            title="Access restricted"
            description={error}
          />
        ) : data ? (
          <>
            {/* Title block */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl bg-surface-100 border border-surface-300 p-6"
            >
              {/* Ambient glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple/5 via-transparent to-for-500/5 pointer-events-none" />

              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Swords className="h-5 w-5 text-purple" />
                    <span className="text-xs font-mono text-purple uppercase tracking-widest">
                      War Room
                    </span>
                    {data.currentUserRole && (
                      <span
                        className={cn(
                          'text-[10px] font-mono px-1.5 py-0.5 rounded border',
                          data.currentUserRole === 'leader'
                            ? 'text-gold border-gold/30 bg-gold/10'
                            : data.currentUserRole === 'officer'
                            ? 'text-purple border-purple/30 bg-purple/10'
                            : 'text-surface-400 border-surface-400/30 bg-surface-400/10',
                        )}
                      >
                        {ROLE_CONFIG[data.currentUserRole].label}
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl font-mono font-bold text-white">
                    {data.coalition.name}
                  </h1>
                  {data.coalition.description && (
                    <p className="text-sm text-surface-400 mt-1 line-clamp-2">
                      {data.coalition.description}
                    </p>
                  )}
                </div>

                <Link
                  href={`/coalitions/${coalitionId}/analytics`}
                  className="flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors whitespace-nowrap"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  Analytics
                </Link>
              </div>

              {/* Stats row */}
              <div className="relative grid grid-cols-4 gap-3 mt-5">
                {[
                  {
                    icon: Users,
                    label: 'Members',
                    value: `${data.coalition.memberCount}/${data.coalition.maxMembers}`,
                    color: 'text-for-400',
                  },
                  {
                    icon: Trophy,
                    label: 'Win Rate',
                    value:
                      data.winRate !== null ? `${data.winRate}%` : '—',
                    color: 'text-gold',
                  },
                  {
                    icon: Zap,
                    label: 'Influence',
                    value: data.coalition.influence.toLocaleString(),
                    color: 'text-purple',
                  },
                  {
                    icon: Target,
                    label: 'Campaigns',
                    value: data.activeCampaigns.length.toString(),
                    color: 'text-emerald',
                  },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-surface-200/60 border border-surface-300/60"
                  >
                    <Icon className={cn('h-4 w-4', color)} />
                    <span className="text-base font-mono font-bold text-white tabular-nums">
                      {value}
                    </span>
                    <span className="text-[10px] font-mono text-surface-500">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ─── Quick actions (leaders/officers only) ──────────────── */}
            {canPost && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-3 gap-3"
              >
                <Link
                  href={`/coalitions/${coalitionId}#bulletin`}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-purple/40 hover:bg-surface-200/60 transition-all group"
                >
                  <Megaphone className="h-5 w-5 text-purple group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-mono text-surface-300 group-hover:text-white transition-colors text-center">
                    Post Update
                  </span>
                </Link>
                <Link
                  href={`/coalitions/${coalitionId}#stance`}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-for-500/40 hover:bg-surface-200/60 transition-all group"
                >
                  <Scale className="h-5 w-5 text-for-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-mono text-surface-300 group-hover:text-white transition-colors text-center">
                    Declare Stance
                  </span>
                </Link>
                {data.openSlots > 0 && (
                  <Link
                    href={`/coalitions/${coalitionId}#invite`}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-emerald/40 hover:bg-surface-200/60 transition-all group"
                  >
                    <UserPlus className="h-5 w-5 text-emerald group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-mono text-surface-300 group-hover:text-white transition-colors text-center">
                      Invite ({data.openSlots} open)
                    </span>
                  </Link>
                )}
              </motion.div>
            )}

            {/* ─── Tabs ────────────────────────────────────────────────── */}
            <div className="flex gap-1 p-1 bg-surface-100 border border-surface-300 rounded-xl">
              {(
                [
                  {
                    id: 'campaigns' as const,
                    label: 'Campaigns',
                    Icon: Swords,
                    count: data.activeCampaigns.length,
                  },
                  {
                    id: 'intel' as const,
                    label: 'Intel',
                    Icon: Bell,
                    count: data.recentPosts.length,
                  },
                  {
                    id: 'roster' as const,
                    label: 'Roster',
                    Icon: Users,
                    count: data.coalition.memberCount,
                  },
                ] as const
              ).map(({ id, label, Icon, count }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
                    activeTab === id
                      ? 'bg-surface-200 text-white shadow-sm'
                      : 'text-surface-400 hover:text-white',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {count > 0 && (
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded-full text-[10px]',
                        activeTab === id
                          ? 'bg-for-500/20 text-for-400'
                          : 'bg-surface-300/60 text-surface-500',
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ─── Tab content ────────────────────────────────────────── */}
            <AnimatePresence mode="wait">
              {activeTab === 'campaigns' && (
                <motion.div
                  key="campaigns"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* Active campaigns */}
                  {data.activeCampaigns.length > 0 ? (
                    <div className="space-y-3">
                      <h2 className="text-xs font-mono text-surface-500 uppercase tracking-widest">
                        Active Campaigns
                      </h2>
                      {data.activeCampaigns.map((c) => (
                        <CampaignCard key={c.stanceId} campaign={c} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Target}
                      title="No active campaigns"
                      description="Declare your coalition's stance on a debate topic to start a campaign."
                    />
                  )}

                  {/* Resolved campaigns */}
                  {data.resolvedCampaigns.length > 0 && (
                    <div className="space-y-3">
                      <h2 className="text-xs font-mono text-surface-500 uppercase tracking-widest">
                        Recent Outcomes
                      </h2>
                      {data.resolvedCampaigns.map((c) => (
                        <div key={c.stanceId} className="opacity-60 hover:opacity-80 transition-opacity">
                          <CampaignCard campaign={c} />
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'intel' && (
                <motion.div
                  key="intel"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  {data.recentPosts.length > 0 ? (
                    <>
                      <h2 className="text-xs font-mono text-surface-500 uppercase tracking-widest">
                        Coalition Bulletins
                      </h2>
                      {data.recentPosts.map((post) => (
                        <PostCard key={post.id} post={post} />
                      ))}
                      <Link
                        href={`/coalitions/${coalitionId}#bulletin`}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-xs font-mono text-surface-400 hover:text-white border border-surface-300/60 hover:border-surface-400/60 transition-all"
                      >
                        View all bulletins
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </>
                  ) : (
                    <EmptyState
                      icon={Bell}
                      title="No bulletins yet"
                      description={
                        canPost
                          ? 'Post the first update to your coalition.'
                          : 'Leaders and officers can post updates here.'
                      }
                    />
                  )}
                </motion.div>
              )}

              {activeTab === 'roster' && (
                <motion.div
                  key="roster"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-1"
                >
                  <h2 className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-3">
                    {data.coalition.memberCount} Member
                    {data.coalition.memberCount !== 1 ? 's' : ''}
                    {data.openSlots > 0 && (
                      <span className="ml-2 text-emerald">
                        · {data.openSlots} open slot
                        {data.openSlots !== 1 ? 's' : ''}
                      </span>
                    )}
                  </h2>
                  <div className="bg-surface-100 border border-surface-300 rounded-xl divide-y divide-surface-300/50 overflow-hidden">
                    {data.contributors.map((c, i) => (
                      <ContributorRow key={c.userId} contributor={c} rank={i + 1} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
