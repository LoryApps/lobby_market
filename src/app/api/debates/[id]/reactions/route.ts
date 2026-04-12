import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { VoteSide } from '@/lib/supabase/types'

const MAX_EMOJI = 8

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

  let body: { emoji?: string; side?: VoteSide | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { emoji, side } = body

  if (!emoji || typeof emoji !== 'string' || emoji.length === 0) {
    return NextResponse.json({ error: 'emoji is required' }, { status: 400 })
  }

  if (emoji.length > MAX_EMOJI) {
    return NextResponse.json(
      { error: `emoji must be ${MAX_EMOJI} characters or fewer` },
      { status: 400 }
    )
  }

  if (side != null && side !== 'blue' && side !== 'red') {
    return NextResponse.json(
      { error: 'side must be "blue", "red", or null' },
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
      { error: 'Reactions can only be sent in live debates' },
      { status: 400 }
    )
  }

  // Persist reaction (fire-and-forget behavior: best-effort insert)
  const { error: insertError } = await supabase
    .from('debate_reactions')
    .insert({
      debate_id: params.id,
      user_id: user.id,
      emoji,
      side: side ?? null,
    })

  // Even if insert fails (e.g., throttled), still broadcast so the UI stays alive.
  try {
    const channel = supabase.channel(`debate:${params.id}`)
    await channel.send({
      type: 'broadcast',
      event: 'reaction',
      payload: {
        emoji,
        side: side ?? null,
        user_id: user.id,
        created_at: new Date().toISOString(),
      },
    })
    await supabase.removeChannel(channel)
  } catch {
    // Best-effort broadcast.
  }

  if (insertError) {
    return NextResponse.json({ success: true, persisted: false })
  }

  return NextResponse.json({ success: true, persisted: true })
}
