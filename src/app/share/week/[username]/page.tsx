import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  BarChart2,
  CalendarDays,
  Flame,
  Gavel,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

const BASE_URL = 'https://lobby.market'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekBounds(): { start: string; end: string } {
  const now = new Date()
  const dow = now.getUTCDay()
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - ((dow + 6) % 7))
  monday.setUTCHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  sunday.setUTCHours(23, 59, 59, 999)
  return { start: monday.toISOString(), end: sunday.toISOString() }
}

function formatWeekRange(start: string): string {
  const s = new Date(start)
  const e = new Date(s)
  e.setUTCDate(s.getUTCDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

const ROLE_BADGE_VARIANT: Record<string, 'person' | 'debator' | 'troll_catcher' | 'elder'> = {
  person: 'person',
  debator: 'debator',
  troll_catcher: 'troll_catcher',
  elder: 'elder',
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
  Other: 'text-surface-500',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface VoteRow {
  side: string
  created_at: string
  topics: { category: string | null } | null
}

interface ArgRow {
  id: string
  content: string
  side: string
  upvotes: number
  topics: { statement: string } | null
}

interface AchRow {
  achievements: { id: string; name: string; icon_emoji: string } | null
}

interface DayBar {
  label: string
  count: number
  dateKey: string
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

interface Props {
  params: { username: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, total_votes')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) return { title: 'Weekly Stats · Lobby Market' }

  const displayName = profile.display_name || profile.username
  const title = `${displayName}'s Week · Lobby Market`
  const description = `See ${displayName}'s civic engagement this week on Lobby Market — votes, arguments, and more.`
  const ogImage = `/api/og/week/${encodeURIComponent(params.username)}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${displayName}'s weekly civic stats` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function WeekSharePage({ params }: Props) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, vote_streak, reputation_score')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  const { start, end } = getWeekBounds()

  const [votesRes, argsRes, achRes] = await Promise.all([
    supabase
      .from('votes')
      .select('side, created_at, topics!inner(category)')
      .eq('user_id', profile.id)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true }),

    supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, topics!inner(statement)')
      .eq('user_id', profile.id)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('upvotes', { ascending: false })
      .limit(10),

    supabase
      .from('user_achievements')
      .select('achievements(id, name, icon_emoji)')
      .eq('user_id', profile.id)
      .gte('earned_at', start)
      .lte('earned_at', end)
      .limit(5),
  ])

  const votes = (votesRes.data ?? []) as unknown as VoteRow[]
  const args = (argsRes.data ?? []) as unknown as ArgRow[]
  const achs = (achRes.data ?? []) as unknown as AchRow[]

  const totalVotes = votes.length
  const votesBlue = votes.filter((v) => v.side === 'blue').length
  const votesRed = votes.filter((v) => v.side === 'red').length

  // Category breakdown
  const catMap: Record<string, number> = {}
  for (const v of votes) {
    const cat = v.topics?.category ?? 'Other'
    catMap[cat] = (catMap[cat] ?? 0) + 1
  }
  const topCategories = Object.entries(catMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)

  // Top argument
  const topArg = args[0] ?? null

  // Achievements
  const achievements = achs.filter((a) => a.achievements).map((a) => a.achievements!)

  // Daily vote bars (Mon–Sun)
  const dayMap: Record<string, number> = {}
  for (const v of votes) {
    const d = v.created_at.slice(0, 10)
    dayMap[d] = (dayMap[d] ?? 0) + 1
  }
  const monDate = new Date(start)
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const dayBars: DayBar[] = dayLabels.map((label, i) => {
    const d = new Date(monDate)
    d.setUTCDate(monDate.getUTCDate() + i)
    const key = d.toISOString().slice(0, 10)
    return { label, count: dayMap[key] ?? 0, dateKey: key }
  })
  const maxDayCount = Math.max(1, ...dayBars.map((d) => d.count))

  const displayName = profile.display_name || profile.username
  const weekLabel = formatWeekRange(start)
  const shareUrl = `${BASE_URL}/share/week/${profile.username}`

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-8 flex items-start gap-4">
          <Avatar
            src={profile.avatar_url}
            fallback={displayName}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="font-mono text-xl font-bold text-white">
                {displayName}
              </h1>
              <Badge variant={ROLE_BADGE_VARIANT[profile.role] ?? 'person'}>
                {ROLE_LABEL[profile.role] ?? 'Citizen'}
              </Badge>
            </div>
            <p className="text-xs font-mono text-surface-500">@{profile.username}</p>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-mono text-surface-500">
              <CalendarDays className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
              <span className="text-surface-400">{weekLabel}</span>
            </div>
          </div>
          <Link
            href={`/profile/${profile.username}`}
            className={cn(
              'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
              'bg-surface-200 border border-surface-300 text-surface-500',
              'hover:border-for-500/40 hover:text-for-300 transition-colors'
            )}
          >
            Profile
            <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>

        {/* ── Hero stat ──────────────────────────────────────────────────── */}
        <div className={cn(
          'rounded-2xl border p-6 mb-4',
          totalVotes > 0
            ? 'bg-for-500/5 border-for-500/20'
            : 'bg-surface-100 border-surface-300'
        )}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-widest text-surface-500 mb-1">
                Votes this week
              </p>
              <p className={cn(
                'font-mono text-6xl font-black leading-none',
                totalVotes > 0 ? 'text-for-300' : 'text-surface-600'
              )}>
                {totalVotes}
              </p>
            </div>
            <div className="flex items-center gap-3 pb-1">
              <div className="text-center">
                <p className="font-mono text-2xl font-bold text-for-400">{votesBlue}</p>
                <p className="text-[10px] text-surface-500 uppercase tracking-wider mt-0.5">For</p>
              </div>
              <div className="w-px h-8 bg-surface-300" />
              <div className="text-center">
                <p className="font-mono text-2xl font-bold text-against-400">{votesRed}</p>
                <p className="text-[10px] text-surface-500 uppercase tracking-wider mt-0.5">Against</p>
              </div>
            </div>
          </div>

          {/* Vote split bar */}
          {totalVotes > 0 && (
            <div className="mt-4 h-2 rounded-full overflow-hidden bg-surface-300" aria-hidden="true">
              <div
                className="h-full bg-gradient-to-r from-for-600 to-for-400 float-left rounded-l-full"
                style={{ width: `${Math.round((votesBlue / totalVotes) * 100)}%` }}
              />
              <div
                className="h-full bg-against-500 float-left rounded-r-full"
                style={{ width: `${Math.round((votesRed / totalVotes) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* ── Daily chart ────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-4">
          <p className="text-[11px] font-mono uppercase tracking-widest text-surface-500 mb-4">
            Daily activity
          </p>
          <div className="flex items-end gap-2 h-16" aria-label="Daily vote chart">
            {dayBars.map((day) => {
              const pct = day.count > 0 ? (day.count / maxDayCount) * 100 : 0
              return (
                <div key={day.dateKey} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center h-12">
                    <div
                      className={cn(
                        'w-full rounded-t-sm transition-all',
                        day.count > 0 ? 'bg-for-500/70' : 'bg-surface-300'
                      )}
                      style={{ height: day.count > 0 ? `${Math.max(4, pct)}%` : '4px' }}
                      aria-label={`${day.label}: ${day.count} vote${day.count !== 1 ? 's' : ''}`}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-surface-600">{day.label.slice(0, 2)}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Stats grid ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 text-center">
            <MessageSquare className="h-4 w-4 text-purple mx-auto mb-2" aria-hidden="true" />
            <p className="font-mono text-2xl font-bold text-white">{args.length}</p>
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">Arguments</p>
          </div>
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 text-center">
            <Flame className="h-4 w-4 text-gold mx-auto mb-2" aria-hidden="true" />
            <p className="font-mono text-2xl font-bold text-white">{profile.vote_streak ?? 0}</p>
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">Day Streak</p>
          </div>
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 text-center">
            <TrendingUp className="h-4 w-4 text-for-400 mx-auto mb-2" aria-hidden="true" />
            <p className="font-mono text-2xl font-bold text-white">
              {profile.reputation_score ? Math.round(profile.reputation_score) : 0}
            </p>
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">Reputation</p>
          </div>
        </div>

        {/* ── Top categories ─────────────────────────────────────────────── */}
        {topCategories.length > 0 && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-4">
            <p className="text-[11px] font-mono uppercase tracking-widest text-surface-500 mb-3">
              Top categories
            </p>
            <div className="space-y-2">
              {topCategories.map(([cat, count]) => {
                const pct = Math.round((count / totalVotes) * 100)
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className={cn('text-xs font-mono font-semibold w-24 truncate', CATEGORY_COLORS[cat] ?? 'text-surface-500')}>
                      {cat}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-300">
                      <div
                        className="h-full rounded-full bg-for-500/60"
                        style={{ width: `${pct}%` }}
                        aria-label={`${pct}%`}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-surface-500 w-8 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Top argument ───────────────────────────────────────────────── */}
        {topArg && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-gold" aria-hidden="true" />
              <p className="text-[11px] font-mono uppercase tracking-widest text-surface-500">
                Top argument this week
              </p>
              <div className="ml-auto flex items-center gap-1 text-xs font-mono text-gold">
                <Zap className="h-3 w-3" aria-hidden="true" />
                {topArg.upvotes} upvote{topArg.upvotes !== 1 ? 's' : ''}
              </div>
            </div>
            <div className={cn(
              'flex items-start gap-2 p-3 rounded-xl border',
              topArg.side === 'blue'
                ? 'bg-for-500/5 border-for-500/20'
                : 'bg-against-500/5 border-against-500/20'
            )}>
              {topArg.side === 'blue'
                ? <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                : <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white leading-relaxed">
                  &ldquo;{topArg.content.slice(0, 160)}{topArg.content.length > 160 ? '…' : ''}&rdquo;
                </p>
                {topArg.topics?.statement && (
                  <p className="text-[11px] font-mono text-surface-500 mt-1.5 truncate">
                    on: {topArg.topics.statement.slice(0, 80)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Achievements this week ─────────────────────────────────────── */}
        {achievements.length > 0 && (
          <div className="rounded-2xl border border-gold/20 bg-gold/5 p-5 mb-4">
            <p className="text-[11px] font-mono uppercase tracking-widest text-gold/70 mb-3">
              Achievements unlocked
            </p>
            <div className="flex flex-wrap gap-2">
              {achievements.map((ach) => (
                <div
                  key={ach.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gold/10 border border-gold/20"
                >
                  <span className="text-sm" role="img" aria-label={ach.name}>{ach.icon_emoji}</span>
                  <span className="text-xs font-mono font-semibold text-gold">{ach.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {totalVotes === 0 && args.length === 0 && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center mb-4">
            <BarChart2 className="h-8 w-8 text-surface-500 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-mono text-surface-400">No activity this week yet.</p>
            <p className="text-xs font-mono text-surface-600 mt-1">
              Vote on topics and make arguments to build your weekly stats.
            </p>
          </div>
        )}

        {/* ── Share / CTA row ────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
            Vote now
          </Link>
          <Link
            href="/analytics"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 text-sm font-mono transition-colors"
          >
            <BarChart2 className="h-4 w-4" aria-hidden="true" />
            Full analytics
          </Link>
          <Link
            href="/my-week"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 text-sm font-mono transition-colors"
          >
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            My week
          </Link>
          <Link
            href="/law"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 text-sm font-mono transition-colors"
          >
            <Gavel className="h-4 w-4" aria-hidden="true" />
            The Codex
          </Link>
        </div>

        {/* ── OG image preview / share hint ─────────────────────────────── */}
        <div className="mt-8 pt-6 border-t border-surface-300">
          <p className="text-xs font-mono text-surface-600 text-center">
            Share this page to show your weekly civic stats —{' '}
            <span className="text-surface-500 break-all">{shareUrl}</span>
          </p>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
