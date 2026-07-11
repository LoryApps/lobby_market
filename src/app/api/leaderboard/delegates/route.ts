import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type DelegateTier = 'oracle' | 'sage' | 'elder' | 'mentor' | 'trusted'

export interface DelegateLeaderEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  total_count: number
  global_count: number
  category_count: number
  topic_count: number
  tier: DelegateTier
  top_categories: string[]
}

export interface DelegateMyStats {
  total_count: number
  global_count: number
  category_count: number
  topic_count: number
  tier: DelegateTier
  rank: number | null
}

export interface DelegateLeaderboardResponse {
  entries: DelegateLeaderEntry[]
  total_delegates: number
  total_delegations: number
  my_stats: DelegateMyStats | null
  generated_at: string
}

// ─── Tier assignment ──────────────────────────────────────────────────────────

function getTier(total: number): DelegateTier {
  if (total >= 50) return 'oracle'
  if (total >= 20) return 'sage'
  if (total >= 10) return 'elder'
  if (total >= 5)  return 'mentor'
  return 'trusted'
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { searchParams } = new URL(req.url)
  // tab: total | global | category
  const tab = searchParams.get('tab') ?? 'total'

  // ── 1. Pull top from delegation_stats view ────────────────────────────────
  let orderCol: string
  if (tab === 'global') {
    orderCol = 'global_count'
  } else if (tab === 'category') {
    orderCol = 'category_count'
  } else {
    orderCol = 'total_count'
  }

  const { data: statsRaw, error: statsError } = await supabase
    .from('delegation_stats')
    .select('delegate_id, global_count, category_count, topic_count, total_count')
    .gt(orderCol, 0)
    .order(orderCol, { ascending: false })
    .limit(100)

  if (statsError) {
    return NextResponse.json({ error: statsError.message }, { status: 500 })
  }

  const stats = statsRaw ?? []
  if (stats.length === 0) {
    return NextResponse.json({
      entries: [],
      total_delegates: 0,
      total_delegations: 0,
      my_stats: null,
      generated_at: new Date().toISOString(),
    } satisfies DelegateLeaderboardResponse)
  }

  const delegateIds = stats.map((s) => s.delegate_id)

  // ── 2. Pull profile info for those delegates ──────────────────────────────
  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout')
    .in('id', delegateIds)

  const profileMap = new Map((profilesRaw ?? []).map((p) => [p.id, p]))

  // ── 3. For each delegate pull their top delegated categories ─────────────
  //       (up to 3 category-scoped delegations)
  const { data: catDelegs } = await supabase
    .from('vote_delegations')
    .select('delegate_id, category')
    .in('delegate_id', delegateIds)
    .not('category', 'is', null)
    .is('revoked_at', null)
    .limit(1000)

  // Group categories per delegate
  const catMap = new Map<string, Set<string>>()
  for (const d of catDelegs ?? []) {
    if (!d.category) continue
    const set = catMap.get(d.delegate_id) ?? new Set()
    set.add(d.category)
    catMap.set(d.delegate_id, set)
  }

  // ── 4. Build sorted entries ───────────────────────────────────────────────
  const statsMap = new Map(stats.map((s) => [s.delegate_id, s]))

  const entries: DelegateLeaderEntry[] = delegateIds
    .map((uid, idx) => {
      const profile = profileMap.get(uid)
      const stat = statsMap.get(uid)
      if (!profile || !stat) return null

      const sortVal = tab === 'global'
        ? (stat.global_count ?? 0)
        : tab === 'category'
          ? (stat.category_count ?? 0)
          : (stat.total_count ?? 0)

      if (sortVal === 0) return null

      return {
        rank: idx + 1,
        user_id: uid,
        username: profile.username ?? 'unknown',
        display_name: profile.display_name ?? null,
        avatar_url: profile.avatar_url ?? null,
        role: profile.role ?? 'person',
        clout: profile.clout ?? 0,
        total_count: stat.total_count ?? 0,
        global_count: stat.global_count ?? 0,
        category_count: stat.category_count ?? 0,
        topic_count: stat.topic_count ?? 0,
        tier: getTier(stat.total_count ?? 0),
        top_categories: [...(catMap.get(uid) ?? [])].slice(0, 3),
      }
    })
    .filter(Boolean) as DelegateLeaderEntry[]

  // Correct ranks after null filtering
  entries.forEach((e, i) => { e.rank = i + 1 })

  // ── 5. Platform totals ────────────────────────────────────────────────────
  const totalDelegates = entries.length
  const totalDelegations = entries.reduce((sum, e) => sum + e.total_count, 0)

  // ── 6. My stats ───────────────────────────────────────────────────────────
  let myStats: DelegateMyStats | null = null
  if (user) {
    const myStat = statsMap.get(user.id)
    if (myStat) {
      const myRankIdx = entries.findIndex((e) => e.user_id === user.id)
      myStats = {
        total_count: myStat.total_count ?? 0,
        global_count: myStat.global_count ?? 0,
        category_count: myStat.category_count ?? 0,
        topic_count: myStat.topic_count ?? 0,
        tier: getTier(myStat.total_count ?? 0),
        rank: myRankIdx >= 0 ? myRankIdx + 1 : null,
      }
    } else {
      // User has zero delegations received
      myStats = {
        total_count: 0,
        global_count: 0,
        category_count: 0,
        topic_count: 0,
        tier: 'trusted',
        rank: null,
      }
    }
  }

  return NextResponse.json({
    entries,
    total_delegates: totalDelegates,
    total_delegations: totalDelegations,
    my_stats: myStats,
    generated_at: new Date().toISOString(),
  } satisfies DelegateLeaderboardResponse)
}
