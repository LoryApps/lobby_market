import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { RelayLeg, RelayRow } from '@/app/api/relays/route'

export const dynamic = 'force-dynamic'

export type RecommendationReason =
  | 'voted_topic'
  | 'followed_tag'
  | 'almost_complete'
  | 'trending'
  | 'fresh'

export interface RecommendedRelay extends RelayRow {
  reasons: RecommendationReason[]
}

export interface ForYouRelaysResponse {
  relays: RecommendedRelay[]
  is_personalized: boolean
}

// ─── GET /api/relays/for-you ─────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ─── Signals from user activity ──────────────────────────────────────────

  const votedTopicIds = new Set<string>()
  const votedCategories = new Set<string>()
  const tagTopicIds = new Set<string>()
  const userLegRelayIds = new Set<string>()
  const userStartedRelayIds = new Set<string>()

  if (user) {
    // Topics the user has voted on
    const { data: userVotes } = await supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', user.id)
      .limit(200)

    for (const v of userVotes ?? []) {
      if (v.topic_id) votedTopicIds.add(v.topic_id)
    }

    // Categories from those topics
    if (votedTopicIds.size > 0) {
      const { data: votedTopics } = await supabase
        .from('topics')
        .select('id, category')
        .in('id', [...votedTopicIds])

      for (const t of votedTopics ?? []) {
        if (t.category) votedCategories.add(t.category)
      }
    }

    // Tags the user follows → topics that carry those tags
    const { data: followedTags } = await supabase
      .from('user_tag_follows')
      .select('tag_id')
      .eq('user_id', user.id)
      .limit(50)

    const tagIds = (followedTags ?? []).map((f) => f.tag_id)
    if (tagIds.length > 0) {
      const { data: taggedTopics } = await supabase
        .from('topic_tags')
        .select('topic_id')
        .in('tag_id', tagIds)

      for (const tt of taggedTopics ?? []) {
        if (tt.topic_id) tagTopicIds.add(tt.topic_id)
      }
    }

    // Relay legs the user has already contributed to
    const { data: myLegs } = await supabase
      .from('relay_legs')
      .select('relay_id')
      .eq('author_id', user.id)

    for (const l of myLegs ?? []) {
      userLegRelayIds.add(l.relay_id)
    }

    // Relays the user started
    const { data: myRelays } = await supabase
      .from('civic_relays')
      .select('id')
      .eq('starter_id', user.id)

    for (const r of myRelays ?? []) {
      userStartedRelayIds.add(r.id)
    }
  }

  // ─── Fetch candidate relays ───────────────────────────────────────────────

  // For personalized: use voted + tag topic IDs; otherwise fallback to all active relays
  const isPersonalized =
    votedTopicIds.size > 0 || votedCategories.size > 0 || tagTopicIds.size > 0

  let relayQuery = supabase
    .from('civic_relays')
    .select('*')
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(60)

  if (isPersonalized) {
    // Build set of relevant topic IDs
    const relevantTopicIds = new Set<string>([...votedTopicIds, ...tagTopicIds])

    // Also include topics from matching categories
    if (votedCategories.size > 0) {
      const { data: catTopics } = await supabase
        .from('topics')
        .select('id')
        .in('category', [...votedCategories])
        .limit(200)

      for (const t of catTopics ?? []) {
        relevantTopicIds.add(t.id)
      }
    }

    if (relevantTopicIds.size > 0) {
      relayQuery = relayQuery.in('topic_id', [...relevantTopicIds])
    }
  }

  const { data: rawRelays } = await relayQuery

  if (!rawRelays || rawRelays.length === 0) {
    return NextResponse.json({ relays: [], is_personalized: isPersonalized } satisfies ForYouRelaysResponse)
  }

  // Exclude relays the user started or already contributed to
  const filtered = rawRelays.filter(
    (r) => !userLegRelayIds.has(r.id) && !userStartedRelayIds.has(r.id)
  )

  if (filtered.length === 0) {
    return NextResponse.json({ relays: [], is_personalized: isPersonalized } satisfies ForYouRelaysResponse)
  }

  const relayIds = filtered.map((r) => r.id)

  // ─── Fetch starters ───────────────────────────────────────────────────────

  const starterIds = [...new Set(filtered.map((r) => r.starter_id))]
  const { data: starters } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', starterIds)

  const starterMap = new Map(starters?.map((s) => [s.id, s]) ?? [])

  // ─── Fetch topic info ─────────────────────────────────────────────────────

  const topicIds = filtered.map((r) => r.topic_id).filter(Boolean) as string[]
  const { data: topics } =
    topicIds.length > 0
      ? await supabase
          .from('topics')
          .select('id, statement, category, status')
          .in('id', topicIds)
      : { data: [] }

  const topicMap = new Map(topics?.map((t) => [t.id, t]) ?? [])

  // ─── Fetch legs ───────────────────────────────────────────────────────────

  const { data: legsRaw } = await supabase
    .from('relay_legs')
    .select('*, profiles:author_id(id, username, display_name, avatar_url, role)')
    .in('relay_id', relayIds)
    .order('leg_number', { ascending: true })

  const legsByRelay = new Map<string, RelayLeg[]>()
  for (const leg of legsRaw ?? []) {
    const author = (leg as { profiles?: unknown }).profiles as RelayLeg['author'] | null
    const cleaned: RelayLeg = {
      id: leg.id,
      relay_id: leg.relay_id,
      author_id: leg.author_id,
      leg_number: leg.leg_number,
      content: leg.content,
      created_at: leg.created_at,
      upvote_count: (leg as { upvote_count?: number }).upvote_count ?? 0,
      user_upvoted: false,
      author,
    }
    const arr = legsByRelay.get(leg.relay_id) ?? []
    arr.push(cleaned)
    legsByRelay.set(leg.relay_id, arr)
  }

  // ─── Assign reasons and score ──────────────────────────────────────────────

  interface ScoredRelay {
    relay: typeof filtered[0]
    reasons: RecommendationReason[]
    score: number
  }

  const scored: ScoredRelay[] = filtered.map((r) => {
    const reasons: RecommendationReason[] = []
    let score = 0

    const topic = r.topic_id ? topicMap.get(r.topic_id) : null
    const legs = legsByRelay.get(r.id) ?? []
    const legCount = legs.length

    // User voted on this exact topic
    if (r.topic_id && votedTopicIds.has(r.topic_id)) {
      reasons.push('voted_topic')
      score += 30
    }

    // Topic is in a tag the user follows
    if (r.topic_id && tagTopicIds.has(r.topic_id)) {
      reasons.push('followed_tag')
      score += 20
    }

    // Almost complete (within 1 leg of max)
    if (legCount >= r.max_legs - 1 && legCount < r.max_legs) {
      reasons.push('almost_complete')
      score += 15
    }

    // Trending: has > 2 legs and recent activity (leg added in last 24h)
    const lastLeg = legs[legs.length - 1]
    const lastActivity = lastLeg ? new Date(lastLeg.created_at).getTime() : 0
    const hoursOld = (Date.now() - lastActivity) / 3_600_000
    if (legCount > 2 && hoursOld < 24) {
      reasons.push('trending')
      score += 10
    }

    // Bonus: topic has active/voting status (hot policy moment)
    if (topic?.status === 'active' || topic?.status === 'voting') {
      score += 8
    }

    // Bonus: matching category (even if not a direct voted topic)
    if (topic?.category && votedCategories.has(topic.category) && !reasons.includes('voted_topic')) {
      score += 5
    }

    // Fresh relay (less than 6 hours old, open)
    const hoursCreated = (Date.now() - new Date(r.created_at).getTime()) / 3_600_000
    if (r.status === 'open' && hoursCreated < 6) {
      reasons.push('fresh')
      score += 5
    }

    // Tiebreaker: recency
    score += Math.max(0, 10 - Math.floor(hoursCreated / 12))

    return { relay: r, reasons, score }
  })

  // Sort descending by score, cap at 20
  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, 20)

  // ─── Assemble output ─────────────────────────────────────────────────────

  const relays: RecommendedRelay[] = top.map(({ relay: r, reasons }) => {
    const starter = starterMap.get(r.starter_id)
    const topic = r.topic_id ? topicMap.get(r.topic_id) : null

    return {
      id: r.id,
      topic_id: r.topic_id,
      side: r.side as 'for' | 'against',
      starter_id: r.starter_id,
      status: r.status as RelayRow['status'],
      max_legs: r.max_legs,
      vote_compelling: r.vote_compelling,
      vote_not_compelling: r.vote_not_compelling,
      created_at: r.created_at,
      completed_at: r.completed_at,
      topic_statement: topic?.statement ?? null,
      topic_category: topic?.category ?? null,
      topic_status: topic?.status ?? null,
      starter_username: starter?.username ?? 'unknown',
      starter_display_name: starter?.display_name ?? null,
      starter_avatar_url: starter?.avatar_url ?? null,
      starter_role: starter?.role ?? 'person',
      legs: legsByRelay.get(r.id) ?? [],
      user_vote: null,
      user_has_leg: false,
      reasons: reasons.length > 0 ? reasons : ['fresh'],
    }
  })

  return NextResponse.json({ relays, is_personalized: isPersonalized } satisfies ForYouRelaysResponse)
}
