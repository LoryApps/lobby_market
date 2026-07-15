import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface TimetableDebate {
  id: string
  title: string
  topic_id: string | null
  topic_statement: string | null
  starts_at: string
  ends_at: string | null
  status: string
  participant_count: number
  category: string | null
}

export interface TimetableVoting {
  id: string
  statement: string
  category: string | null
  voting_ends_at: string
  blue_pct: number
  total_votes: number
  status: string
}

export interface TimetableEvent {
  id: string
  type: 'emergency_debate' | 'ama' | 'debate_challenge'
  title: string
  starts_at: string
  status: string
  link: string
}

export interface TimetableResponse {
  debates_today: TimetableDebate[]
  debates_upcoming: TimetableDebate[]
  voting_closing_today: TimetableVoting[]
  voting_closing_soon: TimetableVoting[]
  special_events: TimetableEvent[]
  generated_at: string
}

export async function GET() {
  try {
    const supabase = await createClient()

    const now = new Date()
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)
    const soon = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    // Debates active today or starting soon
    const { data: debatesRaw } = await supabase
      .from('debates')
      .select(`
        id,
        title,
        topic_id,
        starts_at,
        ends_at,
        status,
        participant_count,
        topics(statement, category)
      `)
      .or(`status.eq.live,status.eq.scheduled`)
      .lte('starts_at', soon.toISOString())
      .order('starts_at', { ascending: true })
      .limit(20)

    const debates = (debatesRaw ?? []).map((d: Record<string, unknown>) => {
      const topic = d.topics as { statement?: string; category?: string } | null
      return {
        id: d.id as string,
        title: (d.title as string) || (topic?.statement ?? 'Untitled debate'),
        topic_id: d.topic_id as string | null,
        topic_statement: topic?.statement ?? null,
        starts_at: d.starts_at as string,
        ends_at: d.ends_at as string | null,
        status: d.status as string,
        participant_count: (d.participant_count as number) ?? 0,
        category: topic?.category ?? null,
      }
    })

    const debatesToday = debates.filter(
      (d) => new Date(d.starts_at) <= todayEnd
    )
    const debatesUpcoming = debates.filter(
      (d) => new Date(d.starts_at) > todayEnd
    )

    // Topics whose voting windows close today or in the next 48h
    const { data: votingRaw } = await supabase
      .from('topics')
      .select('id, statement, category, voting_ends_at, blue_pct, total_votes, status')
      .eq('status', 'voting')
      .not('voting_ends_at', 'is', null)
      .gte('voting_ends_at', now.toISOString())
      .lte('voting_ends_at', soon.toISOString())
      .order('voting_ends_at', { ascending: true })
      .limit(15)

    const votingAll = (votingRaw ?? []) as TimetableVoting[]
    const votingToday = votingAll.filter(
      (t) => new Date(t.voting_ends_at) <= todayEnd
    )
    const votingSoon = votingAll.filter(
      (t) => new Date(t.voting_ends_at) > todayEnd
    )

    // Emergency debates granted and upcoming
    const specialEvents: TimetableEvent[] = []

    const { data: emergencyRaw } = await supabase
      .from('emergency_debates')
      .select('id, title, created_at, status')
      .eq('status', 'granted')
      .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(5)

    for (const ed of emergencyRaw ?? []) {
      specialEvents.push({
        id: ed.id as string,
        type: 'emergency_debate',
        title: ed.title as string,
        starts_at: ed.created_at as string,
        status: ed.status as string,
        link: '/emergency-debates',
      })
    }

    // Active AMA sessions
    const { data: amaRaw } = await supabase
      .from('ama_sessions')
      .select('id, title, starts_at, status')
      .in('status', ['scheduled', 'live'])
      .gte('starts_at', now.toISOString())
      .lte('starts_at', soon.toISOString())
      .order('starts_at', { ascending: true })
      .limit(5)

    for (const ama of amaRaw ?? []) {
      specialEvents.push({
        id: ama.id as string,
        type: 'ama',
        title: ama.title as string,
        starts_at: ama.starts_at as string,
        status: ama.status as string,
        link: '/ama',
      })
    }

    // Sort special events by time
    specialEvents.sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    )

    const response: TimetableResponse = {
      debates_today: debatesToday,
      debates_upcoming: debatesUpcoming,
      voting_closing_today: votingToday,
      voting_closing_soon: votingSoon,
      special_events: specialEvents,
      generated_at: now.toISOString(),
    }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=60' },
    })
  } catch (err) {
    console.error('[timetable]', err)
    return NextResponse.json(
      {
        debates_today: [],
        debates_upcoming: [],
        voting_closing_today: [],
        voting_closing_soon: [],
        special_events: [],
        generated_at: new Date().toISOString(),
      } satisfies TimetableResponse,
      { status: 200 }
    )
  }
}
