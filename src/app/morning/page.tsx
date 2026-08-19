import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  Calendar,
  Flame,
  Gavel,
  MessageSquare,
  Mic,
  Moon,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Civic Morning · Lobby Market',
  description:
    'Start your civic day. The Lobby\'s morning front page — today\'s headline debate, laws established this week, upcoming debates, and the top argument of the day.',
  openGraph: {
    title: 'Civic Morning · Lobby Market',
    description:
      'Your daily front page. What\'s happening in the Lobby right now — the headline topic, recent laws, debate schedule, and today\'s best argument.',
    type: 'website',
    siteName: 'Lobby Market',
    images: [{ url: '/assets/og-share.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Morning · Lobby Market',
    description: 'Your morning brief from the Lobby — headline topic, new laws, upcoming debates, top argument.',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMorningDate(): string {
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

function relLawTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 2) return 'Just established'
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
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

export default async function MorningPage() {
  const supabase = await createClient()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch all data in parallel
  const [
    headlineResult,
    contestedResult,
    newLawsResult,
    debatesResult,
    topArgResult,
    statsResult,
  ] = await Promise.all([
    // Headline: most voted active topic in the last 24h
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, scope')
      .in('status', ['active', 'voting'])
      .gte('updated_at', oneDayAgo)
      .order('total_votes', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Most contested: closest to 50/50 among active topics
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['active', 'voting'])
      .gte('total_votes', 10)
      .order('feed_score', { ascending: false })
      .limit(50),

    // New laws this week
    supabase
      .from('topics')
      .select('id, statement, category, total_votes, updated_at')
      .eq('status', 'law')
      .gte('updated_at', sevenDaysAgo)
      .order('updated_at', { ascending: false })
      .limit(4),

    // Upcoming debates today
    supabase
      .from('debates')
      .select('id, topic_id, scheduled_at, status, type, topics!debates_topic_id_fkey(statement, category)')
      .in('status', ['scheduled', 'live'])
      .gte('scheduled_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .lte('scheduled_at', new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(3),

    // Top argument of the day
    supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, topic_id, topics!topic_arguments_topic_id_fkey(statement, category)')
      .gte('created_at', oneDayAgo)
      .order('upvotes', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Platform stats
    supabase
      .from('topics')
      .select('id, status, total_votes, created_at')
      .in('status', ['active', 'voting', 'law'])
      .gte('created_at', oneDayAgo),
  ])

  const headline = headlineResult.data
  const allActive = contestedResult.data ?? []
  // Find the topic closest to 50/50
  const contested = allActive
    .map((t) => ({ ...t, deviation: Math.abs((t.blue_pct ?? 50) - 50) }))
    .sort((a, b) => a.deviation - b.deviation)[0] ?? null
  const newLaws = newLawsResult.data ?? []
  const debates = (debatesResult.data ?? []) as Array<{
    id: string
    topic_id: string
    scheduled_at: string
    status: string
    type: string
    topics: { statement: string; category: string | null } | null
  }>
  const topArg = topArgResult.data as {
    id: string
    content: string
    side: string
    upvotes: number
    topic_id: string
    topics: { statement: string; category: string | null } | null
  } | null
  const todayTopics = statsResult.data ?? []
  const todayVotes = todayTopics.reduce((s, t) => s + (t.total_votes ?? 0), 0)
  const lawCount = newLaws.length

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
              {formatMorningDate()}
            </span>
          </div>
          <h1 className="font-mono font-black text-3xl sm:text-4xl text-white tracking-tight leading-none">
            CIVIC MORNING
          </h1>
          <p className="text-surface-500 text-sm font-mono mt-1">
            The Lobby's daily front page — what happened while you slept.
          </p>
        </header>

        {/* Platform pulse row */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-mono text-surface-400">
            <Zap className="h-3.5 w-3.5 text-gold" />
            <span className="text-white font-semibold">{allActive.length}</span> active debates
          </div>
          <span className="text-surface-600 hidden sm:block">·</span>
          <div className="flex items-center gap-1.5 text-xs font-mono text-surface-400">
            <TrendingUp className="h-3.5 w-3.5 text-for-400" />
            <span className="text-white font-semibold">{todayVotes.toLocaleString()}</span> votes today
          </div>
          {lawCount > 0 && (
            <>
              <span className="text-surface-600 hidden sm:block">·</span>
              <div className="flex items-center gap-1.5 text-xs font-mono text-surface-400">
                <Gavel className="h-3.5 w-3.5 text-emerald" />
                <span className="text-white font-semibold">{lawCount}</span> new law{lawCount > 1 ? 's' : ''} this week
              </div>
            </>
          )}
        </div>

        {/* Headline topic */}
        {headline ? (
          <section className="mb-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-px flex-1 bg-surface-300" />
              <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">Today's Headline</span>
              <span className="h-px flex-1 bg-surface-300" />
            </div>
            <Link
              href={`/topic/${headline.id}`}
              className="group block rounded-2xl bg-surface-100 border border-surface-300 hover:border-for-500/40 transition-colors p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                {headline.category && (
                  <span className={cn('text-xs font-mono font-semibold uppercase tracking-wide', catColor(headline.category))}>
                    {headline.category}
                  </span>
                )}
                <span className="text-xs font-mono text-surface-500 ml-auto">{headline.scope}</span>
              </div>
              <p className="font-mono font-bold text-white text-lg leading-snug group-hover:text-for-300 transition-colors mb-4">
                {headline.statement}
              </p>
              {/* Vote bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-for-400 flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" /> {Math.round(headline.blue_pct ?? 50)}% For
                  </span>
                  <span className="text-surface-500">{(headline.total_votes ?? 0).toLocaleString()} votes</span>
                  <span className="text-against-400 flex items-center gap-1">
                    {100 - Math.round(headline.blue_pct ?? 50)}% Against <ThumbsDown className="h-3 w-3" />
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
                  <div
                    className="h-full bg-for-500 rounded-full"
                    style={{ width: `${Math.round(headline.blue_pct ?? 50)}%` }}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs font-mono text-surface-500">
                  {headline.status === 'voting' ? 'Final voting underway' : 'Open for votes'}
                </span>
                <span className="text-xs font-mono text-for-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Vote now <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Link>
          </section>
        ) : (
          <section className="mb-6">
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 text-center">
              <Scale className="h-8 w-8 text-surface-600 mx-auto mb-2" />
              <p className="text-surface-500 text-sm font-mono">No active debates found. Check back later.</p>
            </div>
          </section>
        )}

        <Divider />

        {/* Most contested + new laws — two column layout on wider screens */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-2">

          {/* Most contested */}
          {contested && contested.id !== headline?.id && (
            <section>
              <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
                Most Contested
              </h2>
              <Link
                href={`/topic/${contested.id}`}
                className="group block rounded-xl bg-surface-100 border border-against-800/30 hover:border-against-500/40 transition-colors p-4 h-full"
              >
                <div className="flex items-center gap-2 mb-2">
                  {contested.category && (
                    <span className={cn('text-xs font-mono uppercase tracking-wide', catColor(contested.category))}>
                      {contested.category}
                    </span>
                  )}
                </div>
                <p className="font-mono text-white text-sm leading-snug mb-3 group-hover:text-against-300 transition-colors">
                  {contested.statement.slice(0, 100)}{contested.statement.length > 100 ? '…' : ''}
                </p>
                <div className="flex justify-between text-xs font-mono text-surface-500">
                  <span className="text-for-400">{Math.round(contested.blue_pct ?? 50)}%</span>
                  <span>split</span>
                  <span className="text-against-400">{100 - Math.round(contested.blue_pct ?? 50)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden mt-1">
                  <div className="h-full bg-for-500 rounded-full" style={{ width: `${Math.round(contested.blue_pct ?? 50)}%` }} />
                </div>
              </Link>
            </section>
          )}

          {/* New laws this week */}
          {newLaws.length > 0 && (
            <section className={contested && contested.id !== headline?.id ? '' : 'sm:col-span-2'}>
              <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
                Laws Established This Week
              </h2>
              <div className="space-y-2">
                {newLaws.slice(0, contested && contested.id !== headline?.id ? 3 : 4).map((law) => (
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
                        {relLawTime(law.updated_at)} · {(law.total_votes ?? 0).toLocaleString()} votes
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <Divider />

        {/* Top argument */}
        {topArg && (
          <section className="mb-2">
            <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
              Argument of the Morning
            </h2>
            <Link
              href={`/arguments/${topArg.id}`}
              className="group block rounded-xl bg-surface-100 border border-surface-300 hover:border-gold/40 transition-colors p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={cn(
                    'text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded',
                    topArg.side === 'blue'
                      ? 'bg-for-900/60 text-for-300 border border-for-800/40'
                      : 'bg-against-900/60 text-against-300 border border-against-800/40'
                  )}
                >
                  {topArg.side === 'blue' ? 'FOR' : 'AGAINST'}
                </span>
                {topArg.topics && (
                  <span className={cn('text-xs font-mono', catColor(topArg.topics.category))}>
                    {topArg.topics.category}
                  </span>
                )}
                <span className="ml-auto text-xs font-mono text-gold flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" /> {topArg.upvotes}
                </span>
              </div>
              {topArg.topics && (
                <p className="text-surface-500 text-[10px] font-mono mb-2 line-clamp-1">
                  On: {topArg.topics.statement}
                </p>
              )}
              <blockquote className="font-mono text-sm text-white leading-relaxed border-l-2 border-gold pl-3 group-hover:border-gold/70 transition-colors">
                &ldquo;{topArg.content.slice(0, 200)}{topArg.content.length > 200 ? '…' : ''}&rdquo;
              </blockquote>
              <p className="mt-2 text-xs font-mono text-surface-500 group-hover:text-gold/80 transition-colors flex items-center gap-1">
                Read full argument <ArrowRight className="h-3 w-3" />
              </p>
            </Link>
          </section>
        )}

        {/* Upcoming debates */}
        {debates.length > 0 && (
          <>
            <Divider />
            <section className="mb-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
                  On the Debate Schedule
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
                        d.status === 'live' ? 'bg-against-900/60 border border-against-700/40' : 'bg-surface-200 border border-surface-400/20'
                      )}
                    >
                      {d.status === 'live' ? (
                        <span className="h-2 w-2 rounded-full bg-against-400 animate-pulse" />
                      ) : (
                        <Mic className="h-4 w-4 text-surface-500" />
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

        {/* Start your day row */}
        <section>
          <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
            Start Your Civic Day
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { href: '/challenge', icon: Flame, label: 'Daily Quorum', desc: 'Vote on 3 topics', color: 'text-orange-400' },
              { href: '/topics', icon: Scale, label: 'Browse Topics', desc: 'All active debates', color: 'text-for-400' },
              { href: '/debate/calendar', icon: Calendar, label: 'Debate Schedule', desc: 'Upcoming sessions', color: 'text-purple-400' },
              { href: '/trending', icon: TrendingUp, label: 'Trending', desc: 'What\'s moving now', color: 'text-gold' },
              { href: '/arguments', icon: MessageSquare, label: 'Top Arguments', desc: 'Best reasoning', color: 'text-emerald' },
              { href: '/laws', icon: Gavel, label: 'Law Codex', desc: 'All established laws', color: 'text-cyan-400' },
              { href: '/evening', icon: Moon, label: 'Evening Recap', desc: "Today's verdicts", color: 'text-purple-400' },
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

        {/* Footer attribution */}
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
