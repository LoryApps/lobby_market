import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PositionResult =
  | 'won'       // voted blue, topic became law
  | 'lost'      // voted blue, topic failed
  | 'right_call' // voted red, topic failed
  | 'missed'    // voted red, topic became law
  | 'open'      // topic still active/voting/proposed

export interface Position {
  vote_id: string
  topic_id: string
  statement: string
  category: string | null
  status: string
  side: 'blue' | 'red'
  blue_pct: number
  total_votes: number
  voted_at: string
  result: PositionResult
}

export interface CategoryStat {
  category: string
  total: number
  won: number
  lost: number
  right_call: number
  missed: number
  open: number
  win_rate: number | null  // won / (won + missed) among resolved laws
}

export interface PortfolioResponse {
  authenticated: true
  user: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  }
  summary: {
    total_positions: number
    open: number
    won: number
    lost: number
    right_call: number
    missed: number
    resolved: number
    overall_accuracy: number | null  // (won + right_call) / resolved
    law_accuracy: number | null      // won / (won + missed) — did you pick winning laws?
  }
  open_positions: Position[]
  closed_positions: Position[]
  category_stats: CategoryStat[]
  top_wins: Position[]   // highest blue_pct laws the user voted FOR
  biggest_misses: Position[]  // highest blue_pct laws the user voted AGAINST
}

export interface UnauthenticatedResponse {
  authenticated: false
}

export type PortfolioAPIResponse = PortfolioResponse | UnauthenticatedResponse

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<PortfolioAPIResponse>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ authenticated: false })
  }

  // Fetch profile
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profileRow) {
    return NextResponse.json({ authenticated: false })
  }

  // Fetch all votes with topic details
  const { data: voteRows } = await supabase
    .from('votes')
    .select(`
      id,
      topic_id,
      side,
      created_at,
      topics (
        id,
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const rows = (voteRows ?? []) as Array<{
    id: string
    topic_id: string
    side: 'blue' | 'red'
    created_at: string
    topics: {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
    } | null
  }>

  // Build positions
  const positions: Position[] = rows
    .filter((r) => r.topics !== null)
    .map((r) => {
      const t = r.topics!
      const status = t.status
      const side = r.side as 'blue' | 'red'

      let result: PositionResult
      if (status === 'law') {
        result = side === 'blue' ? 'won' : 'missed'
      } else if (status === 'failed') {
        result = side === 'red' ? 'right_call' : 'lost'
      } else {
        result = 'open'
      }

      return {
        vote_id: r.id,
        topic_id: t.id,
        statement: t.statement,
        category: t.category,
        status,
        side,
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
        voted_at: r.created_at,
        result,
      }
    })

  // Summary counts
  const won = positions.filter((p) => p.result === 'won').length
  const lost = positions.filter((p) => p.result === 'lost').length
  const right_call = positions.filter((p) => p.result === 'right_call').length
  const missed = positions.filter((p) => p.result === 'missed').length
  const open = positions.filter((p) => p.result === 'open').length
  const resolved = won + lost + right_call + missed
  const overall_accuracy = resolved > 0 ? Math.round(((won + right_call) / resolved) * 100) : null
  const law_voted = won + missed
  const law_accuracy = law_voted > 0 ? Math.round((won / law_voted) * 100) : null

  // Category stats
  const catMap = new Map<string, CategoryStat>()
  for (const p of positions) {
    const key = p.category ?? 'Uncategorized'
    if (!catMap.has(key)) {
      catMap.set(key, {
        category: key,
        total: 0,
        won: 0,
        lost: 0,
        right_call: 0,
        missed: 0,
        open: 0,
        win_rate: null,
      })
    }
    const stat = catMap.get(key)!
    stat.total++
    if (p.result === 'won') stat.won++
    else if (p.result === 'lost') stat.lost++
    else if (p.result === 'right_call') stat.right_call++
    else if (p.result === 'missed') stat.missed++
    else stat.open++
  }

  const category_stats: CategoryStat[] = Array.from(catMap.values())
    .map((s) => {
      const lawVoted = s.won + s.missed
      return {
        ...s,
        win_rate: lawVoted > 0 ? Math.round((s.won / lawVoted) * 100) : null,
      }
    })
    .sort((a, b) => b.total - a.total)

  // Open positions: sort by blue_pct descending (closest to law first)
  const open_positions = positions
    .filter((p) => p.result === 'open')
    .sort((a, b) => {
      // FOR voters: sort highest blue_pct first (closest to law)
      // AGAINST voters: sort lowest blue_pct first (closest to fail)
      if (a.side === 'blue' && b.side === 'blue') return b.blue_pct - a.blue_pct
      if (a.side === 'red' && b.side === 'red') return a.blue_pct - b.blue_pct
      // Mixed: blue first
      return a.side === 'blue' ? -1 : 1
    })
    .slice(0, 50)

  // Closed positions: most recent first
  const closed_positions = positions
    .filter((p) => p.result !== 'open')
    .slice(0, 50)

  // Top wins: voted FOR, became law, highest blue_pct
  const top_wins = positions
    .filter((p) => p.result === 'won')
    .sort((a, b) => b.blue_pct - a.blue_pct)
    .slice(0, 5)

  // Biggest misses: voted AGAINST, became law (highest blue_pct = clearest miss)
  const biggest_misses = positions
    .filter((p) => p.result === 'missed')
    .sort((a, b) => b.blue_pct - a.blue_pct)
    .slice(0, 5)

  return NextResponse.json({
    authenticated: true,
    user: {
      username: profileRow.username,
      display_name: profileRow.display_name,
      avatar_url: profileRow.avatar_url,
      role: profileRow.role,
    },
    summary: {
      total_positions: positions.length,
      open,
      won,
      lost,
      right_call,
      missed,
      resolved,
      overall_accuracy,
      law_accuracy,
    },
    open_positions,
    closed_positions,
    category_stats,
    top_wins,
    biggest_misses,
  })
}
