import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Flame,
  Gavel,
  MessageSquare,
  Moon,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 900

export const metadata: Metadata = {
  title: 'Civic Evening · Lobby Market',
  description:
    "The Lobby's evening recap — what happened today. Laws enacted, debates concluded, biggest vote swings, and the top argument of the day.",
  openGraph: {
    title: 'Civic Evening · Lobby Market',
    description:
      "Your daily civic wrap-up. What happened in the Lobby today — verdicts reached, laws enacted, debates concluded, the day's top argument.",
    type: 'website',
    siteName: 'Lobby Market',
    images: [{ url: '/assets/og-share.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Evening · Lobby Market',
    description: "The Lobby's evening recap — verdicts, new laws, and today's best argument.",
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEveningDate(): string {
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
  return 'Earlier'
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
      <Moon className="h-3 w-3 text-surface-500" />
      <div className="flex-1 h-px bg-surface-300" />
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default async function EveningPage() {
  const supabase = await createClient()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)
  const todayStart = todayMidnight.toISOString()

  const [
    verdictsTodayResult,
    lawsTodayResult,
    failedTodayResult,
    activeResult,
    topArgResult,
    mostDebatedResult,
    concludedDebatesResult,
    newTopicsTodayResult,
    newArgsResult,
  ] = await Promise.all([
    // Topics that concluded today (law or failed)
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, updated_at, scope')
      .in('status', ['law', 'failed'])
      .gte('updated_at', todayStart)
      .order('total_votes', { ascending: false })
      .limit(6),

    // Laws enacted today
    supabase
      .from('topics')
      .select('id, statement, category, total_votes, blue_pct, updated_at')
      .eq('status', 'law')
      .gte('updated_at', todayStart)
      .order('total_votes', { ascending: false })
      .limit(4),

    // Failed today
    supabase
      .from('topics')
      .select('id, statement, category, total_votes, blue_pct, updated_at')
      .eq('status', 'failed')
      .gte('updated_at', todayStart)
      .order('total_votes', { ascending: false })
      .limit(3),

    // Active topics to find biggest swing (closest and furthest from 50/50)
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, updated_at')
      .in('status', ['active', 'voting'])
      .gte('updated_at', oneDayAgo)
      .gte('total_votes', 5)
      .order('total_votes', { ascending: false })
      .limit(100),

    // Top argument posted today
    supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, topic_id, created_at, topics!topic_arguments_topic_id_fkey(statement, category)')
      .gte('created_at', todayStart)
      .order('upvotes', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Most argued topic today
    supabase
      .from('topic_arguments')
      .select('topic_id, topics!topic_arguments_topic_id_fkey(id, statement, category, total_votes, blue_pct, status)')
      .gte('created_at', todayStart)
      .limit(200),

    // Debates that concluded today
    supabase
      .from('debates')
      .select('id, topic_id, scheduled_at, status, type, topics!debates_topic_id_fkey(statement, category)')
      .eq('status', 'ended')
      .gte('updated_at', todayStart)
      .order('updated_at', { ascending: false })
      .limit(3),

    // New topics proposed today
    supabase
      .from('topics')
      .select('id, statement, category, total_votes, created_at')
      .gte('created_at', todayStart)
      .order('total_votes', { ascending: false })
      .limit(3),

    // Total arguments today (count)
    supabase
      .from('topic_arguments')
      .select('id')
      .gte('created_at', todayStart),
  ])

  const verdictsToday = verdictsTodayResult.data ?? []
  const lawsToday = lawsTodayResult.data ?? []
  const failedToday = failedTodayResult.data ?? []
  const activeTopics = activeResult.data ?? []
  const topArg = topArgResult.data as {
    id: string
    content: string
    side: string
    upvotes: number
    topic_id: string
    created_at: string
    topics: { statement: string; category: string | null } | null
  } | null
  const concludedDebates = (concludedDebatesResult.data ?? []) as Array<{
    id: string
    topic_id: string
    scheduled_at: string
    status: string
    type: string
    topics: { statement: string; category: string | null } | null
  }>
  const newTopicsToday = newTopicsTodayResult.data ?? []
  const argsToday = newArgsResult.data ?? []

  // Find biggest decisive swing (furthest from 50/50 among active topics)
  const biggestSwing = activeTopics
    .map((t) => ({ ...t, deviation: Math.abs((t.blue_pct ?? 50) - 50) }))
    .sort((a, b) => b.deviation - a.deviation)[0] ?? null

  // Most argued topic today
  const argCounts: Record<string, number> = {}
  for (const row of mostDebatedResult.data ?? []) {
    argCounts[row.topic_id] = (argCounts[row.topic_id] ?? 0) + 1
  }
  const topTopicId = Object.entries(argCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
  const mostDebatedRow = (mostDebatedResult.data ?? []).find((r) => r.topic_id === topTopicId)
  const mostDebated = mostDebatedRow
    ? {
        ...(mostDebatedRow.topics as { id: string; statement: string; category: string | null; total_votes: number; blue_pct: number; status: string }),
        argCount: argCounts[topTopicId!] ?? 0,
      }
    : null

  // Day in numbers
  const totalVotesToday = activeTopics.reduce((s, t) => s + (t.total_votes ?? 0), 0)

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
              {formatEveningDate()}
            </span>
          </div>
          <h1 className="font-mono font-black text-3xl sm:text-4xl text-white tracking-tight leading-none">
            CIVIC EVENING
          </h1>
          <p className="text-surface-500 text-sm font-mono mt-1">
            The Lobby's daily wrap-up — what was decided today.
          </p>
        </header>

        {/* Day in numbers */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-mono text-surface-400">
            <Zap className="h-3.5 w-3.5 text-gold" />
            <span className="text-white font-semibold">{totalVotesToday.toLocaleString()}</span> votes cast today
          </div>
          {verdictsToday.length > 0 && (
            <>
              <span className="text-surface-600 hidden sm:block">·</span>
              <div className="flex items-center gap-1.5 text-xs font-mono text-surface-400">
                <Gavel className="h-3.5 w-3.5 text-emerald" />
                <span className="text-white font-semibold">{verdictsToday.length}</span> verdict{verdictsToday.length !== 1 ? 's' : ''} reached
              </div>
            </>
          )}
          {argsToday.length > 0 && (
            <>
              <span className="text-surface-600 hidden sm:block">·</span>
              <div className="flex items-center gap-1.5 text-xs font-mono text-surface-400">
                <MessageSquare className="h-3.5 w-3.5 text-for-400" />
                <span className="text-white font-semibold">{argsToday.length}</span> arguments made
              </div>
            </>
          )}
        </div>

        {/* Today's Verdicts — laws enacted and topics that failed */}
        {(lawsToday.length > 0 || failedToday.length > 0) ? (
          <section className="mb-2">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-px flex-1 bg-surface-300" />
              <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">Today's Verdicts</span>
              <span className="h-px flex-1 bg-surface-300" />
            </div>

            {/* Laws enacted today */}
            {lawsToday.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-mono text-emerald uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3" /> Enacted into law
                </p>
                <div className="space-y-2">
                  {lawsToday.map((law) => (
                    <Link
                      key={law.id}
                      href={`/topic/${law.id}`}
                      className="group flex items-start gap-3 p-3.5 rounded-xl bg-surface-100 border border-emerald/20 hover:border-emerald/50 transition-colors"
                    >
                      <Gavel className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-mono leading-snug group-hover:text-emerald transition-colors line-clamp-2">
                          {law.statement}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {law.category && (
                            <span className={cn('text-[10px] font-mono uppercase tracking-wide', catColor(law.category))}>
                              {law.category}
                            </span>
                          )}
                          <span className="text-surface-500 text-[10px] font-mono">
                            {(law.total_votes ?? 0).toLocaleString()} votes · {Math.round(law.blue_pct ?? 50)}% for
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
                        {relTime(law.updated_at)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Failed today */}
            {failedToday.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-against-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <XCircle className="h-3 w-3" /> Did not pass
                </p>
                <div className="space-y-2">
                  {failedToday.map((t) => (
                    <Link
                      key={t.id}
                      href={`/topic/${t.id}`}
                      className="group flex items-start gap-3 p-3.5 rounded-xl bg-surface-100 border border-against-800/30 hover:border-against-500/30 transition-colors"
                    >
                      <XCircle className="h-4 w-4 text-against-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-mono leading-snug line-clamp-2 group-hover:text-against-300 transition-colors">
                          {t.statement}
                        </p>
                        <p className="text-surface-500 text-[10px] font-mono mt-1">
                          {(t.total_votes ?? 0).toLocaleString()} votes · {Math.round(t.blue_pct ?? 50)}% for
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
                        {relTime(t.updated_at)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="mb-6">
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 text-center">
              <Scale className="h-8 w-8 text-surface-600 mx-auto mb-2" />
              <p className="text-surface-500 text-sm font-mono">No verdicts yet today. Check back later.</p>
            </div>
          </section>
        )}

        <Divider />

        {/* Two column: biggest swing + most debated */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-2">

          {/* Biggest swing today */}
          {biggestSwing && (
            <section>
              <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3" /> Biggest Swing
              </h2>
              <Link
                href={`/topic/${biggestSwing.id}`}
                className="group block rounded-xl bg-surface-100 border border-for-800/30 hover:border-for-500/40 transition-colors p-4 h-full"
              >
                {biggestSwing.category && (
                  <span className={cn('text-xs font-mono uppercase tracking-wide', catColor(biggestSwing.category))}>
                    {biggestSwing.category}
                  </span>
                )}
                <p className="font-mono text-white text-sm leading-snug my-2 group-hover:text-for-300 transition-colors line-clamp-3">
                  {biggestSwing.statement}
                </p>
                <div className="flex items-center justify-between text-xs font-mono mb-1">
                  <span className="text-for-400 flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" /> {Math.round(biggestSwing.blue_pct ?? 50)}%
                  </span>
                  <span className="text-surface-500">{(biggestSwing.total_votes ?? 0).toLocaleString()} votes</span>
                  <span className="text-against-400 flex items-center gap-1">
                    {100 - Math.round(biggestSwing.blue_pct ?? 50)}% <ThumbsDown className="h-3 w-3" />
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                  <div className="h-full bg-for-500 rounded-full" style={{ width: `${Math.round(biggestSwing.blue_pct ?? 50)}%` }} />
                </div>
              </Link>
            </section>
          )}

          {/* Most debated today */}
          {mostDebated && (
            <section>
              <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Flame className="h-3 w-3 text-orange-400" /> Most Argued Today
              </h2>
              <Link
                href={`/topic/${mostDebated.id}`}
                className="group block rounded-xl bg-surface-100 border border-against-800/20 hover:border-against-500/30 transition-colors p-4 h-full"
              >
                {mostDebated.category && (
                  <span className={cn('text-xs font-mono uppercase tracking-wide', catColor(mostDebated.category))}>
                    {mostDebated.category}
                  </span>
                )}
                <p className="font-mono text-white text-sm leading-snug my-2 group-hover:text-against-300 transition-colors line-clamp-3">
                  {mostDebated.statement}
                </p>
                <div className="flex items-center gap-3 text-xs font-mono text-surface-500 mt-auto">
                  <span className="text-orange-400 font-semibold flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> {mostDebated.argCount} argument{mostDebated.argCount !== 1 ? 's' : ''}
                  </span>
                  <span>{(mostDebated.total_votes ?? 0).toLocaleString()} votes</span>
                </div>
              </Link>
            </section>
          )}
        </div>

        <Divider />

        {/* Top argument of the evening */}
        {topArg && (
          <section className="mb-2">
            <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
              Argument of the Evening
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

        {/* Concluded debates */}
        {concludedDebates.length > 0 && (
          <>
            <Divider />
            <section className="mb-2">
              <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
                Debates Concluded Today
              </h2>
              <div className="space-y-2">
                {concludedDebates.map((d) => (
                  <Link
                    key={d.id}
                    href={`/debate/${d.id}`}
                    className="group flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-purple/40 transition-colors"
                  >
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-surface-200 border border-surface-400/20 flex items-center justify-center">
                      <Award className="h-4 w-4 text-purple" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-mono leading-snug line-clamp-1 group-hover:text-purple transition-colors">
                        {d.topics?.statement ?? 'Debate'}
                      </p>
                      <p className="text-surface-500 text-[10px] font-mono mt-0.5">
                        {d.type.charAt(0).toUpperCase() + d.type.slice(1)} · {d.topics?.category ?? 'General'}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-surface-500 flex-shrink-0 flex items-center gap-1">
                      Concluded <ArrowRight className="h-3 w-3" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}

        {/* New topics proposed today */}
        {newTopicsToday.length > 0 && (
          <>
            <Divider />
            <section className="mb-2">
              <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
                Proposed Today
              </h2>
              <div className="space-y-2">
                {newTopicsToday.map((t) => (
                  <Link
                    key={t.id}
                    href={`/topic/${t.id}`}
                    className="group flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
                  >
                    <TrendingDown className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-mono leading-snug line-clamp-2 group-hover:text-surface-100 transition-colors">
                        {t.statement}
                      </p>
                      <p className="text-surface-500 text-[10px] font-mono mt-0.5">
                        {t.category} · {(t.total_votes ?? 0).toLocaleString()} votes · {relTime(t.created_at)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}

        <Divider />

        {/* Wind down actions */}
        <section>
          <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
            Wind Down Your Civic Day
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { href: '/laws', icon: Gavel, label: 'Law Codex', desc: 'All enacted laws', color: 'text-emerald' },
              { href: '/arguments', icon: MessageSquare, label: 'Arguments', desc: 'Best of the day', color: 'text-gold' },
              { href: '/analytics', icon: BarChart3, label: 'Your Analytics', desc: 'Your civic impact', color: 'text-for-400' },
              { href: '/notes', icon: BookOpen, label: 'Civic Notes', desc: 'Reflect and write', color: 'text-purple' },
              { href: '/topics', icon: Scale, label: 'Open Topics', desc: 'Still needs your vote', color: 'text-for-300' },
              { href: '/morning', icon: Moon, label: 'Morning Brief', desc: "Tomorrow's preview", color: 'text-surface-400' },
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
