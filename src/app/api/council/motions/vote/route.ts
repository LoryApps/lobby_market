import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const COUNCIL_SIZE = 20

async function isCouncilMember(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .order('clout', { ascending: false })
    .limit(COUNCIL_SIZE)

  return (data ?? []).some((p) => p.id === userId)
}

// ─── POST /api/council/motions/vote ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!(await isCouncilMember(supabase, user.id))) {
      return NextResponse.json({ error: 'Only Grand Council members may vote on motions' }, { status: 403 })
    }

    const body = await req.json()
    const { motion_id, vote } = body as { motion_id: string; vote: string }

    if (!motion_id) {
      return NextResponse.json({ error: 'motion_id is required' }, { status: 400 })
    }
    if (!['for', 'against'].includes(vote)) {
      return NextResponse.json({ error: 'vote must be "for" or "against"' }, { status: 400 })
    }

    // Verify motion is still active
    const { data: motion } = await supabase
      .from('council_motions')
      .select('status, closes_at')
      .eq('id', motion_id)
      .single()

    if (!motion || motion.status !== 'active') {
      return NextResponse.json({ error: 'Motion is not open for voting' }, { status: 409 })
    }
    if (new Date(motion.closes_at) < new Date()) {
      return NextResponse.json({ error: 'Voting period has closed' }, { status: 409 })
    }

    // Upsert vote
    const { error: voteErr } = await supabase
      .from('council_motion_votes')
      .upsert(
        { motion_id, voter_id: user.id, vote },
        { onConflict: 'motion_id,voter_id' }
      )

    if (voteErr) throw voteErr

    // Recount and update tally
    const { data: counts } = await supabase
      .from('council_motion_votes')
      .select('vote')
      .eq('motion_id', motion_id)

    const votes_for = (counts ?? []).filter((v) => v.vote === 'for').length
    const votes_against = (counts ?? []).filter((v) => v.vote === 'against').length
    const total = votes_for + votes_against

    // Check if motion should be resolved (min 3 votes, 60% threshold)
    let newStatus: string | null = null
    if (total >= 3) {
      const forPct = votes_for / total
      if (forPct >= 0.6) newStatus = 'passed'
      else if (1 - forPct >= 0.6) newStatus = 'rejected'
    }

    const updatePayload: Record<string, unknown> = { votes_for, votes_against }
    if (newStatus) {
      updatePayload.status = newStatus
      updatePayload.resolved_at = new Date().toISOString()
    }

    await supabase
      .from('council_motions')
      .update(updatePayload)
      .eq('id', motion_id)

    return NextResponse.json({ votes_for, votes_against, status: newStatus ?? 'active' })
  } catch (err) {
    console.error('[POST /api/council/motions/vote]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
