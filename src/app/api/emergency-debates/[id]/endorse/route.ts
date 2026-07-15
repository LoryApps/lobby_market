import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST — toggle endorsement (second / un-second)
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = params

    // Verify debate exists and is still proposed
    const { data: debate } = await supabase
      .from('emergency_debates')
      .select('id, status, proposer_id, endorsement_count, endorsement_target, expires_at')
      .eq('id', id)
      .single()

    if (!debate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (debate.status !== 'proposed') {
      return NextResponse.json({ error: 'This debate is no longer open for endorsements' }, { status: 400 })
    }
    if (new Date(debate.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This proposal has expired' }, { status: 400 })
    }
    if (debate.proposer_id === user.id) {
      return NextResponse.json({ error: 'You cannot endorse your own proposal' }, { status: 400 })
    }

    // Check if already endorsed
    const { data: existing } = await supabase
      .from('emergency_debate_endorsements')
      .select('debate_id')
      .eq('debate_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      // Remove endorsement
      await supabase
        .from('emergency_debate_endorsements')
        .delete()
        .eq('debate_id', id)
        .eq('user_id', user.id)

      const newCount = Math.max(0, (debate.endorsement_count ?? 0) - 1)
      await supabase
        .from('emergency_debates')
        .update({ endorsement_count: newCount })
        .eq('id', id)

      return NextResponse.json({ endorsed: false, endorsement_count: newCount })
    }

    // Add endorsement
    await supabase
      .from('emergency_debate_endorsements')
      .insert({ debate_id: id, user_id: user.id })

    const newCount = (debate.endorsement_count ?? 0) + 1
    await supabase
      .from('emergency_debates')
      .update({ endorsement_count: newCount })
      .eq('id', id)

    // Auto-grant if threshold reached
    if (newCount >= (debate.endorsement_target ?? 10)) {
      await supabase
        .from('emergency_debates')
        .update({
          status: 'granted',
          speaker_decision: 'Granted by endorsement threshold — debate auto-convened.',
          decided_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'proposed') // idempotent guard
    }

    return NextResponse.json({ endorsed: true, endorsement_count: newCount })
  } catch (err) {
    console.error('[emergency-debates endorse POST]', err)
    return NextResponse.json({ error: 'Failed to update endorsement' }, { status: 500 })
  }
}
