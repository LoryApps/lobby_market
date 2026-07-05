import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** POST /api/vetoes/[id]/sign — add signature */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: veto, error: vetoErr } = await supabase
    .from('civic_vetoes')
    .select('id, status, challenger_id')
    .eq('id', params.id)
    .maybeSingle()

  if (vetoErr || !veto) {
    return NextResponse.json({ error: 'Veto not found' }, { status: 404 })
  }
  if (veto.status !== 'open') {
    return NextResponse.json({ error: 'Veto is no longer open' }, { status: 409 })
  }

  const { error } = await supabase
    .from('civic_veto_signatures')
    .insert({ veto_id: params.id, user_id: user.id })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already signed' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/** DELETE /api/vetoes/[id]/sign — remove signature */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('civic_veto_signatures')
    .delete()
    .eq('veto_id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
