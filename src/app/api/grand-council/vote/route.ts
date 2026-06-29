import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const COUNCIL_SIZE = 20
const PASS_PCT = 0.6
const MIN_VOTES = 3

async function isCouncilMember(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .order('clout', { ascending: false })
    .limit(COUNCIL_SIZE)
  return (data ?? []).some((p) => p.id === userId)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const member = await isCouncilMember(supabase, user.id)
    if (!member) {
      return NextResponse.json({ error: 'Only Grand Council members can vote on motions' }, { status: 403 })
    }

    const { motion_id, vote } = await req.json()
    if (!motion_id || !['for', 'against'].includes(vote)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Load motion
    const { data: motion, error: motionErr } = await supabase
      .from('council_motions')
      .select('id, status, closes_at, proposer_id, votes_for, votes_against')
      .eq('id', motion_id)
      .single()

    if (motionErr || !motion) return NextResponse.json({ error: 'Motion not found' }, { status: 404 })
    if (motion.status !== 'active') {
      return NextResponse.json({ error: 'This motion is no longer active' }, { status: 409 })
    }
    if (new Date(motion.closes_at) < new Date()) {
      return NextResponse.json({ error: 'Voting period has ended' }, { status: 409 })
    }
    if (motion.proposer_id === user.id) {
      return NextResponse.json({ error: 'You cannot vote on your own motion' }, { status: 409 })
    }

    // Upsert vote
    const { error: voteErr } = await supabase
      .from('council_motion_votes')
      .upsert(
        { motion_id, voter_id: user.id, vote },
        { onConflict: 'motion_id,voter_id' }
      )
    if (voteErr) throw voteErr

    // Recount all votes
    const { data: allVotes } = await supabase
      .from('council_motion_votes')
      .select('vote')
      .eq('motion_id', motion_id)

    const votesFor = (allVotes ?? []).filter((v) => v.vote === 'for').length
    const votesAgainst = (allVotes ?? []).filter((v) => v.vote === 'against').length
    const total = votesFor + votesAgainst

    // Determine if motion should be resolved
    let newStatus: string = 'active'
    if (total >= MIN_VOTES) {
      const pct = votesFor / total
      if (pct >= PASS_PCT) newStatus = 'passed'
      else if ((1 - pct) >= PASS_PCT && total >= MIN_VOTES) newStatus = 'rejected'
    }

    const { error: updateErr } = await supabase
      .from('council_motions')
      .update({
        votes_for: votesFor,
        votes_against: votesAgainst,
        ...(newStatus !== 'active' ? { status: newStatus, resolved_at: new Date().toISOString() } : {}),
      })
      .eq('id', motion_id)

    if (updateErr) throw updateErr

    return NextResponse.json({ votes_for: votesFor, votes_against: votesAgainst, status: newStatus })
  } catch (err) {
    console.error('[grand-council vote POST]', err)
    return NextResponse.json({ error: 'Failed to cast vote' }, { status: 500 })
  }
}
