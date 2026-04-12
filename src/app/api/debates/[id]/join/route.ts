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

  let body: { side?: VoteSide; is_speaker?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { side, is_speaker } = body

  if (side !== 'blue' && side !== 'red') {
    return NextResponse.json(
      { error: 'side must be "blue" or "red"' },
      { status: 400 }
    )
  }

  // Verify debate exists and isn't ended
  const { data: debate, error: debateError } = await supabase
    .from('debates')
    .select('id, status')
    .eq('id', params.id)
    .single()

  if (debateError || !debate) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
  }

  if (debate.status === 'ended' || debate.status === 'cancelled') {
    return NextResponse.json(
      { error: 'This debate is no longer active' },
      { status: 400 }
    )
  }

  // Upsert participant
  const { data: existing } = await supabase
    .from('debate_participants')
    .select('id')
    .eq('debate_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    const { error: updateError } = await supabase
      .from('debate_participants')
      .update({ side, left_at: null })
      .eq('id', existing.id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update participation' },
        { status: 500 }
      )
    }
  } else {
    const { error: insertError } = await supabase
      .from('debate_participants')
      .insert({
        debate_id: params.id,
        user_id: user.id,
        side,
        is_speaker: is_speaker === true,
      })

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to join debate' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ success: true })
}
