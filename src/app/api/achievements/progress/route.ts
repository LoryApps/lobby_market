import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AchievementTier } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export interface AchievementProgress {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  tier: AchievementTier
  criteriaType: string
  threshold: number
  current: number
  pct: number
  remaining: number
  metricLabel: string
}

export interface AchievementProgressResponse {
  inProgress: AchievementProgress[]
  earnedCount: number
  totalCount: number
}

const METRIC_LABELS: Record<string, string> = {
  total_votes: 'votes cast',
  topics_authored: 'topics proposed',
  laws_authored: 'laws established',
  vote_streak: 'day vote streak',
  minority_wins: 'minority wins',
  chain_depth: 'chain depth',
  signup_rank: 'early members joined first',
  total_arguments: 'arguments made',
  bookmarks_count: 'topics bookmarked',
  clout_balance: 'clout earned',
  coalitions_count: 'coalitions joined',
  debates_count: 'debates participated in',
  follower_count: 'followers',
  predictions_count: 'predictions made',
  topics_supported: 'laws you helped pass',
  relays_started: 'relay chains started',
  relay_legs_added: 'relay legs contributed',
  relays_completed: 'relays fully completed',
  relay_compelling_votes: 'relays voted compelling',
  relay_leg_stars: 'stars on your best relay leg',
}

