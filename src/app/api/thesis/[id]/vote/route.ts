import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: { id: string }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { agree?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.agree !== 'boolean') {
    return NextResponse.json({ error: 'agree must be boolean' }, { status: 400 })
  }

  // Verify the thesis exists and belongs to someone else
  const { data: thesis } = await supabase
    .from('civic_theses')
    .select('id, user_id, status')
    .eq('id', params.id)
    .single()

  if (!thesis) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (thesis.user_id === user.id) {
    return NextResponse.json({ error: 'Cannot vote on your own thesis' }, { status: 400 })
  }
  if (thesis.status !== 'active') {
    return NextResponse.json({ error: 'Thesis is no longer active' }, { status: 400 })
  }

  // Upsert the vote (removes old opposite vote automatically via PK)
  const { error } = await supabase
    .from('thesis_votes')
    .upsert(
      { thesis_id: params.id, user_id: user.id, agree: body.agree },
      { onConflict: 'thesis_id,user_id' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, agree: body.agree })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('thesis_votes')
    .delete()
    .eq('thesis_id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
