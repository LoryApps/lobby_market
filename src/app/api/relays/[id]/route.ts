import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── POST /api/relays/[id] — Add a leg or vote ────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const relayId = params.id

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json()) as
    | { action: 'add_leg'; content: string }
    | { action: 'vote'; vote: 'compelling' | 'not_compelling' }

  // ─── Fetch relay ─────────────────────────────────────────────────────────

  const { data: relay } = await supabase
    .from('civic_relays')
    .select('*')
    .eq('id', relayId)
    .single()

  if (!relay) {
    return NextResponse.json({ error: 'Relay not found' }, { status: 404 })
  }

  // ─── Add a leg ────────────────────────────────────────────────────────────

  if (body.action === 'add_leg') {
    if (!['open', 'in_progress'].includes(relay.status)) {
      return NextResponse.json(
        { error: 'Relay is not accepting new legs' },
        { status: 400 }
      )
    }

    const content = body.content?.trim()
    if (!content || content.length < 30 || content.length > 300) {
      return NextResponse.json(
        { error: 'Leg must be 30–300 characters' },
        { status: 400 }
      )
    }

    // Check existing legs
    const { data: existingLegs } = await supabase
      .from('relay_legs')
      .select('author_id, leg_number')
      .eq('relay_id', relayId)
      .order('leg_number', { ascending: true })

    const legCount = existingLegs?.length ?? 0

    // Prevent starter from adding legs 2+
    if (relay.starter_id === user.id && legCount > 0) {
      return NextResponse.json(
        { error: 'Relay starter can only add the first leg' },
        { status: 400 }
      )
    }

    // Prevent double-submission
    if (existingLegs?.some((l) => l.author_id === user.id)) {
      return NextResponse.json(
        { error: 'You have already contributed to this relay' },
        { status: 400 }
      )
    }

    if (legCount >= relay.max_legs) {
      return NextResponse.json({ error: 'Relay is full' }, { status: 400 })
    }

    const nextLeg = legCount + 1

    const { error: insertErr } = await supabase.from('relay_legs').insert({
      relay_id: relayId,
      author_id: user.id,
      leg_number: nextLeg,
      content,
    })

    if (insertErr) {
      return NextResponse.json({ error: 'Failed to add leg' }, { status: 500 })
    }

    // Update status
    const newStatus = nextLeg >= relay.max_legs ? 'complete' : 'in_progress'
    const updatePayload: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'complete') {
      updatePayload.completed_at = new Date().toISOString()
    }

    await supabase.from('civic_relays').update(updatePayload).eq('id', relayId)

    return NextResponse.json({ leg_number: nextLeg, status: newStatus })
  }

  // ─── Vote ─────────────────────────────────────────────────────────────────

  if (body.action === 'vote') {
    if (relay.status !== 'complete') {
      return NextResponse.json(
        { error: 'Only completed relays can be voted on' },
        { status: 400 }
      )
    }

    const vote = body.vote
    if (!['compelling', 'not_compelling'].includes(vote)) {
      return NextResponse.json({ error: 'Invalid vote' }, { status: 400 })
    }

    // Check existing vote
    const { data: existingVote } = await supabase
      .from('relay_votes')
      .select('vote')
      .eq('relay_id', relayId)
      .eq('voter_id', user.id)
      .maybeSingle()

    if (existingVote) {
      return NextResponse.json(
        { error: 'You have already voted on this relay' },
        { status: 400 }
      )
    }

    await supabase.from('relay_votes').insert({
      relay_id: relayId,
      voter_id: user.id,
      vote,
    })

    // Increment counter
    const field =
      vote === 'compelling' ? 'vote_compelling' : 'vote_not_compelling'
    await supabase.rpc('increment_column', {
      table_name: 'civic_relays',
      column_name: field,
      row_id: relayId,
    })

    await supabase
      .from('civic_relays')
      .update({ status: 'voted' })
      .eq('id', relayId)
      .eq('status', 'complete')

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
