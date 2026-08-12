'use client'

/**
 * /profile/[username]/journey — Civic Journey
 *
 * Narrative milestone timeline of a citizen's civic life — from their first
 * vote through their most impactful moments, rendered as a beautiful story.
 *
 * Distinct from:
 *   /profile/[username]/timeline  — raw chronological event log
 *   /profile/[username]/growth    — monthly stats + milestones chart
 *   /profile/[username]/analytics — voting patterns and accuracy analysis
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Coins,
  ExternalLink,
  Flame,
  Gavel,
  Globe,
  Loader2,
  MessageSquare,
  Mic,
  RefreshCw,
  Scroll,
  Shield,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  User,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { JourneyResponse, JourneyChapter, JourneyStats } from '@/app/api/profile/[username]/journey/route'

// ─── Phase config ─────────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<JourneyChapter['phase'], {
  label: string
  color: string
  borderColor: string
  bg: string
  dotColor: string
}> = {
  origin:      { label: 'Origin',      color: 'text-surface-500',  borderColor: 'border-surface-400',  bg: 'bg-surface-300/30',   dotColor: 'bg-surface-500' },
  discovery:   { label: 'Discovery',   color: 'text-for-400',      borderColor: 'border-for-500/40',   bg: 'bg-for-500/8',        dotColor: 'bg-for-500' },
  rising:      { label: 'Rising',      color: 'text-purple',       borderColor: 'border-purple/40',    bg: 'bg-purple/8',         dotColor: 'bg-purple' },
  established: { label: 'Established', color: 'text-gold',         borderColor: 'border-gold/40',      bg: 'bg-gold/8',           dotColor: 'bg-gold' },
  legend:      { label: 'Legend',      color: 'text-emerald',      borderColor: 'border-emerald/40',   bg: 'bg-emerald/8',        dotColor: 'bg-emerald' },
}

// ─── Chapter icon map ─────────────────────────────────────────────────────────

function chapterIcon(id: string): React.ComponentType<{ className?: string }> {
  const map: Record<string, React.ComponentType<{ className?: string }>> = {
    origin:           Globe,
    first_vote:       Vote,
    first_argument:   MessageSquare,
    first_debate:     Mic,
    first_achievement: Trophy,
    top_argument:     Star,
    law_contribution: Gavel,
    role_upgrade:     Shield,
  }
  return map[id] ?? Sparkles
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(months / 12)
  return `${years}yr ago`
}

function sideColor(side: string): string {
  return side === 'blue' ? 'text-for-400' : 'text-against-400'
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-1">
      <Icon className={cn('h-4 w-4 mb-0.5', color)} />
      <span className="text-lg font-mono font-bold text-white">{value}</span>
      <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider leading-tight">{label}</span>
    </div>
  )
}

// ─── Chapter card ─────────────────────────────────────────────────────────────

function ChapterCard({
  chapter,
  isLast,
  index,
}: {
  chapter: JourneyChapter
  isLast: boolean
  index: number
}) {
  const phase = PHASE_CONFIG[chapter.phase]
  const Icon = chapterIcon(chapter.id)
  const side = chapter.meta?.side as string | undefined

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      className="flex gap-4"
    >
      {/* Timeline rail */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={cn(
          'flex items-center justify-center h-9 w-9 rounded-full border-2',
          'bg-surface-100 shadow-sm',
          phase.borderColor,
        )}>
          <Icon className={cn('h-4 w-4', phase.color)} />
        </div>
        {!isLast && (
          <div className="w-px flex-1 mt-2 mb-1 bg-gradient-to-b from-surface-400 to-transparent min-h-[2rem]" />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 pb-6', isLast && 'pb-0')}>
        <div className={cn(
          'rounded-xl border p-4 space-y-1.5',
          phase.bg,
          phase.borderColor,
        )}>
          {/* Phase label + date */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className={cn('text-[10px] font-mono uppercase tracking-widest font-semibold', phase.color)}>
              {phase.label}
            </span>
            <span className="text-[10px] font-mono text-surface-500">
              {relativeDate(chapter.date)}
            </span>
          </div>

          {/* Title */}
          <p className="text-sm font-semibold text-white leading-snug">{chapter.title}</p>

          {/* Subtitle */}
          <p className="text-xs text-surface-400 leading-relaxed">{chapter.subtitle}</p>

          {/* Side indicator */}
          {side && (
            <div className="flex items-center gap-1.5 mt-1">
              {side === 'blue' ? (
                <ThumbsUp className="h-3 w-3 text-for-400" />
              ) : (
                <ThumbsDown className="h-3 w-3 text-against-400" />
              )}
              <span className={cn('text-[11px] font-mono font-medium', sideColor(side))}>
                {side === 'blue' ? 'Voted FOR' : 'Voted AGAINST'}
              </span>
            </div>
          )}

          {/* Detail */}
          {chapter.detail && (
            <p className="text-[11px] font-mono text-surface-500 mt-1">{chapter.detail}</p>
          )}

          {/* Full date + link */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
            <span className="text-[10px] font-mono text-surface-600">
              {formatDate(chapter.date)}
            </span>
            {chapter.link && (
              <Link
                href={chapter.link}
                className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-white transition-colors group"
              >
                View
                <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Hero panel ──────────────────────────────────────────────────────────────

function JourneyHero({
  profile,
  stats,
}: {
  profile: JourneyResponse['profile']
  stats: JourneyStats
}) {
  const roleLabels: Record<string, { label: string; color: string }> = {
    person:       { label: 'Citizen',       color: 'text-surface-400' },
    debator:      { label: 'Debator',       color: 'text-for-400' },
    troll_catcher:{ label: 'Troll Catcher', color: 'text-emerald' },
    elder:        { label: 'Elder',         color: 'text-gold' },
  }
  const roleInfo = roleLabels[profile.role] ?? roleLabels.person

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const sideDescription = {
    blue: 'Primarily FOR',
    red: 'Primarily AGAINST',
    balanced: 'Balanced voter',
  }[stats.foeSide]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      <div className="flex items-start gap-4">
        <div className="relative">
          <Avatar
            src={profile.avatar_url}
            username={profile.username}
            size="lg"
          />
          {profile.civic_archetype && (
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-gold" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-lg leading-none">
            {profile.display_name ?? profile.username}
          </p>
          <p className="text-sm text-surface-500 mt-0.5">@{profile.username}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={cn('text-xs font-mono font-medium', roleInfo.color)}>
              {roleInfo.label}
            </span>
            <span className="text-surface-600 text-xs">·</span>
            <span className="text-xs text-surface-500">
              Since {memberSince}
            </span>
          </div>
          {profile.civic_archetype && (
            <p className="text-[11px] font-mono text-gold/80 mt-1">
              {profile.civic_archetype}
            </p>
          )}
        </div>
      </div>

      {/* Quick bio stats */}
      <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-surface-300">
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
          <span className="text-surface-400">{stats.daysActive} days active</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {stats.foeSide === 'blue' ? (
            <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
          ) : stats.foeSide === 'red' ? (
            <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
          ) : (
            <Vote className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
          )}
          <span className="text-surface-400">{sideDescription}</span>
        </div>
        {stats.topCategory && (
          <div className="flex items-center gap-2 text-xs">
            <BookOpen className="h-3.5 w-3.5 text-purple flex-shrink-0" />
            <span className="text-surface-400">Top: {stats.topCategory}</span>
          </div>
        )}
        {stats.lawsContributed > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <Gavel className="h-3.5 w-3.5 text-gold flex-shrink-0" />
            <span className="text-surface-400">{stats.lawsContributed} laws contributed</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function JourneyPage() {
  const params = useParams()
  const router = useRouter()
  const username = typeof params.username === 'string' ? params.username : ''

  const [data, setData] = useState<JourneyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/profile/${username}/journey`)
      if (!res.ok) {
        setError(res.status === 404 ? 'Citizen not found' : 'Failed to load journey')
        return
      }
      setData(await res.json())
    } catch {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            type="button"
            onClick={() => router.back()}
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
              'transition-colors',
            )}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="font-mono text-xl font-bold text-white flex items-center gap-2">
              <Scroll className="h-5 w-5 text-gold" />
              Civic Journey
            </h1>
            {username && (
              <p className="text-xs text-surface-500 font-mono mt-0.5">@{username}</p>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-start gap-4">
                <Skeleton className="h-16 w-16 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-40 mt-2" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                  <Skeleton className="h-4 w-4 mb-1.5" />
                  <Skeleton className="h-6 w-12 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
                  <div className="flex-1 rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <EmptyState
            icon={User}
            title={error}
            description="This citizen's journey could not be loaded."
            action={
              <button
                type="button"
                onClick={load}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-sm text-white hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            }
          />
        )}

        {/* Content */}
        {!loading && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              {/* Hero */}
              <JourneyHero profile={data.profile} stats={data.stats} />

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <StatTile
                  label="Total Votes"
                  value={data.profile.total_votes.toLocaleString()}
                  icon={Vote}
                  color="text-for-400"
                />
                <StatTile
                  label="Arguments"
                  value={data.profile.total_arguments.toLocaleString()}
                  icon={MessageSquare}
                  color="text-purple"
                />
                <StatTile
                  label="Clout"
                  value={data.profile.clout.toLocaleString()}
                  icon={Coins}
                  color="text-gold"
                />
              </div>

              {/* Chapters */}
              {data.chapters.length === 0 ? (
                <EmptyState
                  icon={Scroll}
                  title="Journey just beginning"
                  description="Cast your first vote to start writing your civic story."
                  action={
                    <Link
                      href="/"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-500/20 border border-for-500/30 text-sm text-for-300 hover:bg-for-500/30 transition-colors"
                    >
                      Explore topics
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  }
                />
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-px flex-1 bg-surface-300" />
                    <span className="text-[10px] font-mono text-surface-600 uppercase tracking-widest px-2">
                      Milestones
                    </span>
                    <div className="h-px flex-1 bg-surface-300" />
                  </div>
                  <div className="space-y-0">
                    {data.chapters.map((chapter, i) => (
                      <ChapterCard
                        key={chapter.id}
                        chapter={chapter}
                        isLast={i === data.chapters.length - 1}
                        index={i}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Footer links */}
              <div className="rounded-xl border border-surface-300 bg-surface-100/50 divide-y divide-surface-300">
                <Link
                  href={`/profile/${username}/growth`}
                  className="flex items-center justify-between px-4 py-3 text-sm text-white hover:bg-surface-200/50 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <TrendingUp className="h-4 w-4 text-for-400" />
                    <span>Growth chart</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-500 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  href={`/profile/${username}/achievements`}
                  className="flex items-center justify-between px-4 py-3 text-sm text-white hover:bg-surface-200/50 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <Trophy className="h-4 w-4 text-gold" />
                    <span>All achievements</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-500 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  href={`/profile/${username}/analytics`}
                  className="flex items-center justify-between px-4 py-3 text-sm text-white hover:bg-surface-200/50 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <Zap className="h-4 w-4 text-purple" />
                    <span>Voting analytics</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-500 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
