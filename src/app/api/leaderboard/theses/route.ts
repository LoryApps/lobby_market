import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThesisOracle {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  total_theses: number
  active_theses: number
  vindicated: number
  refuted: number
  expired: number
  total_resolved: number
  accuracy_pct: number
  rank: number
}

export interface RecentlyResolvedThesis {
  id: string
  statement: string
  category: string
  status: 'vindicated' | 'refuted' | 'expired'
  resolved_at: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  agree_count: number
  disagree_count: number
}

export interface ThesisLeaderboardResponse {
  topByAccuracy: ThesisOracle[]
  topByVolume: ThesisOracle[]
  recentResolutions: RecentlyResolvedThesis[]
  platformStats: {
    total_theses: number
    active_theses: number
    vindicated: number
    refuted: number
    expired: number
    total_oracle_users: number
    platform_accuracy_pct: number
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  // ── Aggregate per-user thesis stats ──────────────────────────────────────────
  const { data: rawTheses } = await supabase
    .from('civic_theses')
    .select('user_id, status')
    .eq('is_public', true)

  type UserAgg = {
    total: number
    active: number
    vindicated: number
    refuted: number
    expired: number
  }

  const userAgg: Map<string, UserAgg> = new Map()

  for (const row of rawTheses ?? []) {
    const uid = row.user_id as string
    if (!userAgg.has(uid)) {
      userAgg.set(uid, { total: 0, active: 0, vindicated: 0, refuted: 0, expired: 0 })
    }
    const agg = userAgg.get(uid)!
    agg.total += 1
    const s = row.status as string
    if (s === 'active') agg.active += 1
    else if (s === 'vindicated') agg.vindicated += 1
    else if (s === 'refuted') agg.refuted += 1
    else if (s === 'expired') agg.expired += 1
  }

  // Only users with at least 1 resolved thesis qualify for accuracy ranking
  const qualifyingIds = Array.from(userAgg.entries())
    .filter(([, agg]) => agg.vindicated + agg.refuted >= 1)
    .map(([uid]) => uid)

  if (qualifyingIds.length === 0) {
    return NextResponse.json({
      topByAccuracy: [],
      topByVolume: [],
      recentResolutions: [],
      platformStats: {
        total_theses: rawTheses?.length ?? 0,
        active_theses: 0,
        vindicated: 0,
        refuted: 0,
        expired: 0,
        total_oracle_users: 0,
        platform_accuracy_pct: 0,
      },
    } satisfies ThesisLeaderboardResponse)
  }

  // ── Fetch profiles for all qualifying users ───────────────────────────────────
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout')
    .in('id', qualifyingIds)

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        username: p.username as string,
        display_name: p.display_name as string | null,
        avatar_url: p.avatar_url as string | null,
        role: p.role as string,
        clout: (p.clout as number) ?? 0,
      },
    ])
  )

  // ── Build oracle rows ─────────────────────────────────────────────────────────
  const oracles: ThesisOracle[] = []
  for (const [uid, agg] of userAgg.entries()) {
    const profile = profileMap.get(uid)
    if (!profile) continue
    const totalResolved = agg.vindicated + agg.refuted
    if (totalResolved === 0) continue
    oracles.push({
      user_id: uid,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout,
      total_theses: agg.total,
      active_theses: agg.active,
      vindicated: agg.vindicated,
      refuted: agg.refuted,
      expired: agg.expired,
      total_resolved: totalResolved,
      accuracy_pct: Math.round((agg.vindicated / totalResolved) * 100),
      rank: 0,
    })
  }

  // ── Sort by accuracy, assign rank ────────────────────────────────────────────
  const topByAccuracy = [...oracles]
    .sort((a, b) => {
      if (b.accuracy_pct !== a.accuracy_pct) return b.accuracy_pct - a.accuracy_pct
      return b.total_resolved - a.total_resolved
    })
    .map((o, i) => ({ ...o, rank: i + 1 }))

  // ── Sort by total theses (volume) ────────────────────────────────────────────
  const topByVolume = [...oracles]
    .sort((a, b) => {
      if (b.total_theses !== a.total_theses) return b.total_theses - a.total_theses
      return b.accuracy_pct - a.accuracy_pct
    })
    .map((o, i) => ({ ...o, rank: i + 1 }))

  // ── Recently resolved theses ─────────────────────────────────────────────────
  const { data: rawResolved } = await supabase
    .from('civic_theses')
    .select(
      `
      id, statement, category, status, resolved_at, agree_count, disagree_count,
      profiles!civic_theses_user_id_fkey(username, display_name, avatar_url)
    `
    )
    .in('status', ['vindicated', 'refuted', 'expired'])
    .eq('is_public', true)
    .order('resolved_at', { ascending: false })
    .limit(10)

  const recentResolutions: RecentlyResolvedThesis[] = (rawResolved ?? []).map((row) => {
    const author = Array.isArray(row.profiles)
      ? (row.profiles[0] as { username: string; display_name: string | null; avatar_url: string | null } | undefined)
      : (row.profiles as { username: string; display_name: string | null; avatar_url: string | null } | null)
    return {
      id: row.id as string,
      statement: row.statement as string,
      category: (row.category as string) ?? 'politics',
      status: row.status as 'vindicated' | 'refuted' | 'expired',
      resolved_at: row.resolved_at as string,
      author_username: author?.username ?? 'unknown',
      author_display_name: author?.display_name ?? null,
      author_avatar_url: author?.avatar_url ?? null,
      agree_count: (row.agree_count as number) ?? 0,
      disagree_count: (row.disagree_count as number) ?? 0,
    }
  })

  // ── Platform-wide stats ──────────────────────────────────────────────────────
  let totalActive = 0
  let totalVindicated = 0
  let totalRefuted = 0
  let totalExpired = 0

  for (const agg of userAgg.values()) {
    totalActive += agg.active
    totalVindicated += agg.vindicated
    totalRefuted += agg.refuted
    totalExpired += agg.expired
  }

  const totalResolvedPlatform = totalVindicated + totalRefuted
  const platformAccuracy = totalResolvedPlatform > 0
    ? Math.round((totalVindicated / totalResolvedPlatform) * 100)
    : 0

  return NextResponse.json({
    topByAccuracy: topByAccuracy.slice(0, 50),
    topByVolume: topByVolume.slice(0, 50),
    recentResolutions,
    platformStats: {
      total_theses: rawTheses?.length ?? 0,
      active_theses: totalActive,
      vindicated: totalVindicated,
      refuted: totalRefuted,
      expired: totalExpired,
      total_oracle_users: oracles.length,
      platform_accuracy_pct: platformAccuracy,
    },
  } satisfies ThesisLeaderboardResponse)
}
