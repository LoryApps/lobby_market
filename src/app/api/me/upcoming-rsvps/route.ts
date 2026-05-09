import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface UpcomingRsvpDebate {
  id: string
  title: string
  type: string
  status: string
  scheduled_at: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  ms_until_start: number
}

export interface UpcomingRsvpsResponse {
  debates: UpcomingRsvpDebate[]
}

// Window: debates starting within the next 2 hours
const WINDOW_MS = 2 * 60 * 60 * 1000

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ debates: [] })
  }

  const now = new Date()
  const windowEnd = new Date(now.getTime() + WINDOW_MS)

  // Fetch RSVPs for debates starting within the window that are scheduled or live
  const { data: rsvps, error } = await supabase
    .from('debate_rsvps')
    .select('debate_id')
    .eq('user_id', user.id)

  if (error || !rsvps || rsvps.length === 0) {
    return NextResponse.json({ debates: [] })
  }

  const debateIds = rsvps.map((r) => r.debate_id)

  const { data: debates, error: debatesError } = await supabase
    .from('debates')
    .select('id, title, type, status, scheduled_at, topic_id')
    .in('id', debateIds)
    .in('status', ['scheduled', 'live'])
    .lte('scheduled_at', windowEnd.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(3)

  if (debatesError || !debates || debates.length === 0) {
    return NextResponse.json({ debates: [] })
  }

  const topicIds = Array.from(new Set(debates.map((d) => d.topic_id)))
  const { data: topics } = await supabase
    .from('topics')
    .select('id, statement, category')
    .in('id', topicIds)

  const topicMap = new Map(
    (topics ?? []).map((t) => [t.id, t])
  )

  const result: UpcomingRsvpDebate[] = debates.map((d) => {
    const topic = topicMap.get(d.topic_id)
    const scheduled = new Date(d.scheduled_at)
    return {
      id: d.id,
      title: d.title ?? 'Untitled Debate',
      type: d.type,
      status: d.status,
      scheduled_at: d.scheduled_at,
      topic_id: d.topic_id,
      topic_statement: topic?.statement ?? '',
      topic_category: topic?.category ?? null,
      ms_until_start: Math.max(0, scheduled.getTime() - now.getTime()),
    }
  })

  return NextResponse.json({ debates: result })
}
