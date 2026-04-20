import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArenaCoalition {
  id: string
  name: string
  description: string | null
  member_count: number
  max_members: number
  coalition_influence: number
  wins: number
  losses: number
  is_public: boolean
  created_at: string
}

export interface BattleTopic {
  topic_id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  stance_a: 'for' | 'against' | 'neutral'
  stance_b: 'for' | 'against' | 'neutral'
  statement_a: string | null
  statement_b: string | null
  // who won this topic (if resolved)
  outcome: 'a_wins' | 'b_wins' | 'both_win' | 'both_lose' | 'draw' | 'pending'
  aligned: boolean
}

export interface ArenaBattleStats {
  shared_topics: number
  contested_topics: number   // A and B have opposing stances
  aligned_topics: number     // A and B have the same stance
  a_wins: number             // A's stance matched outcome, B's didn't
  b_wins: number
  both_win: number           // aligned + outcome matched both
  both_lose: number          // aligned + outcome matched neither
  a_win_rate: number | null  // on contested topics only
  b_win_rate: number | null
}

export interface ArenaResponse {
  coalition_a: ArenaCoalition
  coalition_b: ArenaCoalition
  topics: BattleTopic[]
  stats: ArenaBattleStats
}

export interface ArenaSearchResult {
  id: string
  name: string
  description: string | null
  member_count: number
  coalition_influence: number
  wins: number
  losses: number
}

export interface ArenaSearchResponse {
  results: ArenaSearchResult[]
}

// ─── Route handlers ───────────────────────────────────────────────────────────

