import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryRelay {
  id: string
  side: 'for' | 'against'
  status: 'open' | 'in_progress' | 'complete' | 'voted'
  max_legs: number
  leg_count: number
  vote_compelling: number
  vote_not_compelling: number
  created_at: string
  completed_at: string | null
  topic_id: string | null
  topic_statement: string | null
  starter_username: string
  starter_display_name: string | null
  starter_avatar_url: string | null
  first_leg_content: string | null
}

export interface RelayCategoryData {
  name: string
  total: number
  open: number
  complete: number
  for_count: number
  against_count: number
  top_for: CategoryRelay | null
  top_against: CategoryRelay | null
  recent: CategoryRelay[]
}

export interface RelayCategoriesResponse {
  categories: RelayCategoryData[]
  total_relays: number
}

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
] as const

// ─── GET /api/relays/categories ───────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // 1. Fetch all topics (to map category)
  const { data: topics } = await supabase
    .from('topics')
    .select('id, statement, category, status')

  const topicMap = new Map((topics ?? []).map((t) => [t.id, t]))

  // Category → topic IDs lookup
  const topicsByCategory = new Map<string, string[]>()
  for (const t of topics ?? []) {
    if (!t.category) continue
    const existing = topicsByCategory.get(t.category) ?? []
    existing.push(t.id)
    topicsByCategory.set(t.category, existing)
  }

  // 2. Fetch all relays (topic_id + status + side + counts)
  const { data: relays } = await supabase
    .from('civic_relays')
    .select(
      'id, topic_id, side, status, max_legs, vote_compelling, vote_not_compelling, created_at, completed_at, starter_id'
    )
    .order('created_at', { ascending: false })

  if (!relays || relays.length === 0) {
    const emptyCategories: RelayCategoryData[] = CATEGORIES.map((name) => ({
      name,
      total: 0,
      open: 0,
      complete: 0,
      for_count: 0,
      against_count: 0,
      top_for: null,
      top_against: null,
      recent: [],
    }))
    return NextResponse.json({ categories: emptyCategories, total_relays: 0 } satisfies RelayCategoriesResponse)
  }

  const relayIds = relays.map((r) => r.id)
  const starterIds = [...new Set(relays.map((r) => r.starter_id))]

  // 3. Fetch starters
  const { data: starters } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', starterIds)
  const starterMap = new Map((starters ?? []).map((s) => [s.id, s]))

  // 4. Fetch leg counts + first leg content per relay
  const { data: legs } = await supabase
    .from('relay_legs')
    .select('relay_id, leg_number, content')
    .in('relay_id', relayIds)
    .order('leg_number', { ascending: true })

  const legCountMap = new Map<string, number>()
  const firstLegMap = new Map<string, string>()
  for (const leg of legs ?? []) {
    legCountMap.set(leg.relay_id, (legCountMap.get(leg.relay_id) ?? 0) + 1)
    if (leg.leg_number === 1 && !firstLegMap.has(leg.relay_id)) {
      firstLegMap.set(leg.relay_id, leg.content)
    }
  }

  // 5. Build CategoryRelay rows and group by category
  function toRow(r: (typeof relays)[number]): CategoryRelay {
    const topic = r.topic_id ? topicMap.get(r.topic_id) : null
    const starter = starterMap.get(r.starter_id)
    return {
      id: r.id,
      side: r.side as 'for' | 'against',
      status: r.status as CategoryRelay['status'],
      max_legs: r.max_legs,
      leg_count: legCountMap.get(r.id) ?? 0,
      vote_compelling: r.vote_compelling ?? 0,
      vote_not_compelling: r.vote_not_compelling ?? 0,
      created_at: r.created_at,
      completed_at: r.completed_at ?? null,
      topic_id: r.topic_id ?? null,
      topic_statement: topic?.statement ?? null,
      starter_username: starter?.username ?? 'anon',
      starter_display_name: starter?.display_name ?? null,
      starter_avatar_url: starter?.avatar_url ?? null,
      first_leg_content: firstLegMap.get(r.id) ?? null,
    }
  }

  // Group relays by category
  const relaysByCategory = new Map<string, (typeof relays)[number][]>()
  for (const r of relays) {
    const topic = r.topic_id ? topicMap.get(r.topic_id) : null
    const cat = topic?.category ?? null
    if (!cat) continue
    const arr = relaysByCategory.get(cat) ?? []
    arr.push(r)
    relaysByCategory.set(cat, arr)
  }

  // 6. Assemble category summaries
  const categories: RelayCategoryData[] = CATEGORIES.map((name) => {
    const catRelays = relaysByCategory.get(name) ?? []
    const forRelays = catRelays.filter((r) => r.side === 'for')
    const againstRelays = catRelays.filter((r) => r.side === 'against')
    const openCount = catRelays.filter((r) => r.status === 'open' || r.status === 'in_progress').length
    const completeCount = catRelays.filter((r) => r.status === 'complete' || r.status === 'voted').length

    // Best FOR relay: completed ones ranked by compelling votes, else most leg progress
    const topForRelay = forRelays.sort((a, b) => {
      const aScore = (a.vote_compelling ?? 0) * 2 + (legCountMap.get(a.id) ?? 0)
      const bScore = (b.vote_compelling ?? 0) * 2 + (legCountMap.get(b.id) ?? 0)
      return bScore - aScore
    })[0] ?? null

    const topAgainstRelay = againstRelays.sort((a, b) => {
      const aScore = (a.vote_compelling ?? 0) * 2 + (legCountMap.get(a.id) ?? 0)
      const bScore = (b.vote_compelling ?? 0) * 2 + (legCountMap.get(b.id) ?? 0)
      return bScore - aScore
    })[0] ?? null

    // 3 most recent relays (any side)
    const recentRelays = catRelays.slice(0, 3)

    return {
      name,
      total: catRelays.length,
      open: openCount,
      complete: completeCount,
      for_count: forRelays.length,
      against_count: againstRelays.length,
      top_for: topForRelay ? toRow(topForRelay) : null,
      top_against: topAgainstRelay ? toRow(topAgainstRelay) : null,
      recent: recentRelays.map(toRow),
    }
  })

  const total_relays = relays.length

  return NextResponse.json({ categories, total_relays } satisfies RelayCategoriesResponse)
}
