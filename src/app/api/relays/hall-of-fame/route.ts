import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1-hour cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HallOfFameRelay {
  id: string
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  side: 'for' | 'against'
  status: string
  max_legs: number
  leg_count: number
  vote_compelling: number
  vote_not_compelling: number
  compelling_pct: number
  completed_at: string | null
  created_at: string
  starter_username: string
  starter_display_name: string | null
  starter_avatar_url: string | null
  starter_role: string
  top_leg_content: string | null
  top_leg_upvotes: number
}

export interface TopContributor {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  relay_count: number
  total_compelling: number
}

export interface CategoryChampion {
  category: string
  relay_id: string
  topic_statement: string | null
  side: 'for' | 'against'
  compelling_pct: number
  vote_compelling: number
  leg_count: number
  completed_at: string | null
}

export interface HallOfFameResponse {
  most_compelling: HallOfFameRelay[]
  longest_chains: HallOfFameRelay[]
  fastest_completed: HallOfFameRelay[]
  top_contributors: TopContributor[]
  category_champions: CategoryChampion[]
  totals: {
    total_relays: number
    total_completed: number
    total_compelling_votes: number
    avg_compelling_pct: number
  }
}

// ─── GET /api/relays/hall-of-fame ────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Fetch completed relays with vote data, ordered by compelling score
  const { data: completedRows } = await supabase
    .from('civic_relays')
    .select('*')
    .in('status', ['complete', 'voted'])
    .order('vote_compelling', { ascending: false })
    .limit(100)

  const completed = completedRows ?? []

  if (completed.length === 0) {
    return NextResponse.json({
      most_compelling: [],
      longest_chains: [],
      fastest_completed: [],
      top_contributors: [],
      category_champions: [],
      totals: { total_relays: 0, total_completed: 0, total_compelling_votes: 0, avg_compelling_pct: 0 },
    } satisfies HallOfFameResponse)
  }

  // Enrich with topic data
  const topicIds = Array.from(new Set(completed.map((r) => r.topic_id).filter(Boolean)))
  const { data: topicRows } = topicIds.length
    ? await supabase
        .from('topics')
        .select('id, statement, category')
        .in('id', topicIds)
    : { data: [] }
  const topicMap = new Map((topicRows ?? []).map((t) => [t.id, t]))

  // Enrich with starter profiles
  const starterIds = Array.from(new Set(completed.map((r) => r.starter_id)))
  const { data: profileRows } = starterIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', starterIds)
    : { data: [] }
  const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]))

  // Leg counts per relay
  const relayIds = completed.map((r) => r.id)
  const { data: legCountRows } = await supabase
    .from('relay_legs')
    .select('relay_id')
    .in('relay_id', relayIds)
  const legCountMap = new Map<string, number>()
  for (const leg of legCountRows ?? []) {
    legCountMap.set(leg.relay_id, (legCountMap.get(leg.relay_id) ?? 0) + 1)
  }

  // Top leg per relay (most upvotes)
  const { data: topLegRows } = await supabase
    .from('relay_legs')
    .select('relay_id, content, upvote_count')
    .in('relay_id', relayIds)
    .order('upvote_count', { ascending: false })
  const topLegMap = new Map<string, { content: string; upvote_count: number }>()
  for (const leg of topLegRows ?? []) {
    if (!topLegMap.has(leg.relay_id)) {
      topLegMap.set(leg.relay_id, { content: leg.content, upvote_count: leg.upvote_count ?? 0 })
    }
  }

  function buildRelay(r: typeof completed[0]): HallOfFameRelay {
    const topic = r.topic_id ? topicMap.get(r.topic_id) : null
    const starter = profileMap.get(r.starter_id)
    const total = (r.vote_compelling ?? 0) + (r.vote_not_compelling ?? 0)
    const topLeg = topLegMap.get(r.id)
    return {
      id: r.id,
      topic_id: r.topic_id ?? null,
      topic_statement: topic?.statement ?? null,
      topic_category: topic?.category ?? null,
      side: r.side as 'for' | 'against',
      status: r.status,
      max_legs: r.max_legs ?? 5,
      leg_count: legCountMap.get(r.id) ?? 0,
      vote_compelling: r.vote_compelling ?? 0,
      vote_not_compelling: r.vote_not_compelling ?? 0,
      compelling_pct: total > 0 ? Math.round(((r.vote_compelling ?? 0) / total) * 100) : 0,
      completed_at: r.completed_at ?? null,
      created_at: r.created_at,
      starter_username: starter?.username ?? 'unknown',
      starter_display_name: starter?.display_name ?? null,
      starter_avatar_url: starter?.avatar_url ?? null,
      starter_role: starter?.role ?? 'person',
      top_leg_content: topLeg?.content ?? null,
      top_leg_upvotes: topLeg?.upvote_count ?? 0,
    }
  }

  const enriched = completed.map(buildRelay)

  // Most compelling: highest compelling_pct with at least 3 total votes
  const mostCompelling = enriched
    .filter((r) => r.vote_compelling + r.vote_not_compelling >= 3)
    .sort((a, b) => b.compelling_pct - a.compelling_pct || b.vote_compelling - a.vote_compelling)
    .slice(0, 10)

  // Longest chains: most legs
  const longestChains = [...enriched]
    .sort((a, b) => b.leg_count - a.leg_count || b.compelling_pct - a.compelling_pct)
    .slice(0, 8)

  // Fastest completed: shortest time from created_at to completed_at
  const fastestCompleted = enriched
    .filter((r) => r.completed_at)
    .sort((a, b) => {
      const aMs = new Date(a.completed_at!).getTime() - new Date(a.created_at).getTime()
      const bMs = new Date(b.completed_at!).getTime() - new Date(b.created_at).getTime()
      return aMs - bMs
    })
    .slice(0, 8)

  // Top contributors: count relay legs per user
  const { data: contribRows } = await supabase
    .from('relay_legs')
    .select('author_id, relay_id')
    .in('relay_id', relayIds)

  const contribMap = new Map<string, { relayIds: Set<string>; total: number }>()
  for (const leg of contribRows ?? []) {
    const entry = contribMap.get(leg.author_id) ?? { relayIds: new Set(), total: 0 }
    entry.relayIds.add(leg.relay_id)
    entry.total += 1
    contribMap.set(leg.author_id, entry)
  }

  const contribIds = Array.from(contribMap.keys())
  const { data: contribProfileRows } = contribIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', contribIds)
    : { data: [] }
  const contribProfileMap = new Map((contribProfileRows ?? []).map((p) => [p.id, p]))

  // Build compelling-votes total per contributor (across relays they contributed to)
  const contribCompelling = new Map<string, number>()
  for (const [userId, { relayIds: rIds }] of contribMap.entries()) {
    let compellingTotal = 0
    for (const rid of rIds) {
      const relay = enriched.find((r) => r.id === rid)
      if (relay) compellingTotal += relay.vote_compelling
    }
    contribCompelling.set(userId, compellingTotal)
  }

  const topContributors: TopContributor[] = Array.from(contribMap.entries())
    .map(([userId, { relayIds: rIds }]) => {
      const p = contribProfileMap.get(userId)
      return {
        user_id: userId,
        username: p?.username ?? 'unknown',
        display_name: p?.display_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        role: p?.role ?? 'person',
        relay_count: rIds.size,
        total_compelling: contribCompelling.get(userId) ?? 0,
      }
    })
    .sort((a, b) => b.relay_count - a.relay_count || b.total_compelling - a.total_compelling)
    .slice(0, 10)

  // Category champions: best relay per category
  const categoryMap = new Map<string, HallOfFameRelay>()
  for (const relay of enriched) {
    const cat = relay.topic_category
    if (!cat) continue
    const current = categoryMap.get(cat)
    if (!current || relay.compelling_pct > current.compelling_pct ||
        (relay.compelling_pct === current.compelling_pct && relay.vote_compelling > current.vote_compelling)) {
      categoryMap.set(cat, relay)
    }
  }

  const categoryChampions: CategoryChampion[] = Array.from(categoryMap.entries())
    .map(([category, relay]) => ({
      category,
      relay_id: relay.id,
      topic_statement: relay.topic_statement,
      side: relay.side,
      compelling_pct: relay.compelling_pct,
      vote_compelling: relay.vote_compelling,
      leg_count: relay.leg_count,
      completed_at: relay.completed_at,
    }))
    .sort((a, b) => b.compelling_pct - a.compelling_pct)

  // Totals
  const { count: totalRelays } = await supabase
    .from('civic_relays')
    .select('*', { count: 'exact', head: true })
  const totalCompellingVotes = enriched.reduce((s, r) => s + r.vote_compelling, 0)
  const totalWithVotes = enriched.filter((r) => r.vote_compelling + r.vote_not_compelling > 0)
  const avgCompellingPct = totalWithVotes.length
    ? Math.round(totalWithVotes.reduce((s, r) => s + r.compelling_pct, 0) / totalWithVotes.length)
    : 0

  return NextResponse.json({
    most_compelling: mostCompelling,
    longest_chains: longestChains,
    fastest_completed: fastestCompleted,
    top_contributors: topContributors,
    category_champions: categoryChampions,
    totals: {
      total_relays: totalRelays ?? 0,
      total_completed: completed.length,
      total_compelling_votes: totalCompellingVotes,
      avg_compelling_pct: avgCompellingPct,
    },
  } satisfies HallOfFameResponse)
}
