import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/coalitions/[id]/join-request
// Returns the current user's join request status for this coalition.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data } = await supabase
    .from('coalition_join_requests')
    .select('id, status, created_at')
    .eq('coalition_id', params.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ request: data ?? null })
}

// POST /api/coalitions/[id]/join-request
// Submit a request to join a private coalition.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify coalition exists and is private
  const { data: coalition } = await supabase
    .from('coalitions')
    .select('id, is_public, member_count, max_members')
    .eq('id', params.id)
    .maybeSingle()

  if (!coalition) {
    return NextResponse.json({ error: 'Coalition not found' }, { status: 404 })
  }

  if (coalition.is_public) {
    return NextResponse.json(
      { error: 'Public coalitions can be joined directly' },
      { status: 400 }
    )
  }

  if (coalition.member_count >= coalition.max_members) {
    return NextResponse.json({ error: 'Coalition is full' }, { status: 400 })
  }

  // Check not already a member
  const { data: existing } = await supabase
    .from('coalition_members')
    .select('id')
    .eq('coalition_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Already a member' }, { status: 409 })
  }

  // Check no pending request already
  const { data: pending } = await supabase
    .from('coalition_join_requests')
    .select('id, status')
    .eq('coalition_id', params.id)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (pending) {
    return NextResponse.json({ error: 'Request already pending' }, { status: 409 })
  }

  const { data: created, error } = await supabase
    .from('coalition_join_requests')
    .insert({ coalition_id: params.id, user_id: user.id })
    .select()
    .single()

  if (error || !created) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to submit request' },
      { status: 500 }
    )
  }

  return NextResponse.json({ request: created }, { status: 201 })
}

// DELETE /api/coalitions/[id]/join-request
// Cancel a pending join request.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('coalition_join_requests')
    .delete()
    .eq('coalition_id', params.id)
    .eq('user_id', user.id)
    .eq('status', 'pending')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
