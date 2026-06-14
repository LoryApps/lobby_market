import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImpactEntry {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  civic_archetype: string | null
  // Raw signals
  laws_authored: number
  total_arguments: number
  reputation_score: number
  clout: number
  total_votes: number
  followers_count: number
  // Computed
  impact_score: number
}

export interface ImpactLeaderboardResponse {
  entries: ImpactEntry[]
  total: number
  generated_at: string
}

// ─── Impact formula ───────────────────────────────────────────────────────────
// Laws authored carry the highest weight — actually changing the Codex is
// the highest possible civic impact.  After that: argument quality (reputation),
// clout earned (community endorsement), and follower reach.

function computeImpact(
  lawsAuthored: number,
  totalArguments: number,
  reputationScore: number,
  clout: number,
  followersCount: number,
): number {
  const lawScore  = lawsAuthored    * 250   // Creating laws is king
  const argScore  = Math.min(totalArguments * 3, 300)   // Capped at 300
  const repScore  = Math.min(reputationScore * 0.5, 200) // Capped at 200
  const cloutScore = Math.min(clout * 0.01, 150)         // Capped at 150
  const reachScore = Math.min(followersCount * 2, 100)   // Capped at 100
  return Math.round(lawScore + argScore + repScore + cloutScore + reachScore)
}

// ─── GET /api/leaderboard/impact ─────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // 1. Count laws authored per user
  const { data: lawCounts } = await supabase
    .from('topics')
    .select('created_by')
    .eq('status', 'law')
    .not('created_by', 'is', null)

  const lawMap: Record<string, number> = {}
  for (const row of lawCounts ?? []) {
    if (row.created_by) {
      lawMap[row.created_by] = (lawMap[row.created_by] ?? 0) + 1
    }
  }

  // 2. Fetch top profiles by reputation_score (covers most impact signals)
  const { data: profiles } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, role, civic_archetype, ' +
      'total_arguments, reputation_score, clout, total_votes, followers_count'
    )
    .gt('total_votes', 0)
    .order('reputation_score', { ascending: false })
    .limit(300)

  const rows = profiles ?? []

  // 3. Compute impact scores
  const entries: ImpactEntry[] = rows.map((p) => ({
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    role: p.role,
    civic_archetype: p.civic_archetype,
    laws_authored: lawMap[p.id] ?? 0,
    total_arguments: p.total_arguments ?? 0,
    reputation_score: p.reputation_score ?? 0,
    clout: p.clout ?? 0,
    total_votes: p.total_votes ?? 0,
    followers_count: p.followers_count ?? 0,
    impact_score: computeImpact(
      lawMap[p.id] ?? 0,
      p.total_arguments ?? 0,
      p.reputation_score ?? 0,
      p.clout ?? 0,
      p.followers_count ?? 0,
    ),
  }))

  // 4. Sort by impact_score and keep top 100
  entries.sort((a, b) => b.impact_score - a.impact_score)
  const top = entries.slice(0, 100)

  return NextResponse.json({
    entries: top,
    total: top.length,
    generated_at: new Date().toISOString(),
  } satisfies ImpactLeaderboardResponse)
}