async function computeMetric(
  userId: string,
  type: string,
  supabase: Awaited<ReturnType<typeof createClient>>
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
      const lawMap = new Map(lawTopics.map((t) => [t.id, t]))
      let count = 0
      for (const v of userVotes) {
        const t = lawMap.get(v.topic_id)
        if (!t) continue
        const majorityIsBlue = t.blue_votes >= t.red_votes
        if ((v.side === 'blue' && !majorityIsBlue) || (v.side === 'red' && majorityIsBlue)) count++
      }
      return count
    }
    case 'chain_depth': {
      const { data } = await supabase
        .from('topics')
        .select('chain_depth')
        .eq('author_id', userId)
        .order('chain_depth', { ascending: false })
        .limit(1)
      return data?.[0]?.chain_depth ?? 0
    }
    case 'signup_rank': {
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
    case 'total_arguments': {
      const { data } = await supabase
        .from('profiles')
        .select('total_arguments')
        .eq('id', userId)
        .single()
      return (data as { total_arguments?: number } | null)?.total_arguments ?? 0
    }
    case 'bookmarks_count': {
      const { count } = await supabase
        .from('topic_bookmarks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      return count ?? 0
    }
    case 'clout_balance': {
      const { data } = await supabase
        .from('profiles')
        .select('clout')
        .eq('id', userId)
        .single()
      return data?.clout ?? 0
    }
    case 'coalitions_count': {
      const { count } = await supabase
        .from('coalition_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      return count ?? 0
    }
    case 'debates_count': {
      const { count } = await supabase
        .from('debate_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      return count ?? 0
    }
    case 'follower_count': {
      const { data } = await supabase
        .from('profiles')
        .select('followers_count')
        .eq('id', userId)
        .single()
      return (data as { followers_count?: number } | null)?.followers_count ?? 0
    }
    case 'predictions_count': {
      const { count } = await supabase
        .from('topic_predictions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      return count ?? 0
    }
    case 'topics_supported': {
      const { data: userVotes } = await supabase
        .from('votes')
        .select('topic_id')
        .eq('user_id', userId)
      if (!userVotes?.length) return 0
      const topicIds = userVotes.map((v) => v.topic_id)
      const { count } = await supabase
        .from('topics')
        .select('*', { count: 'exact', head: true })
        .in('id', topicIds)
        .eq('status', 'law')
      return count ?? 0
    }
    case 'relays_started': {
      const { count } = await supabase
        .from('civic_relays')
        .select('*', { count: 'exact', head: true })
        .eq('starter_id', userId)
      return count ?? 0
    }
    case 'relay_legs_added': {
      const { count } = await supabase
        .from('relay_legs')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', userId)
      return count ?? 0
    }
    case 'relays_completed': {
      const { count } = await supabase
        .from('civic_relays')
        .select('*', { count: 'exact', head: true })
        .eq('starter_id', userId)
        .in('status', ['complete', 'voted'])
      return count ?? 0
    }
    case 'relay_compelling_votes': {
      // Number of the user's relays that have ≥1 compelling vote
      const { data: myRelays } = await supabase
        .from('civic_relays')
        .select('id')
        .eq('starter_id', userId)
      if (!myRelays?.length) return 0
      const relayIds = myRelays.map((r) => r.id)
      const { count } = await supabase
        .from('relay_votes')
        .select('relay_id', { count: 'exact', head: false })
        .in('relay_id', relayIds)
        .eq('vote', 'compelling')
      // Count distinct relays with at least one compelling vote (rough approximation)
      // A proper DISTINCT COUNT requires a separate approach
      if (!count || count === 0) return 0
      // Fetch distinct relay_ids with compelling votes
      const { data: compellingRows } = await supabase
        .from('relay_votes')
        .select('relay_id')
        .in('relay_id', relayIds)
        .eq('vote', 'compelling')
      const distinctRelays = new Set((compellingRows ?? []).map((r) => r.relay_id))
      return distinctRelays.size
    }
    case 'relay_leg_stars': {
      // Max stars any single leg of the user has received
      const { data: myLegs } = await supabase
        .from('relay_legs')
        .select('id')
        .eq('author_id', userId)
      if (!myLegs?.length) return 0
      const legIds = myLegs.map((l) => l.id)
      const { data: starRows } = await supabase
        .from('relay_leg_upvotes')
        .select('leg_id')
        .in('leg_id', legIds)
      if (!starRows?.length) return 0
      const starsByLeg = new Map<string, number>()
      for (const row of starRows) {
        starsByLeg.set(row.leg_id, (starsByLeg.get(row.leg_id) ?? 0) + 1)
      }
      return Math.max(...Array.from(starsByLeg.values()))
    }
    default:
      return 0
  }
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Load full achievement catalog
  const { data: allAchievements } = await supabase
    .from('achievements')
    .select('id, slug, name, description, icon, tier, criteria')

  if (!allAchievements?.length) {
    return NextResponse.json<AchievementProgressResponse>({
      inProgress: [],
      earnedCount: 0,
      totalCount: 0,
    })
  }

  // Load already-earned IDs
  const { data: earnedRows } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', user.id)

  const earnedIds = new Set((earnedRows ?? []).map((r) => r.achievement_id))

  const unearned = (allAchievements as Array<{
    id: string
    slug: string
    name: string
    description: string
    icon: string
    tier: AchievementTier
    criteria: Record<string, unknown>
  }>).filter((a) => !earnedIds.has(a.id) && a.criteria?.type && a.criteria?.threshold != null)

  // Compute progress for each unearned achievement
  // De-duplicate metric fetches — many achievements share the same type
  const uniqueMetrics = Array.from(new Set(unearned.map((a) => a.criteria.type as string)))
  const metricCache = new Map<string, number>()
  for (const type of uniqueMetrics) {
    metricCache.set(type, await computeMetric(user.id, type, supabase))
  }

  const progress: AchievementProgress[] = unearned.map((a) => {
    const type = a.criteria.type as string
    const threshold = a.criteria.threshold as number
    const current = metricCache.get(type) ?? 0
    // signup_rank is inverted: lower is better
    const isInverted = type === 'signup_rank'
    const pct = isInverted
      ? Math.min(100, Math.max(0, Math.round(((threshold - Math.min(current, threshold)) / threshold) * 100)))
      : Math.min(100, Math.max(0, Math.round((current / threshold) * 100)))
    const remaining = isInverted ? Math.max(0, current - threshold) : Math.max(0, threshold - current)

    return {
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      icon: a.icon,
      tier: a.tier,
      criteriaType: type,
      threshold,
      current: isInverted ? 0 : current,
      pct,
      remaining,
      metricLabel: METRIC_LABELS[type] ?? type,
    }
  })

  // Sort by percentage descending (closest to earning first), then by tier weight
  const tierWeight: Record<AchievementTier, number> = {
    common: 0,
    rare: 1,
    epic: 2,
    legendary: 3,
  }
  progress.sort((a, b) => {
    if (b.pct !== a.pct) return b.pct - a.pct
    return tierWeight[a.tier] - tierWeight[b.tier]
  })

  // Return top 8 (enough for profile + overview sections across all branches)
  return NextResponse.json<AchievementProgressResponse>({
    inProgress: progress.slice(0, 8),
    earnedCount: earnedIds.size,
    totalCount: allAchievements.length,
  })
}
