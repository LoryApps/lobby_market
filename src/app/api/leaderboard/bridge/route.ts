import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type BridgeTier =
  | 'unifier'
  | 'consensus_seeker'
  | 'bridge_builder'
  | 'occasional_bridge'
  | 'partisan'

export interface BridgeLeaderEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  bridge_votes: number
  total_eligible_votes: number
  bridge_rate: number        // 0-100: % of votes that crossed own lean
  categories_bridged: number // distinct categories where they bridged
  best_bridge_category: string | null
  bridge_score: number
  tier: BridgeTier
}

export interface BridgeMyStats {
  bridge_votes: number
  total_eligible_votes: number
  bridge_rate: number
  categories_bridged: number
  bridge_score: number
  tier: BridgeTier
  rank: number | null
}

export interface BridgeLeaderboardResponse {
  entries: BridgeLeaderEntry[]
  total_eligible: number
  my_stats: BridgeMyStats | null
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

// User must have voted at least this many times to appear
const MIN_TOTAL_VOTES = 5
// User must have voted in at least this many categories to qualify
const MIN_CATEGORIES = 2
// User's lean in a category must be this many % above/below 50 to count as a "lean"
// If someone votes 55% FOR, that's not a clear lean — we need a stronger signal
const LEAN_THRESHOLD = 15
// Score formula: bridge_votes × (1 + bridge_rate) + categories_bridged × 2
// bridge_rate here is the 0-1 fraction, not 0-100

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTier(score: number): BridgeTier {
  if (score >= 35) return 'unifier'
  if (score >= 18) return 'consensus_seeker'
  if (score >= 8)  return 'bridge_builder'
  if (score >= 3)  return 'occasional_bridge'
  return 'partisan'
}

function calcScore(
  bridge_votes: number,
  bridge_rate_fraction: number,
  categories_bridged: number,
): number {
  return Math.round(
    (bridge_votes * (1 + bridge_rate_fraction) + categories_bridged * 2) * 10,
  ) / 10
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // ── 1. Fetch all votes with topic category ────────────────────────────────
  // Limit to topics that have a category defined for meaningful analysis
  const { data: voteRows, error: voteErr } = await supabase
    .from('votes')
    .select('user_id, topic_id, side')
    .limit(50000) // safety cap

  if (voteErr || !voteRows || voteRows.length === 0) {
    return NextResponse.json({
      entries: [],
      total_eligible: 0,
      my_stats: null,
      generated_at: new Date().toISOString(),
    } satisfies BridgeLeaderboardResponse)
  }

  // ── 2. Fetch topic categories ─────────────────────────────────────────────
  const topicIds = [...new Set(voteRows.map((v) => v.topic_id))]

  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, category')
    .in('id', topicIds)

  if (!topicRows || topicRows.length === 0) {
    return NextResponse.json({
      entries: [],
      total_eligible: 0,
      my_stats: null,
      generated_at: new Date().toISOString(),
    } satisfies BridgeLeaderboardResponse)
  }

  // Build fast lookup: topicId → category
  const topicCatMap = new Map<string, string>()
  for (const t of topicRows) {
    if (t.category) topicCatMap.set(t.id, t.category)
  }

  // ── 3. Compute per-user per-category aggregates (pass 1) ─────────────────
  // userCatMap[userId][category] = { forVotes, total }
  type CatAgg = { forVotes: number; total: number }
  const userCatMap = new Map<string, Map<string, CatAgg>>()

  for (const vote of voteRows) {
    const cat = topicCatMap.get(vote.topic_id)
    if (!cat) continue

    let catMap = userCatMap.get(vote.user_id)
    if (!catMap) {
      catMap = new Map()
      userCatMap.set(vote.user_id, catMap)
    }
    const agg = catMap.get(cat) ?? { forVotes: 0, total: 0 }
    agg.total++
    if (vote.side === 'blue') agg.forVotes++
    catMap.set(cat, agg)
  }

  // ── 4. Count bridge votes per user (pass 2) ───────────────────────────────
  // A "bridge vote" = user voted AGAINST their established lean in that category
  // We only count if the user has a clear lean (≥15% from 50/50)

  type UserBridgeAgg = {
    bridge_votes: number
    total_eligible: number       // votes in categories where user has a clear lean
    bridged_cats: Set<string>    // categories where bridge happened
    cat_bridge_counts: Map<string, number>
  }
  const bridgeMap = new Map<string, UserBridgeAgg>()

  for (const vote of voteRows) {
    const cat = topicCatMap.get(vote.topic_id)
    if (!cat) continue

    const catMap = userCatMap.get(vote.user_id)
    if (!catMap) continue

    const catAgg = catMap.get(cat)
    if (!catAgg || catAgg.total < 3) continue // need at least 3 votes to establish a lean

    const leanPct = (catAgg.forVotes / catAgg.total) * 100
    const hasForLean  = leanPct >= 50 + LEAN_THRESHOLD  // e.g. votes ≥65% FOR
    const hasAgainstLean = leanPct <= 50 - LEAN_THRESHOLD  // e.g. votes ≤35% FOR

    if (!hasForLean && !hasAgainstLean) continue // no clear lean, skip

    let agg = bridgeMap.get(vote.user_id)
    if (!agg) {
      agg = {
        bridge_votes: 0,
        total_eligible: 0,
        bridged_cats: new Set(),
        cat_bridge_counts: new Map(),
      }
      bridgeMap.set(vote.user_id, agg)
    }

    agg.total_eligible++

    // Is this a bridge vote?
    const isBridge =
      (hasForLean && vote.side === 'red') ||    // usually FOR but voted AGAINST
      (hasAgainstLean && vote.side === 'blue')   // usually AGAINST but voted FOR

    if (isBridge) {
      agg.bridge_votes++
      agg.bridged_cats.add(cat)
      agg.cat_bridge_counts.set(cat, (agg.cat_bridge_counts.get(cat) ?? 0) + 1)
    }
  }

  // ── 5. Filter, score, sort ────────────────────────────────────────────────
  type ScoredEntry = {
    user_id: string
    bridge_votes: number
    total_eligible: number
    bridge_rate: number  // 0-1
    categories_bridged: number
    best_bridge_category: string | null
    bridge_score: number
  }

  const scored: ScoredEntry[] = []

  for (const [uid, agg] of bridgeMap.entries()) {
    const catMap = userCatMap.get(uid)
    if (!catMap) continue

    const totalVotes = Array.from(catMap.values()).reduce((s, c) => s + c.total, 0)
    if (totalVotes < MIN_TOTAL_VOTES) continue
    if (catMap.size < MIN_CATEGORIES) continue
    if (agg.bridge_votes === 0) continue

    const bridge_rate = agg.total_eligible > 0 ? agg.bridge_votes / agg.total_eligible : 0
    const categories_bridged = agg.bridged_cats.size

    // Best bridge category = where they crossed the most times
    let best_bridge_category: string | null = null
    let bestCount = 0
    for (const [cat, count] of agg.cat_bridge_counts.entries()) {
      if (count > bestCount) {
        bestCount = count
        best_bridge_category = cat
      }
    }

    const bridge_score = calcScore(agg.bridge_votes, bridge_rate, categories_bridged)
    if (bridge_score < 1) continue

    scored.push({
      user_id: uid,
      bridge_votes: agg.bridge_votes,
      total_eligible: agg.total_eligible,
      bridge_rate,
      categories_bridged,
      best_bridge_category,
      bridge_score,
    })
  }

  scored.sort((a, b) => b.bridge_score - a.bridge_score)

  const total_eligible = scored.length
  const top = scored.slice(0, 50)

  // ── 6. Fetch profiles for top entries ─────────────────────────────────────
  const userIds = top.map((e) => e.user_id)
  const profileMap = new Map<string, {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  }>()

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', userIds)

    for (const p of (profiles ?? [])) {
      profileMap.set(p.id, p)
    }
  }

