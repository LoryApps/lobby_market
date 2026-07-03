import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: { id: string }
}

/** POST /api/civic-vetoes/[id]/sign — add signature */
export async function POST(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  const { data: veto } = await supabase
    .from('civic_vetoes')
    .select('id, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!veto) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (veto.status !== 'open') return NextResponse.json({ error: 'veto_closed' }, { status: 400 })

  const { error } = await supabase
    .from('civic_veto_signatures')
    .insert({ veto_id: params.id, user_id: user.id })

  if (error && error.code === '23505') {
    return NextResponse.json({ error: 'already_signed' }, { status: 409 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: updated } = await supabase
    .from('civic_vetoes')
    .select('signature_count, status')
    .eq('id', params.id)
    .single()

  return NextResponse.json({ ok: true, signature_count: updated?.signature_count ?? 0, status: updated?.status ?? 'open' })
}

/** DELETE /api/civic-vetoes/[id]/sign — remove signature */
export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  const { data: veto } = await supabase
    .from('civic_vetoes')
    .select('id, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!veto) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (veto.status !== 'open') return NextResponse.json({ error: 'veto_closed' }, { status: 400 })

  await supabase
    .from('civic_veto_signatures')
    .delete()
    .eq('veto_id', params.id)
    .eq('user_id', user.id)

  const { data: updated } = await supabase
    .from('civic_vetoes')
    .select('signature_count')
    .eq('id', params.id)
    .single()

  return NextResponse.json({ ok: true, signature_count: updated?.signature_count ?? 0 })
}
