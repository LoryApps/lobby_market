import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = params.id
  const body = await req.json()
  const { opposition_speech } = body as { opposition_speech?: string }

  if (!opposition_speech?.trim() || opposition_speech.trim().length < 50) {
    return NextResponse.json({ error: 'Opposition speech must be at least 50 characters.' }, { status: 400 })
  }

  // Fetch current state
  const { data: proposal } = await supabase
    .from('civic_tmr_proposals')
    .select('status, author_id, opponent_id')
    .eq('id', id)
    .maybeSingle()

  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const p = proposal as { status: string; author_id: string; opponent_id: string | null }

  if (p.status !== 'seeking_opponent') {
    return NextResponse.json({ error: 'This proposal is no longer seeking an opponent.' }, { status: 409 })
  }
  if (p.author_id === user.id) {
    return NextResponse.json({ error: 'Authors cannot oppose their own proposal.' }, { status: 403 })
  }
  if (p.opponent_id && p.opponent_id !== user.id) {
    return NextResponse.json({ error: 'This proposal already has an opponent.' }, { status: 409 })
  }

  const { error } = await supabase
    .from('civic_tmr_proposals')
    .update({
      opponent_id: user.id,
      opposition_speech: opposition_speech.trim().slice(0, 2000),
      opponent_joined_at: new Date().toISOString(),
      status: 'ready_to_vote',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Open voting immediately when opposition speech is submitted
  const votingClosesAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('civic_tmr_proposals')
    .update({
      status: 'voting',
      voting_opens_at: new Date().toISOString(),
      voting_closes_at: votingClosesAt,
    })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
