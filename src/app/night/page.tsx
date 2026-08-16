import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Eye,
  Flame,
  Gavel,
  MessageSquare,
  Moon,
  Scale,
  Sparkles,
  Star,
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
export const revalidate = 600

export const metadata: Metadata = {
  title: 'Civic Night · Lobby Market',
  description:
    "The Lobby's late-night brief — what's still live as the night falls, sleeper topics that need your vote, and a preview of tomorrow's debates.",
  openGraph: {
    title: 'Civic Night · Lobby Market',
    description:
      "Wind down your civic day. Night owl topics still open, the debate that refused to settle, and what's starting at dawn.",
    type: 'website',
    siteName: 'Lobby Market',
    images: [{ url: '/assets/og-share.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Night · Lobby Market',
    description: "The Lobby at night — what's still live, what's unresolved, and what starts tomorrow.",
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNightDate(): string {
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

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'Just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return 'Earlier today'
}

function relFuture(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (diff <= 0) return 'Starting now'
  if (m < 60) return `In ${m}m`
  if (h < 24) return `In ${h}h`
  const d = Math.floor(h / 24)
  return `In ${d}d`
}

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-emerald',
  Environment: 'text-emerald',
  Healthcare: 'text-against-300',
  Education: 'text-purple',
  Justice: 'text-against-400',
  Defence: 'text-surface-400',
  Housing: 'text-gold',
  Transport: 'text-for-300',
}

function catColor(c: string | null): string {
  return c ? (CAT_COLOR[c] ?? 'text-surface-400') : 'text-surface-400'
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
  return <hr className="border-surface-300 my-6" />
}

// ─── Component ────────────────────────────────────────────────────────────────

export default async function NightPage() {
  const supabase = await createClient()
  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)
  const todayStart = todayMidnight.toISOString()
  const twelveHoursAhead = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    nightOwlResult,
    sleeperResult,
    undecidedResult,
    upcomingDebatesResult,
    lawsTodayResult,
    topArgNightResult,
    totalVotesTodayResult,
    newTopicsResult,
  ] = await Promise.all([
    // Night owl: active topics with recent activity (voted on in the last 2h)
    supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes, status, updated_at')
      .in('status', ['active', 'voting'])
      .gte('updated_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .order('total_votes', { ascending: false })
      .limit(5),

    // Sleeper topics: active, not many votes, not recently touched — deserve attention
    supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes, status, created_at')
      .in('status', ['active', 'voting'])
      .lt('total_votes', 30)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(4),

    // Most contested right now: closest to 50/50 with decent volume
    supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes, status')
      .in('status', ['active', 'voting'])
      .gte('total_votes', 10)
      .order('total_votes', { ascending: false })
      .limit(50),

    // Debates starting in the next 12 hours
    supabase
      .from('debates')
      .select('id, topic_id, scheduled_at, type, status, topics!debates_topic_id_fkey(statement, category)')
      .in('status', ['scheduled', 'live'])
      .gte('scheduled_at', new Date().toISOString())
      .lte('scheduled_at', twelveHoursAhead)
      .order('scheduled_at', { ascending: true })
      .limit(3),

    // Laws enacted today
    supabase
      .from('topics')
      .select('id, statement, category, total_votes, blue_pct, updated_at')
      .eq('status', 'law')
      .gte('updated_at', todayStart)
      .order('total_votes', { ascending: false })
      .limit(3),

    // Top argument posted today (by upvotes)
    supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, topic_id, created_at, topics!topic_arguments_topic_id_fkey(statement, category)')
      .gte('created_at', todayStart)
      .order('upvotes', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Total votes cast today (count across active topics updated today)
    supabase
      .from('topics')
      .select('total_votes')
      .in('status', ['active', 'voting', 'law', 'failed'])
      .gte('updated_at', todayStart)
      .limit(500),

    // New topics proposed today
    supabase
      .from('topics')
      .select('id, statement, category, total_votes, created_at')
      .gte('created_at', todayStart)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const nightOwl = nightOwlResult.data ?? []
  const sleepers = sleeperResult.data ?? []
  const lawsToday = lawsTodayResult.data ?? []
  const upcomingDebates = (upcomingDebatesResult.data ?? []) as Array<{
    id: string
    topic_id: string
    scheduled_at: string
    type: string
    status: string
    topics: { statement: string; category: string | null } | null
  }>
  const topArg = topArgNightResult.data as {
    id: string
    content: string
    side: string
    upvotes: number
    topic_id: string
    created_at: string
    topics: { statement: string; category: string | null } | null
  } | null
  const newTopics = newTopicsResult.data ?? []

  // Most contested: closest to 50/50
  const contested = (undecidedResult.data ?? [])
    .map((t) => ({ ...t, distance: Math.abs((t.blue_pct ?? 50) - 50) }))
    .sort((a, b) => a.distance - b.distance)[0] ?? null

  // Day stats
  const totalVotes = (totalVotesTodayResult.data ?? []).reduce((s, t) => s + (t.total_votes ?? 0), 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Masthead ──────────────────────────────────────────────────────── */}
        <header className="border-b border-surface-300 pb-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
              Lobby Market
            </span>
            <span className="text-[10px] font-mono text-surface-600">
              {formatEdition()}
            </span>
          </div>
          <div className="flex items-center gap-3 mb-1">
            <Moon className="h-7 w-7 text-purple flex-shrink-0" aria-hidden />
            <h1 className="font-mono text-4xl font-black text-white tracking-tight leading-none">
              Night Brief
            </h1>
          </div>
          <p className="font-mono text-sm text-surface-500 mt-2">
            {formatNightDate()} · The Lobby at night
          </p>
        </header>

        {/* ── Night pulse ───────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-6 text-[11px] font-mono text-surface-500">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-for-400" />
            {totalVotes.toLocaleString()} votes today
          </span>
          <span className="flex items-center gap-1">
            <Gavel className="h-3 w-3 text-emerald" />
            {lawsToday.length} law{lawsToday.length !== 1 ? 's' : ''} enacted
          </span>
          <span className="flex items-center gap-1">
            <Flame className="h-3 w-3 text-orange-400" />
            {nightOwl.length} topic{nightOwl.length !== 1 ? 's' : ''} still live
          </span>
        </div>

        {/* ── Most contested right now ───────────────────────────────────────── */}
        {contested && (
          <section className="mb-6">
            <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Scale className="h-3 w-3 text-purple" /> Still Undecided
            </h2>
            <Link
              href={`/topic/${contested.id}`}
              className="group block rounded-2xl bg-surface-100 border border-purple/20 hover:border-purple/40 transition-colors p-5"
            >
              {contested.category && (
                <span className={cn('text-xs font-mono uppercase tracking-wide', catColor(contested.category))}>
                  {contested.category}
                </span>
              )}
              <p className="font-mono text-white text-base leading-snug my-3 group-hover:text-purple/90 transition-colors">
                {contested.statement}
              </p>
              <div className="flex items-center justify-between text-xs font-mono text-surface-500 mb-2">
                <span className="text-for-400 flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" /> {Math.round(contested.blue_pct ?? 50)}%
                </span>
                <span className="text-surface-600">{(contested.total_votes ?? 0).toLocaleString()} votes</span>
                <span className="text-against-400 flex items-center gap-1">
                  {100 - Math.round(contested.blue_pct ?? 50)}% <ThumbsDown className="h-3 w-3" />
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full"
                  style={{ width: `${Math.round(contested.blue_pct ?? 50)}%` }}
                />
              </div>
              <p className="mt-3 text-xs font-mono text-purple/70 flex items-center gap-1 group-hover:text-purple transition-colors">
                Cast your vote <ArrowRight className="h-3 w-3" />
              </p>
            </Link>
          </section>
        )}

        <Divider />

        {/* ── Night owl topics ───────────────────────────────────────────────── */}
        {nightOwl.length > 0 && (
          <section className="mb-2">
            <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Eye className="h-3 w-3 text-gold" /> Night Owl — Still Active
            </h2>
            <div className="space-y-2">
              {nightOwl.map((topic) => (
                <Link
                  key={topic.id}
                  href={`/topic/${topic.id}`}
                  className="group flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-gold/30 transition-colors"
                >
                  <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-400/20">
                    <Flame className="h-3.5 w-3.5 text-orange-400" aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-mono leading-snug line-clamp-2 group-hover:text-gold/80 transition-colors">
                      {topic.statement}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-surface-500">
                      {topic.category && (
                        <span className={catColor(topic.category)}>{topic.category}</span>
                      )}
                      <span>{(topic.total_votes ?? 0).toLocaleString()} votes</span>
                      <span className="text-for-400">{Math.round(topic.blue_pct ?? 50)}% For</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-surface-600 flex-shrink-0 whitespace-nowrap">
                    {relTime(topic.updated_at)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {nightOwl.length > 0 && <Divider />}

        {/* ── Sleeper topics ─────────────────────────────────────────────────── */}
        {sleepers.length > 0 && (
          <section className="mb-2">
            <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-for-300" /> Sleepers — Need Your Vote
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sleepers.map((topic) => (
                <Link
                  key={topic.id}
                  href={`/topic/${topic.id}`}
                  className="group block rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/30 transition-colors p-3"
                >
                  {topic.category && (
                    <span className={cn('text-[10px] font-mono uppercase tracking-wide', catColor(topic.category))}>
                      {topic.category}
                    </span>
                  )}
                  <p className="text-white text-xs font-mono leading-snug mt-1 line-clamp-2 group-hover:text-for-300/80 transition-colors">
                    {topic.statement}
                  </p>
                  <p className="text-surface-500 text-[10px] font-mono mt-2">
                    {(topic.total_votes ?? 0)} votes · {relTime(topic.created_at)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {sleepers.length > 0 && <Divider />}

        {/* ── Argument of the night ─────────────────────────────────────────── */}
        {topArg && (
          <section className="mb-2">
            <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
              Argument of the Night
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
                &ldquo;{topArg.content.slice(0, 220)}{topArg.content.length > 220 ? '…' : ''}&rdquo;
              </blockquote>
              <p className="mt-2 text-xs font-mono text-surface-500 group-hover:text-gold/80 transition-colors flex items-center gap-1">
                Read full argument <ArrowRight className="h-3 w-3" />
              </p>
            </Link>
          </section>
        )}

        {topArg && <Divider />}

        {/* ── Laws established today ────────────────────────────────────────── */}
        {lawsToday.length > 0 && (
          <section className="mb-2">
            <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Gavel className="h-3 w-3 text-emerald" /> Laws Enacted Today
            </h2>
            <div className="space-y-2">
              {lawsToday.map((law) => (
                <Link
                  key={law.id}
                  href={`/topic/${law.id}`}
                  className="group flex items-start gap-3 p-3 rounded-xl bg-emerald/5 border border-emerald/20 hover:border-emerald/40 transition-colors"
                >
                  <Gavel className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-mono leading-snug line-clamp-2 group-hover:text-emerald/80 transition-colors">
                      {law.statement}
                    </p>
                    <p className="text-surface-500 text-[10px] font-mono mt-1">
                      {(law.total_votes ?? 0).toLocaleString()} votes · {Math.round(law.blue_pct ?? 100)}% For
                    </p>
                  </div>
                  <Star className="h-3.5 w-3.5 text-emerald/50 flex-shrink-0 mt-0.5" aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        )}

        {lawsToday.length > 0 && <Divider />}

        {/* ── Upcoming debates ──────────────────────────────────────────────── */}
        {upcomingDebates.length > 0 && (
          <section className="mb-2">
            <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-for-400" /> Starting Soon
            </h2>
            <div className="space-y-2">
              {upcomingDebates.map((debate) => (
                <Link
                  key={debate.id}
                  href={`/debate/${debate.id}`}
                  className="group flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/30 transition-colors"
                >
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-surface-200 border border-surface-400/20 flex items-center justify-center">
                    <MessageSquare className="h-3.5 w-3.5 text-for-400" aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-mono leading-snug line-clamp-1 group-hover:text-for-300 transition-colors">
                      {debate.topics?.statement ?? 'Debate'}
                    </p>
                    <p className="text-surface-500 text-[10px] font-mono mt-0.5">
                      {debate.type.charAt(0).toUpperCase() + debate.type.slice(1)} · {debate.topics?.category ?? 'General'}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-for-400 flex-shrink-0 whitespace-nowrap">
                    {relFuture(debate.scheduled_at)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {upcomingDebates.length > 0 && <Divider />}

        {/* ── New topics today ─────────────────────────────────────────────── */}
        {newTopics.length > 0 && (
          <section className="mb-2">
            <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-gold" /> Proposed Today
            </h2>
            <div className="space-y-2">
              {newTopics.map((t) => (
                <Link
                  key={t.id}
                  href={`/topic/${t.id}`}
                  className="group flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-mono leading-snug line-clamp-2 group-hover:text-surface-100 transition-colors">
                      {t.statement}
                    </p>
                    <p className="text-surface-500 text-[10px] font-mono mt-1">
                      {t.category} · {(t.total_votes ?? 0).toLocaleString()} votes · {relTime(t.created_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {newTopics.length > 0 && <Divider />}

        {/* ── Rest easy actions ─────────────────────────────────────────────── */}
        <section>
          <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
            Before You Sleep
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { href: '/notes', icon: BookOpen, label: 'Civic Notes', desc: 'Jot your thoughts', color: 'text-purple' },
              { href: '/laws', icon: Gavel, label: 'Law Codex', desc: "Tonight's new laws", color: 'text-emerald' },
              { href: '/arguments', icon: MessageSquare, label: 'Best Arguments', desc: "Today's top takes", color: 'text-gold' },
              { href: '/topics', icon: Scale, label: 'Open Votes', desc: 'Still needs your voice', color: 'text-for-400' },
              { href: '/morning', icon: Moon, label: 'Morning Brief', desc: "Tomorrow's briefing", color: 'text-surface-400' },
              { href: '/streaks', icon: Flame, label: 'Your Streak', desc: 'Keep the flame alive', color: 'text-orange-400' },
            ].map(({ href, icon: Icon, label, desc, color }) => (
              <Link
                key={href}
                href={href}
                className="group flex flex-col gap-1.5 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
              >
                <Icon className={cn('h-4 w-4', color)} aria-hidden />
                <p className="text-white text-xs font-mono font-semibold leading-tight group-hover:text-surface-100">
                  {label}
                </p>
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
