'use client'

/**
 * /briefing — Your Daily Civic Briefing
 *
 * A personalized, action-oriented daily start page that surfaces exactly
 * what you should do in the Lobby today:
 *   - Today's vote progress and streak status
 *   - Updates on debates you're subscribed to
 *   - Upcoming debates in the next 48 hours
 *   - A featured argument from your top category
 *   - Platform highlights: trending topic + newest law
 *
 * Distinct from:
 *   /today      — raw platform stats (not personalized)
 *   /catchup    — since-last-visit (localStorage, no subscription awareness)
 *   /digest     — curated weekly roundup (editorial, not real-time)
 *   /dashboard  — personal stats hub (not actionable briefing)
 *   /analytics  — deep analysis (not action-focused)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  Mic,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { BriefingData } from '@/app/api/briefing/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const absMin = Math.abs(Math.floor(diff / 60_000))
  const h = Math.floor(absMin / 60)
  const m = absMin % 60
  if (diff < 0) return 'started'
  if (h === 0) return `in ${m}m`
  if (m === 0) return `in ${h}h`
  return `in ${h}h ${m}m`
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    proposed: 'Proposed',
    active: 'Active',
    voting: 'Voting',
    law: 'Law',
    failed: 'Failed',
  }
  return map[s] ?? s
}

function statusColor(s: string): string {
  const map: Record<string, string> = {
    proposed: 'text-surface-500',
    active: 'text-for-400',
    voting: 'text-purple',
    law: 'text-gold',
    failed: 'text-against-400',
  }
  return map[s] ?? 'text-surface-500'
}

function debateTypeLabel(t: string): string {
  const map: Record<string, string> = {
    quick: 'Quick Debate',
    grand: 'Grand Debate',
    oxford: 'Oxford Debate',
    tribunal: 'Tribunal',
  }
  return map[t] ?? t
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function BriefingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  )
}

// ─── Vote progress card ───────────────────────────────────────────────────────

function VoteProgressCard({
  votesUsed,
  limit,
  streak,
}: {
  votesUsed: number
  limit: number
  streak: number
}) {
  const pct = Math.min((votesUsed / limit) * 100, 100)
  const done = votesUsed >= limit

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Flame className={cn('h-4 w-4', streak >= 7 ? 'text-gold' : streak > 0 ? 'text-amber-400' : 'text-surface-500')} />
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">Today&rsquo;s Progress</span>
        {streak > 0 && (
          <span className={cn('ml-auto text-xs font-mono font-bold', streak >= 30 ? 'text-against-300' : streak >= 7 ? 'text-gold' : 'text-amber-400')}>
            {streak}-day streak
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mb-2 text-xs font-mono">
        <span className="text-surface-500">{votesUsed}/{limit} votes used</span>
        {done ? (
          <span className="text-emerald flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />Daily goal met
          </span>
        ) : (
          <span className="text-surface-500">{limit - votesUsed} remaining</span>
        )}
      </div>

      <div className="h-2 rounded-full bg-surface-300 overflow-hidden mb-4">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn(
            'h-full rounded-full',
            done ? 'bg-gradient-to-r from-emerald to-emerald/70' : 'bg-gradient-to-r from-for-600 to-for-400'
          )}
        />
      </div>

      <Link
        href="/"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-700 text-white text-xs font-mono font-semibold transition-colors"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        {done ? 'Keep voting' : 'Vote now'}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </motion.div>
  )
}

// ─── Subscribed topic card ────────────────────────────────────────────────────

function SubscribedTopicCard({
  update,
  index,
}: {
  update: BriefingData['subscribed_updates'][0]
  index: number
}) {
  const forPct = Math.round(update.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link
        href={`/topic/${update.topic_id}`}
        className="block rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors p-4 group"
      >
        <div className="flex items-center gap-2 mb-2">
          {update.category && (
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{update.category}</span>
          )}
          <span className={cn('text-[10px] font-mono font-semibold ml-auto', statusColor(update.new_status))}>
            {statusLabel(update.new_status)}
          </span>
        </div>
        <p className="text-sm text-white leading-snug line-clamp-2 mb-3 group-hover:text-surface-700 transition-colors">
          {update.statement}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div className="h-full bg-for-500 rounded-full" style={{ width: `${forPct}%` }} />
          </div>
          <span className="text-[10px] font-mono text-for-400">{forPct}%</span>
          <span className="text-[10px] font-mono text-surface-600">/</span>
          <span className="text-[10px] font-mono text-against-400">{againstPct}%</span>
          <span className="text-[10px] font-mono text-surface-600 ml-1">{update.total_votes.toLocaleString()} votes</span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Debate card ──────────────────────────────────────────────────────────────

function DebateCard({
  debate,
  index,
}: {
  debate: BriefingData['upcoming_debates'][0]
  index: number
}) {
  const isLive = debate.status === 'live'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link
        href={`/debate/${debate.id}`}
        className={cn(
          'block rounded-xl border p-4 transition-colors group',
          isLive
            ? 'bg-against-950/50 border-against-700/50 hover:border-against-600/70'
            : 'bg-surface-100 border-surface-300 hover:border-surface-400'
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          {isLive ? (
            <span className="flex items-center gap-1 text-[10px] font-mono text-against-400 uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-against-400 animate-pulse" />
              Live now
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
              <Clock className="h-3 w-3" />
              {relativeTime(debate.scheduled_at)}
            </span>
          )}
          <span className="ml-auto text-[10px] font-mono text-purple">{debateTypeLabel(debate.debate_type)}</span>
        </div>
        <p className="text-sm font-medium text-white line-clamp-2 mb-2 group-hover:text-surface-700 transition-colors">
          {debate.title}
        </p>
        {debate.topic_statement && (
          <p className="text-[11px] font-mono text-surface-500 line-clamp-1">
            Re: {debate.topic_statement}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <Mic className="h-3 w-3 text-surface-500" />
          <span className="text-[10px] font-mono text-surface-500">
            {debate.participant_count} participant{debate.participant_count !== 1 ? 's' : ''}
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Featured argument card ───────────────────────────────────────────────────

function FeaturedArgumentCard({
  arg,
}: {
  arg: BriefingData['featured_argument']
}) {
  if (!arg) return null
  const isFor = arg.side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className={cn(
        'rounded-2xl border p-5',
        isFor
          ? 'bg-for-600/5 border-for-500/20'
          : 'bg-against-600/5 border-against-500/20'
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-3.5 w-3.5 text-gold" />
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">Featured Argument</span>
        {arg.category && (
          <span className="ml-auto text-[10px] font-mono text-surface-500">{arg.category}</span>
        )}
      </div>

      <Link href={`/topic/${arg.topic_id}`} className="block mb-3 hover:opacity-80 transition-opacity">
        <p className="text-[11px] font-mono text-surface-500 mb-2 line-clamp-1">
          Re: {arg.topic_statement}
        </p>
        <div className={cn(
          'flex items-start gap-2 px-3 py-2.5 rounded-xl',
          isFor ? 'bg-for-600/10' : 'bg-against-600/10'
        )}>
          {isFor ? (
            <ThumbsUp className="h-3.5 w-3.5 text-for-400 mt-0.5 flex-shrink-0" />
          ) : (
            <ThumbsDown className="h-3.5 w-3.5 text-against-400 mt-0.5 flex-shrink-0" />
          )}
          <p className="text-sm text-white leading-relaxed line-clamp-4">{arg.content}</p>
        </div>
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar src={arg.author_avatar_url} fallback={arg.author_display_name ?? arg.author_username} size="xs" />
          <Link href={`/profile/${arg.author_username}`} className="text-xs font-mono text-surface-500 hover:text-white transition-colors">
            @{arg.author_username}
          </Link>
        </div>
        <div className="flex items-center gap-1 text-xs font-mono text-gold">
          <TrendingUp className="h-3 w-3" />
          {arg.upvotes.toLocaleString()} upvotes
        </div>
      </div>
    </motion.div>
  )
}

// ─── Highlight card ───────────────────────────────────────────────────────────

function HighlightCard({ highlight, index }: { highlight: BriefingData['highlights'][0]; index: number }) {
  const isTrending = highlight.type === 'trending_topic'
  const isLaw = highlight.type === 'new_law'
  const forPct = Math.round(highlight.blue_pct ?? 50)
  const href = highlight.topic_id ? `/topic/${highlight.topic_id}` : highlight.debate_id ? `/debate/${highlight.debate_id}` : '/'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
    >
      <Link href={href} className={cn(
        'flex items-start gap-3 rounded-xl border p-4 transition-colors group',
        isLaw ? 'bg-gold/5 border-gold/20 hover:border-gold/40' : 'bg-surface-100 border-surface-300 hover:border-for-500/30'
      )}>
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border',
          isLaw ? 'bg-gold/10 border-gold/30' : 'bg-for-500/10 border-for-500/20'
        )}>
          {isLaw ? <Gavel className="h-4 w-4 text-gold" /> : <TrendingUp className="h-4 w-4 text-for-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
            {isLaw ? 'New Law Established' : isTrending ? 'Trending Now' : 'Platform Highlight'}
          </div>
          <p className="text-sm text-white group-hover:text-surface-700 transition-colors line-clamp-2 leading-snug">
            {highlight.statement}
          </p>
          {highlight.blue_pct !== undefined && (
            <div className="flex items-center gap-2 mt-2">
              <div className="h-1 w-16 rounded-full bg-surface-300 overflow-hidden">
                <div className="h-full bg-for-500 rounded-full" style={{ width: `${forPct}%` }} />
              </div>
              <span className="text-[10px] font-mono text-surface-500">
                {forPct}% For · {(highlight.total_votes ?? 0).toLocaleString()} votes
              </span>
            </div>
          )}
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 mt-0.5 group-hover:text-surface-500 transition-colors" />
      </Link>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BriefingPage() {
  const router = useRouter()
  const [data, setData] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/briefing', { cache: 'no-store' })
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load briefing')
      setData(await res.json())
    } catch {
      setError('Could not load your briefing. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs font-mono text-surface-500 mb-1">{todayLabel}</p>
            <h1 className="text-xl font-mono font-bold text-white">
              {loading ? greeting() : `${greeting()}, ${data?.profile.display_name ?? data?.profile.username ?? 'Citizen'}`}
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">Your daily civic briefing</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh briefing"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Notification badge ── */}
        {!loading && data && data.unread_notification_count > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
          >
            <Link
              href="/notifications"
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-purple/10 border border-purple/30 hover:border-purple/50 transition-colors"
            >
              <Bell className="h-4 w-4 text-purple flex-shrink-0" />
              <span className="text-sm font-mono text-purple">
                {data.unread_notification_count} unread notification{data.unread_notification_count !== 1 ? 's' : ''}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-purple ml-auto" />
            </Link>
          </motion.div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="rounded-xl bg-against-950 border border-against-800 p-4 text-sm text-against-400 mb-4">
            {error}
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {loading && <BriefingSkeleton />}

        {/* ── Content ── */}
        {!loading && data && (
          <div className="space-y-6">

            {/* Vote progress */}
            <VoteProgressCard
              votesUsed={data.profile.daily_votes_used}
              limit={data.profile.daily_limit}
              streak={data.profile.vote_streak}
            />

            {/* Quick actions row */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="grid grid-cols-3 gap-2"
            >
              {[
                { href: '/swipe', icon: Scale, label: 'Swipe & Vote', color: 'text-for-400' },
                { href: '/argue', icon: MessageSquare, label: 'Argue', color: 'text-purple' },
                { href: '/debate', icon: Mic, label: 'Debates', color: 'text-gold' },
              ].map(({ href, icon: Icon, label, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
                >
                  <Icon className={cn('h-5 w-5', color)} />
                  <span className="text-[11px] font-mono text-surface-500">{label}</span>
                </Link>
              ))}
            </motion.div>

            {/* Subscribed topic updates */}
            <AnimatePresence>
              {data.subscribed_updates.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-for-400" />
                    <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                      Updates on topics you follow
                    </h2>
                    <Link href="/watchlist" className="ml-auto text-[10px] font-mono text-surface-600 hover:text-white transition-colors">
                      View all
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {data.subscribed_updates.map((u, i) => (
                      <SubscribedTopicCard key={u.topic_id} update={u} index={i} />
                    ))}
                  </div>
                </section>
              )}
            </AnimatePresence>

            {/* No subscriptions prompt */}
            {data.subscribed_updates.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="rounded-2xl bg-surface-100 border border-dashed border-surface-400 p-5 text-center"
              >
                <Zap className="h-6 w-6 text-surface-500 mx-auto mb-2" />
                <p className="text-sm font-mono text-surface-500">No subscribed topic updates yet.</p>
                <p className="text-xs font-mono text-surface-600 mt-0.5">
                  Follow debates with the <span className="text-for-400">subscribe</span> button on any topic.
                </p>
                <Link href="/" className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors">
                  Browse topics <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>
            )}

            {/* Upcoming debates */}
            {data.upcoming_debates.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-purple" />
                  <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                    Upcoming debates
                  </h2>
                  <Link href="/debate" className="ml-auto text-[10px] font-mono text-surface-600 hover:text-white transition-colors">
                    View all
                  </Link>
                </div>
                <div className="space-y-2">
                  {data.upcoming_debates.map((d, i) => (
                    <DebateCard key={d.id} debate={d} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* Featured argument */}
            {data.featured_argument && (
              <section>
                <FeaturedArgumentCard arg={data.featured_argument} />
                <div className="mt-2 text-center">
                  <Link
                    href={`/topic/${data.featured_argument.topic_id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    Read the full debate <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </section>
            )}

            {/* Platform highlights */}
            {data.highlights.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-gold" />
                  <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                    Platform highlights
                  </h2>
                </div>
                <div className="space-y-2">
                  {data.highlights.map((h, i) => (
                    <HighlightCard key={i} highlight={h} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* Footer actions */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.35 }}
              className="flex flex-wrap gap-2 pt-2"
            >
              {[
                { href: '/analytics', label: 'My Analytics', icon: TrendingUp },
                { href: '/achievements', label: 'Achievements', icon: Zap },
                { href: '/leaderboard', label: 'Leaderboard', icon: Coins },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              ))}
            </motion.div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
