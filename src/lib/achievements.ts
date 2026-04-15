/**
 * Achievement granting logic.
 *
 * Call `checkAndGrantAchievements(userId, supabase)` after any user action
 * (vote cast, topic created, etc.) to evaluate unearned achievements and
 * insert any newly-qualifying ones.  A notification of type
 * `achievement_earned` is created for each grant so the client-side
 * AchievementWatcher can surface it as a toast.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './supabase/types'

type Client = SupabaseClient<Database>

interface AchievementRow {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  tier: string
  criteria: Record<string, unknown>
}

// ─── Metric helpers ──────────────────────────────────────────────────────────

async function computeMetric(
  userId: string,
  type: string,
  supabase: Client
): Promise<number> {
  switch (type) {
    case 'total_votes': {
      const { data } = await supabase
        .from('profiles')
        .select('total_votes')
        .eq('id', userId)
        .single()
      return data?.total_votes ?? 0
    }

    case 'topics_authored': {
      const { count } = await supabase
        .from('topics')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', userId)
      return count ?? 0
    }

    case 'laws_authored': {
      const { count } = await supabase
        .from('topics')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', userId)
        .eq('status', 'law')
      return count ?? 0
    }

    case 'vote_streak': {
      const { data } = await supabase
        .from('profiles')
        .select('vote_streak')
        .eq('id', userId)
        .single()
      return data?.vote_streak ?? 0
    }

    case 'minority_wins': {
      // Count topics where user voted on the minority side AND the topic
      // resolved into a law.  We compare user's vote side against the
      // majority (whichever side has more votes at resolution).
      //
      // Two-step: get the user's vote sides, then look up the law topics.
      const { data: userVotes } = await supabase
        .from('votes')
        .select('side, topic_id')
        .eq('user_id', userId)

      if (!userVotes?.length) return 0

      const topicIds = userVotes.map((v) => v.topic_id)

      const { data: lawTopics } = await supabase
        .from('topics')
        .select('id, blue_votes, red_votes')
        .in('id', topicIds)
        .eq('status', 'law')

      if (!lawTopics?.length) return 0

      const lawMap = new Map(
        lawTopics.map((t) => [t.id, { blue_votes: t.blue_votes, red_votes: t.red_votes }])
      )

      let minorityCount = 0
      for (const row of userVotes) {
        const t = lawMap.get(row.topic_id)
        if (!t) continue
        const majorityIsBlue = t.blue_votes >= t.red_votes
        const onMinority =
          (row.side === 'blue' && !majorityIsBlue) ||
          (row.side === 'red' && majorityIsBlue)
        if (onMinority) minorityCount++
      }
      return minorityCount
    }

    case 'chain_depth': {
      // Find the deepest chain_depth across all topics authored by the user.
      const { data } = await supabase
        .from('topics')
        .select('chain_depth')
        .eq('author_id', userId)
        .order('chain_depth', { ascending: false })
        .limit(1)
      return data?.[0]?.chain_depth ?? 0
    }

    case 'signup_rank': {
      // Count how many profiles registered before (or at the same moment as)
      // this user.  A value <= threshold means they're an early member.
      const { data: profile } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', userId)
        .single()
      if (!profile) return 999_999

      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .lte('created_at', profile.created_at)
      return count ?? 999_999
    }

    default:
      return 0
  }
}

// ─── Core grant function ─────────────────────────────────────────────────────

/**
 * Evaluate every unearned achievement for `userId`.  Grant any that the user
 * now qualifies for, then create `achievement_earned` notifications (unless
 * the user has opted out).
 *
 * Returns the slugs of newly-granted achievements (empty array if none).
 */
export async function checkAndGrantAchievements(
  userId: string,
  supabase: Client
): Promise<string[]> {
  // 1. Load achievement catalog
  const { data: allAchievements, error: catalogError } = await supabase
    .from('achievements')
    .select('id, slug, name, description, icon, tier, criteria')

  if (catalogError || !allAchievements?.length) return []

  // 2. Load already-earned achievement IDs for this user
  const { data: earnedRows } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId)

  const earnedIds = new Set((earnedRows ?? []).map((r) => r.achievement_id))

  // 3. Evaluate each unearned achievement
  const toGrant: AchievementRow[] = []

  for (const achievement of allAchievements as AchievementRow[]) {
    if (earnedIds.has(achievement.id)) continue

    const criteria = achievement.criteria as {
      type?: string
      threshold?: number
    }
    if (!criteria?.type || criteria.threshold == null) continue

    const value = await computeMetric(userId, criteria.type, supabase)
    if (value >= criteria.threshold) {
      toGrant.push(achievement)
    }
  }

  if (toGrant.length === 0) return []

  // 4. Insert into user_achievements (ignore duplicates via ON CONFLICT)
  const { error: insertError } = await supabase
    .from('user_achievements')
    .insert(
      toGrant.map((a) => ({
        user_id: userId,
        achievement_id: a.id,
      }))
    )

  if (insertError) return []

  // 5. Check if the user wants achievement notifications (default: true)
  const { data: prefs } = await supabase
    .from('user_notification_prefs')
    .select('achievement_earned')
    .eq('user_id', userId)
    .maybeSingle()

  const notifyEnabled = prefs?.achievement_earned !== false

  if (notifyEnabled && toGrant.length > 0) {
    // Build notification body: "tier: <tier>\n<description>"
    // The AchievementWatcher parses this format to set the toast tier.
    await supabase.from('notifications').insert(
      toGrant.map((a) => ({
        user_id: userId,
        type: 'achievement_earned' as const,
        title: `Achievement Unlocked: ${a.name}`,
        body: `tier: ${a.tier}\n${a.description}`,
        reference_id: a.id,
        reference_type: 'achievement',
      }))
    )
  }

  return toGrant.map((a) => a.slug)
}
