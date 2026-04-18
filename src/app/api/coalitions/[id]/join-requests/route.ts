import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/supabase/types'

export interface JoinRequestWithProfile {
  id: string
  coalition_id: string
  user_id: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  responded_at: string | null
  requester: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role' | 'clout' | 'reputation_score'> | null
}

// GET /api/coalitions/[id]/join-requests
// Returns pending join requests. Leaders/officers only.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify caller is a leader or officer
  const { data: membership } = await supabase
    .from('coalition_members')
    .select('role')
    .eq('coalition_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['leader', 'officer'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: requests, error } = await supabase
    .from('coalition_join_requests')
    .select('*')
    .eq('coalition_id', params.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = requests ?? []

  // Enrich with requester profiles
  const requesterIds = rows.map((r) => r.user_id)
  const profileMap = new Map<string, JoinRequestWithProfile['requester']>()

  if (requesterIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score')
      .in('id', requesterIds)

    for (const p of profiles ?? []) {
      profileMap.set(p.id, p as JoinRequestWithProfile['requester'])
    }
  }

  const enriched: JoinRequestWithProfile[] = rows.map((r) => ({
    ...r,
    requester: profileMap.get(r.user_id) ?? null,
  }))

  return NextResponse.json({ requests: enriched })
}
