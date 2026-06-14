import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Tier thresholds ──────────────────────────────────────────────────────────

export type StreakTier = 'platinum' | 'gold' | 'silver' | 'bronze' | 'ember'

function getStreakTier(days: number): StreakTier {
  if (days >= 90) return 'platinum'
  if (days >= 30) return 'gold'
  if (days >= 7)  return 'silver'
  if (days >= 3)  return 'bronze'
  return 'ember'
}

const TIER_LABEL: Record<StreakTier, string> = {
  platinum: 'Platinum',
  gold:     'Gold',
  silver:   'Silver',
  bronze:   'Bronze',
  ember:    'Ember',
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface StreakEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  vote_streak: number
  total_votes: number
  reputation_score: number
  tier: StreakTier
  tier_label: string
  streak_started_est: string
}

export type StreakFilter = 'all' | 'platinum' | 'gold' | 'silver'

export interface StreakLeaderboardResponse {
  entries: StreakEntry[]
  total_active: number
  platinum_count: number
  gold_count: number
  silver_count: number
  filter: StreakFilter
  generated_at: string
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const filter = (searchParams.get('filter') ?? 'all') as StreakFilter

  const supabase = await createClient()

  // Minimum streak to appear
  const minStreak = filter === 'platinum' ? 90 : filter === 'gold' ? 30 : filter === 'silver' ? 7 : 3

  const { data: rows, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, vote_streak, total_votes, reputation_score')
    .gte('vote_streak', minStreak)
    .order('vote_streak', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const profiles = rows ?? []

  // Separate counts for tier stats (computed from full result before paging)
  const platinumCount = profiles.filter((p) => p.vote_streak >= 90).length
  const goldCount     = profiles.filter((p) => p.vote_streak >= 30 && p.vote_streak < 90).length
  const silverCount   = profiles.filter((p) => p.vote_streak >= 7 && p.vote_streak < 30).length

  // Estimate streak start date
  function estimateStart(days: number): string {
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d.toISOString().slice(0, 10)
  }

  const entries: StreakEntry[] = profiles.slice(0, 50).map((p, i) => ({
    rank: i + 1,
    user_id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    role: p.role,
    vote_streak: p.vote_streak,
    total_votes: p.total_votes ?? 0,
    reputation_score: p.reputation_score ?? 0,
    tier: getStreakTier(p.vote_streak),
    tier_label: TIER_LABEL[getStreakTier(p.vote_streak)],
    streak_started_est: estimateStart(p.vote_streak),
  }))

  const response: StreakLeaderboardResponse = {
    entries,
    total_active: profiles.length,
    platinum_count: platinumCount,
    gold_count: goldCount,
    silver_count: silverCount,
    filter,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
  })
}