// GET /api/arena?a=<id>&b=<id>   → battle data
// GET /api/arena?search=<query>  → coalition search
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const url = new URL(request.url)

  // ── Search mode ─────────────────────────────────────────────────────────────
  const q = url.searchParams.get('search')?.trim()
  if (q !== null && q !== undefined) {
    const { data, error } = await supabase
      .from('coalitions')
      .select('id, name, description, member_count, coalition_influence, wins, losses')
      .eq('is_public', true)
      .ilike('name', `%${q}%`)
      .order('coalition_influence', { ascending: false })
      .limit(12)

    if (error) {
      return NextResponse.json({ results: [] })
    }

    return NextResponse.json({ results: data ?? [] } satisfies ArenaSearchResponse)
  }

  // ── Battle mode ──────────────────────────────────────────────────────────────
  const idA = url.searchParams.get('a')?.trim()
  const idB = url.searchParams.get('b')?.trim()

  if (!idA || !idB) {
    return NextResponse.json({ error: 'Provide ?a=<id>&b=<id>' }, { status: 400 })
  }

  if (idA === idB) {
    return NextResponse.json({ error: 'Cannot battle a coalition against itself' }, { status: 400 })
  }

  // Fetch both coalitions in parallel
  const [resA, resB] = await Promise.all([
    supabase
      .from('coalitions')
      .select('id, name, description, member_count, max_members, coalition_influence, wins, losses, is_public, created_at')
      .eq('id', idA)
      .eq('is_public', true)
      .maybeSingle(),
    supabase
      .from('coalitions')
      .select('id, name, description, member_count, max_members, coalition_influence, wins, losses, is_public, created_at')
      .eq('id', idB)
      .eq('is_public', true)
      .maybeSingle(),
  ])

  if (!resA.data || !resB.data) {
    return NextResponse.json({ error: 'One or both coalitions not found' }, { status: 404 })
  }

  const coalitionA = resA.data as ArenaCoalition
  const coalitionB = resB.data as ArenaCoalition

  // Fetch stances for both coalitions (without join to avoid type inference issues)
  const [stancesA, stancesB] = await Promise.all([
    supabase
      .from('coalition_stances')
      .select('topic_id, stance, statement')
      .eq('coalition_id', idA),
    supabase
      .from('coalition_stances')
      .select('topic_id, stance, statement')
      .eq('coalition_id', idB),
  ])

  type RawStance = { topic_id: string; stance: string; statement: string | null }
  const stancesAData = (stancesA.data ?? []) as RawStance[]
  const stancesBData = (stancesB.data ?? []) as RawStance[]

  // Find intersection of topic IDs
  const bTopicIdSet = new Set(stancesBData.map((s) => s.topic_id))
  const sharedIds = stancesAData.map((s) => s.topic_id).filter((id) => bTopicIdSet.has(id))

  // Build lookup maps
  const aStanceMap = new Map<string, RawStance>()
  for (const s of stancesAData) aStanceMap.set(s.topic_id, s)
  const bStanceMap = new Map<string, RawStance>()
  for (const s of stancesBData) bStanceMap.set(s.topic_id, s)

  // Fetch topic details for shared topics
  interface TopicRow {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  const topicRows: TopicRow[] = []
  if (sharedIds.length > 0) {
    const { data: tData } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', sharedIds)
      .limit(100)
    if (tData) topicRows.push(...(tData as TopicRow[]))
  }

  const topicMap = new Map(topicRows.map((t) => [t.id, t]))

  // Find shared topics (where A has a stance AND B has a stance)
  const sharedTopics: BattleTopic[] = []

  for (const topicId of sharedIds) {
    const sa = aStanceMap.get(topicId)
    const sbEntry = bStanceMap.get(topicId)
    const topicInfo = topicMap.get(topicId)
    if (!sa || !sbEntry || !topicInfo) continue
    const stanceA = sa.stance as 'for' | 'against' | 'neutral'
    const stanceB = sbEntry.stance as 'for' | 'against' | 'neutral'
    const aligned = stanceA === stanceB

    // Determine outcome based on topic status
    let outcome: BattleTopic['outcome'] = 'pending'
    if (topicInfo.status === 'law') {
      // FOR won — topic became law
      const aCorrect = stanceA === 'for'
      const bCorrect = stanceB === 'for'
      if (aCorrect && bCorrect) outcome = 'both_win'
      else if (!aCorrect && !bCorrect) outcome = 'both_lose'
      else if (aCorrect && !bCorrect) outcome = 'a_wins'
      else outcome = 'b_wins'
    } else if (topicInfo.status === 'failed') {
      // AGAINST won — topic failed
      const aCorrect = stanceA === 'against'
      const bCorrect = stanceB === 'against'
      if (aCorrect && bCorrect) outcome = 'both_win'
      else if (!aCorrect && !bCorrect) outcome = 'both_lose'
      else if (aCorrect && !bCorrect) outcome = 'a_wins'
      else outcome = 'b_wins'
    } else if (stanceA !== 'neutral' && stanceB !== 'neutral' && stanceA !== stanceB) {
      // Unresolved but opposing — draw for now
      outcome = 'draw'
    }

    sharedTopics.push({
      topic_id: topicInfo.id,
      statement: topicInfo.statement,
      category: topicInfo.category,
      status: topicInfo.status,
      blue_pct: topicInfo.blue_pct,
      total_votes: topicInfo.total_votes,
      stance_a: stanceA,
      stance_b: stanceB,
      statement_a: sa.statement,
      statement_b: sbEntry.statement,
      outcome,
      aligned,
    })
  }

  // Sort: contested resolved first, then contested pending, then aligned
  sharedTopics.sort((a, b) => {
    const resolvedA = a.status === 'law' || a.status === 'failed' ? 0 : 1
    const resolvedB = b.status === 'law' || b.status === 'failed' ? 0 : 1
    if (resolvedA !== resolvedB) return resolvedA - resolvedB
    const contestedA = !a.aligned ? 0 : 1
    const contestedB = !b.aligned ? 0 : 1
    return contestedA - contestedB
  })

  // Compute stats
  const contested = sharedTopics.filter((t) => !t.aligned && t.stance_a !== 'neutral' && t.stance_b !== 'neutral')
  const aligned = sharedTopics.filter((t) => t.aligned)
  const a_wins = sharedTopics.filter((t) => t.outcome === 'a_wins').length
  const b_wins = sharedTopics.filter((t) => t.outcome === 'b_wins').length
  const both_win = sharedTopics.filter((t) => t.outcome === 'both_win').length
  const both_lose = sharedTopics.filter((t) => t.outcome === 'both_lose').length

  const resolvedContested = contested.filter(
    (t) => t.outcome === 'a_wins' || t.outcome === 'b_wins'
  ).length

  const stats: ArenaBattleStats = {
    shared_topics: sharedTopics.length,
    contested_topics: contested.length,
    aligned_topics: aligned.length,
    a_wins,
    b_wins,
    both_win,
    both_lose,
    a_win_rate: resolvedContested > 0 ? Math.round((a_wins / resolvedContested) * 100) : null,
    b_win_rate: resolvedContested > 0 ? Math.round((b_wins / resolvedContested) * 100) : null,
  }

  return NextResponse.json({
    coalition_a: coalitionA,
    coalition_b: coalitionB,
    topics: sharedTopics,
    stats,
  } satisfies ArenaResponse)
}
