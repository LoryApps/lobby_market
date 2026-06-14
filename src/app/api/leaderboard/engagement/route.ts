import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Score thresholds (100 pts each) ─────────────────────────────────────────
// Voter      : 300 votes  → full marks
// Orator     : 40 arguments → full marks
// Stalwart   : 21 streak days → full marks
// Scholar    : 5 000 reputation → full marks
// Strategist : 30 clout  → full marks (clout scaled to keep it achievable)

const VOTER_CAP = 300
const ORATOR_CAP = 40
const STALWART_CAP = 21
const SCHOLAR_CAP = 5000
const STRATEGIST_CAP = 30

function cap(value: number, ceiling: number): number {
  return Math.min(value / ceiling, 1) * 100
}

function engagementScore(
  votes: number,
  args: number,
  streak: number,
  rep: number,
  clout: number
): number {
  const v = cap(votes, VOTER_CAP)
  const o = cap(args, ORATOR_CAP)
  const s = cap(streak, STALWART_CAP)
  const sc = cap(rep, SCHOLAR_CAP)
  const st = cap(clout, STRATEGIST_CAP)
  // Geometric mean penalises zero/low dimensions heavily
  // to reward truly well-rounded citizens.
  const product = v * o * s * sc * st
  if (product <= 0) return 0
  return Math.pow(product, 1 / 5)
}

function topDimension(
  votes: number,
  args: number,
  streak: number,
  rep: number,
  clout: number
): { label: string; color: string; icon: string } {
  const scores: [number, string, string, string][] = [
    [cap(votes, VOTER_CAP), 'Voter', 'text-for-400', 'vote'],
    [cap(args, ORATOR_CAP), 'Orator', 'text-gold', 'mic'],
    [cap(streak, STALWART_CAP), 'Stalwart', 'text-against-400', 'flame'],
    [cap(rep, SCHOLAR_CAP), 'Scholar', 'text-emerald', 'book'],
    [cap(clout, STRATEGIST_CAP), 'Strategist', 'text-purple', 'strategy'],
  ]
  const best = scores.reduce((a, b) => (a[0] >= b[0] ? a : b))
  return { label: best[1], color: best[2], icon: best[3] }
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface EngagementEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  engagement_score: number
  voter_score: number
  orator_score: number
  stalwart_score: number
  scholar_score: number
  strategist_score: number
  top_dimension: string
  top_dimension_color: string
  total_votes: number
  total_arguments: number
  vote_streak: number
  reputation_score: number
  clout: number
}

export interface EngagementStats {
  total_participants: number
  perfect_score_count: number
  avg_score: number
  top_dimension_breakdown: Record<string, number>
}

export interface EngagementLeaderboardResponse {
  entries: EngagementEntry[]
  stats: EngagementStats
  my_rank: number | null
  my_score: number | null
}

// ─── GET /api/leaderboard/engagement ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '100'), 200)

  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    // Fetch all profiles with engagement-relevant fields
    // Only include users who have cast at least 1 vote (active citizens)
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select(
        'id, username, display_name, avatar_url, role, total_votes, total_arguments, vote_streak, reputation_score, clout'
      )
      .gt('total_votes', 0)
      .order('reputation_score', { ascending: false })
      .limit(2000) // Pull a wide pool so geometric mean works on the full distribution

    if (error) throw error

    // Compute scores for all profiles
    const scored = (profiles ?? []).map((p) => {
      const votes = p.total_votes ?? 0
      const args = p.total_arguments ?? 0
      const streak = p.vote_streak ?? 0
      const rep = p.reputation_score ?? 0
      const clout = p.clout ?? 0

      const vScore = cap(votes, VOTER_CAP)
      const oScore = cap(args, ORATOR_CAP)
      const sScore = cap(streak, STALWART_CAP)
      const scScore = cap(rep, SCHOLAR_CAP)
      const stScore = cap(clout, STRATEGIST_CAP)
      const totalScore = engagementScore(votes, args, streak, rep, clout)
      const dim = topDimension(votes, args, streak, rep, clout)

      return {
        user_id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role ?? 'person',
        engagement_score: Math.round(totalScore * 10) / 10,
        voter_score: Math.round(vScore),
        orator_score: Math.round(oScore),
        stalwart_score: Math.round(sScore),
        scholar_score: Math.round(scScore),
        strategist_score: Math.round(stScore),
        top_dimension: dim.label,
        top_dimension_color: dim.color,
        total_votes: votes,
        total_arguments: args,
        vote_streak: streak,
        reputation_score: rep,
        clout: clout,
      }
    })

    // Sort by engagement score desc
    scored.sort((a, b) => b.engagement_score - a.engagement_score)

    // Assign ranks
    const ranked: EngagementEntry[] = scored.map((e, i) => ({
      rank: i + 1,
      ...e,
    }))

    // Stats
    const totalParticipants = ranked.length
    const perfectScores = ranked.filter((e) => e.engagement_score >= 99).length
    const avgScore =
      totalParticipants > 0
        ? ranked.reduce((sum, e) => sum + e.engagement_score, 0) / totalParticipants
        : 0

    const dimBreakdown: Record<string, number> = {}
    for (const e of ranked) {
      dimBreakdown[e.top_dimension] = (dimBreakdown[e.top_dimension] ?? 0) + 1
    }

    // My rank
    let myRank: number | null = null
    let myScore: number | null = null
    if (authUser) {
      const me = ranked.find((e) => e.user_id === authUser.id)
      if (me) {
        myRank = me.rank
        myScore = me.engagement_score
      }
    }

    const entries = ranked.slice(0, limit)

    const response: EngagementLeaderboardResponse = {
      entries,
      stats: {
        total_participants: totalParticipants,
        perfect_score_count: perfectScores,
        avg_score: Math.round(avgScore * 10) / 10,
        top_dimension_breakdown: dimBreakdown,
      },
      my_rank: myRank,
      my_score: myScore,
    }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' },
    })
  } catch (err) {
    console.error('[engagement-leaderboard]', err)
    return NextResponse.json({ error: 'Failed to load engagement leaderboard' }, { status: 500 })
  }
}
