import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RadarDeadHeat {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  voting_ends_at: string | null
  closeness: number // ABS(blue_pct - 50), lower = more contested
}

export interface RadarActiveTopic {
  id: string
  statement: string
  category: string | null
  support_count: number
  activation_threshold: number
  feed_score: number
  view_count: number
  created_at: string
}

export interface RadarDebate {
  id: string
  topic_statement: string
  topic_id: string
  status: string
  scheduled_at: string | null
  debate_type: string
  duration_minutes: number
}

export interface RadarLaw {
  id: string
  statement: string
  category: string | null
  established_at: string
  blue_pct: number | null
  total_votes: number | null
}

export interface RadarStats {
  voting_topics: number
  active_topics: number
  live_debates: number
  laws_today: number
  arguments_last_hour: number
}

export interface RadarResponse {
  dead_heats: RadarDeadHeat[]
  active_surge: RadarActiveTopic[]
  debates_soon: RadarDebate[]
  laws_today: RadarLaw[]
  stats: RadarStats
  fetched_at: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = new Date()
  const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000)
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)

  const [
    deadHeatsRes,
    activeSurgeRes,
    debatesSoonRes,
    lawsTodayRes,
    votingCountRes,
    activeCountRes,
    liveDebateRes,
    argumentsHourRes,
  ] = await Promise.all([
    // Topics in voting, sorted by closeness to 50/50
    supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes, voting_ends_at')
      .eq('status', 'voting')
      .order('voting_ends_at', { ascending: true })
      .limit(10),

    // Active topics gaining momentum (high feed_score, not yet voting)
    supabase
      .from('topics')
      .select('id, statement, category, support_count, activation_threshold, feed_score, view_count, created_at')
      .eq('status', 'active')
      .order('feed_score', { ascending: false })
      .limit(6),

    // Debates scheduled in the next 6 hours (or live now)
    supabase
      .from('debates')
      .select('id, topic_id, status, scheduled_at, debate_type, duration_minutes')
      .in('status', ['live', 'scheduled'])
      .or(`status.eq.live,and(status.eq.scheduled,scheduled_at.gte.${now.toISOString()},scheduled_at.lte.${sixHoursFromNow.toISOString()})`)
      .order('scheduled_at', { ascending: true })
      .limit(6),

    // Laws established today
    supabase
      .from('laws')
      .select('id, statement, category, established_at, blue_pct, total_votes')
      .eq('is_active', true)
      .gte('established_at', todayStart.toISOString())
      .order('established_at', { ascending: false })
      .limit(5),

    // Count: topics in voting
    supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'voting'),

    // Count: active topics
    supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),

    // Count: live debates
    supabase
      .from('debates')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'live'),

    // Count: arguments in the last hour
    supabase
      .from('arguments')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString()),
  ])

  // Build dead_heats: sort by closeness to 50/50
  const rawVoting = (deadHeatsRes.data ?? []) as RadarDeadHeat[]
  const dead_heats = rawVoting
    .map((t) => ({ ...t, closeness: Math.abs(t.blue_pct - 50) }))
    .sort((a, b) => a.closeness - b.closeness)

  // Enrich debates with topic statements
  const rawDebates = (debatesSoonRes.data ?? []) as Array<{
    id: string; topic_id: string; status: string
    scheduled_at: string | null; debate_type: string; duration_minutes: number
  }>

  const topicIds = Array.from(new Set(rawDebates.map((d) => d.topic_id)))
  const topicMap: Record<string, string> = {}

  if (topicIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, statement')
      .in('id', topicIds)
    for (const t of topicRows ?? []) {
      topicMap[t.id] = t.statement
    }
  }

  const debates_soon: RadarDebate[] = rawDebates.map((d) => ({
    id: d.id,
    topic_id: d.topic_id,
    topic_statement: topicMap[d.topic_id] ?? 'Debate topic',
    status: d.status,
    scheduled_at: d.scheduled_at,
    debate_type: d.debate_type,
    duration_minutes: d.duration_minutes,
  }))

  const stats: RadarStats = {
    voting_topics: votingCountRes.count ?? 0,
    active_topics: activeCountRes.count ?? 0,
    live_debates: liveDebateRes.count ?? 0,
    laws_today: (lawsTodayRes.data ?? []).length,
    arguments_last_hour: argumentsHourRes.count ?? 0,
  }

  const response: RadarResponse = {
    dead_heats,
    active_surge: (activeSurgeRes.data ?? []) as RadarActiveTopic[],
    debates_soon,
    laws_today: (lawsTodayRes.data ?? []) as RadarLaw[],
    stats,
    fetched_at: now.toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
