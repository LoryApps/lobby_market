import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface IRVRound {
  round: number
  tallies: { option_id: string; text: string; votes: number; pct: number }[]
  eliminated: string | null
}

export interface RCPollDetail {
  id: string
  title: string
  description: string | null
  category: string
  status: string
  closes_at: string
  created_at: string
  voter_count: number
  user_ranking: { option_id: string; rank: number }[] | null
  options: { id: string; text: string; position: number }[]
  irv_rounds: IRVRound[]
  winner: { option_id: string; text: string } | null
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

// ── Instant Runoff Voting tallier ──────────────────────────────────────────────

function runIRV(
  ballots: { option_id: string; rank: number }[][],
  options: { id: string; text: string }[]
): { rounds: IRVRound[]; winner: { option_id: string; text: string } | null } {
  if (ballots.length === 0 || options.length === 0) return { rounds: [], winner: null }

  const rounds: IRVRound[] = []
  let remaining = options.map((o) => o.id)

  for (let roundNum = 1; roundNum <= options.length; roundNum++) {
    // Tally first-choice votes among remaining options
    const tally = new Map<string, number>()
    for (const id of remaining) tally.set(id, 0)

    for (const ballot of ballots) {
      const sorted = [...ballot]
        .filter((r) => remaining.includes(r.option_id))
        .sort((a, b) => a.rank - b.rank)
      if (sorted.length > 0) {
        tally.set(sorted[0].option_id, (tally.get(sorted[0].option_id) ?? 0) + 1)
      }
    }

    const total = ballots.length
    const tallies = remaining.map((id) => ({
      option_id: id,
      text: options.find((o) => o.id === id)?.text ?? id,
      votes: tally.get(id) ?? 0,
      pct: total > 0 ? Math.round(((tally.get(id) ?? 0) / total) * 100) : 0,
    }))

    // Check for majority winner
    const winner = tallies.find((t) => t.votes > total / 2)
    if (winner || remaining.length === 1) {
      rounds.push({ round: roundNum, tallies, eliminated: null })
      const w = winner ?? tallies[0]
      return {
        rounds,
        winner: { option_id: w.option_id, text: w.text },
      }
    }

    // Eliminate the option with fewest first-choice votes
    const minVotes = Math.min(...tallies.map((t) => t.votes))
    const toEliminate = tallies.find((t) => t.votes === minVotes)!
    rounds.push({ round: roundNum, tallies, eliminated: toEliminate.option_id })
    remaining = remaining.filter((id) => id !== toEliminate.option_id)
  }

  return { rounds, winner: null }
}

// ── GET /api/ranked-choice/[id] ───────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: poll, error } = await supabase
    .from('ranked_choice_polls')
    .select(`
      *,
      author:profiles!created_by(username, display_name, avatar_url),
      options:ranked_choice_options(id, text, position)
    `)
    .eq('id', params.id)
    .single()

  if (error || !poll) {
    return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  }

  const sortedOptions = (poll.options as { id: string; text: string; position: number }[])
    .sort((a, b) => a.position - b.position)

  // Fetch all votes for IRV computation
  const { data: votes } = await supabase
    .from('ranked_choice_votes')
    .select('user_id, rankings')
    .eq('poll_id', params.id)

  const voterCount = votes?.length ?? 0
  const ballots: { option_id: string; rank: number }[][] = (votes ?? []).map(
    (v) => v.rankings as { option_id: string; rank: number }[]
  )

  const { rounds, winner } = runIRV(ballots, sortedOptions)

  // Fetch the current user's ranking if they voted
  let userRanking: { option_id: string; rank: number }[] | null = null
  if (user) {
    const { data: myVote } = await supabase
      .from('ranked_choice_votes')
      .select('rankings')
      .eq('poll_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (myVote) {
      userRanking = myVote.rankings as { option_id: string; rank: number }[]
    }
  }

  const detail: RCPollDetail = {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    category: poll.category,
    status: poll.status,
    closes_at: poll.closes_at,
    created_at: poll.created_at,
    voter_count: voterCount,
    user_ranking: userRanking,
    options: sortedOptions,
    irv_rounds: rounds,
    winner,
    author: poll.author,
  }

  return NextResponse.json(detail)
}

// ── POST /api/ranked-choice/[id] — submit a ranking ───────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  // Validate poll exists and is open
  const { data: poll } = await supabase
    .from('ranked_choice_polls')
    .select('id, status, closes_at')
    .eq('id', params.id)
    .single()

  if (!poll) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  if (poll.status !== 'open') return NextResponse.json({ error: 'Poll is closed' }, { status: 400 })
  if (new Date(poll.closes_at) < new Date()) {
    return NextResponse.json({ error: 'Poll has expired' }, { status: 400 })
  }

  let body: { rankings: { option_id: string; rank: number }[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { rankings } = body
  if (!Array.isArray(rankings) || rankings.length < 2) {
    return NextResponse.json({ error: 'Rank at least 2 options' }, { status: 400 })
  }

  // Validate option IDs belong to this poll
  const { data: optRows } = await supabase
    .from('ranked_choice_options')
    .select('id')
    .eq('poll_id', params.id)

  const validIds = new Set((optRows ?? []).map((o) => o.id))
  for (const r of rankings) {
    if (!validIds.has(r.option_id)) {
      return NextResponse.json({ error: 'Invalid option_id' }, { status: 400 })
    }
  }

  const { error } = await supabase
    .from('ranked_choice_votes')
    .upsert(
      { poll_id: params.id, user_id: user.id, rankings, updated_at: new Date().toISOString() },
      { onConflict: 'poll_id,user_id' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