  // ── 7. Build response entries ──────────────────────────────────────────────
  const entries: BridgeLeaderEntry[] = top
    .map((e, i) => {
      const profile = profileMap.get(e.user_id)
      if (!profile) return null
      return {
        rank: i + 1,
        user_id: e.user_id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        clout: profile.clout ?? 0,
        bridge_votes: e.bridge_votes,
        total_eligible_votes: e.total_eligible,
        bridge_rate: Math.round(e.bridge_rate * 1000) / 10,
        categories_bridged: e.categories_bridged,
        best_bridge_category: e.best_bridge_category,
        bridge_score: e.bridge_score,
        tier: getTier(e.bridge_score),
      } satisfies BridgeLeaderEntry
    })
    .filter((e): e is BridgeLeaderEntry => e !== null)

  // ── 8. Personal stats ──────────────────────────────────────────────────────
  let my_stats: BridgeMyStats | null = null

  if (user) {
    const myIdx = scored.findIndex((e) => e.user_id === user.id)
    const myEntry = scored.find((e) => e.user_id === user.id)

    if (myEntry) {
      my_stats = {
        bridge_votes: myEntry.bridge_votes,
        total_eligible_votes: myEntry.total_eligible,
        bridge_rate: Math.round(myEntry.bridge_rate * 1000) / 10,
        categories_bridged: myEntry.categories_bridged,
        bridge_score: myEntry.bridge_score,
        tier: getTier(myEntry.bridge_score),
        rank: myIdx >= 0 ? myIdx + 1 : null,
      }
    } else {
      // User exists but didn't qualify — give them a zero-stat card
      const catMap = userCatMap.get(user.id)
      const totalVotes = catMap
        ? Array.from(catMap.values()).reduce((s, c) => s + c.total, 0)
        : 0
      if (totalVotes > 0) {
        my_stats = {
          bridge_votes: 0,
          total_eligible_votes: 0,
          bridge_rate: 0,
          categories_bridged: 0,
          bridge_score: 0,
          tier: 'partisan',
          rank: null,
        }
      }
    }
  }

  return NextResponse.json({
    entries,
    total_eligible,
    my_stats,
    generated_at: new Date().toISOString(),
  } satisfies BridgeLeaderboardResponse)
}
