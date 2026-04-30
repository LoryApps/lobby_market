import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Tier definitions ─────────────────────────────────────────────────────────

export interface LeagueTier {
  name: string
  minLP: number
  maxLP: number | null
  color: string
  gradient: string
  rank: number
}

export const TIERS: LeagueTier[] = [
  {
    name: 'Bystander',
    minLP: 0,
    maxLP: 49,
    color: '#6b7280',
    gradient: 'from-surface-300 to-surface-400',
    rank: 0,
  },
  {
    name: 'Citizen',
    minLP: 50,
    maxLP: 199,
    color: '#93c5fd',
    gradient: 'from-for-400/60 to-for-600/60',
    rank: 1,
  },
  {
    name: 'Delegate',
    minLP: 200,
    maxLP: 499,
    color: '#cd7f32',
    gradient: 'from-amber-600/70 to-amber-800/70',
    rank: 2,
  },
  {
    name: 'Lawmaker',
    minLP: 500,
    maxLP: 999,
    color: '#9ca3af',
    gradient: 'from-gray-400/70 to-gray-600/70',
    rank: 3,
  },
  {
    name: 'Senator',
    minLP: 1000,
    maxLP: 1999,
    color: '#c9a84c',
    gradient: 'from-gold/70 to-amber-500/70',
    rank: 4,
  },
  {
    name: 'Champion',
    minLP: 2000,
    maxLP: null,
    color: '#a855f7',
    gradient: 'from-purple/70 to-for-600/70',
    rank: 5,
  },
]

export function getTier(lp: number): LeagueTier {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (lp >= TIERS[i].minLP) return TIERS[i]
  }
  return TIERS[0]
}

export function getTierProgress(lp: number): {
  tier: LeagueTier
  nextTier: LeagueTier | null
  progressPct: number
  lpToNext: number | null
} {
  const tier = getTier(lp)
  const nextTier = TIERS.find((t) => t.rank === tier.rank + 1) ?? null
  if (!nextTier) {
    return { tier, nextTier: null, progressPct: 100, lpToNext: null }
  }
  const range = nextTier.minLP - tier.minLP
  const earned = lp - tier.minLP
  const progressPct = Math.min(100, Math.round((earned / range) * 100))
  const lpToNext = nextTier.minLP - lp
  return { tier, nextTier, progressPct, lpToNext }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeagueStanding {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  monthly_lp: number
  tier_name: string
  tier_color: string
  tier_gradient: string
}

export interface LeagueCurrentUser {
  rank: number | null
  monthly_lp: number
  tier_name: string
  tier_color: string
  tier_gradient: string
  next_tier_name: string | null
  progress_pct: number
  lp_to_next: number | null
}

export interface LeagueResponse {
  season_name: string
  season_start: string
  season_end: string
  season_days_left: number
  top50: LeagueStanding[]
  currentUser: LeagueCurrentUser | null
  total_participants: number
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const now = new Date()
    const seasonStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const seasonEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const MONTH_NAMES = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]
    const seasonName = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`
    const daysLeft = Math.ceil(
      (seasonEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )

    // ── Get current user ──────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser()

    // ── Aggregate monthly earned clout per user ───────────────────────────────
    // Supabase RPC would be ideal; we simulate with two queries:
    // 1. Sum clout earned this month per user (earned only, positive amounts)
    // 2. Join to profiles for display info

    const { data: txRows, error: txErr } = await supabase
      .from('clout_transactions')
      .select('user_id, amount')
      .eq('type', 'earned')
      .gte('created_at', seasonStart.toISOString())
      .lte('created_at', seasonEnd.toISOString())
      .gt('amount', 0)

    if (txErr) {
      return NextResponse.json({ error: txErr.message }, { status: 500 })
    }

    // Aggregate in JS (Supabase JS v2 doesn't support GROUP BY directly)
    const lpByUser: Record<string, number> = {}
    for (const tx of txRows ?? []) {
      lpByUser[tx.user_id] = (lpByUser[tx.user_id] ?? 0) + tx.amount
    }

    const sortedEntries = Object.entries(lpByUser)
      .sort(([, a], [, b]) => b - a)

    const totalParticipants = sortedEntries.length

    const top50Ids = sortedEntries.slice(0, 50).map(([id]) => id)

    // ── Fetch profiles for top 50 ─────────────────────────────────────────────
    const profileMap: Record<string, { username: string; display_name: string | null; avatar_url: string | null; role: string }> = {}

    if (top50Ids.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', top50Ids)

      for (const p of profiles ?? []) {
        profileMap[p.id] = p
      }
    }

    const top50: LeagueStanding[] = sortedEntries
      .slice(0, 50)
      .map(([userId, lp], idx) => {
        const p = profileMap[userId]
        const { tier } = getTierProgress(lp)
        return {
          rank: idx + 1,
          user_id: userId,
          username: p?.username ?? 'unknown',
          display_name: p?.display_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          role: p?.role ?? 'person',
          monthly_lp: lp,
          tier_name: tier.name,
          tier_color: tier.color,
          tier_gradient: tier.gradient,
        }
      })

    // ── Current user stats ─────────────────────────────────────────────────────
    let currentUser: LeagueCurrentUser | null = null

    if (user) {
      const userLP = lpByUser[user.id] ?? 0
      const { tier, nextTier, progressPct, lpToNext } = getTierProgress(userLP)

      const userRankIdx = sortedEntries.findIndex(([id]) => id === user.id)
      const userRank = userRankIdx >= 0 ? userRankIdx + 1 : null

      currentUser = {
        rank: userRank,
        monthly_lp: userLP,
        tier_name: tier.name,
        tier_color: tier.color,
        tier_gradient: tier.gradient,
        next_tier_name: nextTier?.name ?? null,
        progress_pct: progressPct,
        lp_to_next: lpToNext,
      }
    }

    const response: LeagueResponse = {
      season_name: seasonName,
      season_start: seasonStart.toISOString(),
      season_end: seasonEnd.toISOString(),
      season_days_left: daysLeft,
      top50,
      currentUser,
      total_participants: totalParticipants,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[league]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
