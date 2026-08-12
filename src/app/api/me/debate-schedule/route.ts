import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ScheduledDebate {
  id: string
  title: string
  type: string
  status: string
  scheduled_at: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  rsvp_count: number
  participant_count: number
}

export interface DebateScheduleResponse {
  debates: ScheduledDebate[]
}

// GET /api/me/debate-schedule
// Returns all upcoming debates the user has RSVP'd to, sorted by scheduled_at.
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ debates: [] } satisfies DebateScheduleResponse)
  }

  // All debates the user has RSVP'd to
  const { data: rsvps } = await supabase
    .from('debate_rsvps')
    .select('debate_id')
    .eq('user_id', user.id)

  if (!rsvps || rsvps.length === 0) {
    return NextResponse.json({ debates: [] } satisfies DebateScheduleResponse)
  }

  const debateIds = rsvps.map((r) => r.debate_id as string)

  // Fetch upcoming debates (scheduled or live)
  const { data: debates } = await supabase
    .from('debates')
    .select('id, title, type, status, scheduled_at, topic_id')
    .in('id', debateIds)
    .in('status', ['scheduled', 'live'])
    .order('scheduled_at', { ascending: true })

  if (!debates || debates.length === 0) {
    return NextResponse.json({ debates: [] } satisfies DebateScheduleResponse)
  }

  const fetchedIds = debates.map((d) => d.id as string)
  const topicIds = Array.from(new Set(debates.map((d) => d.topic_id as string)))

  const [topicsRes, rsvpCountsRes, participantCountsRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category')
      .in('id', topicIds),
    supabase
      .from('debate_rsvps')
      .select('debate_id')
      .in('debate_id', fetchedIds),
    supabase
      .from('debate_participants')
      .select('debate_id')
      .in('debate_id', fetchedIds),
  ])

  const topicMap = new Map(
    (topicsRes.data ?? []).map((t) => [t.id as string, t])
  )

  const rsvpCountMap: Record<string, number> = {}
  for (const r of rsvpCountsRes.data ?? []) {
    const did = r.debate_id as string
    rsvpCountMap[did] = (rsvpCountMap[did] ?? 0) + 1
  }

  const participantCountMap: Record<string, number> = {}
  for (const p of participantCountsRes.data ?? []) {
    const did = p.debate_id as string
    participantCountMap[did] = (participantCountMap[did] ?? 0) + 1
  }

  const result: ScheduledDebate[] = debates.map((d) => {
    const topic = topicMap.get(d.topic_id as string)
    return {
      id: d.id as string,
      title: (d.title as string | null) ?? 'Untitled Debate',
      type: d.type as string,
      status: d.status as string,
      scheduled_at: d.scheduled_at as string,
      topic_id: d.topic_id as string,
      topic_statement: topic?.statement ?? '',
      topic_category: (topic?.category as string | null) ?? null,
      rsvp_count: rsvpCountMap[d.id as string] ?? 0,
      participant_count: participantCountMap[d.id as string] ?? 0,
    }
  })

  return NextResponse.json({ debates: result } satisfies DebateScheduleResponse)
}
