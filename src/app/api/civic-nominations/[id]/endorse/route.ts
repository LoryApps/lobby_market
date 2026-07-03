import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/civic-nominations/[id]/endorse  — add endorsement
 * DELETE /api/civic-nominations/[id]/endorse — remove endorsement
 */

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id: nominationId } = params

  // Verify nomination exists and is open
  const { data: nomination, error: fetchErr } = await supabase
    .from('civic_nominations')
    .select('id, status, nominee_id')
    .eq('id', nominationId)
    .maybeSingle()

  if (fetchErr || !nomination) {
    return NextResponse.json({ error: 'Nomination not found' }, { status: 404 })
  }
  if (nomination.status !== 'open') {
    return NextResponse.json({ error: 'Nomination is no longer open' }, { status: 409 })
  }
  if (nomination.nominee_id === user.id) {
    return NextResponse.json({ error: 'You cannot endorse your own nomination' }, { status: 400 })
  }

  const { error } = await supabase
    .from('civic_nomination_endorsements')
    .insert({ nomination_id: nominationId, user_id: user.id })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already endorsed' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ endorsed: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { id: nominationId } = params

  const { error } = await supabase
    .from('civic_nomination_endorsements')
    .delete()
    .eq('nomination_id', nominationId)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ endorsed: false })
}
