import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── POST /api/hearings/[id]/testimony ────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  let body: { content?: unknown; stance?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const stance = typeof body.stance === 'string' ? body.stance : 'neutral'

  if (content.length < 10 || content.length > 500) {
    return NextResponse.json(
      { error: 'Testimony must be between 10 and 500 characters' },
      { status: 400 }
    )
  }

  if (!['for', 'against', 'neutral'].includes(stance)) {
    return NextResponse.json({ error: 'Stance must be for, against, or neutral' }, { status: 400 })
  }

  try {
    // Verify the hearing exists and is open
    const { data: hearing, error: hearingError } = await supabase
      .from('civic_hearings')
      .select('id, status')
      .eq('id', params.id)
      .single()

    if (hearingError || !hearing) {
      return NextResponse.json({ error: 'Hearing not found' }, { status: 404 })
    }

    if ((hearing as { status: string }).status !== 'open') {
      return NextResponse.json({ error: 'This hearing is no longer accepting testimony' }, { status: 409 })
    }

    // Check if user already submitted testimony
    const { data: existing } = await supabase
      .from('civic_testimonies')
      .select('id')
      .eq('hearing_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      // Update existing testimony
      const { data: updated, error: updateError } = await supabase
        .from('civic_testimonies')
        .update({ content, stance })
        .eq('id', (existing as { id: string }).id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError) throw updateError
      return NextResponse.json({ testimony: updated, action: 'updated' })
    }

    // Insert new testimony
    const { data: inserted, error: insertError } = await supabase
      .from('civic_testimonies')
      .insert({
        hearing_id: params.id,
        user_id: user.id,
        content,
        stance,
      })
      .select()
      .single()

    if (insertError) throw insertError
    return NextResponse.json({ testimony: inserted, action: 'created' }, { status: 201 })
  } catch (err) {
    console.error('[testimony POST]', err)
    return NextResponse.json({ error: 'Failed to submit testimony' }, { status: 500 })
  }
}

// ─── DELETE /api/hearings/[id]/testimony ─────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const { error } = await supabase
      .from('civic_testimonies')
      .delete()
      .eq('hearing_id', params.id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[testimony DELETE]', err)
    return NextResponse.json({ error: 'Failed to withdraw testimony' }, { status: 500 })
  }
}
