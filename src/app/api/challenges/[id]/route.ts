import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: { id: string }
}

// ─── PATCH /api/challenges/[id] ───────────────────────────────────────────────
// Accept, decline, or cancel a challenge.

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action } = body

  if (!action || !['accept', 'decline', 'cancel'].includes(action)) {
    return NextResponse.json({ error: 'action must be accept, decline, or cancel' }, { status: 400 })
  }

  // Fetch the challenge
  const { data: challenge } = await supabase
    .from('debate_challenges')
    .select('id, challenger_id, challenged_id, status, topic_id, expires_at')
    .eq('id', params.id)
    .single()

  if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })

  // Permission checks
  if (action === 'cancel' && challenge.challenger_id !== user.id) {
    return NextResponse.json({ error: 'Only the challenger can cancel' }, { status: 403 })
  }
  if ((action === 'accept' || action === 'decline') && challenge.challenged_id !== user.id) {
    return NextResponse.json({ error: 'Only the challenged user can accept or decline' }, { status: 403 })
  }
  if (challenge.status !== 'pending') {
    return NextResponse.json({ error: `Challenge is already ${challenge.status}` }, { status: 409 })
  }
  if (new Date(challenge.expires_at) < new Date()) {
    await supabase
      .from('debate_challenges')
      .update({ status: 'expired' })
      .eq('id', params.id)
    return NextResponse.json({ error: 'Challenge has expired' }, { status: 410 })
  }

  const newStatus =
    action === 'accept' ? 'accepted' :
    action === 'decline' ? 'declined' :
    'cancelled'

  const { data: updated, error } = await supabase
    .from('debate_challenges')
    .update({
      status: newStatus,
      responded_at: action !== 'cancel' ? new Date().toISOString() : null,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(updated)
}
