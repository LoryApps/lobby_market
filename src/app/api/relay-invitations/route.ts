import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/relay-invitations — fetch the current user's relay invitations
// Query params:
//   direction: 'received' | 'sent' | 'all' (default: 'all')
//   status: 'pending' | 'accepted' | 'declined' | 'expired' | 'all' (default: 'all')

export async function GET(req: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const direction = url.searchParams.get('direction') ?? 'all'
  const statusFilter = url.searchParams.get('status') ?? 'all'

  // Expire stale pending invitations before fetching
  await supabase
    .from('relay_invitations')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())

  // Build the query
  let query = supabase.from('relay_invitations').select(`
    id,
    relay_id,
    inviter_id,
    invitee_id,
    message,
    status,
    created_at,
    responded_at,
    expires_at,
    relay:civic_relays (
      id,
      is_for,
      status,
      leg_count,
      max_legs,
      topic:topics ( id, statement, category )
    ),
    inviter:profiles!relay_invitations_inviter_id_fkey (
      id,
      username,
      display_name,
      avatar_url,
      role
    ),
    invitee:profiles!relay_invitations_invitee_id_fkey (
      id,
      username,
      display_name,
      avatar_url,
      role
    )
  `)

  // Direction filter
  if (direction === 'received') {
    query = query.eq('invitee_id', user.id)
  } else if (direction === 'sent') {
    query = query.eq('inviter_id', user.id)
  } else {
    // 'all' — show both directions
    query = query.or(`invitee_id.eq.${user.id},inviter_id.eq.${user.id}`)
  }

  // Status filter
  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  query = query.order('created_at', { ascending: false }).limit(60)

  const { data, error } = await query

  if (error) {
    console.error('relay_invitations fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 })
  }

  return NextResponse.json({ invitations: data ?? [] })
}
