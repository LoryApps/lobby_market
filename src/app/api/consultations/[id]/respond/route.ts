import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const body = await request.json()
  const { response_text, stance } = body as {
    response_text: string
    stance: string
  }

  if (!response_text || response_text.length < 20) {
    return NextResponse.json({ error: 'Response too short (min 20 chars)' }, { status: 400 })
  }

  const validStances = ['strongly_support', 'support', 'neutral', 'oppose', 'strongly_oppose']
  if (!validStances.includes(stance)) {
    return NextResponse.json({ error: 'Invalid stance' }, { status: 400 })
  }

  // Check consultation is open
  const { data: consultation } = await supabase
    .from('civic_consultations')
    .select('id, status, closes_at')
    .eq('id', params.id)
    .single()

  if (!consultation) {
    return NextResponse.json({ error: 'Consultation not found' }, { status: 404 })
  }

  if (consultation.status !== 'open') {
    return NextResponse.json({ error: 'Consultation is not open for responses' }, { status: 422 })
  }

  if (new Date(consultation.closes_at as string) < new Date()) {
    return NextResponse.json({ error: 'Consultation deadline has passed' }, { status: 422 })
  }

  // Upsert response (users may edit their single response)
  const { data: response, error } = await supabase
    .from('civic_consultation_responses')
    .upsert(
      {
        consultation_id: params.id,
        author_id: user.id,
        response_text: response_text.trim(),
        stance,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'consultation_id,author_id' }
    )
    .select('id, response_text, stance, upvotes, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ response })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const { error } = await supabase
    .from('civic_consultation_responses')
    .delete()
    .eq('consultation_id', params.id)
    .eq('author_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
