import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/bounties/[id]/award
// Marks the bounty as awarded and triggers gift_clout() to pay the winner.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { winner_argument_id, winner_id } = (await req.json()) as {
    winner_argument_id: string
    winner_id: string
  }
  if (!winner_argument_id || !winner_id) {
    return NextResponse.json({ error: 'winner_argument_id and winner_id required' }, { status: 400 })
  }

  // Fetch bounty and verify ownership
  const { data: bounty } = await supabase
    .from('topic_bounties')
    .select('id, creator_id, amount, status, topic_id')
    .eq('id', params.id)
    .single()

  if (!bounty) return NextResponse.json({ error: 'Bounty not found' }, { status: 404 })
  if (bounty.creator_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (bounty.status !== 'open') {
    return NextResponse.json({ error: 'Bounty is not open' }, { status: 400 })
  }
  if (winner_id === user.id) {
    return NextResponse.json({ error: 'Cannot award yourself' }, { status: 400 })
  }

  // Gift the clout
  const { data: giftResult } = await supabase.rpc('gift_clout', {
    p_recipient_id: winner_id,
    p_amount: bounty.amount,
    p_reason: `Bounty award for argument on topic`,
  })

  const result = giftResult as { status: string; error?: string } | null
  if (!result || result.status !== 'ok') {
    return NextResponse.json(
      { error: result?.error ?? result?.status ?? 'Gift failed' },
      { status: 400 }
    )
  }

  // Mark bounty awarded
  const { error: updateError } = await supabase
    .from('topic_bounties')
    .update({
      status: 'awarded',
      winner_argument_id,
      winner_id,
    })
    .eq('id', params.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
