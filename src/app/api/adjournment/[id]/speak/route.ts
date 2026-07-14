import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/adjournment/[id]/speak
// Body: { speech_type: 'opening' | 'floor' | 'response'; content: string }

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { speech_type?: string; content?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { speech_type, content } = body
  if (!speech_type || !['opening', 'floor', 'response'].includes(speech_type)) {
    return NextResponse.json({ error: 'speech_type must be opening, floor, or response' }, { status: 422 })
  }
  if (!content || content.trim().length < 20) {
    return NextResponse.json({ error: 'Speech must be at least 20 characters' }, { status: 422 })
  }
  const maxLen = speech_type === 'floor' ? 500 : 1000
  if (content.trim().length > maxLen) {
    return NextResponse.json({ error: `Speech must be under ${maxLen} characters` }, { status: 422 })
  }

  // Verify application
  const { data: app } = await supabase
    .from('adjournment_applications')
    .select('id, status, applicant_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  if (!['selected', 'open'].includes(app.status)) {
    return NextResponse.json({ error: 'Debate is not open for speeches' }, { status: 409 })
  }

  // Validate speech_type rules
  if (speech_type === 'opening' && app.applicant_id !== user.id) {
    return NextResponse.json({ error: 'Only the applicant can deliver the opening speech' }, { status: 403 })
  }

  // Check opening hasn't been delivered yet (if this is an opening)
  if (speech_type === 'opening') {
    const { count: openingCount } = await supabase
      .from('adjournment_speeches')
      .select('id', { count: 'exact', head: true })
      .eq('application_id', params.id)
      .eq('speech_type', 'opening')
    if ((openingCount ?? 0) > 0) {
      return NextResponse.json({ error: 'Opening speech already delivered' }, { status: 409 })
    }
  }

  // Limit floor speeches to 5 per debate, 1 per user
  if (speech_type === 'floor') {
    const { count: floorCount } = await supabase
      .from('adjournment_speeches')
      .select('id', { count: 'exact', head: true })
      .eq('application_id', params.id)
      .eq('speech_type', 'floor')
    if ((floorCount ?? 0) >= 5) {
      return NextResponse.json({ error: 'Maximum floor speeches (5) reached' }, { status: 409 })
    }

    const { count: myCount } = await supabase
      .from('adjournment_speeches')
      .select('id', { count: 'exact', head: true })
      .eq('application_id', params.id)
      .eq('speaker_id', user.id)
    if ((myCount ?? 0) > 0) {
      return NextResponse.json({ error: 'You have already spoken in this debate' }, { status: 409 })
    }
  }

  // Response: only 1 allowed, by anyone (acts as "minister")
  if (speech_type === 'response') {
    const { count: responseCount } = await supabase
      .from('adjournment_speeches')
      .select('id', { count: 'exact', head: true })
      .eq('application_id', params.id)
      .eq('speech_type', 'response')
    if ((responseCount ?? 0) > 0) {
      return NextResponse.json({ error: 'A ministerial response has already been submitted' }, { status: 409 })
    }
  }

  const { data: speech, error } = await supabase
    .from('adjournment_speeches')
    .insert({
      application_id: params.id,
      speaker_id: user.id,
      speech_type,
      content: content.trim(),
    })
    .select('id, speech_type, content, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // If a response has been submitted and opening was also delivered, auto-close
  if (speech_type === 'response') {
    const { count: openingCount } = await supabase
      .from('adjournment_speeches')
      .select('id', { count: 'exact', head: true })
      .eq('application_id', params.id)
      .eq('speech_type', 'opening')
    if ((openingCount ?? 0) > 0) {
      await supabase
        .from('adjournment_applications')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', params.id)
    }
  }

  // If opening delivered and status is still 'selected', advance to 'open'
  if (speech_type === 'opening' && app.status === 'selected') {
    await supabase
      .from('adjournment_applications')
      .update({ status: 'open', updated_at: new Date().toISOString() })
      .eq('id', params.id)
  }

  return NextResponse.json({ id: speech.id }, { status: 201 })
}
