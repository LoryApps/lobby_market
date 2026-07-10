import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NetworkNode {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  relay_count: number
  leg_count: number
  clout: number
}

export interface NetworkEdge {
  source: string
  target: string
  weight: number
}

export interface RelayNetworkResponse {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
  total_relays: number
  total_participants: number
}

// ─── GET /api/relays/network ──────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // 1. Fetch all relays with their starter
  const { data: relayRows, error: relayErr } = await supabase
    .from('civic_relays')
    .select('id, starter_id')
    .order('created_at', { ascending: false })
    .limit(500)

  if (relayErr || !relayRows) {
    return NextResponse.json({ nodes: [], edges: [], total_relays: 0, total_participants: 0 })
  }

  // 2. Fetch all relay legs
  const { data: legRows, error: legErr } = await supabase
    .from('relay_legs')
    .select('relay_id, author_id')
    .limit(5000)

  if (legErr || !legRows) {
    return NextResponse.json({ nodes: [], edges: [], total_relays: 0, total_participants: 0 })
  }

  // 3. Build per-relay participant sets (starter + leg authors)
  const participantsByRelay = new Map<string, Set<string>>()
  for (const r of relayRows) {
    participantsByRelay.set(r.id, new Set([r.starter_id]))
  }
  for (const leg of legRows) {
    const set = participantsByRelay.get(leg.relay_id)
    if (set) set.add(leg.author_id)
  }

  // 4. Count relays per user (started + participated in)
  const userRelayCount = new Map<string, number>()
  const userLegCount = new Map<string, number>()

  for (const r of relayRows) {
    userRelayCount.set(r.starter_id, (userRelayCount.get(r.starter_id) ?? 0) + 1)
  }
  for (const leg of legRows) {
    userLegCount.set(leg.author_id, (userLegCount.get(leg.author_id) ?? 0) + 1)
    // legs also count toward relay participation
    userRelayCount.set(leg.author_id, (userRelayCount.get(leg.author_id) ?? 0) + 1)
  }

  // 5. Build co-participation edge weights
  const edgeMap = new Map<string, number>()
  for (const participants of participantsByRelay.values()) {
    const list = Array.from(participants)
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const key = [list[i], list[j]].sort().join('|')
        edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1)
      }
    }
  }

  // 6. Limit to top 80 users by relay count for readability
  const allUserIds = Array.from(userRelayCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 80)
    .map(([id]) => id)

  const topUserSet = new Set(allUserIds)

  // 7. Filter edges to only include top users
  const edges: NetworkEdge[] = []
  for (const [key, weight] of edgeMap.entries()) {
    const [src, tgt] = key.split('|')
    if (topUserSet.has(src) && topUserSet.has(tgt)) {
      edges.push({ source: src, target: tgt, weight })
    }
  }

  // 8. Fetch profile data for top users
  if (allUserIds.length === 0) {
    return NextResponse.json({ nodes: [], edges: [], total_relays: relayRows.length, total_participants: 0 })
  }

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout')
    .in('id', allUserIds)

  const profileMap = new Map<string, typeof profileRows extends Array<infer T> ? T : never>()
  for (const p of profileRows ?? []) {
    profileMap.set(p.id, p)
  }

  const nodes: NetworkNode[] = allUserIds
    .filter((id) => profileMap.has(id))
    .map((id) => {
      const p = profileMap.get(id)!
      return {
        id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role,
        relay_count: userRelayCount.get(id) ?? 0,
        leg_count: userLegCount.get(id) ?? 0,
        clout: p.clout ?? 0,
      }
    })

  const totalParticipants = userRelayCount.size

  return NextResponse.json({
    nodes,
    edges,
    total_relays: relayRows.length,
    total_participants: totalParticipants,
  } satisfies RelayNetworkResponse)
}
