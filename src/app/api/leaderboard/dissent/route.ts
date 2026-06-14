import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type DissentTier = 'iconoclast' | 'rebel' | 'challenger' | 'skeptic' | 'observer'

export interface DissentEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  // Core dissent stats
  minority_votes: number      // votes cast on losing side of resolved topics
  total_resolved_votes: number
  dissent_rate: number        // minority_votes / total_resolved_votes (0–1)
  // Argument quality bonus
  minority_arguments: number  // arguments posted on losing-side positions
  minority_upvotes: number    // upvotes received on those arguments
  // Composite score
  dissent_score: number
  tier: DissentTier
}

export interface DissentMyStats {
  minority_votes: number
  total_resolved_votes: number
  dissent_rate: number
  minority_arguments: number
  minority_upvotes: number
  dissent_score: number
  tier: DissentTier
  rank: number | null
}

export interface DissentLeaderboardResponse {
  entries: DissentEntry[]
  total_eligible: number
  my_stats: DissentMyStats | null
  generated_at: string
}

// ─── Tier assignment ──────────────────────────────────────────────────────────

function getTier(score: number): DissentTier {
  if (score >= 200) return 'iconoclast'
  if (score >= 80)  return 'rebel'
  if (score >= 25)  return 'challenger'
  if (score >= 8)   return 'skeptic'
  return 'observer'
}

// ─── Score formula ────────────────────────────────────────────────────────────
// dissent_score = minority_votes × dissent_rate_multiplier + (minority_arguments × 3) + (minority_upvotes × 1)
// dissent_rate_multiplier = 1 + dissent_rate (so chronic contrarians get a bonus)
// Minimum 5 resolved votes to appear on the board.

const MIN_RESOLVED_VOTES = 5

function calcScore(
  minority_votes: number,
  dissent_rate: number,
  minority_arguments: number,
  minority_upvotes: number
): number {
  return (
    minority_votes * (1 + dissent_rate) +
    minority_arguments * 3 +
    minority_upvotes
  )
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // ── 1. Fetch all votes on resolved topics ──────────────────────────────────
  // A "minority vote" = voted FOR on a topic that FAILED, or voted AGAINST on a topic that became LAW.
  const { data: voteRows, error: voteError } = await supabase
    .from('votes')
    .select('user_id, side, topic:topics!inner(status)')
    .in('topics.status', ['law', 'failed'])

  if (voteError) {
    return NextResponse.json({ error: voteError.message }, { status: 500 })
  }

  // ── 2. Fetch arguments on resolved topics (minority side only) ─────────────
  const { data: argRows, error: argError } = await supabase
    .from('topic_arguments')
    .select('author_id, side, upvotes, topic:topics!inner(status)')
    .in('topics.status', ['law', 'failed'])

  if (argError) {
    return NextResponse.json({ error: argError.message }, { status: 500 })
  }

  // ── 3. Aggregate per user ──────────────────────────────────────────────────

  interface UserAgg {
    minority_votes: number
    total_resolved: number
    minority_args: number
    minority_upvotes: number
  }

  const agg = new Map<string, UserAgg>()

  for (const row of (voteRows ?? []) as unknown as {
    user_id: string
    side: string
    topic: { status: string }
  }[]) {
    const { user_id, side, topic } = row
    if (!user_id || !topic) continue

    const isMinority =
      (side === 'blue' && topic.status === 'failed') ||
      (side === 'red'  && topic.status === 'law')

    if (!agg.has(user_id)) {
      agg.set(user_id, { minority_votes: 0, total_resolved: 0, minority_args: 0, minority_upvotes: 0 })
    }
    const a = agg.get(user_id)!
    a.total_resolved += 1
    if (isMinority) a.minority_votes += 1
  }

  for (const row of (argRows ?? []) as unknown as {
    author_id: string
    side: string
    upvotes: number
    topic: { status: string }
  }[]) {
    const { author_id, side, upvotes, topic } = row
    if (!author_id || !topic) continue

    const isMinority =
      (side === 'blue' && topic.status === 'failed') ||
      (side === 'red'  && topic.status === 'law')

    if (!isMinority) continue

    if (!agg.has(author_id)) {
      agg.set(author_id, { minority_votes: 0, total_resolved: 0, minority_args: 0, minority_upvotes: 0 })
    }
    const a = agg.get(author_id)!
    a.minority_args += 1
    a.minority_upvotes += (upvotes ?? 0)
  }

  // ── 4. Filter, score, sort ─────────────────────────────────────────────────

  interface ScoredEntry {
    user_id: string
    minority_votes: number
    total_resolved: number
    dissent_rate: number
    minority_args: number
    minority_upvotes: number
    dissent_score: number
  }

  const scored: ScoredEntry[] = []

  for (const [uid, a] of agg.entries()) {
    if (a.total_resolved < MIN_RESOLVED_VOTES) continue
    if (a.minority_votes === 0 && a.minority_args === 0) continue

    const dissent_rate = a.minority_votes / a.total_resolved
    const score = calcScore(a.minority_votes, dissent_rate, a.minority_args, a.minority_upvotes)
    if (score < 1) continue

    scored.push({
      user_id: uid,
      minority_votes: a.minority_votes,
      total_resolved: a.total_resolved,
      dissent_rate,
      minority_args: a.minority_args,
      minority_upvotes: a.minority_upvotes,
      dissent_score: Math.round(score * 10) / 10,
    })
  }

  scored.sort((a, b) => b.dissent_score - a.dissent_score)

  const total_eligible = scored.length
  const top = scored.slice(0, 50)

  // ── 5. Fetch profile data for top entries ─────────────────────────────────

  const userIds = top.map((e) => e.user_id)
  const profileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null; role: string; clout: number }>()

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', userIds)

    for (const p of (profiles ?? [])) {
      profileMap.set(p.id, p)
    }
  }

  // ── 6. Build response entries ──────────────────────────────────────────────

  const entries: DissentEntry[] = top
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
        clout: profile.clout,
        minority_votes: e.minority_votes,
        total_resolved_votes: e.total_resolved,
        dissent_rate: Math.round(e.dissent_rate * 1000) / 10, // pct with 1dp
        minority_arguments: e.minority_args,
        minority_upvotes: e.minority_upvotes,
        dissent_score: e.dissent_score,
        tier: getTier(e.dissent_score),
      } satisfies DissentEntry
    })
    .filter((e): e is DissentEntry => e !== null)

  // ── 7. Personal stats ──────────────────────────────────────────────────────

  let my_stats: DissentMyStats | null = null

  if (user) {
    const myAgg = agg.get(user.id)
    if (myAgg && myAgg.total_resolved >= MIN_RESOLVED_VOTES) {
      const dissent_rate = myAgg.minority_votes / myAgg.total_resolved
      const score = calcScore(myAgg.minority_votes, dissent_rate, myAgg.minority_args, myAgg.minority_upvotes)
      const rank_idx = scored.findIndex((e) => e.user_id === user.id)
      my_stats = {
        minority_votes: myAgg.minority_votes,
        total_resolved_votes: myAgg.total_resolved,
        dissent_rate: Math.round(dissent_rate * 1000) / 10,
        minority_arguments: myAgg.minority_args,
        minority_upvotes: myAgg.minority_upvotes,
        dissent_score: Math.round(score * 10) / 10,
        tier: getTier(score),
        rank: rank_idx >= 0 ? rank_idx + 1 : null,
      }
    }
  }

  return NextResponse.json({
    entries,
    total_eligible,
    my_stats,
    generated_at: new Date().toISOString(),
  } satisfies DissentLeaderboardResponse)
}
