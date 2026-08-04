import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface PublicPositionItem {
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

export interface PublicPositionsResponse {
  positions: PublicPositionItem[]
  profile: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    total_votes: number
    blue_vote_count: number
    red_vote_count: number
    clout: number
  }
  total: number
}

// GET /api/users/[username]/positions?limit=100&status=all
export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  const supabase = await createClient()

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status') ?? 'all'
  const limit = Math.min(
    Math.max(1, Number.parseInt(searchParams.get('limit') ?? '100', 10) || 100),
    200
  )

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, total_votes, blue_vote_count, red_vote_count, clout')
    .eq('username', params.username)
    .maybeSingle()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  let query = supabase
    .from('votes')
    .select(`
      id,
      side,
      created_at,
      topic_id,
      topics!inner (
        id,
        statement,
        category,
        status,
        blue_pct,
        total_votes,
        scope,
        voting_ends_at
      )
    `)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (statusFilter !== 'all') {
    query = query.eq('topics.status', statusFilter)
  }

  const { data: votes } = await query

  const positions: PublicPositionItem[] = (votes ?? [])
    .filter((v) => v.topics)
    .map((v) => {
      const t = v.topics as {
        id: string
        statement: string
        category: string | null
        status: string
        blue_pct: number | null
        total_votes: number | null
        scope: string | null
        voting_ends_at: string | null
      }
      const forPct = t.blue_pct ?? 50
      const isFor = v.side === 'blue'
      const inMajority = isFor ? forPct >= 50 : forPct < 50
      return {
        vote_id: v.id,
        voted_at: v.created_at,
        side: v.side as 'blue' | 'red',
        in_majority: inMajority,
        topic: {
          id: t.id,
          statement: t.statement,
          category: t.category,
          status: t.status,
          blue_pct: forPct,
          total_votes: t.total_votes ?? 0,
          scope: t.scope ?? 'Global',
          voting_ends_at: t.voting_ends_at,
        },
      }
    })

  return NextResponse.json({
    positions,
    profile,
    total: positions.length,
  } satisfies PublicPositionsResponse)
}
