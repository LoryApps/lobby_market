import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/laws/[id]/reopen
// File a repeal petition against an established Law.
// Requires: authenticated user who voted on the original topic.
// Body: { case_for_repeal: string (min 200 chars) }
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { case_for_repeal?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const caseForRepeal = body.case_for_repeal?.trim() ?? ''

  if (caseForRepeal.length < 200) {
    return NextResponse.json(
      { error: 'Case for repeal must be at least 200 characters' },
      { status: 400 }
    )
  }

  // Look up the law and its source topic
  const { data: law, error: lawError } = await supabase
    .from('laws')
    .select('id, topic_id, is_active')
    .eq('id', params.id)
    .single()

  if (lawError || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  if (!law.is_active) {
    return NextResponse.json(
      { error: 'This law is no longer active' },
      { status: 409 }
    )
  }

  // Verify requester voted on the original topic
  const { data: requesterVote } = await supabase
    .from('votes')
    .select('id')
    .eq('topic_id', law.topic_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!requesterVote) {
    return NextResponse.json(
      { error: 'Only original voters may file a repeal petition' },
      { status: 403 }
    )
  }

  // Check for existing pending request
  const { data: existing } = await supabase
    .from('law_reopen_requests')
    .select('id, status')
    .eq('law_id', law.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'A repeal petition is already pending for this law' },
      { status: 409 }
    )
  }

  // Count original voters for the snapshot
  const { count: totalVoters } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('topic_id', law.topic_id)

  const { data: created, error: insertError } = await supabase
    .from('law_reopen_requests')
    .insert({
      law_id: law.id,
      topic_id: law.topic_id,
      requester_id: user.id,
      case_for_repeal: caseForRepeal,
      total_original_voters: totalVoters ?? 0,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    )
  }

  // Auto-consent the requester
  await supabase.from('law_reopen_consents').insert({
    request_id: created.id,
    user_id: user.id,
  })

  return NextResponse.json({ success: true, request: created }, { status: 201 })
}
