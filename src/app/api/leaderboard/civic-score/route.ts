import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CivicScoreEntry {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  civic_index: number          // 0–100 composite
  // Dimensional scores 0–100
  engagement_score: number
  quality_score: number
  influence_score: number
  consistency_score: number
  // Raw stats for tooltips
  total_votes: number
  total_arguments: number
  vote_streak: number
  clout: number
  reputation_score: number
  followers_count: number
  rank: number
}

export interface CivicScoreLeaderboardResponse {
  entries: CivicScoreEntry[]
  platformStats: {
    total_participants: number
    avg_civic_index: number
    top_engagement: number
    top_quality: number
    top_influence: number
  }
}

// ─── Score helpers ────────────────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v))
}

// Engagement: votes (main signal) + daily habit (streak bonus)
// 500 votes = 40 pts; 1000+ = 40; streaks up to 60 days = 20 pts
function engagementScore(total_votes: number, vote_streak: number): number {
  const voteComponent = clamp((total_votes / 1000) * 50, 0, 50)
  const streakComponent = clamp((vote_streak / 60) * 30, 0, 30)
  const habitBonus = total_votes >= 10 ? 20 : total_votes >= 5 ? 10 : 0
  return clamp(voteComponent + streakComponent + habitBonus)
}

// Quality: based on arguments written (a proxy for willingness to debate deeply)
// 10 args = 30 pts; 50 args = 60 pts; 100+ = 80 pts; bonus for high reputation (law authorship)
function qualityScore(total_arguments: number, reputation_score: number): number {
  const argComponent = clamp((total_arguments / 100) * 70, 0, 70)
  // reputation_score includes laws (×50) which reflects deep quality
  const lawBonus = clamp((reputation_score / 2000) * 30, 0, 30)
  return clamp(argComponent + lawBonus)
}

// Influence: clout (community-granted) + followers
function influenceScore(clout: number, followers_count: number): number {
  const cloutComponent = clamp((clout / 5000) * 60, 0, 60)
  const followersComponent = clamp((followers_count / 200) * 40, 0, 40)
  return clamp(cloutComponent + followersComponent)
}

// Consistency: vote_streak primary; total_votes secondary (shows ongoing commitment)
function consistencyScore(vote_streak: number, total_votes: number): number {
  const streakComponent = clamp((vote_streak / 30) * 60, 0, 60)
  const volumeComponent = clamp((total_votes / 500) * 40, 0, 40)
  return clamp(streakComponent + volumeComponent)
}

// Composite: weighted average of all four dimensions
function civicIndex(eng: number, qual: number, inf: number, cons: number): number {
  return clamp(Math.round(eng * 0.30 + qual * 0.25 + inf * 0.25 + cons * 0.20))
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  // Fetch top 200 by reputation_score as a first-pass filter
  const { data: raw, error } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, role, clout, reputation_score, total_votes, total_arguments, vote_streak, followers_count'
    )
    .gt('total_votes', 0)
    .order('reputation_score', { ascending: false })
    .limit(200)

  if (error || !raw) {
    return NextResponse.json({ error: 'Failed to load profiles' }, { status: 500 })
  }

  // Score every profile
  type RawRow = typeof raw[number]
  const scored = raw.map((p: RawRow) => {
    const eng  = engagementScore(p.total_votes ?? 0, p.vote_streak ?? 0)
    const qual = qualityScore(p.total_arguments ?? 0, p.reputation_score ?? 0)
    const inf  = influenceScore(p.clout ?? 0, p.followers_count ?? 0)
    const cons = consistencyScore(p.vote_streak ?? 0, p.total_votes ?? 0)
    return {
      user_id: p.id,
      username: p.username,
      display_name: p.display_name ?? null,
      avatar_url: p.avatar_url ?? null,
      role: p.role,
      civic_index: civicIndex(eng, qual, inf, cons),
      engagement_score: Math.round(eng),
      quality_score: Math.round(qual),
      influence_score: Math.round(inf),
      consistency_score: Math.round(cons),
      total_votes: p.total_votes ?? 0,
      total_arguments: p.total_arguments ?? 0,
      vote_streak: p.vote_streak ?? 0,
      clout: p.clout ?? 0,
      reputation_score: p.reputation_score ?? 0,
      followers_count: p.followers_count ?? 0,
    }
  })

  // Sort by civic_index descending, then by clout as tiebreaker
  scored.sort((a, b) =>
    b.civic_index !== a.civic_index
      ? b.civic_index - a.civic_index
      : b.clout - a.clout
  )

  // Top 100 with ranks
  const entries: CivicScoreEntry[] = scored.slice(0, 100).map((p, i) => ({
    ...p,
    rank: i + 1,
  }))

  // Platform aggregates
  const total = scored.length
  const avgIndex = total > 0
    ? Math.round(scored.reduce((s, p) => s + p.civic_index, 0) / total)
    : 0
  const topEng  = Math.max(0, ...scored.slice(0, 10).map((p) => p.engagement_score))
  const topQual = Math.max(0, ...scored.slice(0, 10).map((p) => p.quality_score))
  const topInf  = Math.max(0, ...scored.slice(0, 10).map((p) => p.influence_score))

  return NextResponse.json({
    entries,
    platformStats: {
      total_participants: total,
      avg_civic_index: avgIndex,
      top_engagement: topEng,
      top_quality: topQual,
      top_influence: topInf,
    },
  } satisfies CivicScoreLeaderboardResponse)
}
