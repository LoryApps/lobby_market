import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AchievementTier } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RelayAchievementItem {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  tier: AchievementTier
  criteriaType: string
  threshold: number
  // Global stats
  earnerCount: number
  // Current user
  earned: boolean
  earnedAt: string | null
  // Progress toward unearned
  current: number
  pct: number
  remaining: number
}

export interface RecentEarner {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  achievementSlug: string
  achievementName: string
  achievementTier: AchievementTier
  achievementIcon: string
  earnedAt: string
}

export interface RelayAchievementsResponse {
  achievements: RelayAchievementItem[]
  earnedCount: number
  totalCount: number
  recentEarners: RecentEarner[]
}

// ─── Metric computation ───────────────────────────────────────────────────────

async function computeRelayMetric(
  userId: string,
  type: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<number> {
  switch (type) {
    case 'relays_started': {
      const { count } = await supabase
        .from('civic_relays')
        .select('*', { count: 'exact', head: true })
        .eq('starter_id', userId)
      return count ?? 0
    }
    case 'relay_legs_added': {
      // For relay-collaborator the DB trigger checks DISTINCT relays;
      // count distinct here too for consistent progress display
      const { data } = await supabase
        .from('relay_legs')
        .select('relay_id')
        .eq('author_id', userId)
      if (!data) return 0
      return new Set((data as { relay_id: string }[]).map((r) => r.relay_id)).size
    }
    case 'relays_completed': {
      const { count } = await supabase
        .from('civic_relays')
        .select('*', { count: 'exact', head: true })
        .eq('starter_id', userId)
        .eq('status', 'complete')
      return count ?? 0
    }
    case 'relay_compelling_votes': {
      // Get all relay IDs started by this user
      const { data: myRelays } = await supabase
        .from('civic_relays')
        .select('id')
        .eq('starter_id', userId)
      const myRelayIds = (myRelays as { id: string }[] | null)?.map((r) => r.id) ?? []
      if (myRelayIds.length === 0) return 0
      // Count distinct relays that received a compelling vote
      const { data } = await supabase
        .from('relay_votes')
        .select('relay_id')
        .eq('vote', 'compelling')
        .in('relay_id', myRelayIds)
      if (!data) return 0
      return new Set((data as { relay_id: string }[]).map((r) => r.relay_id)).size
    }
    case 'relay_leg_stars': {
      // Max stars any single leg from this user has
      const { data } = await supabase
        .from('relay_legs')
        .select('upvote_count')
        .eq('author_id', userId)
        .order('upvote_count', { ascending: false })
        .limit(1)
      return data?.[0]?.upvote_count ?? 0
    }
    default:
      return 0
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<RelayAchievementsResponse>> {
  const supabase = await createClient()

  // Load all relay-category achievements
  const { data: rawAchievements } = await supabase
    .from('achievements')
    .select('id, slug, name, description, icon, tier, criteria')
    .eq('category', 'relay')
    .order('tier', { ascending: true })

  const achievements = rawAchievements ?? []

  // Current user (optional)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Global earner counts per achievement
  const achievementIds = achievements.map((a) => a.id)
  const { data: earnRows } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .in('achievement_id', achievementIds)

  const earnMap: Record<string, number> = {}
  for (const row of earnRows ?? []) {
    earnMap[row.achievement_id] = (earnMap[row.achievement_id] ?? 0) + 1
  }

  // Current user's earned achievement IDs
  const userEarnedSet = new Set<string>()
  const userEarnedAt: Record<string, string> = {}
  if (user) {
    const { data: userEarnRows } = await supabase
      .from('user_achievements')
      .select('achievement_id, earned_at')
      .eq('user_id', user.id)
      .in('achievement_id', achievementIds)
    for (const row of userEarnRows ?? []) {
      userEarnedSet.add(row.achievement_id)
      userEarnedAt[row.achievement_id] = row.earned_at
    }
  }

  // Compute progress for each achievement
  const items: RelayAchievementItem[] = []
  for (const a of achievements) {
    const criteria = a.criteria as { type?: string; threshold?: number }
    const criteriaType = criteria?.type ?? ''
    const threshold = criteria?.threshold ?? 1
    const earned = userEarnedSet.has(a.id)

    let current = 0
    if (user && !earned) {
      current = await computeRelayMetric(user.id, criteriaType, supabase)
    } else if (user && earned) {
      current = threshold
    }

    const pct = threshold > 0 ? Math.min(100, Math.round((current / threshold) * 100)) : 0
    const remaining = Math.max(0, threshold - current)

    items.push({
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      icon: a.icon,
      tier: a.tier as AchievementTier,
      criteriaType,
      threshold,
      earnerCount: earnMap[a.id] ?? 0,
      earned,
      earnedAt: userEarnedAt[a.id] ?? null,
      current,
      pct,
      remaining,
    })
  }

  // Sort: legendary first, then earned last within tier group
  const TIER_ORDER: AchievementTier[] = ['legendary', 'epic', 'rare', 'common']
  items.sort((a, b) => {
    const ta = TIER_ORDER.indexOf(a.tier)
    const tb = TIER_ORDER.indexOf(b.tier)
    if (ta !== tb) return ta - tb
    if (a.earned !== b.earned) return a.earned ? 1 : -1
    return b.pct - a.pct
  })

  const earnedCount = items.filter((i) => i.earned).length

  // Recent earners (last 20 across relay achievements)
  const { data: recentEarnData } = await supabase
    .from('user_achievements')
    .select(`
      earned_at,
      achievement_id,
      profiles!user_achievements_user_id_fkey ( id, username, display_name, avatar_url )
    `)
    .in('achievement_id', achievementIds)
    .order('earned_at', { ascending: false })
    .limit(15)

  const recentEarners: RecentEarner[] = []
  const achievementLookup = Object.fromEntries(achievements.map((a) => [a.id, a]))

  for (const row of recentEarnData ?? []) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const ach = achievementLookup[row.achievement_id]
    if (!profile || !ach) continue
    recentEarners.push({
      userId: profile.id,
      username: profile.username,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      achievementSlug: ach.slug,
      achievementName: ach.name,
      achievementTier: ach.tier as AchievementTier,
      achievementIcon: ach.icon,
      earnedAt: row.earned_at,
    })
  }

  return NextResponse.json({
    achievements: items,
    earnedCount,
    totalCount: items.length,
    recentEarners,
  })
}
