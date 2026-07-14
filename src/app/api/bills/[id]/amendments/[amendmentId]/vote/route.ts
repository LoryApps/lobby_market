import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/bills/[id]/amendments/[amendmentId]/vote
// Body: { vote: true (for) | false (against) | null (remove) }

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; amendmentId: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let vote: boolean | null
  try {
    const json = await req.json()
    vote = json.vote ?? null
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate the amendment belongs to the specified bill
  const { data: amendment } = await supabase
    .from('bill_amendments')
    .select('id, status, bill_id')
    .eq('id', params.amendmentId)
    .eq('bill_id', params.id)
    .maybeSingle()

  if (!amendment) {
    return NextResponse.json({ error: 'Amendment not found' }, { status: 404 })
  }
  if (amendment.status !== 'tabled') {
    return NextResponse.json({ error: 'Amendment is no longer open for voting' }, { status: 409 })
  }

  if (vote === null) {
    await supabase
      .from('bill_amendment_votes')
      .delete()
      .eq('amendment_id', params.amendmentId)
      .eq('user_id', user.id)
  } else {
    const { error: upsertErr } = await supabase
      .from('bill_amendment_votes')
      .upsert(
        { amendment_id: params.amendmentId, user_id: user.id, vote },
        { onConflict: 'amendment_id,user_id' }
      )

    if (upsertErr) {
      return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 })
    }
  }

  // Return updated counts from the bill_amendments row (updated by trigger)
  const { data: updated } = await supabase
    .from('bill_amendments')
    .select('votes_for, votes_against, status')
    .eq('id', params.amendmentId)
    .single()

  return NextResponse.json({
    votes_for: updated?.votes_for ?? 0,
    votes_against: updated?.votes_against ?? 0,
    status: updated?.status ?? 'tabled',
    user_vote: vote,
  })
}
