import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface PositionItem {
  vote_id: string
  voted_at: string
  side: 'blue' | 'red'
  in_majority: boolean
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    scope: string
    voting_ends_at: string | null
  }
}

export interface PositionStats {
  total: number
  in_majority: number
  as_contrarian: number
  laws_supported: number
  laws_opposed: number
}

export interface PositionsResponse {
  positions: PositionItem[]
  stats: PositionStats
  total: number
}

// GET /api/positions?status=all|active|law|failed&limit=50&offset=0
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status') ?? 'all'
  const limit = Math.min(Math.max(1, Number.parseInt(searchParams.get('limit') ?? '50', 10) || 50), 100)
  const offset = Math.max(0, Number.parseInt(searchParams.get('offset') ?? '0', 10) || 0)

  const statusMap: Record<string, string[]> = {
    active: ['active', 'voting', 'proposed'],
    law: ['law'],
    failed: ['failed', 'archived'],
    all: ['proposed', 'active', 'voting', 'law', 'failed', 'archived', 'continued'],
  }
  const topicStatuses = statusMap[statusFilter] ?? statusMap.all

  // 1. Fetch all votes for this user
  const { data: voteRows, error: voteError } = await supabase
    .from('votes')
    .select('id, topic_id, side, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (voteError) {
    return NextResponse.json({ error: 'Failed to load votes' }, { status: 500 })
  }

  const votes = (voteRows ?? []) as {
    id: string
    topic_id: string
    side: 'blue' | 'red'
    created_at: string
  }[]

  if (votes.length === 0) {
    const empty: PositionsResponse = {
      positions: [],
      stats: { total: 0, in_majority: 0, as_contrarian: 0, laws_supported: 0, laws_opposed: 0 },
      total: 0,
    }
    return NextResponse.json(empty)
  }

  // 2. Fetch all topics that were voted on
  const topicIds = Array.from(new Set(votes.map((v) => v.topic_id)))

  const { data: topicRows, error: topicError } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope, voting_ends_at')
    .in('id', topicIds)

  if (topicError) {
    return NextResponse.json({ error: 'Failed to load topics' }, { status: 500 })
  }

  const topicMap = new Map<string, {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    scope: string
    voting_ends_at: string | null
  }>()

  for (const t of (topicRows ?? [])) {
    topicMap.set(t.id, t as typeof topicMap extends Map<string, infer V> ? V : never)
  }

  // 3. Build full position items, filter by status
  const allItems: (PositionItem & { topicStatus: string })[] = []

  for (const vote of votes) {
    const topic = topicMap.get(vote.topic_id)
    if (!topic) continue

    const forIsWinning = topic.blue_pct >= 50
    const userVotedFor = vote.side === 'blue'
    const inMajority = forIsWinning ? userVotedFor : !userVotedFor

    allItems.push({
      vote_id: vote.id,
      voted_at: vote.created_at,
      side: vote.side,
      in_majority: inMajority,
      topicStatus: topic.status,
      topic: {
        id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status,
        blue_pct: topic.blue_pct,
        total_votes: topic.total_votes,
        scope: topic.scope,
        voting_ends_at: topic.voting_ends_at,
      },
    })
  }

  // 4. Compute stats from all positions
  const stats: PositionStats = {
    total: allItems.length,
    in_majority: allItems.filter((p) => p.in_majority).length,
    as_contrarian: allItems.filter((p) => !p.in_majority).length,
    laws_supported: allItems.filter((p) => p.topicStatus === 'law' && p.side === 'blue').length,
    laws_opposed: allItems.filter((p) => p.topicStatus === 'law' && p.side === 'red').length,
  }

  // 5. Apply status filter and paginate
  const filtered = allItems.filter((p) => topicStatuses.includes(p.topicStatus))
  const total = filtered.length
  const paginated = filtered.slice(offset, offset + limit)

  // Strip the internal topicStatus field from output
  const positions: PositionItem[] = paginated.map(({ topicStatus: _s, ...rest }) => rest)

  return NextResponse.json({ positions, stats, total } satisfies PositionsResponse)
}
