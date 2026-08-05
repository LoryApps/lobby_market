import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { Mic, Radio, Clock, Swords, Users, ArrowRight, CalendarDays } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Live Debates · Lobby Market',
  description:
    'Debates happening right now on Lobby Market — join live or RSVP for debates starting soon. The civic arena never sleeps.',
  openGraph: {
    title: 'Live Debates · Lobby Market',
    description: 'Join a live civic debate or RSVP for one starting soon.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Live Debates · Lobby Market',
    description: 'Debates happening right now on Lobby Market.',
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DebateRow {
  id: string
  title: string | null
  debate_type: string
  status: string
  scheduled_at: string
  topic_id: string | null
  rsvp_count: number
  topics: { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number } | null
  debate_participants: { id: string; profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const mins = Math.ceil(diff / 60_000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.ceil(mins / 60)
  return `in ${hrs}h`
}

const TYPE_LABELS: Record<string, string> = {
  quick: 'Quick · 15m',
  grand: 'Grand · 45m',
  tribunal: 'Tribunal · 60m',
}

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
}

export default async function LiveDebatesPage() {
  const supabase = await createClient()

  const now = new Date()
  const soonThreshold = new Date(now.getTime() + 30 * 60 * 1000).toISOString()

  // Fetch live and imminent debates
  const { data: rawDebates } = await supabase
    .from('debates')
    .select(`
      id,
      title,
      debate_type,
      status,
      scheduled_at,
      topic_id,
      topics!inner(id, statement, category, status, blue_pct, total_votes),
      debate_participants(id, profiles(id, username, display_name, avatar_url))
    `)
    .or(`status.eq.live,and(status.eq.scheduled,scheduled_at.lte.${soonThreshold})`)
    .order('scheduled_at', { ascending: true })
    .limit(50)

  const debates = (rawDebates ?? []) as unknown as DebateRow[]

  // Fetch RSVP counts
  const debateIds = debates.map((d) => d.id)
  let rsvpCounts: Record<string, number> = {}
  if (debateIds.length > 0) {
    const { data: rsvps } = await supabase
      .from('debate_rsvps')
      .select('debate_id')
      .in('debate_id', debateIds)
    if (rsvps) {
      for (const r of rsvps) {
        rsvpCounts[r.debate_id] = (rsvpCounts[r.debate_id] ?? 0) + 1
      }
    }
  }

  const live = debates.filter((d) => d.status === 'live')
  const soon = debates.filter((d) => d.status !== 'live')

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30">
              <Radio className="h-5 w-5 text-against-400 animate-pulse" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Live Debates</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {live.length > 0
                  ? `${live.length} debate${live.length !== 1 ? 's' : ''} live now · ${soon.length} starting soon`
                  : soon.length > 0
                  ? `${soon.length} debate${soon.length !== 1 ? 's' : ''} starting soon`
                  : 'No active debates right now'}
              </p>
            </div>
          </div>
          <Link
            href="/debate/calendar"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-400/40 text-surface-400 text-xs font-mono hover:border-surface-400/60 hover:text-surface-300 transition-all"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Calendar
          </Link>
        </div>

        {/* ── Live NOW section ──────────────────────────────────────────────── */}
        {live.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2 w-2 rounded-full bg-against-500 animate-pulse" />
              <h2 className="text-xs font-mono font-semibold text-against-400 uppercase tracking-wider">
                Live Now
              </h2>
            </div>
            <div className="flex flex-col gap-3">
              {live.map((debate) => (
                <DebateCard
                  key={debate.id}
                  debate={debate}
                  rsvpCount={rsvpCounts[debate.id] ?? 0}
                  isLive
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Starting Soon section ─────────────────────────────────────────── */}
        {soon.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-3.5 w-3.5 text-gold" />
              <h2 className="text-xs font-mono font-semibold text-gold uppercase tracking-wider">
                Starting Soon
              </h2>
            </div>
            <div className="flex flex-col gap-3">
              {soon.map((debate) => (
                <DebateCard
                  key={debate.id}
                  debate={debate}
                  rsvpCount={rsvpCounts[debate.id] ?? 0}
                  isLive={false}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {debates.length === 0 && (
          <EmptyState
            icon={<Mic className="h-8 w-8 text-surface-500" />}
            title="No live debates right now"
            description="Check back soon — or schedule a debate on any active topic."
            action={{ label: 'Browse Debates', href: '/debate' }}
          />
        )}

        {/* ── Footer links ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 justify-center mt-8">
          <Link
            href="/debate"
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            All Debates
            <ArrowRight className="h-3 w-3" />
          </Link>
          <Link
            href="/debate/create"
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            Schedule a Debate
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}

// ─── DebateCard ───────────────────────────────────────────────────────────────

function DebateCard({
  debate,
  rsvpCount,
  isLive,
}: {
  debate: DebateRow
  rsvpCount: number
  isLive: boolean
}) {
  const topic = debate.topics
  const category = topic?.category ?? null
  const catColor = category ? (CATEGORY_COLOR[category] ?? null) : null
  const forPct = Math.round(topic?.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <Link
      href={`/debate/${debate.id}`}
      className={cn(
        'block rounded-xl border p-4 transition-all duration-200',
        isLive
          ? 'bg-against-900/20 border-against-600/40 hover:border-against-500/60 hover:bg-against-900/30'
          : 'bg-surface-200/60 border-surface-300/60 hover:border-surface-400/60 hover:bg-surface-200/80'
      )}
    >
      {/* Top row: type + status + time */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-against-600/30 border border-against-500/60 text-against-200 text-[10px] font-mono font-bold">
              <Radio className="h-2.5 w-2.5 animate-pulse" />
              LIVE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/15 border border-gold/30 text-gold text-[10px] font-mono font-semibold">
              <Clock className="h-2.5 w-2.5" />
              {relativeTime(debate.scheduled_at)}
            </span>
          )}
          <span className="text-[10px] font-mono text-surface-500">
            {TYPE_LABELS[debate.debate_type] ?? debate.debate_type}
          </span>
        </div>
        {category && catColor && (
          <span className={cn(
            'text-[10px] font-mono px-1.5 py-0.5 rounded-md border',
            catColor.text, catColor.bg, catColor.border
          )}>
            {category}
          </span>
        )}
      </div>

      {/* Title / topic statement */}
      {debate.title ? (
        <p className="text-sm font-semibold text-white mb-1 line-clamp-2">{debate.title}</p>
      ) : null}
      {topic && (
        <p className={cn(
          'text-xs text-surface-400 line-clamp-2',
          debate.title ? 'mt-0.5' : 'text-sm font-medium text-white'
        )}>
          {topic.statement}
        </p>
      )}

      {/* Bottom row: participants + RSVP count + vote split */}
      <div className="flex items-center justify-between mt-3 gap-2">
        <div className="flex items-center gap-3">
          {/* Participant avatars */}
          {debate.debate_participants.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="flex -space-x-1.5">
                {debate.debate_participants.slice(0, 3).map((p) => (
                  <Avatar
                    key={p.id}
                    src={p.profiles?.avatar_url}
                    fallback={p.profiles?.display_name ?? p.profiles?.username ?? '?'}
                    size="xs"
                    className="ring-1 ring-surface-200"
                  />
                ))}
              </div>
              <span className="text-[10px] font-mono text-surface-500">
                <Swords className="h-2.5 w-2.5 inline mr-0.5" />
                {debate.debate_participants.length} debat{debate.debate_participants.length !== 1 ? 'ors' : 'or'}
              </span>
            </div>
          )}
          {rsvpCount > 0 && (
            <span className="text-[10px] font-mono text-surface-500 flex items-center gap-0.5">
              <Users className="h-2.5 w-2.5" />
              {rsvpCount} watching
            </span>
          )}
        </div>

        {/* Vote split mini-bar */}
        {topic && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-for-400">{forPct}%</span>
            <div className="w-16 h-1.5 rounded-full overflow-hidden bg-surface-300/60 flex">
              <div className="h-full bg-for-600" style={{ width: `${forPct}%` }} />
              <div className="h-full bg-against-600" style={{ width: `${againstPct}%` }} />
            </div>
            <span className="text-[10px] font-mono text-against-400">{againstPct}%</span>
          </div>
        )}
      </div>
    </Link>
  )
}
