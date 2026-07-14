import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── PATCH /api/whips/[id] — revoke or update guidance ───────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    active?: boolean
    direction?: string
    strength?: string
    message?: string
  }

  // Fetch guidance to verify permissions
  const { data: guidance } = await supabase
    .from('coalition_whip_guidance')
    .select('id, coalition_id, issued_by')
    .eq('id', params.id)
    .single()

  if (!guidance) {
    return NextResponse.json({ error: 'Guidance not found' }, { status: 404 })
  }

  // Must be issuer or coalition leader
  const isIssuer = guidance.issued_by === user.id
  let isLeader = false
  if (!isIssuer) {
    const { data: membership } = await supabase
      .from('coalition_members')
      .select('role')
      .eq('coalition_id', guidance.coalition_id)
      .eq('user_id', user.id)
      .eq('role', 'leader')
      .single()
    isLeader = !!membership
  }

  if (!isIssuer && !isLeader) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  if (typeof body.active === 'boolean') updates.active = body.active
  if (body.direction) updates.direction = body.direction
  if (body.strength) updates.strength = body.strength
  if (typeof body.message !== 'undefined') updates.message = body.message?.trim() || null

  const { error } = await supabase
    .from('coalition_whip_guidance')
    .update(updates)
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
