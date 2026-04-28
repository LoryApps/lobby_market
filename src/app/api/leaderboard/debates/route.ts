import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type DebateSortBy =
  | 'most_watched'
  | 'decisive'
  | 'longest'
  | 'most_active'
  | 'recent'

export interface DebateEntry {
  id: string
  title: string
  type: string
  status: string
  viewer_count: number
  blue_sway: number
  red_sway: number
  started_at: string | null
  ended_at: string | null
  duration_minutes: number
  message_count: number
  participant_count: number
  sway_swing: number
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null
  creator: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  rank: number
}

export interface DebatesLeaderboardResponse {
  debates: DebateEntry[]
  total: number
  sort: DebateSortBy
  generatedAt: string
}

const DEBATE_SELECT = `
  id, title, type, status,
  viewer_count, blue_sway, red_sway,
  started_at, ended_at,
  topic:topics!debates_topic_id_fkey(id, statement, category, status),
  creator:profiles!debates_creator_id_fkey(id, username, display_name, avatar_url, role)
`

export async function GET(req: NextRequest) {
  const sort = (req.nextUrl.searchParams.get('sort') ?? 'most_watched') as DebateSortBy
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '25', 10), 50)

  const supabase = await createClient()

  // Fetch ended debates — these are the "completed" records worth ranking
  const { data: rawDebates, error } = await supabase
    .from('debates')
    .select(DEBATE_SELECT)
    .eq('status', 'ended')
    .order('ended_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const debateRows = rawDebates ?? []
  const debateIds = debateRows.map((d) => d.id)

  // Fetch message counts per debate
  const msgCountMap = new Map<string, number>()
  const participantCountMap = new Map<string, number>()

  if (debateIds.length > 0) {
    const [msgRes, partRes] = await Promise.all([
      supabase
        .from('debate_messages')
        .select('debate_id')
        .in('debate_id', debateIds),
      supabase
        .from('debate_participants')
        .select('debate_id')
        .in('debate_id', debateIds),
    ])

    for (const row of msgRes.data ?? []) {
      msgCountMap.set(row.debate_id, (msgCountMap.get(row.debate_id) ?? 0) + 1)
    }
    for (const row of partRes.data ?? []) {
      participantCountMap.set(
        row.debate_id,
        (participantCountMap.get(row.debate_id) ?? 0) + 1,
      )
    }
  }

  // Enrich with computed fields
  type RawRow = (typeof debateRows)[0]
  const enriched: DebateEntry[] = debateRows.map((d: RawRow) => {
    const start = d.started_at ? new Date(d.started_at).getTime() : null
    const end = d.ended_at ? new Date(d.ended_at).getTime() : null
    const durationMs = start && end ? Math.max(0, end - start) : 0
    const durationMinutes = Math.round(durationMs / 60_000)

    // How far the final sway moved from an even 50/50 split
    const swaySwing = Math.abs((d.blue_sway ?? 50) - 50)

    return {
      id: d.id,
      title: d.title,
      type: d.type,
      status: d.status,
      viewer_count: d.viewer_count ?? 0,
      blue_sway: d.blue_sway ?? 50,
      red_sway: d.red_sway ?? 50,
      started_at: d.started_at,
      ended_at: d.ended_at,
      duration_minutes: durationMinutes,
      message_count: msgCountMap.get(d.id) ?? 0,
      participant_count: participantCountMap.get(d.id) ?? 0,
      sway_swing: swaySwing,
      topic: d.topic
        ? {
            id: (d.topic as { id: string }).id,
            statement: (d.topic as { statement: string }).statement,
            category: (d.topic as { category: string | null }).category,
            status: (d.topic as { status: string }).status,
          }
        : null,
      creator: d.creator
        ? {
            id: (d.creator as { id: string }).id,
            username: (d.creator as { username: string }).username,
            display_name: (d.creator as { display_name: string | null }).display_name,
            avatar_url: (d.creator as { avatar_url: string | null }).avatar_url,
            role: (d.creator as { role: string }).role,
          }
        : null,
      rank: 0,
    }
  })

  // Sort
  let sorted: DebateEntry[]
  switch (sort) {
    case 'most_watched':
      sorted = [...enriched].sort((a, b) => b.viewer_count - a.viewer_count)
      break
    case 'decisive':
      sorted = [...enriched].sort((a, b) => b.sway_swing - a.sway_swing)
      break
    case 'longest':
      sorted = [...enriched].sort((a, b) => b.duration_minutes - a.duration_minutes)
      break
    case 'most_active':
      sorted = [...enriched].sort((a, b) => b.message_count - a.message_count)
      break
    case 'recent':
    default:
      sorted = [...enriched].sort((a, b) => {
        const aTime = a.ended_at ? new Date(a.ended_at).getTime() : 0
        const bTime = b.ended_at ? new Date(b.ended_at).getTime() : 0
        return bTime - aTime
      })
      break
  }

  const ranked = sorted.slice(0, limit).map((d, i) => ({ ...d, rank: i + 1 }))

  return NextResponse.json({
    debates: ranked,
    total: enriched.length,
    sort,
    generatedAt: new Date().toISOString(),
  } satisfies DebatesLeaderboardResponse)
}
