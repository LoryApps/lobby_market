import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OathValue = 'truth' | 'justice' | 'liberty' | 'community' | 'progress'

export interface OathHolder {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  civic_oath_at: string
  civic_oath_value: OathValue
  reputation_score: number
  total_votes: number
  total_arguments: number
  vote_streak: number
  clout: number
}

export interface AccountabilityStats {
  total_oath_takers: number
  by_value: Record<OathValue, number>
  avg_votes_after_oath: number
  avg_arguments_after_oath: number
  highly_active_count: number
}

export interface AccountabilityResponse {
  stats: AccountabilityStats
  holders: OathHolder[]
  your_rank: number | null
  your_stats: OathHolder | null
}

const VALUE_ORDER: OathValue[] = ['truth', 'justice', 'liberty', 'community', 'progress']

// ─── GET /api/accountability ───────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch all oath holders
  const { data: holders, error } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, role, civic_oath_at, civic_oath_value, reputation_score, total_votes, total_arguments, vote_streak, clout'
    )
    .not('civic_oath_at', 'is', null)
    .not('civic_oath_value', 'is', null)
    .order('reputation_score', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const typedHolders = (holders ?? []) as OathHolder[]

  // Build stats
  const byValue = Object.fromEntries(VALUE_ORDER.map((v) => [v, 0])) as Record<OathValue, number>
  let totalVotes = 0
  let totalArgs = 0
  let highlyActive = 0

  for (const h of typedHolders) {
    if (h.civic_oath_value in byValue) {
      byValue[h.civic_oath_value as OathValue]++
    }
    totalVotes += h.total_votes
    totalArgs += h.total_arguments
    if (h.total_votes >= 10 || h.total_arguments >= 3) highlyActive++
  }

  const n = typedHolders.length

  const stats: AccountabilityStats = {
    total_oath_takers: n,
    by_value: byValue,
    avg_votes_after_oath: n > 0 ? Math.round(totalVotes / n) : 0,
    avg_arguments_after_oath: n > 0 ? Math.round((totalArgs / n) * 10) / 10 : 0,
    highly_active_count: highlyActive,
  }

  // Sort by engagement score (reputation is primary, then votes)
  const sorted = [...typedHolders].sort(
    (a, b) =>
      b.reputation_score - a.reputation_score || b.total_votes - a.total_votes
  )

  // Cap public list at top 100
  const publicList = sorted.slice(0, 100)

  // Find user's own rank and stats
  let yourRank: number | null = null
  let yourStats: OathHolder | null = null

  if (user) {
    const idx = sorted.findIndex((h) => h.id === user.id)
    if (idx !== -1) {
      yourRank = idx + 1
      yourStats = sorted[idx]
    }
  }

  return NextResponse.json({
    stats,
    holders: publicList,
    your_rank: yourRank,
    your_stats: yourStats,
  } satisfies AccountabilityResponse)
}
