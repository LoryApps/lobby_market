import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart2,
  Calendar,
  Flame,
  Gavel,
  MessageSquare,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 900

export const metadata: Metadata = {
  title: 'Civic Midday · Lobby Market',
  description:
    'Your noon civic check-in. What moved since this morning — vote swings, the battle of the hour, rising arguments, and upcoming debates today.',
  openGraph: {
    title: 'Civic Midday · Lobby Market',
    description:
      'Noon check-in: vote momentum since morning, the most contested topic right now, top argument of the hour, and debates happening today.',
    type: 'website',
    siteName: 'Lobby Market',
    images: [{ url: '/assets/og-share.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Midday · Lobby Market',
    description: 'Your midday civic pulse — what moved since morning, the battle of the hour, and the best argument of the noon.',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMiddayDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatEdition(): string {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const day = Math.floor(diff / (1000 * 60 * 60 * 24))
  return `Edition ${day} · ${now.getFullYear()}`
}

function relDebateTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (diff < 0) return 'Now live'
  if (m < 60) return `In ${m}m`
  if (h < 24) return `In ${h}h`
  const d = Math.floor(h / 24)
  return `In ${d}d`
}

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-emerald',
  Science: 'text-cyan-400',
  Health: 'text-green-400',
  Environment: 'text-emerald',
  Education: 'text-purple-400',
  Ethics: 'text-gold',
  Culture: 'text-pink-400',
  Philosophy: 'text-purple-400',
}
function catColor(cat: string | null): string {
  return CAT_COLOR[cat ?? ''] ?? 'text-surface-400'
}

function Divider() {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-surface-300" />
      <span className="text-surface-500 text-xs font-mono">◆</span>
      <div className="flex-1 h-px bg-surface-300" />
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default async function MiddayPage() {
  const supabase = await createClient()
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const endOfDay = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()

  const [
    battleResult,
    risingResult,
    newArgsResult,
    debatesTodayResult,
    freshLawsResult,
    hourArgResult,
  ] = await Promise.all([
    // Battle of the hour: most active topic (most votes in last 6h), closest split
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, scope')
      .in('status', ['active', 'voting'])
      .gte('updated_at', sixHoursAgo)
      .order('total_votes', { ascending: false })
      .limit(30),

    // Rising: topics gaining the most momentum in the last 6h (highest recent votes)
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, feed_score')
      .in('status', ['active', 'voting'])
      .gte('updated_at', sixHoursAgo)
      .order('feed_score', { ascending: false })
      .limit(5),

    // New arguments posted in the last 6 hours (count)
    supabase
      .from('topic_arguments')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', sixHoursAgo),

    // Debates happening today (next 12h)
    supabase
      .from('debates')
      .select('id, topic_id, scheduled_at, status, type, topics!debates_topic_id_fkey(statement, category)')
      .in('status', ['scheduled', 'live'])
      .gte('scheduled_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .lte('scheduled_at', endOfDay)
      .order('scheduled_at', { ascending: true })
      .limit(4),

    // Laws established today
    supabase
      .from('topics')
      .select('id, statement, category, total_votes, updated_at')
      .eq('status', 'law')
      .gte('updated_at', oneDayAgo)
      .order('updated_at', { ascending: false })
      .limit(3),

    // Top argument of the last 6 hours
    supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, topic_id, topics!topic_arguments_topic_id_fkey(statement, category)')
      .gte('created_at', sixHoursAgo)
      .order('upvotes', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const allRecent = battleResult.data ?? []

  // Battle of the hour: among most-active recent topics, pick the closest to 50/50
  const battle = allRecent
    .map((t) => ({ ...t, deviation: Math.abs((t.blue_pct ?? 50) - 50) }))
    .sort((a, b) => a.deviation - b.deviation)[0] ?? null

  // Rising: top 4 by feed_score, excluding the battle topic
  const rising = (risingResult.data ?? [])
    .filter((t) => t.id !== battle?.id)
    .slice(0, 4)

  const newArgCount = newArgsResult.count ?? 0

  const debates = (debatesTodayResult.data ?? []) as Array<{
    id: string
    topic_id: string
    scheduled_at: string
    status: string
    type: string
    topics: { statement: string; category: string | null } | null
  }>

  const freshLaws = freshLawsResult.data ?? []

  const hourArg = hourArgResult.data as {
    id: string
    content: string
    side: string
    upvotes: number
    topic_id: string
    topics: { statement: string; category: string | null } | null
  } | null

  const liveDebates = debates.filter((d) => d.status === 'live')
  const upcomingDebates = debates.filter((d) => d.status === 'scheduled')

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Masthead */}
        <header className="border-b border-surface-300 pb-5 mb-6">
          <div className="flex items-baseline justify-between mb-1">
            <span className="font-mono text-xs text-surface-500 uppercase tracking-widest">
              {formatEdition()}
            </span>
            <span className="font-mono text-xs text-surface-500">
              {formatMiddayDate()}
            </span>
          </div>
          <h1 className="font-mono font-black text-3xl sm:text-4xl text-white tracking-tight leading-none">
            CIVIC MIDDAY
          </h1>
          <p className="text-surface-500 text-sm font-mono mt-1">
            Your noon check-in — what moved since this morning.
          </p>
        </header>

        {/* Platform pulse row */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-mono text-surface-400">
            <Zap className="h-3.5 w-3.5 text-gold" />
            <span className="text-white font-semibold">{allRecent.length}</span> active debates
          </div>
          {newArgCount > 0 && (
            <>
              <span className="text-surface-600 hidden sm:block">·</span>
              <div className="flex items-center gap-1.5 text-xs font-mono text-surface-400">
                <MessageSquare className="h-3.5 w-3.5 text-emerald" />
                <span className="text-white font-semibold">{newArgCount}</span> arguments since morning
              </div>
            </>
          )}
          {liveDebates.length > 0 && (
            <>
              <span className="text-surface-600 hidden sm:block">·</span>
              <div className="flex items-center gap-1.5 text-xs font-mono text-surface-400">
                <span className="h-2 w-2 rounded-full bg-against-400 animate-pulse" />
                <span className="text-against-400 font-semibold">{liveDebates.length} live</span> debate{liveDebates.length > 1 ? 's' : ''}
              </div>
            </>
          )}
        </div>

        {/* Battle of the Hour */}
        {battle ? (
          <section className="mb-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-px flex-1 bg-surface-300" />
              <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
                Battle of the Hour
              </span>
              <span className="h-px flex-1 bg-surface-300" />
            </div>
            <Link
              href={`/topic/${battle.id}`}
              className="group block rounded-2xl bg-surface-100 border border-surface-300 hover:border-gold/40 transition-colors p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <Flame className="h-4 w-4 text-orange-400" />
                {battle.category && (
                  <span className={cn('text-xs font-mono font-semibold uppercase tracking-wide', catColor(battle.category))}>
                    {battle.category}
                  </span>
                )}
                <span className="text-xs font-mono text-surface-500 ml-auto">{battle.scope}</span>
              </div>
              <p className="font-mono font-bold text-white text-lg leading-snug group-hover:text-gold transition-colors mb-4">
                {battle.statement}
              </p>
              {/* Vote bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-for-400 flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" /> {Math.round(battle.blue_pct ?? 50)}% For
                  </span>
                  <span className="text-surface-500">{(battle.total_votes ?? 0).toLocaleString()} votes</span>
                  <span className="text-against-400 flex items-center gap-1">
                    {100 - Math.round(battle.blue_pct ?? 50)}% Against <ThumbsDown className="h-3 w-3" />
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
                  <div
                    className="h-full bg-for-500 rounded-full"
                    style={{ width: `${Math.round(battle.blue_pct ?? 50)}%` }}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs font-mono text-orange-400/80">
                  Most contested right now
                </span>
                <span className="text-xs font-mono text-gold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Weigh in <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          </section>
        ) : (
          <section className="mb-6">
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 text-center">
              <Scale className="h-8 w-8 text-surface-600 mx-auto mb-2" />
              <p className="text-surface-500 text-sm font-mono">No active debates in the last 6 hours.</p>
            </div>
          </section>
        )}

        <Divider />

        {/* Momentum movers + laws in a two-column layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-2">

          {/* Rising topics */}
          {rising.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
                  Rising Since Morning
                </h2>
                <Link href="/trending" className="text-[10px] font-mono text-for-400 hover:text-for-300 flex items-center gap-1">
                  More <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {rising.map((t, i) => (
                  <Link
                    key={t.id}
                    href={`/topic/${t.id}`}
                    className="group flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/40 transition-colors"
                  >
                    <span className="text-xs font-mono text-surface-600 w-4 flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-mono leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
                        {t.statement}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {t.category && (
                          <span className={cn('text-[10px] font-mono', catColor(t.category))}>
                            {t.category}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-surface-500">
                          {Math.round(t.blue_pct ?? 50)}% / {100 - Math.round(t.blue_pct ?? 50)}%
                        </span>
                      </div>
                    </div>
                    <TrendingUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0 mt-0.5" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Fresh laws / today's verdicts */}
          {freshLaws.length > 0 && (
            <section className={rising.length > 0 ? '' : 'sm:col-span-2'}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
                  Verdicts Today
                </h2>
                <Link href="/laws" className="text-[10px] font-mono text-emerald hover:text-emerald/80 flex items-center gap-1">
                  Law codex <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {freshLaws.map((law) => (
                  <Link
                    key={law.id}
                    href={`/topic/${law.id}`}
                    className="group flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-emerald/20 hover:border-emerald/40 transition-colors"
                  >
                    <Gavel className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-mono leading-snug group-hover:text-emerald transition-colors line-clamp-2">
                        {law.statement}
                      </p>
                      <p className="text-surface-500 text-[10px] font-mono mt-0.5">
                        Passed · {(law.total_votes ?? 0).toLocaleString()} votes
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Fallback if no rising and no fresh laws */}
          {rising.length === 0 && freshLaws.length === 0 && (
            <section className="sm:col-span-2">
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
                <BarChart2 className="h-6 w-6 text-surface-600 mx-auto mb-2" />
                <p className="text-surface-500 text-xs font-mono">No major movements since morning. Check back soon.</p>
              </div>
            </section>
          )}
        </div>

        <Divider />

        {/* Argument of the Hour */}
        {hourArg && (
          <section className="mb-2">
            <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
              Argument of the Hour
            </h2>
            <Link
              href={`/arguments/${hourArg.id}`}
              className="group block rounded-xl bg-surface-100 border border-surface-300 hover:border-gold/40 transition-colors p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={cn(
                    'text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded',
                    hourArg.side === 'blue'
                      ? 'bg-for-900/60 text-for-300 border border-for-800/40'
                      : 'bg-against-900/60 text-against-300 border border-against-800/40'
                  )}
                >
                  {hourArg.side === 'blue' ? 'FOR' : 'AGAINST'}
                </span>
                {hourArg.topics && (
                  <span className={cn('text-xs font-mono', catColor(hourArg.topics.category))}>
                    {hourArg.topics.category}
                  </span>
                )}
                <span className="ml-auto text-xs font-mono text-gold flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" /> {hourArg.upvotes}
                </span>
              </div>
              {hourArg.topics && (
                <p className="text-surface-500 text-[10px] font-mono mb-2 line-clamp-1">
                  On: {hourArg.topics.statement}
                </p>
              )}
              <blockquote className="font-mono text-sm text-white leading-relaxed border-l-2 border-gold pl-3 group-hover:border-gold/70 transition-colors">
                &ldquo;{hourArg.content.slice(0, 200)}{hourArg.content.length > 200 ? '…' : ''}&rdquo;
              </blockquote>
              <p className="mt-2 text-xs font-mono text-surface-500 group-hover:text-gold/80 transition-colors flex items-center gap-1">
                Read full argument <ArrowRight className="h-3 w-3" />
              </p>
            </Link>
          </section>
        )}

        {/* Today's debate schedule */}
        {debates.length > 0 && (
          <>
            <Divider />
            <section className="mb-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
                  {liveDebates.length > 0 ? 'Live Now & Upcoming' : "Today's Debates"}
                </h2>
                <Link href="/debate/calendar" className="text-[10px] font-mono text-for-400 hover:text-for-300 flex items-center gap-1">
                  Full calendar <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {debates.map((d) => (
                  <Link
                    key={d.id}
                    href={`/debate/${d.id}`}
                    className="group flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/40 transition-colors"
                  >
                    <div
                      className={cn(
                        'flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center',
                        d.status === 'live'
                          ? 'bg-against-900/60 border border-against-700/40'
                          : 'bg-surface-200 border border-surface-400/20'
                      )}
                    >
                      {d.status === 'live' ? (
                        <span className="h-2 w-2 rounded-full bg-against-400 animate-pulse" />
                      ) : (
                        <Calendar className="h-4 w-4 text-surface-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-mono leading-snug line-clamp-1 group-hover:text-for-300 transition-colors">
                        {d.topics?.statement ?? 'Debate'}
                      </p>
                      <p className="text-surface-500 text-[10px] font-mono mt-0.5">
                        {d.type.charAt(0).toUpperCase() + d.type.slice(1)} · {d.topics?.category ?? 'General'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'text-xs font-mono flex-shrink-0 font-semibold',
                        d.status === 'live' ? 'text-against-400' : 'text-surface-500'
                      )}
                    >
                      {d.status === 'live' ? 'Live' : relDebateTime(d.scheduled_at)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}

        <Divider />

        {/* Quick actions */}
        <section>
          <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
            Keep the Momentum Going
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { href: '/challenge', icon: Flame, label: 'Daily Quorum', desc: 'Vote on 3 topics', color: 'text-orange-400' },
              { href: '/trending', icon: TrendingUp, label: 'Trending', desc: 'What\'s moving now', color: 'text-gold' },
              { href: '/arguments', icon: MessageSquare, label: 'Top Arguments', desc: 'Best reasoning', color: 'text-emerald' },
              { href: '/topics', icon: Scale, label: 'Browse Topics', desc: 'All active debates', color: 'text-for-400' },
              { href: '/debate/calendar', icon: Calendar, label: 'Debate Schedule', desc: 'Upcoming sessions', color: 'text-purple-400' },
              { href: '/evening', icon: TrendingDown, label: 'Evening Recap', desc: "Tonight's verdicts", color: 'text-cyan-400' },
            ].map(({ href, icon: Icon, label, desc, color }) => (
              <Link
                key={href}
                href={href}
                className="group flex flex-col gap-1.5 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
              >
                <Icon className={cn('h-4 w-4', color)} />
                <p className="text-white text-xs font-mono font-semibold leading-tight group-hover:text-surface-100">{label}</p>
                <p className="text-surface-500 text-[10px] font-mono">{desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-8 pt-5 border-t border-surface-300">
          <p className="text-center font-mono text-[10px] text-surface-600 uppercase tracking-widest">
            Lobby Market · Write the law · Build the consensus
          </p>
        </footer>

      </main>

      <BottomNav />
    </div>
  )
}
