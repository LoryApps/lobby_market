import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface EarnedAchievement {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  tier: string
  criteria_type: string
  threshold: number
  earned_at: string
}

export interface AllAchievementsResponse {
  earned: EarnedAchievement[]
  earned_count: number
  total_count: number
}

/**
 * GET /api/achievements/mine
 *
 * Returns all achievements the current user has earned, merged with the
 * full achievement definition (name, icon, tier, description).  Used by
 * the iOS app's AchievementsView.
 *
 * Returns 401 if not authenticated.
 */
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [allRes, earnedRes] = await Promise.all([
    supabase
      .from('achievements')
      .select('id, slug, name, description, icon, tier, criteria_type, threshold')
      .order('tier', { ascending: true }),
    supabase
      .from('user_achievements')
      .select('achievement_id, earned_at')
      .eq('user_id', user.id),
  ])

  const all = allRes.data ?? []
  const earnedRows = earnedRes.data ?? []

  const earnedMap = new Map(earnedRows.map((r) => [r.achievement_id, r.earned_at]))

  const earned: EarnedAchievement[] = all
    .filter((a) => earnedMap.has(a.id))
    .map((a) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      icon: a.icon,
      tier: a.tier,
      criteria_type: a.criteria_type ?? '',
      threshold: a.threshold ?? 0,
      earned_at: earnedMap.get(a.id)!,
    }))

  return NextResponse.json({
    earned,
    earned_count: earned.length,
    total_count: all.length,
  } satisfies AllAchievementsResponse)
}
