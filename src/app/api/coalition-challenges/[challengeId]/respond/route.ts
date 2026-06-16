import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/coalition-challenges/[challengeId]/respond
// Body: { action: 'accept' | 'decline', stance?: 'for' | 'against' | 'neutral' }
// Called by a leader/officer of the challenged coalition

export async function POST(
  request: NextRequest,
  { params }: { params: { challengeId: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { action, stance } = body

  if (action !== 'accept' && action !== 'decline') {
    return NextResponse.json({ error: 'action must be "accept" or "decline"' }, { status: 400 })
  }

  if (action === 'accept' && !stance) {
    return NextResponse.json({ error: 'stance is required when accepting' }, { status: 400 })
  }

  if (stance && !['for', 'against', 'neutral'].includes(stance)) {
    return NextResponse.json({ error: 'stance must be for, against, or neutral' }, { status: 400 })
  }

  // Fetch challenge
  const { data: challenge } = await supabase
    .from('coalition_challenges')
    .select('id, challenged_id, status, expires_at')
    .eq('id', params.challengeId)
    .maybeSingle()

  if (!challenge) {
    return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
  }

  if (challenge.status !== 'pending') {
    return NextResponse.json({ error: 'Challenge has already been responded to' }, { status: 409 })
  }

  if (new Date(challenge.expires_at) < new Date()) {
    // Auto-expire it
    await supabase
      .from('coalition_challenges')
      .update({ status: 'expired' })
      .eq('id', params.challengeId)
    return NextResponse.json({ error: 'Challenge has expired' }, { status: 410 })
  }

  // Verify caller is leader/officer of challenged coalition
  const { data: membership } = await supabase
    .from('coalition_members')
    .select('role')
    .eq('coalition_id', challenge.challenged_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['leader', 'officer'].includes(membership.role)) {
    return NextResponse.json({ error: 'Must be a leader or officer of the challenged coalition' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {
    status: action === 'accept' ? 'accepted' : 'declined',
    responded_at: new Date().toISOString(),
  }

  if (action === 'accept') {
    updates.challenged_stance = stance
  }

  const { error } = await supabase
    .from('coalition_challenges')
    .update(updates)
    .eq('id', params.challengeId)

  if (error) {
    console.error('Coalition challenge respond error:', error)
    return NextResponse.json({ error: 'Failed to respond to challenge' }, { status: 500 })
  }

  return NextResponse.json({ status: updates.status })
}
