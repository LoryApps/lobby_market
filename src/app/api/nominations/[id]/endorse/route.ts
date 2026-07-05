import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** POST /api/nominations/[id]/endorse */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: nom, error: nomErr } = await supabase
    .from('civic_nominations')
    .select('id, status, nominee_id')
    .eq('id', params.id)
    .maybeSingle()

  if (nomErr || !nom) {
    return NextResponse.json({ error: 'Nomination not found' }, { status: 404 })
  }
  if (nom.status !== 'open') {
    return NextResponse.json({ error: 'Nomination is no longer open' }, { status: 409 })
  }
  if (nom.nominee_id === user.id) {
    return NextResponse.json({ error: 'Cannot endorse your own nomination' }, { status: 409 })
  }

  const { error } = await supabase
    .from('civic_nomination_endorsements')
    .insert({ nomination_id: params.id, user_id: user.id })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already endorsed' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/** DELETE /api/nominations/[id]/endorse */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('civic_nomination_endorsements')
    .delete()
    .eq('nomination_id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
