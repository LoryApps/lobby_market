'use client'

/**
 * /profile/[username]/moments — Personal Civic Moments
 *
 * A highlight reel of the user's most significant, one-of-a-kind civic
 * moments on the platform: first vote, most upvoted argument, first law
 * co-created, best prediction win, lone dissenter moment, and more.
 *
 * Distinct from:
 *   /profile/[username]/timeline   — full chronological activity log
 *   /profile/[username]/analytics  — aggregate performance charts
 *   /profile/[username]/achievements — gamification badges earned
 *   /moments                        — platform-wide highlights feed
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BookOpen,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  Gavel,
  Loader2,
  MessageSquare,
  Quote,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CivicMoment, MomentsResponse } from '@/app/api/profile/[username]/moments/route'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const mo = Math.floor(d / 30)
  const y = Math.floor(d / 365)
  if (y >= 1) return `${y}y ago`
  if (mo >= 1) return `${mo}mo ago`
  if (d >= 1) return `${d}d ago`
  if (h >= 1) return `${h}h ago`
  if (m >= 2) return `${m}m ago`
  return 'just now'
}

function absoluteDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// ─── Moment type config ───────────────────────────────────────────────────────

type MomentType = CivicMoment['type']

interface MomentConfig {
  icon: typeof Flame
  iconColor: string
  iconBg: string
  iconBorder: string
  accentColor: string
  tagLabel: string
  tagColor: string
  tagBg: string
}

const MOMENT_CONFIG: Record<MomentType, MomentConfig> = {
  first_vote: {
    icon: Vote,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    iconBorder: 'border-for-500/30',
    accentColor: 'text-for-300',
    tagLabel: 'ORIGIN',
    tagColor: 'text-for-400',
    tagBg: 'bg-for-500/10',
  },
  first_argument: {
    icon: MessageSquare,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    iconBorder: 'border-purple/30',
    accentColor: 'text-purple',
    tagLabel: 'DEBUT',
    tagColor: 'text-purple',
    tagBg: 'bg-purple/10',
  },
  top_argument: {
    icon: Trophy,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    iconBorder: 'border-gold/30',
    accentColor: 'text-gold',
    tagLabel: 'PEAK',
    tagColor: 'text-gold',
    tagBg: 'bg-gold/10',
  },
  most_debated_argument: {
    icon: Users,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
    iconBorder: 'border-emerald/30',
    accentColor: 'text-emerald',
    tagLabel: 'IGNITED',
    tagColor: 'text-emerald',
    tagBg: 'bg-emerald/10',
  },
  first_law_vote: {
    icon: Gavel,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    iconBorder: 'border-gold/30',
    accentColor: 'text-gold',
    tagLabel: 'HISTORY',
    tagColor: 'text-gold',
    tagBg: 'bg-gold/10',
  },
  best_prediction: {
    icon: Zap,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    iconBorder: 'border-purple/30',
    accentColor: 'text-purple',
    tagLabel: 'ORACLE',
    tagColor: 'text-purple',
    tagBg: 'bg-purple/10',
  },
  streak_peak: {
    icon: Flame,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
    iconBorder: 'border-against-500/30',
    accentColor: 'text-against-400',
    tagLabel: 'STREAK',
    tagColor: 'text-against-400',
    tagBg: 'bg-against-500/10',
  },
  founding_vote: {
    icon: Star,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    iconBorder: 'border-gold/30',
    accentColor: 'text-gold',
    tagLabel: 'FOUNDER',
    tagColor: 'text-gold',
    tagBg: 'bg-gold/10',
  },
  lone_dissenter: {
    icon: Shield,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
    iconBorder: 'border-against-500/30',
    accentColor: 'text-against-400',
    tagLabel: 'REBEL',
    tagColor: 'text-against-400',
    tagBg: 'bg-against-500/10',
  },
  consensus_caller: {
    icon: Award,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    iconBorder: 'border-for-500/30',
    accentColor: 'text-for-300',
    tagLabel: 'ALIGNED',
    tagColor: 'text-for-400',
    tagBg: 'bg-for-500/10',
  },
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function MomentsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <div className="rounded-lg bg-surface-200 border border-surface-300 p-3">
            <Skeleton className="h-3 w-full mb-1" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Moment card ──────────────────────────────────────────────────────────────

function MomentCard({ moment, index }: { moment: CivicMoment; index: number }) {
  const cfg = MOMENT_CONFIG[moment.type] ?? MOMENT_CONFIG.first_vote
  const Icon = cfg.icon

  const sideLabel = moment.side === 'blue' ? 'FOR' : moment.side === 'red' ? 'AGAINST' : null
  const sideColor = moment.side === 'blue' ? 'text-for-400' : 'text-against-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: 'easeOut' }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 hover:border-surface-400/70 transition-colors"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className={cn(
            'flex items-center justify-center h-11 w-11 rounded-xl border flex-shrink-0',
            cfg.iconBg,
            cfg.iconBorder
          )}
        >
          <Icon className={cn('h-5 w-5', cfg.iconColor)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-mono font-bold text-white">
              {moment.title}
            </span>
            <span
              className={cn(
                'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border',
                cfg.tagColor,
                cfg.tagBg,
                `border-${cfg.tagBg.replace('bg-', '').replace('/10', '/30')}`
              )}
            >
              {cfg.tagLabel}
            </span>
          </div>
          <p className="text-xs font-mono text-surface-500">
            {absoluteDate(moment.occurred_at)}
            <span className="text-surface-600 mx-1">·</span>
            <span className="text-surface-600">{relativeTime(moment.occurred_at)}</span>
          </p>
        </div>

        {/* Metric badge */}
        {moment.metric_value !== undefined && (
          <div className="text-right flex-shrink-0">
            <div className={cn('text-lg font-mono font-bold', cfg.accentColor)}>
              {moment.metric_value.toLocaleString()}
            </div>
            <div className="text-[10px] font-mono text-surface-600 uppercase tracking-wider">
              {moment.metric_label}
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-xs font-mono text-surface-400 mb-3 leading-relaxed">
        {moment.description}
      </p>

      {/* Argument body quote */}
      {moment.argument_body && (
        <div className="rounded-lg bg-surface-200/70 border border-surface-300/60 p-3 mb-3">
          <div className="flex items-start gap-2">
            <Quote className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-surface-300 leading-relaxed italic">
              {truncate(moment.argument_body, 200)}
            </p>
          </div>
          {sideLabel && (
            <div className="mt-2 flex items-center gap-1.5">
              {moment.side === 'blue' ? (
                <ThumbsUp className="h-3 w-3 text-for-400" />
              ) : (
                <ThumbsDown className="h-3 w-3 text-against-400" />
              )}
              <span className={cn('text-[10px] font-mono font-bold', sideColor)}>
                {sideLabel}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Topic link */}
      {moment.topic_id && moment.topic_statement && (
        <Link
          href={`/topic/${moment.topic_id}`}
          className="flex items-center gap-2 rounded-lg bg-surface-200/50 border border-surface-300/50 p-2.5 hover:bg-surface-200 hover:border-surface-400/50 transition-colors group"
        >
          {moment.topic_status === 'law' && (
            <Gavel className="h-3.5 w-3.5 text-gold flex-shrink-0" />
          )}
          {!moment.argument_body && sideLabel && (
            moment.side === 'blue'
              ? <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
              : <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
          )}
          <span className="text-xs font-mono text-surface-400 group-hover:text-surface-300 transition-colors truncate flex-1">
            {truncate(moment.topic_statement, 90)}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {moment.category && (
              <span className="text-[10px] font-mono text-surface-600 hidden sm:block">
                {moment.category}
              </span>
            )}
            <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
          </div>
        </Link>
      )}
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProfileMomentsPage() {
  const params = useParams<{ username: string }>()
  const username = params?.username ?? ''

  const [data, setData] = useState<MomentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!username) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/profile/${username}/moments`, { cache: 'no-store' })
      if (!res.ok) throw new Error(res.status === 404 ? 'User not found' : 'Failed to load moments')
      const json = (await res.json()) as MomentsResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => {
    void load()
  }, [load])

  const profile = data?.profile
  const moments = data?.moments ?? []
  const displayName = profile?.display_name || profile?.username || username

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back nav */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/profile/${username}`}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to profile
          </Link>
          <span className="text-surface-700">·</span>
          <Link
            href={`/profile/${username}`}
            className="text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            @{username}
          </Link>
        </div>

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
            <Sparkles className="h-5 w-5 text-gold" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">Civic Moments</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              {loading ? 'Loading…' : `${displayName}'s most significant civic milestones`}
            </p>
          </div>
          {!loading && (
            <button
              onClick={load}
              className="ml-auto p-2 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-200 transition-colors"
              aria-label="Refresh moments"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Profile strip */}
        {profile && (
          <Link
            href={`/profile/${username}`}
            className="flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-300 p-3 mb-6 hover:border-surface-400/60 transition-colors group"
          >
            <Avatar
              src={profile.avatar_url}
              fallback={profile.display_name || profile.username}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {profile.display_name || profile.username}
              </p>
              <p className="text-xs font-mono text-surface-500">
                @{profile.username}
                {profile.total_votes > 0 && (
                  <span className="text-surface-600 mx-1">·</span>
                )}
                {profile.total_votes > 0 && (
                  <span>{profile.total_votes.toLocaleString()} votes</span>
                )}
              </p>
            </div>
            <ExternalLink className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" />
          </Link>
        )}

        {/* States */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <MomentsSkeleton />
            </motion.div>
          )}

          {!loading && error && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Loader2}
                title="Couldn't load moments"
                description={error}
                actions={[{ label: 'Try Again', onClick: load }]}
              />
            </motion.div>
          )}

          {!loading && !error && moments.length === 0 && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Sparkles}
                iconColor="text-gold"
                iconBg="bg-gold/10"
                iconBorder="border-gold/30"
                title="No moments yet"
                description={
                  data?.is_own_profile
                    ? 'Cast your first vote and write your first argument to start building your civic story.'
                    : `${displayName} hasn't left a civic footprint yet.`
                }
                actions={
                  data?.is_own_profile
                    ? [{ label: 'Explore the Feed', href: '/', icon: Flame }]
                    : []
                }
              />
            </motion.div>
          )}

          {!loading && !error && moments.length > 0 && (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {/* Count badge */}
              <div className="flex items-center gap-2 text-xs font-mono text-surface-500 mb-2">
                <BookOpen className="h-3.5 w-3.5" />
                <span>{moments.length} civic moment{moments.length !== 1 ? 's' : ''}</span>
                <span className="text-surface-700">·</span>
                <span className="text-surface-600">
                  Since {absoluteDate(profile?.created_at ?? '')}
                </span>
              </div>

              {/* Moment cards */}
              {moments.map((moment, i) => (
                <MomentCard key={moment.id} moment={moment} index={i} />
              ))}

              {/* Footer links */}
              <div className="pt-2 border-t border-surface-300 flex flex-col sm:flex-row items-center gap-2 text-xs font-mono text-surface-600">
                <Link href={`/profile/${username}/timeline`} className="hover:text-surface-400 transition-colors flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Full timeline
                </Link>
                <span className="hidden sm:block text-surface-700">·</span>
                <Link href={`/profile/${username}/analytics`} className="hover:text-surface-400 transition-colors flex items-center gap-1">
                  <Trophy className="h-3.5 w-3.5" />
                  Analytics
                </Link>
                <span className="hidden sm:block text-surface-700">·</span>
                <Link href={`/profile/${username}/achievements`} className="hover:text-surface-400 transition-colors flex items-center gap-1">
                  <Award className="h-3.5 w-3.5" />
                  Achievements
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
