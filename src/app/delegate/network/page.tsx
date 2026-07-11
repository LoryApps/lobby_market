import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { NetworkClient } from './NetworkClient'
import type { NetworkNode, NetworkEdge } from '@/app/api/delegation/network/route'

export const metadata: Metadata = {
  title: 'Delegation Network · Lobby Market',
  description:
    "Force-directed graph of the Lobby's liquid democracy. See how voting power flows between citizens through delegation chains.",
  openGraph: {
    title: 'Delegation Network · Lobby Market',
    description: "Visualise the civic trust graph — who delegates to whom across the Lobby's liquid democracy.",
    type: 'website',
    siteName: 'Lobby Market',
  },
}

// Fetch delegation network data server-side to avoid an extra client round-trip
async function getNetworkData(): Promise<{ nodes: NetworkNode[]; edges: NetworkEdge[]; total: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: delegations } = await supabase
    .from('vote_delegations')
    .select('id, delegator_id, delegate_id, topic_id, category')
    .is('revoked_at', null)
    .limit(500)

  if (!delegations || delegations.length === 0) {
    return { nodes: [], edges: [], total: 0 }
  }

  const userIds = new Set<string>()
  for (const d of delegations) {
    userIds.add(d.delegator_id)
    userIds.add(d.delegate_id)
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, clout, role')
    .in('id', Array.from(userIds))

  const profileMap = new Map<string, { id: string; username: string; display_name: string | null; avatar_url: string | null; clout: number; role: string }>()
  for (const p of profiles ?? []) {
    profileMap.set(p.id, p)
  }

  const receivedCount = new Map<string, number>()
  const givenCount = new Map<string, number>()
  for (const d of delegations) {
    receivedCount.set(d.delegate_id, (receivedCount.get(d.delegate_id) ?? 0) + 1)
    givenCount.set(d.delegator_id, (givenCount.get(d.delegator_id) ?? 0) + 1)
  }

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

  const edges: NetworkEdge[] = delegations.map((d) => ({
    id: d.id,
    source: d.delegator_id,
    target: d.delegate_id,
    scope: d.topic_id ? 'topic' : d.category ? 'category' : 'global',
    category: d.category ?? null,
  }))

  return { nodes, edges, total: delegations.length }
}

export default async function DelegationNetworkPage() {
  const { nodes, edges, total } = await getNetworkData()

  return (
    <NetworkClient
      nodes={nodes}
      edges={edges}
      totalDelegations={total}
    />
  )
}
