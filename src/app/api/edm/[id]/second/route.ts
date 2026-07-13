import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface Params {
  params: { id: string }
}

// ── POST /api/edm/[id]/second ─────────────────────────────────────────────────
// Second an EDM. Idempotent.

export async function POST(
  _req: NextRequest,
  { params }: Params,
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = params

  // Check the EDM exists and is open
  const { data: edm } = await supabase
    .from('early_day_motions')
    .select('id, status, filed_by')
    .eq('id', id)
    .maybeSingle()

  if (!edm) {
    return NextResponse.json({ error: 'EDM not found' }, { status: 404 })
  }
  if (edm.status !== 'open') {
    return NextResponse.json({ error: 'This EDM is no longer open for seconds' }, { status: 409 })
  }
  if (edm.filed_by === user.id) {
    return NextResponse.json({ error: 'You cannot second your own EDM' }, { status: 409 })
  }

  const { error } = await supabase
    .from('edm_seconds')
    .insert({ edm_id: id, user_id: user.id })

  if (error) {
    // Unique violation → already seconded (idempotent)
    if (error.code === '23505') {
      return NextResponse.json({ seconded: true }, { status: 200 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ seconded: true }, { status: 201 })
}

// ── DELETE /api/edm/[id]/second ───────────────────────────────────────────────
// Withdraw your second from an EDM.

export async function DELETE(
  _req: NextRequest,
  { params }: Params,
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = params

  const { error } = await supabase
    .from('edm_seconds')
    .delete()
    .eq('edm_id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ seconded: false })
}
