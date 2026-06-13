import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const CATEGORIES = [
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
] as const

export type PodiumCategory = (typeof CATEGORIES)[number]

export interface ChampionEntry {
  rank: number
  user: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  }
  gold: number
  silver: number
  bronze: number
  total_podiums: number
  best_score: number
  best_category: string | null
  medal_score: number
}

export interface CategoryChampion {
  category: PodiumCategory
  champion: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  } | null
  gold_wins: number
  total_podiums: number
  runner_up: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
  runner_up_gold: number
}

export interface ChampionsResponse {
  overall: ChampionEntry[]
  by_category: CategoryChampion[]
  total_snapshots: number
  weeks_tracked: number
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)

  const supabase = await createClient()

  // Fetch all podium snapshots with user profiles in one join
  const { data: rows, error } = await supabase
    .from('podium_snapshots')
    .select(`
      user_id,
      rank,
      score,
      category,
      week_start,
      profiles!inner(id, username, display_name, avatar_url, role, clout)
    `)
    .order('week_start', { ascending: false })
    .limit(10000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type SnapshotRow = {
    user_id: string
    rank: number
    score: number
    category: string
    week_start: string
    profiles: {
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
      clout: number
    }
  }

  const snapshots = (rows ?? []) as SnapshotRow[]

  // ── Aggregate per user ────────────────────────────────────────────────────

  type UserStats = {
    profile: SnapshotRow['profiles']
    gold: number
    silver: number
    bronze: number
    best_score: number
    category_counts: Map<string, number>
  }

  const userMap = new Map<string, UserStats>()

  for (const snap of snapshots) {
    if (!userMap.has(snap.user_id)) {
      userMap.set(snap.user_id, {
        profile: snap.profiles,
        gold: 0,
        silver: 0,
        bronze: 0,
        best_score: 0,
        category_counts: new Map(),
      })
    }
    const u = userMap.get(snap.user_id)!
    if (snap.rank === 1) u.gold++
    else if (snap.rank === 2) u.silver++
    else if (snap.rank === 3) u.bronze++
    u.best_score = Math.max(u.best_score, snap.score)
    u.category_counts.set(snap.category, (u.category_counts.get(snap.category) ?? 0) + 1)
  }

  // ── Build overall ranking ─────────────────────────────────────────────────
  // Medal score: gold=5, silver=3, bronze=1

  const overall: ChampionEntry[] = Array.from(userMap.entries())
    .map(([, u]) => {
      const medalScore = u.gold * 5 + u.silver * 3 + u.bronze * 1
      // Best category = most appearances on the podium
      let bestCat: string | null = null
      let bestCatCount = 0
      for (const [cat, count] of u.category_counts.entries()) {
        if (count > bestCatCount) { bestCatCount = count; bestCat = cat }
      }
      return {
        rank: 0, // filled after sort
        user: u.profile,
        gold: u.gold,
        silver: u.silver,
        bronze: u.bronze,
        total_podiums: u.gold + u.silver + u.bronze,
        best_score: u.best_score,
        best_category: bestCat,
        medal_score: medalScore,
      }
    })
    .filter((e) => e.total_podiums > 0)
    .sort((a, b) =>
      b.medal_score !== a.medal_score
        ? b.medal_score - a.medal_score
        : b.gold !== a.gold
        ? b.gold - a.gold
        : b.silver !== a.silver
        ? b.silver - a.silver
        : b.bronze - a.bronze
    )
    .slice(0, limit)
    .map((e, idx) => ({ ...e, rank: idx + 1 }))

  // ── Per-category champions ────────────────────────────────────────────────

  const catUserGold = new Map<string, Map<string, number>>() // cat -> userId -> gold wins
  const catUserTotal = new Map<string, Map<string, number>>() // cat -> userId -> total podiums
  const catUserProfile = new Map<string, Map<string, SnapshotRow['profiles']>>()

  for (const snap of snapshots) {
    const cat = snap.category
    if (!catUserGold.has(cat)) {
      catUserGold.set(cat, new Map())
      catUserTotal.set(cat, new Map())
      catUserProfile.set(cat, new Map())
    }
    if (snap.rank === 1) {
      catUserGold.get(cat)!.set(snap.user_id, (catUserGold.get(cat)!.get(snap.user_id) ?? 0) + 1)
    }
    catUserTotal.get(cat)!.set(snap.user_id, (catUserTotal.get(cat)!.get(snap.user_id) ?? 0) + 1)
    catUserProfile.get(cat)!.set(snap.user_id, snap.profiles)
  }

  const by_category: CategoryChampion[] = CATEGORIES.map((cat) => {
    const goldMap = catUserGold.get(cat) ?? new Map()
    const totalMap = catUserTotal.get(cat) ?? new Map()
    const profileMap = catUserProfile.get(cat) ?? new Map()

    // Sort by gold wins, break ties by total podiums
    const sorted = Array.from(totalMap.keys())
      .map((uid) => ({
        uid,
        gold: goldMap.get(uid) ?? 0,
        total: totalMap.get(uid) ?? 0,
        profile: profileMap.get(uid)!,
      }))
      .sort((a, b) => b.gold !== a.gold ? b.gold - a.gold : b.total - a.total)

    const champ = sorted[0] ?? null
    const runnerUp = sorted[1] ?? null

    return {
      category: cat,
      champion: champ ? champ.profile : null,
      gold_wins: champ ? champ.gold : 0,
      total_podiums: champ ? champ.total : 0,
      runner_up: runnerUp ? runnerUp.profile : null,
      runner_up_gold: runnerUp ? runnerUp.gold : 0,
    }
  })

  // ── Week count ────────────────────────────────────────────────────────────

  const uniqueWeeks = new Set(snapshots.map((s) => s.week_start)).size

  const response: ChampionsResponse = {
    overall,
    by_category,
    total_snapshots: snapshots.length,
    weeks_tracked: uniqueWeeks,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=120' },
  })
}
