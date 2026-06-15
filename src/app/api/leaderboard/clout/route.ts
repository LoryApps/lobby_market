import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type CloutTier =
  | 'magnate'
  | 'baron'
  | 'merchant'
  | 'trader'
  | 'participant'

export interface CloutLeaderEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  tier: CloutTier
  // Populated only in the "earners" and "givers" tabs
  period_amount?: number
}

export interface CloutMyStats {
  clout: number
  tier: CloutTier
  rank: number | null
  percentile: number | null
  earned_this_week: number
  gifted_this_week: number
}

export interface CloutLeaderboardResponse {
  entries: CloutLeaderEntry[]
  total_citizens: number
  my_stats: CloutMyStats | null
  platform_total: number
  generated_at: string
}

// ─── Tier assignment ──────────────────────────────────────────────────────────

function getTier(clout: number): CloutTier {
  if (clout >= 50_000) return 'magnate'
  if (clout >= 10_000) return 'baron'
  if (clout >= 5_000)  return 'merchant'
  if (clout >= 1_000)  return 'trader'
  return 'participant'
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { searchParams } = new URL(req.url)
  const tab = searchParams.get('tab') ?? 'richest' // richest | earners | givers

  // ── 1. Richest — top holders by current clout balance ─────────────────────
  if (tab === 'richest') {
    const { data: topProfiles, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .gt('clout', 0)
      .order('clout', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const profiles = topProfiles ?? []

    // Platform-wide stats
    const { count: totalCitizens } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gt('clout', 0)

    const platformTotal = profiles.reduce((sum, p) => sum + (p.clout ?? 0), 0)

    // My stats
    let myStats: CloutMyStats | null = null
    if (user) {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('clout')
        .eq('id', user.id)
        .single()

      if (myProfile) {
        const myClout = myProfile.clout ?? 0
        const myRankIdx = profiles.findIndex((p) => p.id === user.id)
        const rank = myRankIdx >= 0 ? myRankIdx + 1 : null

        // Count how many have more clout (for percentile)
        const { count: higherCount } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .gt('clout', myClout)

        const total = totalCitizens ?? 1
        const percentile = higherCount != null
          ? Math.round(((total - higherCount) / total) * 100)
          : null

        // Weekly earned/gifted
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { data: weekTxns } = await supabase
          .from('clout_transactions')
          .select('type, amount')
          .eq('user_id', user.id)
          .gte('created_at', weekAgo)

        const earnedThisWeek = (weekTxns ?? [])
          .filter((t) => t.type === 'earned')
          .reduce((sum, t) => sum + (t.amount ?? 0), 0)
        const giftedThisWeek = (weekTxns ?? [])
          .filter((t) => t.type === 'gifted')
          .reduce((sum, t) => sum + (t.amount ?? 0), 0)

        myStats = {
          clout: myClout,
          tier: getTier(myClout),
          rank,
          percentile,
          earned_this_week: earnedThisWeek,
          gifted_this_week: giftedThisWeek,
        }
      }
    }

    const entries: CloutLeaderEntry[] = profiles.map((p, idx) => ({
      rank: idx + 1,
      user_id: p.id,
      username: p.username ?? 'unknown',
      display_name: p.display_name ?? null,
      avatar_url: p.avatar_url ?? null,
      role: p.role ?? 'citizen',
      clout: p.clout ?? 0,
      tier: getTier(p.clout ?? 0),
    }))

    return NextResponse.json({
      entries,
      total_citizens: totalCitizens ?? 0,
      my_stats: myStats,
      platform_total: platformTotal,
      generated_at: new Date().toISOString(),
    } satisfies CloutLeaderboardResponse)
  }

  // ── 2. Top Earners — most Clout earned in the last 7 days ─────────────────
  if (tab === 'earners') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: txns, error } = await supabase
      .from('clout_transactions')
      .select('user_id, amount')
      .eq('type', 'earned')
      .gte('created_at', weekAgo)
      .limit(10000)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Aggregate by user
    const byUser = new Map<string, number>()
    for (const t of txns ?? []) {
      byUser.set(t.user_id, (byUser.get(t.user_id) ?? 0) + (t.amount ?? 0))
    }

    const topUserIds = [...byUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([id]) => id)

    if (topUserIds.length === 0) {
      return NextResponse.json({
        entries: [],
        total_citizens: 0,
        my_stats: null,
        platform_total: 0,
        generated_at: new Date().toISOString(),
      } satisfies CloutLeaderboardResponse)
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', topUserIds)

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

    const entries: CloutLeaderEntry[] = topUserIds
      .map((uid, idx) => {
        const p = profileMap.get(uid)
        if (!p) return null
        return {
          rank: idx + 1,
          user_id: p.id,
          username: p.username ?? 'unknown',
          display_name: p.display_name ?? null,
          avatar_url: p.avatar_url ?? null,
          role: p.role ?? 'citizen',
          clout: p.clout ?? 0,
          tier: getTier(p.clout ?? 0),
          period_amount: byUser.get(uid) ?? 0,
        }
      })
      .filter(Boolean) as CloutLeaderEntry[]

    return NextResponse.json({
      entries,
      total_citizens: byUser.size,
      my_stats: null,
      platform_total: [...byUser.values()].reduce((a, b) => a + b, 0),
      generated_at: new Date().toISOString(),
    } satisfies CloutLeaderboardResponse)
  }

  // ── 3. Top Givers — most Clout given away in the last 7 days ──────────────
  if (tab === 'givers') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: txns, error } = await supabase
      .from('clout_transactions')
      .select('user_id, amount')
      .eq('type', 'gifted')
      .gte('created_at', weekAgo)
      .limit(10000)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Aggregate by user (amounts are negative when gifted, so sum absolute values)
    const byUser = new Map<string, number>()
    for (const t of txns ?? []) {
      byUser.set(t.user_id, (byUser.get(t.user_id) ?? 0) + Math.abs(t.amount ?? 0))
    }

    const topUserIds = [...byUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([id]) => id)

    if (topUserIds.length === 0) {
      return NextResponse.json({
        entries: [],
        total_citizens: 0,
        my_stats: null,
        platform_total: 0,
        generated_at: new Date().toISOString(),
      } satisfies CloutLeaderboardResponse)
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', topUserIds)

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

    const entries: CloutLeaderEntry[] = topUserIds
      .map((uid, idx) => {
        const p = profileMap.get(uid)
        if (!p) return null
        return {
          rank: idx + 1,
          user_id: p.id,
          username: p.username ?? 'unknown',
          display_name: p.display_name ?? null,
          avatar_url: p.avatar_url ?? null,
          role: p.role ?? 'citizen',
          clout: p.clout ?? 0,
          tier: getTier(p.clout ?? 0),
          period_amount: byUser.get(uid) ?? 0,
        }
      })
      .filter(Boolean) as CloutLeaderEntry[]

    return NextResponse.json({
      entries,
      total_citizens: byUser.size,
      my_stats: null,
      platform_total: [...byUser.values()].reduce((a, b) => a + b, 0),
      generated_at: new Date().toISOString(),
    } satisfies CloutLeaderboardResponse)
  }

  return NextResponse.json({ error: 'Invalid tab' }, { status: 400 })
}
