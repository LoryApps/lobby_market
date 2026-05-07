import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DigestTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
}

export interface TagDigestEntry {
  tag: string
  followed_at: string
  topic_count: number
  law_count: number
  active_count: number
  total_votes: number
  /** Topics added in the last 7 days */
  recent_topics: DigestTopic[]
  /** The single hottest topic (by votes) in this tag */
  top_topic: DigestTopic | null
}

export interface MyTagsDigestResponse {
  tags: TagDigestEntry[]
  total_followed: number
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch all tags the user follows
  const { data: followRows, error: followErr } = await supabase
    .from('user_tag_follows')
    .select('tag, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (followErr) {
    console.error('[tags/my-digest] follow fetch error', followErr)
    return NextResponse.json({ tags: [], total_followed: 0 } satisfies MyTagsDigestResponse)
  }

  const followedTags = (followRows ?? []).map((r) => ({
    tag: r.tag as string,
    followed_at: r.created_at as string,
  }))

  if (followedTags.length === 0) {
    return NextResponse.json({ tags: [], total_followed: 0 } satisfies MyTagsDigestResponse)
  }

  const tagNames = followedTags.map((f) => f.tag)

  // 2. Fetch all topics that share at least one followed tag (array overlap)
  const { data: topicRows, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, tags, created_at')
    .overlaps('tags', tagNames)
    .in('status', ['proposed', 'active', 'voting', 'law'])
    .order('total_votes', { ascending: false })
    .limit(2000)

  if (topicErr) {
    console.error('[tags/my-digest] topic fetch error', topicErr)
    return NextResponse.json({ tags: [], total_followed: 0 } satisfies MyTagsDigestResponse)
  }

  const topics = topicRows ?? []
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // 3. Group by tag
  const tagMap = new Map<
    string,
    {
      topic_count: number
      law_count: number
      active_count: number
      total_votes: number
      recent_topics: DigestTopic[]
      top_topic: DigestTopic | null
    }
  >()

  for (const tag of tagNames) {
    tagMap.set(tag, {
      topic_count: 0,
      law_count: 0,
      active_count: 0,
      total_votes: 0,
      recent_topics: [],
      top_topic: null,
    })
  }

  for (const topic of topics) {
    const topicTags: string[] = topic.tags ?? []
    for (const tag of topicTags) {
      if (!tagMap.has(tag)) continue
      const entry = tagMap.get(tag)!

      const dt: DigestTopic = {
        id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status,
        blue_pct: topic.blue_pct ?? 50,
        total_votes: topic.total_votes ?? 0,
        created_at: topic.created_at,
      }

      entry.topic_count++
      entry.total_votes += topic.total_votes ?? 0
      if (topic.status === 'law') entry.law_count++
      if (topic.status === 'active' || topic.status === 'voting') entry.active_count++

      // Recent (last 7 days), capped at 5 per tag
      if (topic.created_at >= sevenDaysAgo && entry.recent_topics.length < 5) {
        entry.recent_topics.push(dt)
      }

      // Top topic = highest votes (topics already sorted by votes desc)
      if (!entry.top_topic && topic.status !== 'failed') {
        entry.top_topic = dt
      }
    }
  }

  // 4. Build response, preserving follow order (most-recently followed first)
  const tags: TagDigestEntry[] = followedTags.map(({ tag, followed_at }) => {
    const entry = tagMap.get(tag) ?? {
      topic_count: 0,
      law_count: 0,
      active_count: 0,
      total_votes: 0,
      recent_topics: [],
      top_topic: null,
    }
    return {
      tag,
      followed_at,
      ...entry,
    }
  })

  return NextResponse.json({
    tags,
    total_followed: followedTags.length,
  } satisfies MyTagsDigestResponse)
}
