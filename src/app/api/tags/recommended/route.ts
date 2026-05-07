import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface RecommendedTag {
  tag: string
  topic_count: number
  active_count: number
  total_votes: number
  /** Why this tag was recommended */
  reason: 'voted_topic' | 'cooccurrence' | 'trending'
}

export interface RecommendedTagsResponse {
  recommendations: RecommendedTag[]
}

const MAX_RECOMMENDATIONS = 8
const MIN_TOPIC_COUNT = 2

/**
 * GET /api/tags/recommended
 *
 * Returns personalized tag recommendations for the authenticated user.
 *
 * Algorithm (in priority order):
 * 1. Tags from topics the user has voted on → reveals what they care about
 * 2. Tags that co-occur with tags they already follow → adjacent interests
 * 3. High-activity tags they haven't followed yet → discovery
 *
 * Always excludes tags the user already follows.
 * Falls back to trending tags for unauthenticated users.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Build a map of all tag stats from topics ───────────────────────────────

  const { data: allTopics, error: topicsErr } = await supabase
    .from('topics')
    .select('id, tags, status, total_votes')
    .not('tags', 'eq', '{}')
    .in('status', ['proposed', 'active', 'voting', 'law'])
    .limit(2000)

  if (topicsErr || !allTopics) {
    return NextResponse.json({ recommendations: [] } satisfies RecommendedTagsResponse)
  }

  type TagStats = {
    topic_count: number
    active_count: number
    total_votes: number
    topic_ids: string[]
  }

  const tagStatsMap = new Map<string, TagStats>()
  for (const topic of allTopics) {
    for (const tag of (topic.tags as string[] | null) ?? []) {
      if (!tag) continue
      const existing = tagStatsMap.get(tag) ?? {
        topic_count: 0,
        active_count: 0,
        total_votes: 0,
        topic_ids: [],
      }
      existing.topic_count++
      existing.total_votes += topic.total_votes ?? 0
      if (topic.status === 'active' || topic.status === 'voting') existing.active_count++
      existing.topic_ids.push(topic.id)
      tagStatsMap.set(tag, existing)
    }
  }

  // ── For unauthenticated users, return top trending tags ────────────────────

  if (!user) {
    const trending: RecommendedTag[] = Array.from(tagStatsMap.entries())
      .filter(([, s]) => s.topic_count >= MIN_TOPIC_COUNT)
      .sort((a, b) => b[1].total_votes - a[1].total_votes || b[1].active_count - a[1].active_count)
      .slice(0, MAX_RECOMMENDATIONS)
      .map(([tag, s]) => ({
        tag,
        topic_count: s.topic_count,
        active_count: s.active_count,
        total_votes: s.total_votes,
        reason: 'trending' as const,
      }))
    return NextResponse.json({ recommendations: trending } satisfies RecommendedTagsResponse)
  }

  // ── Fetch user's already-followed tags ─────────────────────────────────────

  const [followedRes, votedRes] = await Promise.all([
    supabase
      .from('user_tag_follows')
      .select('tag')
      .eq('user_id', user.id),
    supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', user.id)
      .limit(200),
  ])

  const followedTags = new Set<string>(
    (followedRes.data ?? []).map((r) => r.tag as string)
  )

  const votedTopicIds = new Set<string>(
    (votedRes.data ?? []).map((r) => r.topic_id as string)
  )

  // ── Phase 1: tags from topics the user voted on ────────────────────────────

  const tagFrequency = new Map<string, number>()
  for (const topic of allTopics) {
    if (!votedTopicIds.has(topic.id)) continue
    for (const tag of (topic.tags as string[] | null) ?? []) {
      if (!tag || followedTags.has(tag)) continue
      tagFrequency.set(tag, (tagFrequency.get(tag) ?? 0) + 1)
    }
  }

  // Sort by frequency (most common tags from voted topics)
  const votedTagCandidates = Array.from(tagFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .filter((tag) => (tagStatsMap.get(tag)?.topic_count ?? 0) >= MIN_TOPIC_COUNT)

  // ── Phase 2: co-occurring tags with followed tags ──────────────────────────

  const cooccurrenceMap = new Map<string, number>()
  if (followedTags.size > 0) {
    // Find topics that have any of the followed tags
    for (const topic of allTopics) {
      const topicTags = (topic.tags as string[] | null) ?? []
      const hasFollowedTag = topicTags.some((t) => followedTags.has(t))
      if (!hasFollowedTag) continue
      // Count co-occurring tags
      for (const tag of topicTags) {
        if (!tag || followedTags.has(tag)) continue
        cooccurrenceMap.set(tag, (cooccurrenceMap.get(tag) ?? 0) + 1)
      }
    }
  }

  const coocCandidates = Array.from(cooccurrenceMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .filter(
      (tag) =>
        !tagFrequency.has(tag) && // not already in phase 1
        (tagStatsMap.get(tag)?.topic_count ?? 0) >= MIN_TOPIC_COUNT
    )

  // ── Phase 3: trending tags not yet followed ────────────────────────────────

  const trendingCandidates = Array.from(tagStatsMap.entries())
    .filter(([tag, s]) => !followedTags.has(tag) && s.topic_count >= MIN_TOPIC_COUNT)
    .sort((a, b) => b[1].total_votes - a[1].total_votes || b[1].active_count - a[1].active_count)
    .map(([tag]) => tag)
    .filter((tag) => !tagFrequency.has(tag) && !cooccurrenceMap.has(tag))

  // ── Merge and label results ────────────────────────────────────────────────

  const seen = new Set<string>()
  const recommendations: RecommendedTag[] = []

  function addTag(tag: string, reason: RecommendedTag['reason']) {
    if (seen.has(tag) || followedTags.has(tag)) return
    const stats = tagStatsMap.get(tag)
    if (!stats) return
    seen.add(tag)
    recommendations.push({
      tag,
      topic_count: stats.topic_count,
      active_count: stats.active_count,
      total_votes: stats.total_votes,
      reason,
    })
  }

  for (const tag of votedTagCandidates) {
    if (recommendations.length >= MAX_RECOMMENDATIONS) break
    addTag(tag, 'voted_topic')
  }

  for (const tag of coocCandidates) {
    if (recommendations.length >= MAX_RECOMMENDATIONS) break
    addTag(tag, 'cooccurrence')
  }

  for (const tag of trendingCandidates) {
    if (recommendations.length >= MAX_RECOMMENDATIONS) break
    addTag(tag, 'trending')
  }

  return NextResponse.json({ recommendations } satisfies RecommendedTagsResponse)
}
