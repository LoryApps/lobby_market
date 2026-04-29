import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/amendments/[id]/vote
// Body: { vote: true (for) | false (against) | null (remove) }

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
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

  // Validate amendment exists and is still pending
  const { data: amendment } = await supabase
    .from('law_amendments')
    .select('id, status, expires_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!amendment) {
    return NextResponse.json({ error: 'Amendment not found' }, { status: 404 })
  }
  if (amendment.status !== 'pending') {
    return NextResponse.json({ error: 'Amendment is no longer open for voting' }, { status: 409 })
  }
  if (new Date(amendment.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Amendment has expired' }, { status: 409 })
  }

  if (vote === null) {
    // Remove vote
    await supabase
      .from('law_amendment_votes')
      .delete()
      .eq('amendment_id', params.id)
      .eq('user_id', user.id)
  } else {
    // Upsert vote
    const { error } = await supabase
      .from('law_amendment_votes')
      .upsert(
        { amendment_id: params.id, user_id: user.id, vote },
        { onConflict: 'amendment_id,user_id' }
      )

    if (error) {
      return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 })
    }
  }

  // Return updated counts
  const { data: updated } = await supabase
    .from('law_amendments')
    .select('for_count, against_count, status')
    .eq('id', params.id)
    .single()

  return NextResponse.json({
    for_count: updated?.for_count ?? 0,
    against_count: updated?.against_count ?? 0,
    status: updated?.status ?? 'pending',
    user_vote: vote,
  })
}
