import Link from 'next/link'
import { BookOpen, Calendar, Mic, Plus, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { DebateCard } from '@/components/debate/DebateCard'
import { EmptyState } from '@/components/ui/EmptyState'
import type {
  Debate,
  DebateWithTopic,
  DebateParticipant,
  DebateParticipantWithProfile,
  Profile,
  Topic,
} from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

export const metadata = {
  title: 'Debates · Lobby',
  description: 'Live and scheduled debates in the Lobby arena.',
}

export const dynamic = 'force-dynamic'

interface DebateWithParticipants extends DebateWithTopic {
  participants: DebateParticipantWithProfile[]
}

export default async function DebateIndexPage() {
  const supabase = await createClient()

  // Active debates (live + scheduled) and recently ended in parallel
  const [activeRes, endedRes] = await Promise.all([
    supabase
      .from('debates')
      .select('*')
      .in('status', ['scheduled', 'live'])
      .order('status', { ascending: true }) // live < scheduled alphabetically
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('debates')
      .select('*')
      .eq('status', 'ended')
      .order('ended_at', { ascending: false })
      .limit(6),
  ])

  const baseDebates = (activeRes.data ?? []) as Debate[]
  const recentEnded = (endedRes.data ?? []) as Debate[]

  // Batch fetch topics, creators, and speakers for all debates (active + recently ended).
  const allDebates = [...baseDebates, ...recentEnded]
  const topicIds = Array.from(new Set(allDebates.map((d) => d.topic_id)))
  const creatorIds = Array.from(new Set(allDebates.map((d) => d.creator_id)))
  const debateIds = allDebates.map((d) => d.id)

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
          c as Pick<
            Profile,
            'id' | 'username' | 'display_name' | 'avatar_url' | 'role'
          >,
        ] as const
    )
  )

  // Hydrate speaker profiles
  const speakerRows = (speakerRes.data ?? []) as DebateParticipant[]
  const speakerUserIds = Array.from(
    new Set(speakerRows.map((p) => p.user_id))
  )
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

  const participantsByDebate = new Map<
    string,
    DebateParticipantWithProfile[]
  >()
  for (const p of speakerRows) {
    const list = participantsByDebate.get(p.debate_id) ?? []
    list.push({ ...p, profile: speakerProfileMap.get(p.user_id) ?? null })
    participantsByDebate.set(p.debate_id, list)
  }

  const withParticipants: DebateWithParticipants[] = baseDebates.map((d) => ({
    ...d,
    topic: topicMap.get(d.topic_id) ?? null,
    creator: creatorMap.get(d.creator_id) ?? null,
    participants: participantsByDebate.get(d.id) ?? [],
  }))

  const endedWithParticipants: DebateWithParticipants[] = recentEnded.map((d) => ({
    ...d,
    topic: topicMap.get(d.topic_id) ?? null,
    creator: creatorMap.get(d.creator_id) ?? null,
    participants: participantsByDebate.get(d.id) ?? [],
  }))

  const now = Date.now()
  const oneDay = 24 * 60 * 60 * 1000

  const liveNow = withParticipants.filter((d) => d.status === 'live')
  const upcomingNext24h = withParticipants.filter(
    (d) =>
      d.status === 'scheduled' &&
      new Date(d.scheduled_at).getTime() - now <= oneDay &&
      new Date(d.scheduled_at).getTime() >= now
  )
  const upcomingLater = withParticipants.filter(
    (d) =>
      d.status === 'scheduled' &&
      new Date(d.scheduled_at).getTime() - now > oneDay
  )

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-8">
        {/* Hero */}
        <div className="mb-10 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-against-500/10 border border-against-500/30">
              <Mic className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="font-mono text-3xl font-bold text-white">
                The Arena
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {liveNow.length} live · {upcomingNext24h.length + upcomingLater.length}{' '}
                upcoming
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/debate/archive"
              className={cn(
                'inline-flex items-center gap-2 px-3 py-2 rounded-lg',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white text-xs font-mono font-medium transition-colors'
              )}
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Archive</span>
            </Link>
            <Link
              href="/debate/calendar"
              className={cn(
                'inline-flex items-center gap-2 px-3 py-2 rounded-lg',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white text-xs font-mono font-medium transition-colors'
              )}
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Calendar</span>
            </Link>
            <Link
              href="/debate/create"
              className={cn(
                'inline-flex items-center gap-2 px-3 py-2 rounded-lg',
                'bg-for-600 border border-for-500 text-white',
                'hover:bg-for-700 text-xs font-mono font-medium transition-colors'
              )}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Schedule Debate</span>
            </Link>
          </div>
        </div>

        {/* Empty state */}
        {withParticipants.length === 0 && (
          <EmptyState
            icon={Mic}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/20"
            title="No debates scheduled"
            description="Be the first to schedule a live debate on an active topic."
            actions={[
              { label: 'Schedule a Debate', href: '/debate/create', icon: Plus },
              { label: 'View archive', href: '/debate/archive', variant: 'secondary' },
            ]}
          />
        )}

        {/* Live now */}
        {liveNow.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-surface-300">
              <div className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-against-500 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-against-500" />
              </div>
              <h2 className="font-mono text-sm font-semibold text-against-400 uppercase tracking-wider">
                Live Now
              </h2>
              <span className="ml-auto text-[11px] font-mono text-surface-500">
                {liveNow.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveNow.map((d) => (
                <DebateCard key={d.id} debate={d} participants={d.participants} />
              ))}
            </div>
          </section>
        )}

        {/* Next 24h */}
        {upcomingNext24h.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-surface-300">
              <h2 className="font-mono text-sm font-semibold text-white uppercase tracking-wider">
                Next 24 Hours
              </h2>
              <span className="ml-auto text-[11px] font-mono text-surface-500">
                {upcomingNext24h.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingNext24h.map((d) => (
                <DebateCard key={d.id} debate={d} participants={d.participants} />
              ))}
            </div>
          </section>
        )}

        {/* Later */}
        {upcomingLater.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-surface-300">
              <h2 className="font-mono text-sm font-semibold text-surface-600 uppercase tracking-wider">
                All Upcoming
              </h2>
              <span className="ml-auto text-[11px] font-mono text-surface-500">
                {upcomingLater.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingLater.map((d) => (
                <DebateCard key={d.id} debate={d} participants={d.participants} />
              ))}
            </div>
          </section>
        )}

        {/* Recent Recaps */}
        {endedWithParticipants.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-surface-300">
              <Trophy className="h-3.5 w-3.5 text-gold" />
              <h2 className="font-mono text-sm font-semibold text-gold/80 uppercase tracking-wider">
                Recent Recaps
              </h2>
              <span className="ml-auto flex items-center gap-1">
                <Link
                  href="/debate/archive"
                  className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                >
                  View all {endedWithParticipants.length >= 6 ? '→' : ''}
                </Link>
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {endedWithParticipants.map((d) => (
                <DebateCard key={d.id} debate={d} participants={d.participants} />
              ))}
            </div>
            <div className="mt-4 text-center">
              <Link
                href="/debate/archive"
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono',
                  'bg-surface-200 border border-surface-300 text-surface-500',
                  'hover:bg-surface-300 hover:text-white transition-colors'
                )}
              >
                <BookOpen className="h-4 w-4" />
                Browse full archive
              </Link>
            </div>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
