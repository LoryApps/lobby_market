import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: { id: string }
}

export async function POST(req: Request, { params }: RouteContext) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const side: string = body.side

  if (side !== 'no_confidence' && side !== 'confidence') {
    return NextResponse.json({ error: 'Invalid side' }, { status: 400 })
  }

  // Verify motion is still open
  const { data: motion } = await supabase
    .from('confidence_motions')
    .select('id, status, expires_at')
    .eq('id', params.id)
    .single()

  if (!motion) {
    return NextResponse.json({ error: 'Motion not found' }, { status: 404 })
  }

  if (motion.status !== 'open') {
    return NextResponse.json({ error: 'Motion is no longer open' }, { status: 409 })
  }

  if (new Date(motion.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Motion has expired' }, { status: 409 })
  }

  // Upsert the vote (change is allowed)
  const { data: existingVote } = await supabase
    .from('confidence_votes')
    .select('side')
    .eq('motion_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingVote) {
    if (existingVote.side === side) {
      // Unvote (toggle off)
      await supabase
        .from('confidence_votes')
        .delete()
        .eq('motion_id', params.id)
        .eq('user_id', user.id)

      // Decrement appropriate counter
      const colToDecrement =
        side === 'no_confidence' ? 'votes_for' : 'votes_against'
      const { data: cur } = await supabase
        .from('confidence_motions')
        .select(colToDecrement)
        .eq('id', params.id)
        .single()

      if (cur) {
        const current = (cur as Record<string, number>)[colToDecrement] ?? 0
        await supabase
          .from('confidence_motions')
          .update({ [colToDecrement]: Math.max(0, current - 1) })
          .eq('id', params.id)
      }

      return NextResponse.json({ action: 'removed' })
    }

    // Switch vote: decrement old, increment new
    const oldCol = existingVote.side === 'no_confidence' ? 'votes_for' : 'votes_against'
    const newCol = side === 'no_confidence' ? 'votes_for' : 'votes_against'

    const { data: cur } = await supabase
      .from('confidence_motions')
      .select(`${oldCol}, ${newCol}`)
      .eq('id', params.id)
      .single()

    if (cur) {
      const curData = cur as Record<string, number>
      await supabase
        .from('confidence_motions')
        .update({
          [oldCol]: Math.max(0, (curData[oldCol] ?? 0) - 1),
          [newCol]: (curData[newCol] ?? 0) + 1,
        })
        .eq('id', params.id)
    }

    await supabase
      .from('confidence_votes')
      .update({ side })
      .eq('motion_id', params.id)
      .eq('user_id', user.id)

    return NextResponse.json({ action: 'switched' })
  }

  // New vote
  const { error: insertErr } = await supabase
    .from('confidence_votes')
    .insert({ motion_id: params.id, user_id: user.id, side })

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Increment counter
  const col = side === 'no_confidence' ? 'votes_for' : 'votes_against'
  const { data: cur } = await supabase
    .from('confidence_motions')
    .select(col)
    .eq('id', params.id)
    .single()

  if (cur) {
    const current = (cur as Record<string, number>)[col] ?? 0
    await supabase
      .from('confidence_motions')
      .update({ [col]: current + 1 })
      .eq('id', params.id)
  }

  return NextResponse.json({ action: 'voted' })
}
