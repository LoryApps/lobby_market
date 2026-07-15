import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── POST /api/confidence-votes/[id]/vote ─────────────────────────────────────
// Second a tabling motion or cast a division ballot.
// Body: { action: 'second' | 'ballot', ballot?: 'aye' | 'no' | 'abstain' }

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { id } = params
  const body = await req.json()
  const { action, ballot } = body

  // Load the motion
  const { data: motion, error: fetchError } = await supabase
    .from('confidence_votes')
    .select('id, status, proposer_id, seconds_count, seconds_required, ayes, noes, abstentions')
    .eq('id', id)
    .single()

  if (fetchError || !motion) return NextResponse.json({ error: 'Motion not found' }, { status: 404 })

  // Can't vote on your own motion
  if (motion.proposer_id === user.id) {
    return NextResponse.json({ error: 'You cannot vote on your own motion' }, { status: 403 })
  }

  if (action === 'second') {
    if (motion.status !== 'tabling') {
      return NextResponse.json({ error: 'This motion is not in the tabling phase' }, { status: 400 })
    }

    // Insert second (upsert-safe via primary key)
    const { error: insertErr } = await supabase
      .from('confidence_vote_seconds')
      .insert({ confidence_vote_id: id, user_id: user.id })

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'Already seconded' }, { status: 409 })
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    const newCount = motion.seconds_count + 1
    const nowOpen = newCount >= motion.seconds_required

    await supabase
      .from('confidence_votes')
      .update({
        seconds_count: newCount,
        ...(nowOpen
          ? {
              status: 'open',
              closes_at: new Date(Date.now() + 48 * 3_600_000).toISOString(),
            }
          : {}),
      })
      .eq('id', id)

    return NextResponse.json({ seconded: true, now_open: nowOpen })
  }

  if (action === 'ballot') {
    if (motion.status !== 'open') {
      return NextResponse.json({ error: 'Division is not open' }, { status: 400 })
    }
    if (!ballot || !['aye', 'no', 'abstain'].includes(ballot)) {
      return NextResponse.json({ error: 'Invalid ballot value' }, { status: 400 })
    }

    // Check for existing ballot
    const { data: existing } = await supabase
      .from('confidence_vote_ballots')
      .select('ballot')
      .eq('confidence_vote_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'You have already cast your ballot' }, { status: 409 })
    }

    const { error: ballotErr } = await supabase
      .from('confidence_vote_ballots')
      .insert({ confidence_vote_id: id, user_id: user.id, ballot })

    if (ballotErr) return NextResponse.json({ error: ballotErr.message }, { status: 500 })

    // Increment the relevant counter
    const field = ballot === 'aye' ? 'ayes' : ballot === 'no' ? 'noes' : 'abstentions'
    await supabase
      .from('confidence_votes')
      .update({ [field]: (motion[field as 'ayes' | 'noes' | 'abstentions'] ?? 0) + 1 })
      .eq('id', id)

    return NextResponse.json({ voted: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
