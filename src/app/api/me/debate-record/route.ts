import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DebateRecord {
  debate_id: string
  title: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  topic_blue_pct: number
  debate_type: string
  debate_status: string
  side: 'blue' | 'red'
  is_speaker: boolean
  sway_earned: number
  scheduled_at: string
  ended_at: string | null
  /** Outcome from THIS user's perspective (null = unresolved) */
  outcome: 'win' | 'loss' | null
}

export interface DebateRecordStats {
  total: number
  as_speaker: number
  as_spectator: number
  as_blue: number
  as_red: number
  total_sway_earned: number
  completed: number
  wins: number
  losses: number
  win_rate: number | null
}

export interface DebateRecordResponse {
  stats: DebateRecordStats
  debates: DebateRecord[]
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // All debates the user participated in
  const { data: participations } = await supabase
    .from('debate_participants')
    .select('debate_id, side, is_speaker, joined_at')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })
    .limit(200)

  if (!participations || participations.length === 0) {
    return NextResponse.json({
      stats: {
        total: 0,
        as_speaker: 0,
        as_spectator: 0,
        as_blue: 0,
        as_red: 0,
        total_sway_earned: 0,
        completed: 0,
        wins: 0,
        losses: 0,
        win_rate: null,
      },
      debates: [],
    } satisfies DebateRecordResponse)
  }

  const debateIds = participations.map((p) => p.debate_id)

  // Fetch debate details with topic info
  const { data: debatesRaw } = await supabase
    .from('debates')
    .select('id, title, topic_id, type, status, scheduled_at, ended_at, blue_sway, red_sway')
    .in('id', debateIds)
    .order('scheduled_at', { ascending: false })

  const debates = debatesRaw ?? []

  // Collect topic IDs
  const topicIds = Array.from(new Set(debates.map((d) => d.topic_id).filter(Boolean)))

  const { data: topicsRaw } = topicIds.length
    ? await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct')
        .in('id', topicIds)
    : { data: [] }

  const topicMap = new Map<string, { statement: string; category: string | null; status: string; blue_pct: number }>()
  for (const t of topicsRaw ?? []) {
    topicMap.set(t.id, {
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct,
    })
  }

  // Build participation lookup
  const partMap = new Map<string, { side: string; is_speaker: boolean }>()
  for (const p of participations) {
    partMap.set(p.debate_id, { side: p.side, is_speaker: p.is_speaker })
  }

  // Assemble records
  const records: DebateRecord[] = []
  let totalSway = 0
  let wins = 0
  let losses = 0
  let completed = 0

  for (const d of debates) {
    const part = partMap.get(d.id)
    if (!part) continue

    const topic = topicMap.get(d.topic_id)
    const side = part.side as 'blue' | 'red'
    const isSpeaker = part.is_speaker

    // Sway earned: blue_sway for blue speakers, red_sway for red speakers
    const swayEarned = isSpeaker
      ? side === 'blue'
        ? (d.blue_sway ?? 0)
        : (d.red_sway ?? 0)
      : 0
    totalSway += swayEarned

    // Outcome: win if topic reached law and you were blue, or topic failed and you were red
    let outcome: 'win' | 'loss' | null = null
    if (d.status === 'ended' && topic) {
      completed++
      if (topic.status === 'law') {
        outcome = side === 'blue' ? 'win' : 'loss'
      } else if (topic.status === 'failed') {
        outcome = side === 'red' ? 'win' : 'loss'
      } else {
        // Debate ended but topic still active — use sway as tiebreaker
        const blueSway = d.blue_sway ?? 0
        const redSway = d.red_sway ?? 0
        if (side === 'blue' && blueSway > redSway) outcome = 'win'
        else if (side === 'red' && redSway > blueSway) outcome = 'win'
        else if (blueSway !== redSway) outcome = 'loss'
      }
      if (outcome === 'win') wins++
      if (outcome === 'loss') losses++
    }

    records.push({
      debate_id: d.id,
      title: d.title,
      topic_id: d.topic_id,
      topic_statement: topic?.statement ?? d.title,
      topic_category: topic?.category ?? null,
      topic_status: topic?.status ?? 'active',
      topic_blue_pct: topic?.blue_pct ?? 50,
      debate_type: d.type,
      debate_status: d.status,
      side,
      is_speaker: isSpeaker,
      sway_earned: swayEarned,
      scheduled_at: d.scheduled_at,
      ended_at: d.ended_at,
      outcome,
    })
  }

  const stats: DebateRecordStats = {
    total: records.length,
    as_speaker: records.filter((r) => r.is_speaker).length,
    as_spectator: records.filter((r) => !r.is_speaker).length,
    as_blue: records.filter((r) => r.side === 'blue').length,
    as_red: records.filter((r) => r.side === 'red').length,
    total_sway_earned: totalSway,
    completed,
    wins,
    losses,
    win_rate: completed > 0 ? Math.round((wins / completed) * 100) : null,
  }

  return NextResponse.json({ stats, debates: records } satisfies DebateRecordResponse)
}
