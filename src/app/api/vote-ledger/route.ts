import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type VoteSideFilter = 'all' | 'blue' | 'red'
export type VotePeriodFilter = '24h' | '7d' | '30d' | 'all'

export interface VoteLedgerEntry {
  id: string
  side: 'blue' | 'red'
  created_at: string
  voter: {
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
    status: string
    blue_votes: number
    red_votes: number
    total_votes: number
  } | null
}

export interface VoteLedgerStats {
  total_votes: number
  blue_votes: number
  red_votes: number
  unique_voters: number
  unique_topics: number
  blue_pct: number
  red_pct: number
}

export interface VoteLedgerResponse {
  entries: VoteLedgerEntry[]
  stats: VoteLedgerStats
  side: VoteSideFilter
  period: VotePeriodFilter
  total: number
  generatedAt: string
}

function periodToTimestamp(period: VotePeriodFilter): string | null {
  if (period === 'all') return null
  const ms = { '24h': 86_400_000, '7d': 7 * 86_400_000, '30d': 30 * 86_400_000 }[period]
  return new Date(Date.now() - ms).toISOString()
}

export async function GET(req: NextRequest) {
  const side = (req.nextUrl.searchParams.get('side') ?? 'all') as VoteSideFilter
  const period = (req.nextUrl.searchParams.get('period') ?? '7d') as VotePeriodFilter
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10), 100)
  const offset = Math.max(parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10), 0)

  const supabase = await createClient()
  const since = periodToTimestamp(period)

  // Build filtered vote query
  let query = supabase
    .from('votes')
    .select(`
      id, side, created_at,
      voter:profiles!votes_user_id_fkey(id, username, display_name, avatar_url, role),
      topic:topics!votes_topic_id_fkey(id, statement, category, status, blue_votes, red_votes, total_votes)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (side !== 'all') query = query.eq('side', side)
  if (since) query = query.gte('created_at', since)

  const { data: entries, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Stats query — same filters but aggregate
  let statsQuery = supabase
    .from('votes')
    .select('side, user_id, topic_id')

  if (side !== 'all') statsQuery = statsQuery.eq('side', side)
  if (since) statsQuery = statsQuery.gte('created_at', since)

  const { data: statsRows } = await statsQuery

  const rows = statsRows ?? []
  const totalVotes = rows.length
  const blueCount = rows.filter((r) => r.side === 'blue').length
  const redCount = rows.filter((r) => r.side === 'red').length
  const uniqueVoters = new Set(rows.map((r) => r.user_id)).size
  const uniqueTopics = new Set(rows.map((r) => r.topic_id)).size

  const stats: VoteLedgerStats = {
    total_votes: totalVotes,
    blue_votes: blueCount,
    red_votes: redCount,
    unique_voters: uniqueVoters,
    unique_topics: uniqueTopics,
    blue_pct: totalVotes > 0 ? Math.round((blueCount / totalVotes) * 100) : 50,
    red_pct: totalVotes > 0 ? Math.round((redCount / totalVotes) * 100) : 50,
  }

  return NextResponse.json({
    entries: entries ?? [],
    stats,
    side,
    period,
    total: count ?? 0,
    generatedAt: new Date().toISOString(),
  } satisfies VoteLedgerResponse)
}
