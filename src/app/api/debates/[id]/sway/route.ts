import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { VoteSide } from '@/lib/supabase/types'

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

  // Verify debate is live
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
    // Unique-violation when user already voted at this checkpoint
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
