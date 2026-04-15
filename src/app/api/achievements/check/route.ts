import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAndGrantAchievements } from '@/lib/achievements'

/**
 * POST /api/achievements/check
 *
 * Evaluates all unearned achievements for the authenticated user and
 * grants any that are now satisfied.  Returns the slugs of newly-granted
 * achievements.
 *
 * Called fire-and-forget from other API routes (vote, topic creation, etc.)
 * or from the client after meaningful actions.
 */
export async function POST() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const granted = await checkAndGrantAchievements(user.id, supabase)

  return NextResponse.json({ granted, count: granted.length })
}
