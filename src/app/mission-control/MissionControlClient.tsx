'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Flame,
  Gavel,
  HelpCircle,
  Mic,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { MissionControlData } from '@/app/api/mission-control/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeUntil(iso: string | null): string {
  if (!iso) return ''
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'ended'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 48) return `${Math.floor(h / 24)}d left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const TIER_COLORS: Record<string, string> = {
  common: 'text-surface-600',
  rare: 'text-for-400',
  epic: 'text-purple',
  legendary: 'text-gold',
}

const NOTIF_COLORS: Record<string, string> = {
  achievement_earned: 'text-gold',
  debate_starting: 'text-purple',
  law_established: 'text-emerald',
  topic_activated: 'text-for-400',
  vote_threshold: 'text-against-400',
  reply_received: 'text-surface-600',
  lobby_update: 'text-for-300',
  role_promoted: 'text-gold',
}

// ─── Pulse Stat ──────────────────────────────────────────────────────────────

function PulseStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Activity
  label: string
  value: number | string
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <Icon className={cn('w-4 h-4', color)} />
      <span className="text-lg font-bold text-surface-900 tabular-nums">{value}</span>
      <span className="text-xs text-surface-500 text-center leading-tight">{label}</span>
    </div>
  )
}

// ─── Section header ──────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  count,
  href,
  color = 'text-surface-600',
}: {
  icon: typeof Activity
  title: string
  count?: number
  href?: string
  color?: string
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className={cn('w-4 h-4', color)} />
        <h2 className="text-sm font-semibold text-surface-700">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="text-xs bg-surface-300 text-surface-600 rounded-full px-2 py-0.5 tabular-nums">
            {count}
          </span>
        )}
      </div>
      {href && (
        <Link href={href} className="text-xs text-for-400 hover:text-for-300 flex items-center gap-1 transition-colors">
          See all <ChevronRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  )
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-20 rounded-2xl" />
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function MissionControlClient() {
  const [data, setData] = useState<MissionControlData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/mission-control')
      if (!res.ok) {
        if (res.status === 401) {
          setError('Sign in to access Mission Control.')
          return
        }
        throw new Error('Failed to load')
      }
      setData(await res.json())
    } catch {
      setError('Could not load Mission Control. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const profile = data?.profile

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28 space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 tracking-tight">
              Mission Control
            </h1>
            <p className="text-sm text-surface-500 mt-0.5">
              Your civic command center
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </Button>
        </div>

        {/* ── Loading / Error ──────────────────────────────────────────────── */}
        {loading && <LoadingSkeleton />}

        {error && (
          <Card className="text-center py-10">
            <HelpCircle className="w-8 h-8 text-surface-500 mx-auto mb-3" />
            <p className="text-surface-600 mb-4">{error}</p>
            <Button variant="for" onClick={load}>Try again</Button>
          </Card>
        )}

        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >

              {/* ── Profile Hero ─────────────────────────────────────────────── */}
              {profile && (
                <Card className="bg-gradient-to-br from-surface-100 to-surface-200 border-surface-300">
                  <div className="flex items-center gap-4">
                    <Avatar
                      src={profile.avatar_url}
                      username={profile.username}
                      size={56}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-surface-900 truncate">
                          {profile.display_name ?? profile.username}
                        </span>
                        <Badge variant="outline" className="text-xs capitalize shrink-0">
                          {profile.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-sm text-surface-500">
                        <span className="flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 text-gold" />
                          <span className="text-gold font-medium">{profile.vote_streak}</span>
                          <span>day streak</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-surface-400" />
                          <span className="font-medium text-surface-700">{profile.clout.toLocaleString()}</span>
                          <span>clout</span>
                        </span>
                      </div>
                    </div>
                    <Link href="/profile/me">
                      <Button variant="secondary" size="sm">
                        Profile
                      </Button>
                    </Link>
                  </div>
                </Card>
              )}

              {/* ── Stats Strip ──────────────────────────────────────────────── */}
              <Card className="py-4">
                <div className="grid grid-cols-4 gap-2 divide-x divide-surface-300">
                  <PulseStat
                    icon={CheckCircle2}
                    label="Voted today"
                    value={data.stats.topics_voted_today}
                    color="text-emerald"
                  />
                  <div className="pl-2">
                    <PulseStat
                      icon={TrendingUp}
                      label="Rank"
                      value={data.stats.leaderboard_rank ? `#${data.stats.leaderboard_rank}` : '–'}
                      color="text-gold"
                    />
                  </div>
                  <div className="pl-2">
                    <PulseStat
                      icon={Target}
                      label="Accuracy"
                      value={data.stats.accuracy_pct !== null ? `${data.stats.accuracy_pct}%` : '–'}
                      color="text-for-400"
                    />
                  </div>
                  <div className="pl-2">
                    <PulseStat
                      icon={Flame}
                      label="Streak"
                      value={`${data.stats.streak_days}d`}
                      color="text-against-400"
                    />
                  </div>
                </div>
              </Card>

              {/* ── Platform Pulse ───────────────────────────────────────────── */}
              <Card>
                <SectionHeader
                  icon={Activity}
                  title="Platform Pulse"
                  color="text-for-400"
                />
                <div className="grid grid-cols-3 gap-3">
                  <Link
                    href="/"
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors text-center"
                  >
                    <Zap className="w-4 h-4 text-for-400" />
                    <span className="text-base font-bold text-surface-900">{data.pulse.active_topics}</span>
                    <span className="text-xs text-surface-500">Active topics</span>
                  </Link>
                  <Link
                    href="/law"
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors text-center"
                  >
                    <Gavel className="w-4 h-4 text-emerald" />
                    <span className="text-base font-bold text-surface-900">{data.pulse.laws_passed_today}</span>
                    <span className="text-xs text-surface-500">Laws today</span>
                  </Link>
                  <Link
                    href="/debate"
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors text-center"
                  >
                    <Mic className="w-4 h-4 text-purple" />
                    <span className="text-base font-bold text-surface-900">{data.pulse.live_debates}</span>
                    <span className="text-xs text-surface-500">Live debates</span>
                  </Link>
                </div>
              </Card>

              {/* ── Pending Votes ─────────────────────────────────────────────── */}
              {data.pending_votes.length > 0 && (
                <Card>
                  <SectionHeader
                    icon={Scale}
                    title="Awaiting Your Vote"
                    count={data.pending_votes.length}
                    href="/"
                    color="text-for-400"
                  />
                  <div className="space-y-2">
                    {data.pending_votes.map((topic) => (
                      <Link
                        key={topic.id}
                        href={`/topics/${topic.id}`}
                        className="group flex items-start gap-3 p-3 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-surface-800 line-clamp-2 group-hover:text-surface-900 transition-colors">
                            {topic.statement}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {topic.category && (
                              <span className="text-xs text-surface-500 bg-surface-300 px-1.5 py-0.5 rounded-full">
                                {topic.category}
                              </span>
                            )}
                            {topic.voting_ends_at && (
                              <span className="text-xs text-against-400">
                                {timeUntil(topic.voting_ends_at)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1 text-xs">
                            <ThumbsUp className="w-3 h-3 text-for-400" />
                            <span className="text-for-400 font-medium">{Math.round(topic.blue_pct)}%</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs">
                            <ThumbsDown className="w-3 h-3 text-against-400" />
                            <span className="text-against-400 font-medium">{Math.round(100 - topic.blue_pct)}%</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-surface-500 shrink-0 mt-1" />
                      </Link>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-surface-300">
                    <Link href="/" className="flex items-center justify-center gap-2 text-sm text-for-400 hover:text-for-300 transition-colors">
                      Browse all topics <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </Card>
              )}

              {data.pending_votes.length === 0 && (
                <Card className="text-center py-6">
                  <CheckCircle2 className="w-8 h-8 text-emerald mx-auto mb-2" />
                  <p className="text-sm font-medium text-surface-700">All caught up on voting</p>
                  <p className="text-xs text-surface-500 mt-1">No active topics awaiting your vote</p>
                  <Link href="/" className="inline-block mt-3">
                    <Button variant="secondary" size="sm">Explore topics</Button>
                  </Link>
                </Card>
              )}

              {/* ── My Debates ────────────────────────────────────────────────── */}
              {data.my_debates.length > 0 && (
                <Card>
                  <SectionHeader
                    icon={Mic}
                    title="My Debates"
                    count={data.my_debates.length}
                    href="/debate"
                    color="text-purple"
                  />
                  <div className="space-y-2">
                    {data.my_debates.map((debate) => (
                      <Link
                        key={debate.id}
                        href={`/debate/${debate.id}`}
                        className="group flex items-start gap-3 p-3 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors"
                      >
                        <div className={cn(
                          'shrink-0 w-1.5 h-full rounded-full mt-1',
                          debate.rsvp === 'for' ? 'bg-for-500' : 'bg-against-500'
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-surface-800 line-clamp-2 group-hover:text-surface-900">
                            {debate.statement}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={cn(
                              'text-xs px-1.5 py-0.5 rounded-full font-medium',
                              debate.status === 'live'
                                ? 'bg-against-500/20 text-against-400'
                                : 'bg-surface-300 text-surface-500'
                            )}>
                              {debate.status === 'live' ? 'LIVE' : 'Scheduled'}
                            </span>
                            {debate.scheduled_at && debate.status !== 'live' && (
                              <span className="text-xs text-surface-500">
                                {formatDate(debate.scheduled_at)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-surface-500 shrink-0 mt-1" />
                      </Link>
                    ))}
                  </div>
                </Card>
              )}

              {/* ── Active Predictions ───────────────────────────────────────── */}
              {data.active_predictions.length > 0 && (
                <Card>
                  <SectionHeader
                    icon={Target}
                    title="Active Predictions"
                    count={data.active_predictions.length}
                    href="/analytics/predictions"
                    color="text-gold"
                  />
                  <div className="space-y-2">
                    {data.active_predictions.map((pred) => (
                      <Link
                        key={pred.id}
                        href={`/topics/${pred.topic_id}`}
                        className="group flex items-start gap-3 p-3 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors"
                      >
                        <div className={cn(
                          'shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5',
                          pred.predicted_law ? 'bg-emerald/20' : 'bg-against-500/20'
                        )}>
                          {pred.predicted_law
                            ? <Gavel className="w-3 h-3 text-emerald" />
                            : <ShieldCheck className="w-3 h-3 text-against-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-surface-800 line-clamp-2 group-hover:text-surface-900">
                            {pred.statement}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className={cn(
                              'text-xs font-medium',
                              pred.predicted_law ? 'text-emerald' : 'text-against-400'
                            )}>
                              {pred.predicted_law ? 'Will pass' : 'Will fail'} · {pred.confidence}%
                            </span>
                            {pred.voting_ends_at && (
                              <span className="text-xs text-surface-500">
                                {timeUntil(pred.voting_ends_at)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-surface-500 shrink-0 mt-1" />
                      </Link>
                    ))}
                  </div>
                </Card>
              )}

              {/* ── Recent Achievements ──────────────────────────────────────── */}
              {data.recent_achievements.length > 0 && (
                <Card>
                  <SectionHeader
                    icon={Trophy}
                    title="Recent Achievements"
                    href="/achievements"
                    color="text-gold"
                  />
                  <div className="space-y-2">
                    {data.recent_achievements.map((ach) => (
                      <div
                        key={ach.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-surface-200"
                      >
                        <span className="text-2xl">{ach.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-surface-800">{ach.name}</span>
                            <span className={cn('text-xs font-medium capitalize', TIER_COLORS[ach.tier] ?? 'text-surface-500')}>
                              {ach.tier}
                            </span>
                          </div>
                          <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">{ach.description}</p>
                        </div>
                        <Sparkles className="w-4 h-4 text-gold shrink-0" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-surface-300">
                    <Link href="/achievements" className="flex items-center justify-center gap-2 text-sm text-for-400 hover:text-for-300 transition-colors">
                      View all achievements <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </Card>
              )}

              {/* ── Notifications ────────────────────────────────────────────── */}
              {data.recent_notifications.length > 0 && (
                <Card>
                  <SectionHeader
                    icon={Bell}
                    title="Unread Notifications"
                    count={data.recent_notifications.length}
                    href="/notifications"
                    color="text-against-400"
                  />
                  <div className="space-y-1">
                    {data.recent_notifications.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start gap-3 p-3 rounded-xl bg-surface-200"
                      >
                        <Bell className={cn('w-4 h-4 mt-0.5 shrink-0', NOTIF_COLORS[n.type] ?? 'text-surface-500')} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-surface-800 font-medium">{n.title}</p>
                          {n.body && (
                            <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{n.body}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-surface-300">
                    <Link href="/notifications" className="flex items-center justify-center gap-2 text-sm text-for-400 hover:text-for-300 transition-colors">
                      All notifications <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </Card>
              )}

              {/* ── Quick Links ──────────────────────────────────────────────── */}
              <Card>
                <SectionHeader icon={Zap} title="Quick Navigate" color="text-surface-600" />
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { href: '/analytics', label: 'Analytics', icon: TrendingUp, color: 'text-for-400' },
                    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy, color: 'text-gold' },
                    { href: '/debate', label: 'Debates', icon: Mic, color: 'text-purple' },
                    { href: '/law', label: 'Law Codex', icon: Gavel, color: 'text-emerald' },
                    { href: '/predictions', label: 'Predictions', icon: Target, color: 'text-against-400' },
                    { href: '/search', label: 'Search', icon: Scale, color: 'text-surface-500' },
                  ].map(({ href, label, icon: Icon, color }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors text-center"
                    >
                      <Icon className={cn('w-5 h-5', color)} />
                      <span className="text-xs text-surface-600 font-medium">{label}</span>
                    </Link>
                  ))}
                </div>
              </Card>

            </motion.div>
          </AnimatePresence>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
