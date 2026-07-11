import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/filibuster/[id]/cloture
 * Body: { vote: 'cloture' | 'second' }
 *
 * Cast a vote on an active filibuster:
 *   'cloture' — vote to end the filibuster and proceed to the vote
 *   'second'  — vote to support the filibuster and extend debate
 *
 * One vote per user per filibuster. Recasting (changing your vote) is allowed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { vote?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { vote } = body
  if (vote !== 'cloture' && vote !== 'second') {
    return NextResponse.json(
      { error: "vote must be 'cloture' or 'second'" },
      { status: 400 },
    )
  }

  // Verify filibuster exists and is active
  const { data: filibuster } = await supabase
    .from('civic_filibusters')
    .select('id, status, filibuster_id, cloture_count, cloture_threshold, second_count, second_threshold, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!filibuster) {
    return NextResponse.json({ error: 'Filibuster not found' }, { status: 404 })
  }
  if (filibuster.status !== 'active') {
    return NextResponse.json(
      { error: 'This filibuster is no longer active' },
      { status: 400 },
    )
  }

  // Filibusterer cannot vote on their own filibuster
  if (filibuster.filibuster_id === user.id) {
    return NextResponse.json(
      { error: 'You cannot vote on your own filibuster' },
      { status: 403 },
    )
  }

  // Check if user already voted
  const { data: existingVote } = await supabase
    .from('civic_filibuster_votes')
    .select('vote')
    .eq('filibuster_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingVote) {
    if (existingVote.vote === vote) {
      return NextResponse.json({ message: 'Already voted', vote }, { status: 200 })
    }
    // Change vote: update the record, then adjust counts
    await supabase
      .from('civic_filibuster_votes')
      .update({ vote })
      .eq('filibuster_id', params.id)
      .eq('user_id', user.id)

    // Recalculate counts from the votes table
    const { data: allVotes } = await supabase
      .from('civic_filibuster_votes')
      .select('vote')
      .eq('filibuster_id', params.id)

    const newCloture = (allVotes ?? []).filter((v) => v.vote === 'cloture').length
    const newSecond = (allVotes ?? []).filter((v) => v.vote === 'second').length

    await supabase
      .from('civic_filibusters')
      .update({ cloture_count: newCloture, second_count: newSecond })
      .eq('id', params.id)

    return NextResponse.json({ ok: true, vote, cloture_count: newCloture, second_count: newSecond })
  }

  // Insert new vote
  const { error: voteError } = await supabase
    .from('civic_filibuster_votes')
    .insert({ filibuster_id: params.id, user_id: user.id, vote })

  if (voteError) {
    return NextResponse.json({ error: voteError.message }, { status: 500 })
  }

  // Increment the appropriate counter
  const newCloture =
    vote === 'cloture'
      ? filibuster.cloture_count + 1
      : filibuster.cloture_count
  const newSecond =
    vote === 'second'
      ? filibuster.second_count + 1
      : filibuster.second_count

  let newStatus: string = 'active'
  let resolvedAt: string | null = null

  // Check resolution thresholds
  if (newCloture >= filibuster.cloture_threshold) {
    newStatus = 'overridden'
    resolvedAt = new Date().toISOString()
  } else if (newSecond >= filibuster.second_threshold) {
    newStatus = 'extended'
    resolvedAt = new Date().toISOString()
  }

  await supabase
    .from('civic_filibusters')
    .update({
      cloture_count: newCloture,
      second_count: newSecond,
      status: newStatus,
      ...(resolvedAt ? { resolved_at: resolvedAt } : {}),
    })
    .eq('id', params.id)

  return NextResponse.json({
    ok: true,
    vote,
    cloture_count: newCloture,
    second_count: newSecond,
    status: newStatus,
  })
}
