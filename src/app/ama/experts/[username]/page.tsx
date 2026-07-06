'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  ExternalLink,
  FlaskConical,
  Gavel,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Loader2,
  MessageSquare,
  Mic,
  Music2,
  Radio,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  AMAExpertProfileResponse,
  ExpertSession,
  ExpertAnswer,
} from '@/app/api/ama/experts/[username]/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; border: string }
> = {
  Economics:   { icon: TrendingUp,    color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/20' },
  Politics:    { icon: Landmark,      color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/20' },
  Technology:  { icon: Cpu,           color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/20' },
  Science:     { icon: FlaskConical,  color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/20' },
  Law:         { icon: Scale,         color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/20' },
  Education:   { icon: GraduationCap, color: 'text-for-300',     bg: 'bg-for-500/10',     border: 'border-for-500/20' },
  Health:      { icon: Heart,         color: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/20' },
  Environment: { icon: Leaf,          color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/20' },
  Culture:     { icon: Music2,        color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/20' },
  Ethics:      { icon: Gavel,         color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/20' },
  Philosophy:  { icon: Sparkles,      color: 'text-for-300',     bg: 'bg-for-300/10',     border: 'border-for-300/20' },
}

const FALLBACK_CAT = { icon: Radio, color: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-300' }

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  person:        { label: 'Citizen',       color: 'text-surface-500' },
  debator:       { label: 'Debater',       color: 'text-for-400' },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald' },
  elder:         { label: 'Elder',         color: 'text-gold' },
  senator:       { label: 'Senator',       color: 'text-purple' },
  lawmaker:      { label: 'Lawmaker',      color: 'text-gold' },
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; dot?: string }
> = {
  upcoming: {
    label: 'Upcoming',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  live: {
    label: 'Live now',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    dot: 'bg-emerald',
  },
  ended: {
    label: 'Ended',
    color: 'text-surface-500',
    bg: 'bg-surface-300/40',
    border: 'border-surface-300',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SessionCard({ session }: { session: ExpertSession }) {
  const cfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.ended
  const catCfg = session.category
    ? (CATEGORY_CONFIG[session.category] ?? FALLBACK_CAT)
    : FALLBACK_CAT
  const CatIcon = catCfg.icon

  const [rsvped, setRsvped] = useState(session.user_rsvped)
  const [rsvpBusy, setRsvpBusy] = useState(false)

  async function toggleRsvp(e: React.MouseEvent) {
    e.preventDefault()
    if (rsvpBusy || session.status === 'ended') return
    setRsvpBusy(true)
    try {
      const res = await fetch(`/api/ama/${session.id}/rsvp`, {
        method: rsvped ? 'DELETE' : 'POST',
      })
      if (res.ok) setRsvped((r) => !r)
    } catch {
      // best-effort
    } finally {
      setRsvpBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400/80 transition-colors overflow-hidden"
    >
      <Link href={`/ama/${session.id}`} className="block p-4">
        {/* Status + category row */}
        <div className="flex items-center gap-2 mb-2.5">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border',
              cfg.color, cfg.bg, cfg.border
            )}
          >
            {cfg.dot && (
              <span className={cn('h-1.5 w-1.5 rounded-full animate-pulse', cfg.dot)} />
            )}
            {cfg.label}
          </span>
          {session.category && (
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border',
                catCfg.color, catCfg.bg, catCfg.border
              )}
            >
              <CatIcon className="h-2.5 w-2.5" />
              {session.category}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-mono text-sm font-semibold text-white leading-snug mb-1.5 line-clamp-2">
          {session.title}
        </h3>

        {/* Date */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 mb-3">
          <Calendar className="h-3 w-3" />
          {formatDate(session.scheduled_at)}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-[11px] font-mono text-surface-500">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {session.question_count} questions
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {session.answer_count} answered
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {session.rsvp_count} RSVPs
          </span>
        </div>
      </Link>

      {/* RSVP button for upcoming/live sessions */}
      {(session.status === 'upcoming' || session.status === 'live') && (
        <div className="px-4 pb-4">
          <button
            onClick={toggleRsvp}
            disabled={rsvpBusy}
            className={cn(
              'w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
              'border disabled:opacity-50',
              rsvped
                ? 'bg-for-500/15 border-for-500/40 text-for-300 hover:bg-for-500/10'
                : 'bg-for-600 border-for-600 text-white hover:bg-for-500'
            )}
          >
            {rsvpBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : rsvped ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                RSVP&apos;d
              </>
            ) : (
              <>
                <Calendar className="h-3.5 w-3.5" />
                RSVP to this session
              </>
            )}
          </button>
        </div>
      )}
    </motion.div>
  )
}

function AnswerCard({ answer }: { answer: ExpertAnswer }) {
  const catCfg = answer.session.category
    ? (CATEGORY_CONFIG[answer.session.category] ?? FALLBACK_CAT)
    : FALLBACK_CAT
  const CatIcon = catCfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-surface-100 border border-surface-300 p-4"
    >
      {/* Question */}
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-shrink-0 mt-0.5 flex items-center justify-center h-5 w-5 rounded-full bg-surface-300/60 border border-surface-300">
          <MessageSquare className="h-2.5 w-2.5 text-surface-500" />
        </div>
        <div>
          <p className="text-xs font-mono text-surface-400 leading-relaxed italic">
            &ldquo;{answer.question.content}&rdquo;
          </p>
          {answer.question.upvotes > 0 && (
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-mono text-for-400">
              <ThumbsUp className="h-2.5 w-2.5" />
              {answer.question.upvotes} upvotes
            </span>
          )}
        </div>
      </div>

      {/* Answer */}
      <p className="text-sm font-mono text-surface-300 leading-relaxed line-clamp-4 mb-3">
        {answer.content}
      </p>

      {/* Session link + time */}
      <div className="flex items-center justify-between">
        <Link
          href={`/ama/${answer.session.id}`}
          className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
        >
          <CatIcon className={cn('h-2.5 w-2.5', catCfg.color)} />
          {answer.session.title.slice(0, 40)}{answer.session.title.length > 40 ? '…' : ''}
          <ExternalLink className="h-2.5 w-2.5" />
        </Link>
        <span className="text-[10px] font-mono text-surface-600">
          {relativeTime(answer.created_at)}
        </span>
      </div>
    </motion.div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  value,
  label,
  color = 'text-white',
}: {
  value: number | string
  label: string
  color?: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-surface-200/60 border border-surface-300/60 p-3">
      <span className={cn('font-mono text-lg font-bold tabular-nums', color)}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider text-center leading-tight">
        {label}
      </span>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'sessions' | 'answers'

// ─── Main page component ──────────────────────────────────────────────────────

export default function AMAExpertProfilePage() {
  const params = useParams()
  const router = useRouter()
  const username = params.username as string

  const [data, setData] = useState<AMAExpertProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('sessions')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ama/experts/${username}`, { cache: 'no-store' })
      if (res.status === 404) {
        setError('Expert not found')
        return
      }
      if (!res.ok) throw new Error('Failed to load expert profile')
      const json = (await res.json()) as AMAExpertProfileResponse
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => {
    load()
  }, [load])

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 mb-4 space-y-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-full max-w-xs" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 mt-5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-20 text-center">
          <EmptyState
            icon={Mic}
            iconColor="text-surface-500"
            title="Expert not found"
            description={error ?? 'This expert profile could not be loaded.'}
            action={{ label: 'Browse all experts', href: '/ama/experts' }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const { profile, stats, sessions, topAnswers } = data

  const roleInfo = ROLE_LABEL[profile.role] ?? ROLE_LABEL.person
  const upcomingSession = sessions.find((s) => s.status === 'upcoming' || s.status === 'live')

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back nav */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-400 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Link
            href="/ama/experts"
            className="text-sm font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1.5"
          >
            AMA Experts
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-white">{profile.display_name ?? profile.username}</span>
          </Link>
        </div>

        {/* Profile card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-6 mb-4"
        >
          <div className="flex items-start gap-4">
            <Avatar
              src={profile.avatar_url}
              fallback={profile.display_name ?? profile.username}
              size="lg"
              className="flex-shrink-0 ring-2 ring-surface-300"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="font-mono text-xl font-bold text-white truncate">
                  {profile.display_name ?? profile.username}
                </h1>
                {data.isCurrentUser && (
                  <span className="flex-shrink-0 text-[10px] font-mono text-surface-500 bg-surface-200 border border-surface-300 px-2 py-0.5 rounded-full">
                    You
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-surface-500">@{profile.username}</span>
                <span className="h-2.5 w-px bg-surface-400/50" />
                <span className={cn('text-xs font-mono', roleInfo.color)}>{roleInfo.label}</span>
              </div>
              {profile.bio && (
                <p className="text-sm font-mono text-surface-400 leading-relaxed line-clamp-2">
                  {profile.bio}
                </p>
              )}

              {/* Categories */}
              {stats.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {stats.categories.slice(0, 5).map((cat) => {
                    const cfg = CATEGORY_CONFIG[cat] ?? FALLBACK_CAT
                    const Icon = cfg.icon
                    return (
                      <span
                        key={cat}
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border',
                          cfg.color, cfg.bg, cfg.border
                        )}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {cat}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Profile link */}
            <Link
              href={`/profile/${profile.username}`}
              className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:border-surface-400 hover:text-white transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Profile
            </Link>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2 mt-5">
            <StatTile
              value={stats.totalSessions}
              label="Sessions"
              color="text-for-400"
            />
            <StatTile
              value={stats.totalAnswers}
              label="Answers"
              color="text-emerald"
            />
            <StatTile
              value={stats.totalQuestions}
              label="Questions"
              color="text-purple"
            />
            <StatTile
              value={stats.totalRsvps}
              label="RSVPs"
              color="text-gold"
            />
          </div>

          {/* Clout + rep */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-surface-300/60">
            <div className="flex items-center gap-1.5 text-xs font-mono text-gold">
              <Zap className="h-3.5 w-3.5" />
              <span className="tabular-nums">{profile.clout.toLocaleString()}</span>
              <span className="text-surface-500">clout</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-purple">
              <Trophy className="h-3.5 w-3.5" />
              <span className="tabular-nums">{profile.reputation_score.toLocaleString()}</span>
              <span className="text-surface-500">reputation</span>
            </div>
            {stats.upcomingSessions > 0 && (
              <div className="ml-auto flex items-center gap-1.5 text-xs font-mono text-emerald">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
                {stats.upcomingSessions} upcoming
              </div>
            )}
          </div>
        </motion.div>

        {/* Next session CTA */}
        {upcomingSession && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-xl bg-for-600/10 border border-for-500/30 p-4 mb-4 flex items-center gap-3"
          >
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-for-500/20 border border-for-500/30 flex-shrink-0">
              {upcomingSession.status === 'live' ? (
                <Radio className="h-4 w-4 text-emerald" />
              ) : (
                <Calendar className="h-4 w-4 text-for-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-surface-400 mb-0.5">
                {upcomingSession.status === 'live' ? 'Live now' : 'Next session'}
              </p>
              <p className="text-sm font-mono text-white font-semibold truncate">
                {upcomingSession.title}
              </p>
              {upcomingSession.status === 'upcoming' && (
                <p className="text-[11px] font-mono text-surface-500 flex items-center gap-1 mt-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {formatDate(upcomingSession.scheduled_at)}
                </p>
              )}
            </div>
            <Link
              href={`/ama/${upcomingSession.id}`}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                upcomingSession.status === 'live'
                  ? 'bg-emerald text-black hover:bg-emerald/90'
                  : 'bg-for-600 text-white hover:bg-for-500'
              )}
            >
              {upcomingSession.status === 'live' ? 'Join live' : 'View'}
            </Link>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface-200 border border-surface-300 mb-4">
          {(
            [
              { id: 'sessions', label: 'Sessions', count: stats.totalSessions, icon: Mic },
              { id: 'answers', label: 'Top Answers', count: topAnswers.length, icon: Award },
            ] as const
          ).map(({ id, label, count, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
                tab === id
                  ? 'bg-surface-100 text-white shadow-sm border border-surface-300/60'
                  : 'text-surface-500 hover:text-white'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {count > 0 && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full text-[9px] font-mono',
                    tab === id
                      ? 'bg-for-500/20 text-for-400'
                      : 'bg-surface-300/40 text-surface-500'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {tab === 'sessions' && (
            <motion.div
              key="sessions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {sessions.length === 0 ? (
                <EmptyState
                  icon={Mic}
                  iconColor="text-surface-500"
                  size="sm"
                  title="No sessions yet"
                  description="This expert hasn't hosted any AMA sessions yet."
                />
              ) : (
                sessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))
              )}
            </motion.div>
          )}

          {tab === 'answers' && (
            <motion.div
              key="answers"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {topAnswers.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  iconColor="text-surface-500"
                  size="sm"
                  title="No answers yet"
                  description="This expert hasn't answered any questions yet."
                />
              ) : (
                topAnswers.map((answer) => (
                  <AnswerCard key={answer.id} answer={answer} />
                ))
              )}

              {stats.totalAnswers > topAnswers.length && (
                <div className="text-center pt-2">
                  <Link
                    href={`/ama?host=${profile.username}`}
                    className="inline-flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    Browse all {stats.totalAnswers} answers
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Refresh button */}
        <div className="text-center mt-8">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-600 hover:text-surface-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
