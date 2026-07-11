import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NetworkNode {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  clout: number
  role: string
  received_count: number // delegations received
  given_count: number    // delegations given
  is_current_user: boolean
}

export interface NetworkEdge {
  id: string
  source: string // delegator_id
  target: string // delegate_id
  scope: 'global' | 'category' | 'topic'
  category: string | null
}

export interface DelegationNetworkResponse {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
  total_delegations: number
}

// ─── GET — delegation graph data ─────────────────────────────────────────────
//
// Returns all active delegations (capped at 500 edges) with the user data
// needed to render the force-directed network graph.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch all active delegations
  const { data: delegations, error } = await supabase
    .from('vote_delegations')
    .select(`
      id,
      delegator_id,
      delegate_id,
      topic_id,
      category
    `)
    .is('revoked_at', null)
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!delegations || delegations.length === 0) {
    return NextResponse.json({ nodes: [], edges: [], total_delegations: 0 } satisfies DelegationNetworkResponse)
  }

  // Collect all unique user IDs that appear in the graph
  const userIds = new Set<string>()
  for (const d of delegations) {
    userIds.add(d.delegator_id)
    userIds.add(d.delegate_id)
  }

  // Fetch profiles for all users in the graph
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, clout, role')
    .in('id', Array.from(userIds))

  const profileMap = new Map<string, {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    clout: number
    role: string
  }>()
  for (const p of profiles ?? []) {
    profileMap.set(p.id, p)
  }

  // Count received and given delegations per user
  const receivedCount = new Map<string, number>()
  const givenCount = new Map<string, number>()
  for (const d of delegations) {
    receivedCount.set(d.delegate_id, (receivedCount.get(d.delegate_id) ?? 0) + 1)
    givenCount.set(d.delegator_id, (givenCount.get(d.delegator_id) ?? 0) + 1)
  }

  // Build nodes
  const nodes: NetworkNode[] = Array.from(userIds).map((uid) => {
    const p = profileMap.get(uid)
    return {
      id: uid,
      username: p?.username ?? 'unknown',
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
      clout: p?.clout ?? 0,
      role: p?.role ?? 'person',
      received_count: receivedCount.get(uid) ?? 0,
      given_count: givenCount.get(uid) ?? 0,
      is_current_user: uid === user?.id,
    }
  })

  // Build edges
  const edges: NetworkEdge[] = delegations.map((d) => ({
    id: d.id,
    source: d.delegator_id,
    target: d.delegate_id,
    scope: d.topic_id ? 'topic' : d.category ? 'category' : 'global',
    category: d.category ?? null,
  }))

  return NextResponse.json({
    nodes,
    edges,
    total_delegations: delegations.length,
  } satisfies DelegationNetworkResponse)
}
