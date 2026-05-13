import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface FaceoffArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  source_url: string | null
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
  } | null
  wins: number
  bouts: number
  win_pct: number | null
}

export interface FaceoffLeaderboardResponse {
  entries: FaceoffArgument[]
  total: number
}

// GET /api/faceoffs?limit=20&offset=0
// Returns global argument arena leaderboard ordered by win count.
export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '20'), 50)
  const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0')

  // Aggregate wins per argument
  const { data: winRows } = await supabase
    .from('argument_faceoff_votes')
    .select('winner_id')

  const winCounts: Record<string, number> = {}
  for (const row of winRows ?? []) {
    winCounts[row.winner_id] = (winCounts[row.winner_id] ?? 0) + 1
  }

  // Aggregate total bouts per argument
  const { data: boutRows } = await supabase
    .from('argument_faceoff_votes')
    .select('argument_a_id, argument_b_id')

  const boutCounts: Record<string, number> = {}
  for (const row of boutRows ?? []) {
    boutCounts[row.argument_a_id] = (boutCounts[row.argument_a_id] ?? 0) + 1
    boutCounts[row.argument_b_id] = (boutCounts[row.argument_b_id] ?? 0) + 1
  }

  // If no votes yet, fall back to top arguments by upvotes
  const argIds = Object.keys(winCounts)

  let argumentRows: Array<{
    id: string
    content: string
    side: 'blue' | 'red'
    upvotes: number
    source_url: string | null
    ai_score: number | null
    ai_grade: string | null
    created_at: string
    user_id: string
    topic_id: string
  }>

  if (argIds.length === 0) {
    const { data } = await supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, source_url, ai_score, ai_grade, created_at, user_id, topic_id')
      .order('upvotes', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1)

    argumentRows = (data ?? []) as typeof argumentRows
  } else {
    // Sort argument ids by wins descending, paginate
    const sorted = argIds
      .sort((a, b) => (winCounts[b] ?? 0) - (winCounts[a] ?? 0))
      .slice(offset, offset + limit)

    const { data } = await supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, source_url, ai_score, ai_grade, created_at, user_id, topic_id')
      .in('id', sorted)

    // Re-sort to match win-order after fetch
    const byId = new Map((data ?? []).map((r) => [r.id, r]))
    argumentRows = sorted
      .map((id) => byId.get(id))
      .filter(Boolean) as typeof argumentRows
  }

  if (argumentRows.length === 0) {
    return NextResponse.json({ entries: [], total: 0 } satisfies FaceoffLeaderboardResponse)
  }

  // Batch-fetch authors and topics
  const userIds = [...new Set(argumentRows.map((a) => a.user_id))]
  const topicIds = [...new Set(argumentRows.map((a) => a.topic_id))]

  const [{ data: profiles }, { data: topics }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', userIds),
    supabase
      .from('topics')
      .select('id, statement, category')
      .in('id', topicIds),
  ])

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
  const topicMap = new Map((topics ?? []).map((t) => [t.id, t]))

  const entries: FaceoffArgument[] = argumentRows.map((arg) => {
    const wins = winCounts[arg.id] ?? 0
    const bouts = boutCounts[arg.id] ?? 0
    return {
      id: arg.id,
      content: arg.content,
      side: arg.side,
      upvotes: arg.upvotes,
      source_url: arg.source_url,
      ai_score: arg.ai_score,
      ai_grade: arg.ai_grade,
      created_at: arg.created_at,
      author: profileMap.get(arg.user_id) ?? null,
      topic: topicMap.get(arg.topic_id) ?? null,
      wins,
      bouts,
      win_pct: bouts > 0 ? Math.round((wins / bouts) * 100) : null,
    }
  })

  return NextResponse.json({ entries, total: argIds.length || entries.length } satisfies FaceoffLeaderboardResponse)
}

// POST /api/faceoffs
// Body: { argumentAId: string, argumentBId: string, winnerId: string }
// Records a faceoff vote. Canonical ordering enforced (lower UUID first).
export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { argumentAId?: string; argumentBId?: string; winnerId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { argumentAId, argumentBId, winnerId } = body
  if (!argumentAId || !argumentBId || !winnerId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (winnerId !== argumentAId && winnerId !== argumentBId) {
    return NextResponse.json({ error: 'Winner must be one of the two arguments' }, { status: 400 })
  }

  // Canonical ordering: lower UUID first to satisfy unique constraint
  const [canonA, canonB] =
    argumentAId < argumentBId
      ? [argumentAId, argumentBId]
      : [argumentBId, argumentAId]

  const { error } = await supabase.from('argument_faceoff_votes').insert({
    user_id: user.id,
    argument_a_id: canonA,
    argument_b_id: canonB,
    winner_id: winnerId,
  })

  if (error) {
    // Unique violation = already voted on this pair
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already voted on this pair' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
