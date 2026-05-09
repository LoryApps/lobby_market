import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface WinnerPollResult {
  blue: number
  red: number
  tie: number
  total: number
  user_vote: 'blue' | 'red' | 'tie' | null
}

// ── GET — fetch current poll results ─────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: rows, error } = await supabase
    .from('debate_winner_polls')
    .select('winner, user_id')
    .eq('debate_id', params.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to load poll' }, { status: 500 })
  }

  const counts = { blue: 0, red: 0, tie: 0 }
  let userVote: 'blue' | 'red' | 'tie' | null = null

  for (const row of rows ?? []) {
    const w = row.winner as 'blue' | 'red' | 'tie'
    counts[w] = (counts[w] ?? 0) + 1
    if (user && row.user_id === user.id) userVote = w
  }

  const result: WinnerPollResult = {
    ...counts,
    total: (rows ?? []).length,
    user_vote: userVote,
  }

  return NextResponse.json(result)
}

// ── POST — cast a vote ────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { winner?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { winner } = body
  if (!winner || !['blue', 'red', 'tie'].includes(winner)) {
    return NextResponse.json(
      { error: 'winner must be "blue", "red", or "tie"' },
      { status: 400 }
    )
  }

  // Verify debate exists and has ended
  const { data: debate } = await supabase
    .from('debates')
    .select('id, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!debate) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
  }

  if (debate.status !== 'ended') {
    return NextResponse.json(
      { error: 'Debate has not ended yet' },
      { status: 409 }
    )
  }

  // Check for existing vote (conflict = already voted)
  const { data: existing } = await supabase
    .from('debate_winner_polls')
    .select('id')
    .eq('debate_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'You have already voted in this poll' },
      { status: 409 }
    )
  }

  const { error } = await supabase.from('debate_winner_polls').insert({
    debate_id: params.id,
    user_id: user.id,
    winner,
  })

  if (error) {
    return NextResponse.json({ error: 'Failed to submit vote' }, { status: 500 })
  }

  // Return updated results
  const { data: rows } = await supabase
    .from('debate_winner_polls')
    .select('winner')
    .eq('debate_id', params.id)

  const counts = { blue: 0, red: 0, tie: 0 }
  for (const row of rows ?? []) {
    const w = row.winner as 'blue' | 'red' | 'tie'
    counts[w] = (counts[w] ?? 0) + 1
  }

  return NextResponse.json({
    ...counts,
    total: (rows ?? []).length,
    user_vote: winner,
  } satisfies WinnerPollResult)
}
