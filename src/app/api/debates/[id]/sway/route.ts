import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { VoteSide } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SwayPoint {
  label: string
  blue_pct: number
  red_pct: number
  blue_votes: number
  red_votes: number
}

export interface SwayArcResponse {
  points: SwayPoint[]    // start + up to 3 checkpoints
  final_blue: number     // debates.blue_sway
  final_red: number      // debates.red_sway
  total_votes: number
  has_data: boolean
}

// ─── GET /api/debates/[id]/sway ───────────────────────────────────────────────
// Returns per-checkpoint sway arc data for the recap visualisation.
// Public — no auth required.

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { id } = params

  const { data: debate, error: debateError } = await supabase
    .from('debates')
    .select('id, status, blue_sway, red_sway')
    .eq('id', id)
    .single()

  if (debateError || !debate) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
  }

  const { data: rows } = await supabase
    .from('debate_sway_votes')
    .select('checkpoint, side')
    .eq('debate_id', id)

  const votes = rows ?? []

  // Build per-checkpoint tallies
  const tally: Record<number, { blue: number; red: number }> = {
    1: { blue: 0, red: 0 },
    2: { blue: 0, red: 0 },
    3: { blue: 0, red: 0 },
  }
  for (const v of votes) {
    const cp = v.checkpoint as 1 | 2 | 3
    if (cp in tally) {
      tally[cp][v.side as 'blue' | 'red']++
    }
  }

  // Build arc: start at 50/50, then each checkpoint as its own sentiment
  const points: SwayPoint[] = [
    { label: 'Start', blue_pct: 50, red_pct: 50, blue_votes: 0, red_votes: 0 },
  ]

  const LABELS: Record<number, string> = { 1: 'Round 1', 2: 'Round 2', 3: 'Round 3' }

  for (const cp of [1, 2, 3] as const) {
    const { blue, red } = tally[cp]
    const total = blue + red
    if (total === 0) continue
    const blue_pct = Math.round((blue / total) * 100)
    points.push({
      label: LABELS[cp],
      blue_pct,
      red_pct: 100 - blue_pct,
      blue_votes: blue,
      red_votes: red,
    })
  }

  const total_votes = votes.length

  return NextResponse.json({
    points,
    final_blue: debate.blue_sway ?? 50,
    final_red: debate.red_sway ?? 50,
    total_votes,
    has_data: total_votes >= 2,
  } satisfies SwayArcResponse)
}

// ─── POST /api/debates/[id]/sway ──────────────────────────────────────────────
// Cast a sway vote at a checkpoint during a live debate.

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { checkpoint?: number; side?: VoteSide }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { checkpoint, side } = body

  if (checkpoint !== 1 && checkpoint !== 2 && checkpoint !== 3) {
    return NextResponse.json(
      { error: 'checkpoint must be 1, 2, or 3' },
      { status: 400 }
    )
  }

  if (side !== 'blue' && side !== 'red') {
    return NextResponse.json(
      { error: 'side must be "blue" or "red"' },
      { status: 400 }
    )
  }

  const { data: debate, error: debateError } = await supabase
    .from('debates')
    .select('id, status')
    .eq('id', params.id)
    .single()

  if (debateError || !debate) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
  }

  if (debate.status !== 'live') {
    return NextResponse.json(
      { error: 'Sway votes can only be cast in live debates' },
      { status: 400 }
    )
  }

  const { error: insertError } = await supabase
    .from('debate_sway_votes')
    .insert({
      debate_id: params.id,
      user_id: user.id,
      checkpoint,
      side,
    })

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'You have already cast a sway vote at this checkpoint' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to cast sway vote' },
      { status: 500 }
    )
  }

  const { data: updated } = await supabase
    .from('debates')
    .select('blue_sway, red_sway')
    .eq('id', params.id)
    .single()

  return NextResponse.json({ success: true, sway: updated })
}
