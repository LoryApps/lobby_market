import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TagVoteStat {
  tag: string
  total: number
  for_count: number
  against_count: number
  for_pct: number
  /** Community-wide FOR% for this tag (across all voters) */
  community_for_pct: number | null
  /** +ve means you lean more FOR than the community, –ve more AGAINST */
  alignment_delta: number | null
  /** Most-voted topic in this tag */
  top_topic_id: string | null
  top_topic_statement: string | null
  top_topic_status: string | null
  is_following: boolean
}

export interface TagAnalyticsResponse {
  total_votes: number
  unique_tags: number
  most_voted_tag: string | null
  most_contrarian_tag: string | null  // largest alignment_delta magnitude
  tags: TagVoteStat[]
}

// ─── GET /api/analytics/tags ──────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch all votes cast by this user, with the parent topic's tags + status
  const { data: voteRows, error: voteErr } = await supabase
    .from('votes')
    .select('side, topic:topics(id, statement, status, tags)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (voteErr) {
    return NextResponse.json({ error: voteErr.message }, { status: 500 })
  }

  const rows = (voteRows ?? []) as Array<{
    side: 'blue' | 'red'
    topic: {
      id: string
      statement: string
      status: string
      tags: string[] | null
    } | null
  }>

  // 2. Which tags does the user follow?
  const { data: followRows } = await supabase
    .from('user_tag_follows')
    .select('tag')
    .eq('user_id', user.id)

  const followedTags = new Set((followRows ?? []).map((r: { tag: string }) => r.tag))

  // 3. Aggregate vote counts per tag
  const tagMap = new Map<
    string,
    {
      for: number
      against: number
      topics: Map<string, { statement: string; status: string; votes: number }>
    }
  >()

  for (const row of rows) {
    const tags = row.topic?.tags ?? []
    if (!tags.length) continue

    for (const tag of tags) {
      if (!tagMap.has(tag)) {
        tagMap.set(tag, { for: 0, against: 0, topics: new Map() })
      }
      const entry = tagMap.get(tag)!
      if (row.side === 'blue') entry.for++
      else entry.against++

      if (row.topic) {
        const existing = entry.topics.get(row.topic.id)
        if (existing) {
          existing.votes++
        } else {
          entry.topics.set(row.topic.id, {
            statement: row.topic.statement,
            status: row.topic.status,
            votes: 1,
          })
        }
      }
    }
  }

  // 4. Fetch community-wide FOR% per tag using all votes
  const userTags = Array.from(tagMap.keys())

  const communityForPct: Record<string, number> = {}

  if (userTags.length > 0) {
    const { data: communityTopics } = await supabase
      .from('topics')
      .select('tags, blue_pct, total_votes')
      .overlaps('tags', userTags)
      .not('blue_pct', 'is', null)
      .gt('total_votes', 0)
      .limit(2000)

    if (communityTopics) {
      const tagTotals = new Map<string, { weightedSum: number; totalWeight: number }>()

      for (const topic of communityTopics as Array<{
        tags: string[]
        blue_pct: number
        total_votes: number
      }>) {
        for (const tag of topic.tags) {
          if (!userTags.includes(tag)) continue
          if (!tagTotals.has(tag)) tagTotals.set(tag, { weightedSum: 0, totalWeight: 0 })
          const t = tagTotals.get(tag)!
          t.weightedSum += topic.blue_pct * topic.total_votes
          t.totalWeight += topic.total_votes
        }
      }

      for (const [tag, { weightedSum, totalWeight }] of tagTotals) {
        communityForPct[tag] = totalWeight > 0 ? weightedSum / totalWeight : 50
      }
    }
  }

  // 5. Build the response
  const tagStats: TagVoteStat[] = []

  for (const [tag, entry] of tagMap) {
    const total = entry.for + entry.against
    const forPct = total > 0 ? Math.round((entry.for / total) * 100) : 50
    const communityPct = communityForPct[tag] ?? null
    const alignmentDelta =
      communityPct !== null ? Math.round(forPct - communityPct) : null

    let topTopic: { id: string; statement: string; status: string } | null = null
    let topVotes = 0
    for (const [id, t] of entry.topics) {
      if (t.votes > topVotes) {
        topVotes = t.votes
        topTopic = { id, statement: t.statement, status: t.status }
      }
    }

    tagStats.push({
      tag,
      total,
      for_count: entry.for,
      against_count: entry.against,
      for_pct: forPct,
      community_for_pct: communityPct !== null ? Math.round(communityPct) : null,
      alignment_delta: alignmentDelta,
      top_topic_id: topTopic?.id ?? null,
      top_topic_statement: topTopic?.statement ?? null,
      top_topic_status: topTopic?.status ?? null,
      is_following: followedTags.has(tag),
    })
  }

  tagStats.sort((a, b) => b.total - a.total)

  let mostContrarian: string | null = null
  let maxDelta = 0
  for (const t of tagStats) {
    if (t.alignment_delta !== null && Math.abs(t.alignment_delta) > maxDelta) {
      maxDelta = Math.abs(t.alignment_delta)
      mostContrarian = t.tag
    }
  }

  const response: TagAnalyticsResponse = {
    total_votes: rows.length,
    unique_tags: tagStats.length,
    most_voted_tag: tagStats[0]?.tag ?? null,
    most_contrarian_tag: mostContrarian,
    tags: tagStats,
  }

  return NextResponse.json(response)
}
