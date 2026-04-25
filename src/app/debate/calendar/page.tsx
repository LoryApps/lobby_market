import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, List, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { DebateCalendar } from '@/components/debate/DebateCalendar'
import type {
  Debate,
  DebateWithTopic,
  DebateParticipant,
  DebateParticipantWithProfile,
  DebateRsvp,
  Profile,
  Topic,
} from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Debate Calendar · Lobby Market',
  description: 'View all scheduled and live debates on a monthly calendar. Plan your participation.',
  openGraph: {
    title: 'Debate Calendar · Lobby Market',
    description: 'View all scheduled and live debates on a monthly calendar.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

interface DebateWithParticipants extends DebateWithTopic {
  participants: DebateParticipantWithProfile[]
  rsvp_count?: number
}

export default async function DebateCalendarPage() {
  const supabase = await createClient()

  const now = new Date()
  const threeMonthsLater = new Date(now)
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3)

  // Fetch all upcoming debates (live + scheduled) in the next 3 months
  const { data: rawDebates } = await supabase
    .from('debates')
    .select('*')
    .in('status', ['scheduled', 'live'])
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', threeMonthsLater.toISOString())
    .order('scheduled_at', { ascending: true })

  const baseDebates = (rawDebates ?? []) as Debate[]

  // Batch fetch related data
  const topicIds = Array.from(new Set(baseDebates.map((d) => d.topic_id)))
  const creatorIds = Array.from(new Set(baseDebates.map((d) => d.creator_id)))
  const debateIds = baseDebates.map((d) => d.id)

  const [topicsRes, creatorsRes, speakerRes, rsvpRes] = await Promise.all([
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
          data: [] as Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>[],
        }),

    debateIds.length
      ? supabase
          .from('debate_participants')
          .select('*')
          .in('debate_id', debateIds)
          .eq('is_speaker', true)
      : Promise.resolve({ data: [] as DebateParticipant[] }),

    debateIds.length
      ? supabase
          .from('debate_rsvps')
          .select('debate_id')
          .in('debate_id', debateIds)
      : Promise.resolve({ data: [] as Pick<DebateRsvp, 'debate_id'>[] }),
  ])

  const topicMap = new Map(
    (topicsRes.data ?? []).map((t) => [t.id, t as Pick<Topic, 'id' | 'statement' | 'category'>])
  )
  const creatorMap = new Map(
    (creatorsRes.data ?? []).map((c) => [
      c.id,
      c as Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>,
    ])
  )

  // Build speaker profiles lookup
  const speakerProfiles = speakerRes.data ?? []
  const speakerProfileIds = Array.from(new Set(speakerProfiles.map((sp) => sp.user_id)))
  const { data: speakerProfileData } = speakerProfileIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', speakerProfileIds)
    : { data: [] as Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>[] }
  const speakerProfileMap = new Map(
    (speakerProfileData ?? []).map((p) => [p.id, p])
  )

  // Count RSVPs per debate
  const rsvpCountMap = new Map<string, number>()
  for (const rsvp of rsvpRes.data ?? []) {
    const existing = rsvpCountMap.get(rsvp.debate_id) ?? 0
    rsvpCountMap.set(rsvp.debate_id, existing + 1)
  }

  // Assemble DebateWithParticipants
  const debates: DebateWithParticipants[] = baseDebates.map((debate) => {
    const participants: DebateParticipantWithProfile[] = (speakerProfiles ?? [])
      .filter((sp) => sp.debate_id === debate.id)
      .map((sp) => ({
        ...sp,
        profile: speakerProfileMap.get(sp.user_id) ?? null,
      })) as DebateParticipantWithProfile[]

    return {
      ...debate,
      topic: topicMap.get(debate.topic_id) ?? null,
      creator: creatorMap.get(debate.creator_id) ?? null,
      participants,
      rsvp_count: rsvpCountMap.get(debate.id) ?? 0,
    }
  })

  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-indexed

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/debate"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to debates"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white font-mono">
              Debate Calendar
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              {debates.length > 0
                ? `${debates.length} upcoming debate${debates.length !== 1 ? 's' : ''} in the next 3 months`
                : 'No upcoming debates scheduled'}
            </p>
          </div>

          {/* View toggle, subscribe, schedule CTA */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/debate"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white text-xs font-mono transition-colors"
            >
              <List className="h-3.5 w-3.5" />
              List View
            </Link>
            {/* iCal subscribe link */}
            <a
              href="/api/debates/upcoming.ics"
              download="lobby-market-debates.ics"
              title="Download upcoming debates as iCal file (.ics) — importable into Google Calendar, Apple Calendar, Outlook"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 text-xs font-mono transition-colors"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export .ics</span>
            </a>
            <Link
              href="/debate/create"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-600 hover:bg-for-700 text-white text-xs font-mono font-medium transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Schedule</span>
            </Link>
          </div>
        </div>

        {/* Calendar component */}
        <DebateCalendar
          debates={debates}
          initialYear={currentYear}
          initialMonth={currentMonth}
        />
      </main>
      <BottomNav />
    </div>
  )
}
