import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface Params {
  params: { id: string; leg_id: string }
}

// ─── POST /api/relays/[id]/legs/[leg_id]/upvote ──────────────────────────────
// Toggle a star upvote on a relay leg. Returns { upvoted, upvote_count }.

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: relayId, leg_id: legId } = params

  // Verify leg belongs to this relay
  const { data: leg } = await supabase
    .from('relay_legs')
    .select('id, relay_id, author_id, upvote_count')
    .eq('id', legId)
    .eq('relay_id', relayId)
    .maybeSingle()

  if (!leg) {
    return NextResponse.json({ error: 'Leg not found' }, { status: 404 })
  }

  // Users cannot upvote their own leg
  if (leg.author_id === user.id) {
    return NextResponse.json({ error: 'Cannot upvote your own leg' }, { status: 400 })
  }

  // Check existing upvote
  const { data: existing } = await supabase
    .from('relay_leg_upvotes')
    .select('id')
    .eq('leg_id', legId)
    .eq('voter_id', user.id)
    .maybeSingle()

  if (existing) {
    // Remove upvote
    await supabase
      .from('relay_leg_upvotes')
      .delete()
      .eq('leg_id', legId)
      .eq('voter_id', user.id)

    const updatedCount = Math.max(0, (leg.upvote_count ?? 0) - 1)
    return NextResponse.json({ upvoted: false, upvote_count: updatedCount })
  } else {
    // Add upvote
    await supabase
      .from('relay_leg_upvotes')
      .insert({ leg_id: legId, voter_id: user.id })

    const updatedCount = (leg.upvote_count ?? 0) + 1
    return NextResponse.json({ upvoted: true, upvote_count: updatedCount })
  }
}
