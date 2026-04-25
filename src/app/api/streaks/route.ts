import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StreakEntry {
  rank: number
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  vote_streak: number
  total_votes: number
  total_arguments: number
  clout: number
  reputation_score: number
  is_you: boolean
}

export interface StreakStats {
  total_active: number
  total_blazing: number
  avg_streak: number
  max_streak: number
  total_streak_days: number
}

export interface StreaksResponse {
  leaderboard: StreakEntry[]
  stats: StreakStats
  your_rank: number | null
  your_streak: number | null
}

const LIMIT = 50

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: rows } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, role, vote_streak, total_votes, total_arguments, clout, reputation_score'
    )
    .gt('vote_streak', 0)
    .order('vote_streak', { ascending: false })
    .limit(LIMIT)

  const profiles = rows ?? []

  const { data: statsRows } = await supabase
    .from('profiles')
    .select('vote_streak')
    .gt('vote_streak', 0)

  const allStreaks = (statsRows ?? []).map((r) => r.vote_streak)
  const stats: StreakStats = {
    total_active: allStreaks.length,
    total_blazing: allStreaks.filter((s) => s >= 14).length,
    avg_streak:
      allStreaks.length > 0
        ? Math.round(allStreaks.reduce((a, b) => a + b, 0) / allStreaks.length)
        : 0,
    max_streak: allStreaks.length > 0 ? Math.max(...allStreaks) : 0,
    total_streak_days: allStreaks.reduce((a, b) => a + b, 0),
  }

  let yourRank: number | null = null
  let yourStreak: number | null = null

  if (user) {
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('vote_streak')
      .eq('id', user.id)
      .maybeSingle()

    if (myProfile && myProfile.vote_streak > 0) {
      yourStreak = myProfile.vote_streak
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gt('vote_streak', myProfile.vote_streak)
      yourRank = (count ?? 0) + 1
    }
  }

  const leaderboard: StreakEntry[] = profiles.map((p, idx) => ({
    rank: idx + 1,
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    role: p.role,
    vote_streak: p.vote_streak,
    total_votes: p.total_votes,
    total_arguments: p.total_arguments,
    clout: p.clout,
    reputation_score: p.reputation_score,
    is_you: p.id === user?.id,
  }))

  const response: StreaksResponse = {
    leaderboard,
    stats,
    your_rank: yourRank,
    your_streak: yourStreak,
  }

  return NextResponse.json(response)
}
