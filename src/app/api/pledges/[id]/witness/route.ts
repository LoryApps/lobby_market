import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: { id: string }
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify pledge exists and is public
  const { data: pledge } = await supabase
    .from('civic_pledges')
    .select('id, user_id, is_public, status')
    .eq('id', params.id)
    .single()

  if (!pledge) {
    return NextResponse.json({ error: 'Pledge not found' }, { status: 404 })
  }
  if (!pledge.is_public) {
    return NextResponse.json({ error: 'Cannot witness a private pledge' }, { status: 403 })
  }
  if (pledge.user_id === user.id) {
    return NextResponse.json({ error: 'Cannot witness your own pledge' }, { status: 400 })
  }

  const { error } = await supabase
    .from('pledge_witnesses')
    .insert({ pledge_id: params.id, user_id: user.id })

  if (error) {
    if (error.code === '23505') {
      // Already a witness — idempotent
      return NextResponse.json({ ok: true, already: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
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
    .from('pledge_witnesses')
    .delete()
    .eq('pledge_id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
