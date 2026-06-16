import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type DepthTier = 'scholar' | 'analyst' | 'researcher' | 'seeker'

export interface DepthLeaderEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  // Component scores
  scored_args: number          // arguments with an AI score
  avg_ai_score: number         // average AI score (1-10), weighted by upvotes
  citation_rate: number        // % of arguments with source URLs (0-100)
  evidence_count: number       // number of evidence submissions
  wiki_edits: number           // number of wiki contributions
  // Composite
  depth_score: number
  tier: DepthTier
}

export interface DepthMyStats {
  scored_args: number
  avg_ai_score: number
  citation_rate: number
  evidence_count: number
  wiki_edits: number
  depth_score: number
  tier: DepthTier
  rank: number | null
}

export interface DepthLeaderboardResponse {
  entries: DepthLeaderEntry[]
  total_participants: number
  platform_scored_args: number
  platform_avg_score: number
  my_stats: DepthMyStats | null
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTier(score: number): DepthTier {
  if (score >= 80) return 'scholar'
  if (score >= 40) return 'analyst'
  if (score >= 15) return 'researcher'
  return 'seeker'
}

/**
 * Compute depth_score from component metrics.
 *
 * - avg_ai_score (1–10):   scaled to 0–40 pts  (40% weight)
 * - citation_rate (0–100): scaled to 0–20 pts  (20% weight)
 * - evidence_count:        capped at 15, scaled to 0–20 pts (20% weight)
 * - wiki_edits:            capped at 20, scaled to 0–20 pts (20% weight)
 */
function calcDepthScore(
  avg_ai_score: number,
  citation_rate: number,
  evidence_count: number,
  wiki_edits: number,
  scored_args: number,
): number {
  // Must have at least 1 scored argument to earn quality points
  const qualityPts  = scored_args > 0 ? ((avg_ai_score / 10) * 40) : 0
  const citePts     = (citation_rate / 100) * 20
  const evidencePts = (Math.min(evidence_count, 15) / 15) * 20
  const wikiPts     = (Math.min(wiki_edits, 20) / 20) * 20

  return Math.round(qualityPts + citePts + evidencePts + wikiPts)
}

// ─── GET /api/leaderboard/depth ───────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // ── 1. Argument quality stats per user ──────────────────────────────────────
  // Fetch all arguments that have an AI score, grouped in memory
  const { data: scoredArgs } = await supabase
    .from('topic_arguments')
    .select('user_id, ai_score, upvotes')
    .not('ai_score', 'is', null)
    .gte('ai_score', 1)

  // Fetch all arguments to compute citation rate
  const { data: allArgs } = await supabase
    .from('topic_arguments')
    .select('user_id, source_url')

  // ── 2. Evidence submissions per user ────────────────────────────────────────
  const { data: evidenceRows } = await supabase
    .from('topic_evidence')
    .select('user_id')

  // ── 3. Wiki edits per user ──────────────────────────────────────────────────
  const { data: wikiRows } = await supabase
    .from('topic_wiki_history')
    .select('editor_id')
    .not('editor_id', 'is', null)

  // ── 4. Aggregate in memory ───────────────────────────────────────────────────

  // Weighted average AI score per user
  const qualityMap = new Map<string, { scoreSum: number; weightSum: number; count: number }>()
  for (const row of scoredArgs ?? []) {
    if (!row.user_id) continue
    const weight = Math.max(1, row.upvotes ?? 1)
    const prev = qualityMap.get(row.user_id) ?? { scoreSum: 0, weightSum: 0, count: 0 }
    qualityMap.set(row.user_id, {
      scoreSum:   prev.scoreSum  + (row.ai_score ?? 0) * weight,
      weightSum:  prev.weightSum + weight,
      count:      prev.count + 1,
    })
  }

  // Citation rate per user
  const argCounts  = new Map<string, number>()   // total args
  const citedCounts = new Map<string, number>()  // cited args
  for (const row of allArgs ?? []) {
    if (!row.user_id) continue
    argCounts.set(row.user_id, (argCounts.get(row.user_id) ?? 0) + 1)
    if (row.source_url) {
      citedCounts.set(row.user_id, (citedCounts.get(row.user_id) ?? 0) + 1)
    }
  }

  // Evidence count per user
  const evidenceMap = new Map<string, number>()
  for (const row of evidenceRows ?? []) {
    if (!row.user_id) continue
    evidenceMap.set(row.user_id, (evidenceMap.get(row.user_id) ?? 0) + 1)
  }

