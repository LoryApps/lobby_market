import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProposalTier = 'architect' | 'visionary' | 'advocate' | 'contributor' | 'newcomer'

export interface ProposalLeaderEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  // Topic counts by status
  total_topics: number
  law_count: number
  voting_count: number
  active_count: number
  failed_count: number
  proposed_count: number
  // Derived metrics
  law_rate: number       // laws / total_topics (0-100)
  avg_votes: number      // average votes attracted per topic
  total_votes_attracted: number
  // Composite score
  proposal_score: number
  tier: ProposalTier
}

export interface ProposalMyStats {
  total_topics: number
  law_count: number
  voting_count: number
  active_count: number
  failed_count: number
  proposed_count: number
  law_rate: number
  avg_votes: number
  total_votes_attracted: number
  proposal_score: number
  tier: ProposalTier
  rank: number | null
}

export interface ProposalPlatformStats {
  total_topics: number
  total_laws: number
  platform_law_rate: number
  avg_votes_per_topic: number
  total_proposers: number
}

export interface ProposalLeaderboardResponse {
  entries: ProposalLeaderEntry[]
  total_participants: number
  platform: ProposalPlatformStats
  my_stats: ProposalMyStats | null
  generated_at: string
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Proposal Score formula:
 *   law     ×15  — laws are the gold standard: consensus was reached
 *   voting  × 5  — reached final vote phase (strong traction)
 *   active  × 2  — gained community engagement
 *   failed  × 1  — still counts: you shipped a proposal
 *   proposed× 0  — pending; doesn't count yet
 *   + (law_rate / 10) bonus — rewards quality over volume
 *   + (avg_votes / 100) bonus — rewards topics that attracted debate
 */
function calcScore(
  law_count: number,
  voting_count: number,
  active_count: number,
  failed_count: number,
  law_rate: number,
  avg_votes: number,
): number {
  const base =
    law_count    * 15 +
    voting_count *  5 +
    active_count *  2 +
    failed_count *  1
  const qualityBonus = law_rate / 10
  const tractionBonus = Math.min(avg_votes / 100, 5) // cap at 5
  return Math.round((base + qualityBonus + tractionBonus) * 10) / 10
}

function getTier(score: number): ProposalTier {
  if (score >= 60) return 'architect'
  if (score >= 25) return 'visionary'
  if (score >= 10) return 'advocate'
  if (score >=  3) return 'contributor'
  return 'newcomer'
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Fetch all topics with author_id, status, and vote count
  const { data: topicRows } = await supabase
    .from('topics')
    .select('author_id, status, total_votes')
    .not('author_id', 'is', null)

  if (!topicRows || topicRows.length === 0) {
    return NextResponse.json<ProposalLeaderboardResponse>({
      entries: [],
      total_participants: 0,
      platform: {
        total_topics: 0,
        total_laws: 0,
        platform_law_rate: 0,
        avg_votes_per_topic: 0,
        total_proposers: 0,
      },
      my_stats: null,
      generated_at: new Date().toISOString(),
    })
  }

  // Aggregate per user
  const userMap = new Map<string, {
    total: number
    law: number
    voting: number
    active: number
    failed: number
    proposed: number
    total_votes: number
  }>()

  for (const t of topicRows) {
    if (!t.author_id) continue
    const existing = userMap.get(t.author_id) ?? {
      total: 0, law: 0, voting: 0, active: 0, failed: 0, proposed: 0, total_votes: 0,
    }
    existing.total++
    existing.total_votes += t.total_votes ?? 0
    switch (t.status) {
      case 'law':      existing.law++;      break
      case 'voting':   existing.voting++;   break
      case 'active':   existing.active++;   break
      case 'failed':   existing.failed++;   break
      case 'proposed': existing.proposed++; break
    }
    userMap.set(t.author_id, existing)
  }

  // Build scored entries — require ≥1 non-pending topic
  type ScoredUser = {
    user_id: string
    total_topics: number
    law_count: number
    voting_count: number
    active_count: number
    failed_count: number
    proposed_count: number
    law_rate: number
    avg_votes: number
    total_votes_attracted: number
    proposal_score: number
  }

  const scored: ScoredUser[] = []

  for (const [user_id, stats] of userMap.entries()) {
    const engagedTopics = stats.law + stats.voting + stats.active + stats.failed
    if (engagedTopics === 0) continue  // only pending proposals — skip

    const law_rate = stats.total > 0 ? Math.round((stats.law / stats.total) * 100) : 0
    const avg_votes = stats.total > 0 ? Math.round(stats.total_votes / stats.total) : 0

    scored.push({
      user_id,
      total_topics: stats.total,
      law_count: stats.law,
      voting_count: stats.voting,
      active_count: stats.active,
      failed_count: stats.failed,
      proposed_count: stats.proposed,
      law_rate,
      avg_votes,
      total_votes_attracted: stats.total_votes,
      proposal_score: calcScore(stats.law, stats.voting, stats.active, stats.failed, law_rate, avg_votes),
    })
  }

  scored.sort((a, b) => b.proposal_score - a.proposal_score)

  const top100 = scored.slice(0, 100)

  // Fetch profiles
  const topIds = top100.map((u) => u.user_id)
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout')
    .in('id', topIds)

  const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]))

  const entries: ProposalLeaderEntry[] = top100
    .map((u, idx) => {
      const profile = profileMap.get(u.user_id)
      if (!profile) return null
      return {
        rank: idx + 1,
        user_id: u.user_id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        clout: profile.clout ?? 0,
        total_topics: u.total_topics,
        law_count: u.law_count,
        voting_count: u.voting_count,
        active_count: u.active_count,
        failed_count: u.failed_count,
        proposed_count: u.proposed_count,
        law_rate: u.law_rate,
        avg_votes: u.avg_votes,
        total_votes_attracted: u.total_votes_attracted,
        proposal_score: u.proposal_score,
        tier: getTier(u.proposal_score),
      } satisfies ProposalLeaderEntry
    })
    .filter((e): e is ProposalLeaderEntry => e !== null)

  // My stats
  let my_stats: ProposalMyStats | null = null
  if (user) {
    const myData = scored.find((u) => u.user_id === user.id)
    if (myData) {
      my_stats = {
        ...myData,
        tier: getTier(myData.proposal_score),
        rank: scored.findIndex((u) => u.user_id === user.id) + 1,
      }
    } else {
      my_stats = {
        total_topics: 0, law_count: 0, voting_count: 0, active_count: 0,
        failed_count: 0, proposed_count: 0, law_rate: 0, avg_votes: 0,
        total_votes_attracted: 0, proposal_score: 0, tier: 'newcomer', rank: null,
      }
    }
  }

  // Platform stats
  const platform_total_topics = topicRows.length
  const platform_total_laws = topicRows.filter((t) => t.status === 'law').length
  const platform_total_votes = topicRows.reduce((s, t) => s + (t.total_votes ?? 0), 0)

  const platform: ProposalPlatformStats = {
    total_topics: platform_total_topics,
    total_laws: platform_total_laws,
    platform_law_rate: platform_total_topics > 0
      ? Math.round((platform_total_laws / platform_total_topics) * 100)
      : 0,
    avg_votes_per_topic: platform_total_topics > 0
      ? Math.round(platform_total_votes / platform_total_topics)
      : 0,
    total_proposers: userMap.size,
  }

  return NextResponse.json<ProposalLeaderboardResponse>({
    entries,
    total_participants: scored.length,
    platform,
    my_stats,
    generated_at: new Date().toISOString(),
  })
}
