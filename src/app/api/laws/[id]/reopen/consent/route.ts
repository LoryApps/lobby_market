import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/laws/[id]/reopen/consent
// Sign an active repeal petition.
// Requires: authenticated user who voted on the original topic.
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find the active reopen request for this law
  const { data: request_, error: reqError } = await supabase
    .from('law_reopen_requests')
    .select('id, topic_id, status')
    .eq('law_id', params.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (reqError || !request_) {
    return NextResponse.json(
      { error: 'No active repeal petition for this law' },
      { status: 404 }
    )
  }

  // Verify consenter voted on the original topic
  const { data: voterCheck } = await supabase
    .from('votes')
    .select('id')
    .eq('topic_id', request_.topic_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!voterCheck) {
    return NextResponse.json(
      { error: 'Only original voters may sign this petition' },
      { status: 403 }
    )
  }

  // Insert consent (trigger handles the count + status transition)
  const { error: insertError } = await supabase
    .from('law_reopen_consents')
    .insert({
      request_id: request_.id,
      user_id: user.id,
    })

  if (insertError) {
    // 23505 = unique violation
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'You have already signed this petition' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}