  // Wiki edits per user
  const wikiMap = new Map<string, number>()
  for (const row of wikiRows ?? []) {
    if (!row.editor_id) continue
    evidenceMap.set(row.editor_id, evidenceMap.get(row.editor_id) ?? 0) // ensure key exists
    wikiMap.set(row.editor_id, (wikiMap.get(row.editor_id) ?? 0) + 1)
  }

  // Collect all user IDs that have any depth signals
  const allUserIds = new Set<string>([
    ...qualityMap.keys(),
    ...evidenceMap.keys(),
    ...wikiMap.keys(),
  ])

  // Compute depth scores for all users
  interface UserDepthRaw {
    user_id: string
    scored_args: number
    avg_ai_score: number
    citation_rate: number
    evidence_count: number
    wiki_edits: number
    depth_score: number
  }

  const userScores: UserDepthRaw[] = []
  for (const uid of allUserIds) {
    const qual = qualityMap.get(uid)
    const totalArgs = argCounts.get(uid) ?? 0
    const cited     = citedCounts.get(uid) ?? 0
    const evidence  = evidenceMap.get(uid) ?? 0
    const wiki      = wikiMap.get(uid) ?? 0

    const scored_args   = qual?.count ?? 0
    const avg_ai_score  = qual && qual.weightSum > 0 ? qual.scoreSum / qual.weightSum : 0
    const citation_rate = totalArgs > 0 ? Math.round((cited / totalArgs) * 100) : 0

    const depth_score = calcDepthScore(avg_ai_score, citation_rate, evidence, wiki, scored_args)
    if (depth_score < 1) continue // exclude users with no depth signal

    userScores.push({
      user_id: uid,
      scored_args,
      avg_ai_score: parseFloat(avg_ai_score.toFixed(2)),
      citation_rate,
      evidence_count: evidence,
      wiki_edits:     wiki,
      depth_score,
    })
  }

  // Sort by depth score descending
  userScores.sort((a, b) => b.depth_score - a.depth_score)

  // Take top 100
  const top100 = userScores.slice(0, 100)

  if (top100.length === 0) {
    return NextResponse.json<DepthLeaderboardResponse>({
      entries: [],
      total_participants: 0,
      platform_scored_args: scoredArgs?.length ?? 0,
      platform_avg_score: 0,
      my_stats: null,
      generated_at: new Date().toISOString(),
    })
  }

  // ── 5. Fetch profiles for top 100 ────────────────────────────────────────────
  const topIds = top100.map((u) => u.user_id)

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout')
    .in('id', topIds)

  const profileMap = new Map(
    (profileRows ?? []).map((p) => [p.id, p]),
  )

  const entries: DepthLeaderEntry[] = top100
    .map((u, idx) => {
      const profile = profileMap.get(u.user_id)
      if (!profile) return null
      return {
        rank:          idx + 1,
        user_id:       u.user_id,
        username:      profile.username,
        display_name:  profile.display_name,
        avatar_url:    profile.avatar_url,
        role:          profile.role,
        clout:         profile.clout ?? 0,
        scored_args:   u.scored_args,
        avg_ai_score:  u.avg_ai_score,
        citation_rate: u.citation_rate,
        evidence_count: u.evidence_count,
        wiki_edits:    u.wiki_edits,
        depth_score:   u.depth_score,
        tier:          getTier(u.depth_score),
      } satisfies DepthLeaderEntry
    })
    .filter((e): e is DepthLeaderEntry => e !== null)

  // ── 6. My stats (if logged in) ────────────────────────────────────────────────
  let my_stats: DepthMyStats | null = null
  if (user) {
    const myData = userScores.find((u) => u.user_id === user.id)
    if (myData) {
      const myRank = userScores.findIndex((u) => u.user_id === user.id) + 1
      my_stats = {
        ...myData,
        tier: getTier(myData.depth_score),
        rank: myRank,
      }
    } else {
      my_stats = {
        scored_args:   0,
        avg_ai_score:  0,
        citation_rate: 0,
        evidence_count: 0,
        wiki_edits:    0,
        depth_score:   0,
        tier:          'seeker',
        rank:          null,
      }
    }
  }

  // ── 7. Platform stats ──────────────────────────────────────────────────────────
  const totalScored = scoredArgs?.length ?? 0
  const platformAvg =
    totalScored > 0
      ? parseFloat(
          (
            (scoredArgs ?? []).reduce((s, r) => s + (r.ai_score ?? 0), 0) / totalScored
          ).toFixed(2),
        )
      : 0

  return NextResponse.json<DepthLeaderboardResponse>({
    entries,
    total_participants: userScores.length,
    platform_scored_args: totalScored,
    platform_avg_score: platformAvg,
    my_stats,
    generated_at: new Date().toISOString(),
  })
}
