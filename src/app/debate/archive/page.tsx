import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Mic,
  Trophy,
  Users,
  Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type {
  Debate,
  DebateWithTopic,
  DebateParticipant,
  DebateParticipantWithProfile,
  Profile,
  Topic,
} from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Debate Archive · Lobby Market',
  description:
    'Browse all past debates in the Lobby arena — review results, sway percentages, and top arguments from every ended debate.',
  openGraph: {
    title: 'Debate Archive · Lobby Market',
    description: 'Browse all past debates in the Lobby arena.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DebateWithParticipants extends DebateWithTopic {
  participants: DebateParticipantWithProfile[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  quick: '15m · Quick',
  grand: '45m · Grand',
  tribunal: '60m · Tribunal',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDuration(startedAt: string | null, endedAt: string | null): string | null {
  if (!startedAt || !endedAt) return null
  const secs = Math.floor(
    (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000
  )
  if (secs <= 0) return null
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

// ─── Past Debate Row ──────────────────────────────────────────────────────────

function PastDebateRow({ debate }: { debate: DebateWithParticipants }) {
  const blueSpeaker = debate.participants.find(
    (p) => p.side === 'blue' && p.is_speaker
  )
  const redSpeaker = debate.participants.find(
    (p) => p.side === 'red' && p.is_speaker
  )

  const winner: 'blue' | 'red' | 'draw' =
    debate.blue_sway > debate.red_sway
      ? 'blue'
      : debate.red_sway > debate.blue_sway
      ? 'red'
      : 'draw'

  const duration = formatDuration(
    debate.started_at ?? null,
    debate.ended_at ?? null
  )

  return (
    <Link
      href={`/debate/${debate.id}/recap`}
      className={cn(
        'group block rounded-xl border border-surface-300 bg-surface-100',
        'hover:border-surface-400 hover:bg-surface-200/40 transition-all duration-150',
        'p-5'
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Trophy icon */}
          <div className="flex-shrink-0 mt-0.5">
            <div
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg',
                winner === 'blue'
                  ? 'bg-for-500/10 border border-for-500/30'
                  : winner === 'red'
                  ? 'bg-against-500/10 border border-against-500/30'
                  : 'bg-gold/10 border border-gold/30'
              )}
            >
              <Trophy
                className={cn(
                  'h-4 w-4',
                  winner === 'blue'
                    ? 'text-for-400'
                    : winner === 'red'
                    ? 'text-against-400'
                    : 'text-gold'
                )}
              />
            </div>
          </div>

          {/* Title + topic */}
          <div className="flex-1 min-w-0">
            <h3 className="font-mono text-sm font-semibold text-white leading-snug line-clamp-1 group-hover:text-surface-700 transition-colors">
              {debate.title}
            </h3>
            {debate.topic?.statement && (
              <p className="text-[11px] text-surface-500 leading-relaxed line-clamp-1 mt-0.5">
                {debate.topic.statement}
              </p>
            )}
          </div>
        </div>

        {/* Meta: type + date */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-surface-500">
            {TYPE_LABEL[debate.type] ?? debate.type}
          </span>
          {debate.ended_at && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-surface-600">
              <Calendar className="h-3 w-3" />
              {formatDate(debate.ended_at)}
            </span>
          )}
        </div>
      </div>

      {/* Sway bar */}
      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-for-400 font-bold">FOR {debate.blue_sway}%</span>
          {winner !== 'draw' && (
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold',
                winner === 'blue'
                  ? 'bg-for-500/20 text-for-300'
                  : 'bg-against-500/20 text-against-300'
              )}
            >
              {winner === 'blue' ? 'FOR wins' : 'AGAINST wins'}
            </span>
          )}
          {winner === 'draw' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-gold/20 text-gold">
              Draw
            </span>
          )}
          <span className="text-against-400 font-bold">AGAINST {debate.red_sway}%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
          <div
            className="h-full bg-for-600 rounded-l-full"
            style={{ width: `${debate.blue_sway}%` }}
          />
          <div
            className="h-full bg-against-600 rounded-r-full"
            style={{ width: `${debate.red_sway}%` }}
          />
        </div>
      </div>

      {/* Footer: speakers + stats */}
      <div className="flex items-center gap-4 pt-3 border-t border-surface-300/50">
        {/* Speakers */}
        <div className="flex items-center gap-2">
          {blueSpeaker?.profile ? (
            <Avatar
              src={blueSpeaker.profile.avatar_url}
              fallback={
                blueSpeaker.profile.display_name ?? blueSpeaker.profile.username
              }
              size="xs"
              className="ring-2 ring-for-500/40"
            />
          ) : (
            <div className="h-6 w-6 rounded-full border border-dashed border-for-500/30" />
          )}
          <span className="text-[10px] font-mono text-surface-600">vs</span>
          {redSpeaker?.profile ? (
            <Avatar
              src={redSpeaker.profile.avatar_url}
              fallback={
                redSpeaker.profile.display_name ?? redSpeaker.profile.username
              }
              size="xs"
              className="ring-2 ring-against-500/40"
            />
          ) : (
            <div className="h-6 w-6 rounded-full border border-dashed border-against-500/30" />
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 ml-auto text-[10px] font-mono text-surface-500">
          {duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {duration}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {debate.viewer_count.toLocaleString()}
          </span>
        </div>

        {/* CTA */}
        <span className="text-[11px] font-mono text-surface-500 group-hover:text-white transition-colors ml-2">
          View recap →
        </span>
      </div>
    </Link>
  )
}

// ─── Summary stat ─────────────────────────────────────────────────────────────

function ArchiveStat({
  label,
  value,
  color = 'text-white',
}: {
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div className="flex flex-col gap-1 bg-surface-100 border border-surface-300 rounded-xl px-4 py-3">
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
        {label}
      </span>
      <span className={cn('text-xl font-mono font-bold', color)}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DebateArchivePage() {
  const supabase = await createClient()

  // Fetch ended debates, most recent first (no limit — this is the archive)
  const { data: rawDebates } = await supabase
    .from('debates')
    .select('*')
    .eq('status', 'ended')
    .order('ended_at', { ascending: false })
    .limit(100)

  const baseDebates = (rawDebates ?? []) as Debate[]

  if (baseDebates.length === 0) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Link
              href="/debate"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
              aria-label="Back to debates"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gold/10 border border-gold/30">
                <BookOpen className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Debate Archive</h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5">Past debates & recaps</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 mx-auto mb-5">
              <BookOpen className="h-7 w-7 text-surface-500" />
            </div>
            <h2 className="font-mono text-lg text-white mb-2">No past debates yet</h2>
            <p className="text-sm font-mono text-surface-500 max-w-sm">
              Debates will appear here once they finish. Check back after the first live debate ends.
            </p>
            <Link
              href="/debate"
              className={cn(
                'mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg',
                'bg-for-600 text-white text-sm font-medium',
                'hover:bg-for-700 transition-colors'
              )}
            >
              <Mic className="h-4 w-4" />
              See live debates
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // Hydrate topics, creators, and speakers
  const topicIds = Array.from(new Set(baseDebates.map((d) => d.topic_id)))
  const creatorIds = Array.from(new Set(baseDebates.map((d) => d.creator_id)))
  const debateIds = baseDebates.map((d) => d.id)

  const [topicsRes, creatorsRes, speakerRes] = await Promise.all([
    topicIds.length
      ? supabase
          .from('topics')
          .select('id, statement, category')
          .in('id', topicIds)
      : Promise.resolve({ data: [] as Pick<Topic, 'id' | 'statement' | 'category'>[] }),
    creatorIds.length
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .in('id', creatorIds)
      : Promise.resolve({
          data: [] as Pick<
            Profile,
            'id' | 'username' | 'display_name' | 'avatar_url' | 'role'
          >[],
        }),
    debateIds.length
      ? supabase
          .from('debate_participants')
          .select('*')
          .in('debate_id', debateIds)
          .eq('is_speaker', true)
      : Promise.resolve({ data: [] as DebateParticipant[] }),
  ])

  const topicMap = new Map(
    (topicsRes.data ?? []).map(
      (t) => [t.id, t as Pick<Topic, 'id' | 'statement' | 'category'>] as const
    )
  )
  const creatorMap = new Map(
    (creatorsRes.data ?? []).map(
      (c) =>
        [
          c.id,
          c as Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>,
        ] as const
    )
  )

  // Hydrate speaker profiles
  const speakerRows = (speakerRes.data ?? []) as DebateParticipant[]
  const speakerUserIds = Array.from(new Set(speakerRows.map((p) => p.user_id)))
  let speakerProfileMap = new Map<
    string,
    Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>
  >()
  if (speakerUserIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', speakerUserIds)
    speakerProfileMap = new Map(
      (profs ?? []).map((p) => [p.id, p] as const)
    )
  }

  const participantsByDebate = new Map<string, DebateParticipantWithProfile[]>()
  for (const p of speakerRows) {
    const list = participantsByDebate.get(p.debate_id) ?? []
    list.push({ ...p, profile: speakerProfileMap.get(p.user_id) ?? null })
    participantsByDebate.set(p.debate_id, list)
  }

  const debates: DebateWithParticipants[] = baseDebates.map((d) => ({
    ...d,
    topic: topicMap.get(d.topic_id) ?? null,
    creator: creatorMap.get(d.creator_id) ?? null,
    participants: participantsByDebate.get(d.id) ?? [],
  }))

  // ── Summary stats ─────────────────────────────────────────────────────────

  const totalViewers = debates.reduce((sum, d) => sum + (d.viewer_count ?? 0), 0)
  const forWins = debates.filter((d) => d.blue_sway > d.red_sway).length
  const againstWins = debates.filter((d) => d.red_sway > d.blue_sway).length
  const draws = debates.length - forWins - againstWins

  // Group by month for section headers
  type DebateGroup = { monthLabel: string; debates: DebateWithParticipants[] }
  const grouped: DebateGroup[] = []
  const monthMap = new Map<string, DebateWithParticipants[]>()

  for (const d of debates) {
    const date = new Date(d.ended_at ?? d.scheduled_at)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
    if (!monthMap.has(key)) {
      monthMap.set(key, [])
      grouped.push({ monthLabel: label, debates: monthMap.get(key)! })
    }
    monthMap.get(key)!.push(d)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Link
              href="/debate"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
              aria-label="Back to debates"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gold/10 border border-gold/30">
                <BookOpen className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Debate Archive
                </h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  {debates.length} debate{debates.length !== 1 ? 's' : ''} on record
                </p>
              </div>
            </div>
          </div>
          <Link
            href="/debate"
            className={cn(
              'hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono',
              'bg-surface-200 border border-surface-300 text-surface-500',
              'hover:bg-surface-300 hover:text-white transition-colors'
            )}
          >
            <Mic className="h-3.5 w-3.5" />
            Live Arena
          </Link>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <ArchiveStat
            label="Total debates"
            value={debates.length}
            color="text-white"
          />
          <ArchiveStat
            label="Total viewers"
            value={totalViewers}
            color="text-for-400"
          />
          <ArchiveStat
            label="FOR wins"
            value={forWins}
            color="text-for-300"
          />
          <ArchiveStat
            label="AGAINST wins"
            value={againstWins}
            color="text-against-300"
          />
        </div>

        {/* Win rate bar */}
        {debates.length > 0 && (
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 mb-8">
            <div className="flex justify-between text-[11px] font-mono mb-2">
              <span className="text-for-400">
                FOR {Math.round((forWins / debates.length) * 100)}%
              </span>
              {draws > 0 && (
                <span className="text-gold">{draws} draw{draws !== 1 ? 's' : ''}</span>
              )}
              <span className="text-against-400">
                AGAINST {Math.round((againstWins / debates.length) * 100)}%
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-surface-300 flex gap-px">
              <div
                className="h-full bg-for-600 rounded-l-full"
                style={{
                  width: `${Math.round((forWins / debates.length) * 100)}%`,
                }}
              />
              {draws > 0 && (
                <div
                  className="h-full bg-gold/70"
                  style={{
                    width: `${Math.round((draws / debates.length) * 100)}%`,
                  }}
                />
              )}
              <div
                className="h-full bg-against-600 rounded-r-full"
                style={{
                  width: `${Math.round((againstWins / debates.length) * 100)}%`,
                }}
              />
            </div>
            <p className="text-[10px] font-mono text-surface-600 mt-2 text-center">
              Historical win rate across all {debates.length} debates
            </p>
          </div>
        )}

        {/* Grouped by month */}
        <div className="space-y-10">
          {grouped.map(({ monthLabel, debates: monthDebates }) => (
            <section key={monthLabel}>
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-surface-300">
                <Calendar className="h-3.5 w-3.5 text-surface-500" />
                <h2 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-wider">
                  {monthLabel}
                </h2>
                <span className="ml-auto text-[11px] font-mono text-surface-600">
                  {monthDebates.length}
                </span>
              </div>
              <div className="space-y-3">
                {monthDebates.map((d) => (
                  <PastDebateRow key={d.id} debate={d} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
