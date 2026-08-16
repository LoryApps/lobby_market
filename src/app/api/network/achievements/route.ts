import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface NetworkAchievementActor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface NetworkAchievementItem {
  id: string
  earned_at: string
  actor: NetworkAchievementActor
  achievement: {
    id: string
    slug: string
    name: string
    description: string
    icon: string
    tier: 'common' | 'rare' | 'epic' | 'legendary'
  }
}

export interface NetworkAchievementsResponse {
  achievements: NetworkAchievementItem[]
  following_count: number
  is_empty: boolean
  cursor: string | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') || '40', 10), 80)
  const cursor = searchParams.get('cursor') ?? null

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch IDs of users this person follows
  const { data: follows, error: followErr } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', user.id)

  if (followErr) {
    return NextResponse.json({ error: 'Failed to fetch follows' }, { status: 500 })
  }

  const followingIds = (follows ?? []).map((f) => f.following_id as string)

  if (followingIds.length === 0) {
    return NextResponse.json({
      achievements: [],
      following_count: 0,
      is_empty: true,
      cursor: null,
    } satisfies NetworkAchievementsResponse)
  }

  // 2. Fetch recent achievements earned by followed users
  let query = supabase
    .from('user_achievements')
    .select('id, user_id, achievement_id, earned_at')
    .in('user_id', followingIds)
    .order('earned_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt('earned_at', cursor)
  }

  const { data: rows, error: rowErr } = await query

  if (rowErr) {
    return NextResponse.json({ error: 'Failed to fetch achievements' }, { status: 500 })
  }

  const allRows = rows ?? []
  const hasMore = allRows.length > limit
  const pageRows = hasMore ? allRows.slice(0, limit) : allRows
  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.earned_at ?? null) : null

  if (pageRows.length === 0) {
    return NextResponse.json({
      achievements: [],
      following_count: followingIds.length,
      is_empty: true,
      cursor: null,
    } satisfies NetworkAchievementsResponse)
  }

  // 3. Fetch actor profiles
  const actorIds = Array.from(new Set(pageRows.map((r) => r.user_id as string)))
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', actorIds)

  const actorMap = new Map<string, NetworkAchievementActor>()
  for (const p of profileRows ?? []) {
    actorMap.set(p.id, {
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      role: p.role ?? 'citizen',
    })
  }

  // 4. Fetch achievement details
  const achievementIds = Array.from(new Set(pageRows.map((r) => r.achievement_id as string)))
  const { data: achievementRows } = await supabase
    .from('achievements')
    .select('id, slug, name, description, icon, tier')
    .in('id', achievementIds)

  const achievementMap = new Map<string, NetworkAchievementItem['achievement']>()
  for (const a of achievementRows ?? []) {
    achievementMap.set(a.id, {
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      icon: a.icon,
      tier: a.tier as 'common' | 'rare' | 'epic' | 'legendary',
    })
  }

  // 5. Build response
  const achievements: NetworkAchievementItem[] = []
  for (const row of pageRows) {
    const actor = actorMap.get(row.user_id as string)
    const achievement = achievementMap.get(row.achievement_id as string)
    if (!actor || !achievement) continue

    achievements.push({
      id: row.id,
      earned_at: row.earned_at,
      actor,
      achievement,
    })
  }

  return NextResponse.json({
    achievements,
    following_count: followingIds.length,
    is_empty: achievements.length === 0,
    cursor: nextCursor,
  } satisfies NetworkAchievementsResponse)
}
