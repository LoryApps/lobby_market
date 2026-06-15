import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ProfileTag {
  tag: string
  followed_at: string
  topic_count: number
  follower_count: number
  user_vote_count: number
  viewer_is_following: boolean
}

export interface ProfileTagsResponse {
  profile: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  }
  tags: ProfileTag[]
  is_own_profile: boolean
  stats: {
    total_followed: number
    total_topics_covered: number
    total_votes_via_tags: number
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } }
) {
  const supabase = await createClient()

  // ── Resolve profile ────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // ── Current viewer ─────────────────────────────────────────────────────────
  const { data: { user: viewer } } = await supabase.auth.getUser()
  const isOwner = viewer?.id === profile.id

  // ── Fetch tags this user follows ───────────────────────────────────────────
  const { data: followRows } = await supabase
    .from('user_tag_follows')
    .select('tag, created_at')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  const userTags = (followRows ?? []) as Array<{ tag: string; created_at: string }>

  if (userTags.length === 0) {
    return NextResponse.json({
      profile: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
      },
      tags: [],
      is_own_profile: isOwner,
      stats: { total_followed: 0, total_topics_covered: 0, total_votes_via_tags: 0 },
    } satisfies ProfileTagsResponse)
  }

  const tagNames = userTags.map((r) => r.tag)

  // ── Per-tag stats ──────────────────────────────────────────────────────────
  // Tags are stored as TEXT[] on topics.tags. For each tag we need:
  //   1. How many topics have this tag → filter topics where tags @> ARRAY[tag]
  //   2. How many users follow this tag → count from user_tag_follows
  //   3. How many of those topics the profile user voted on

  // Fetch all topics that carry any of the user's followed tags (one query)
  // Topics with tags stored as a text array — we use the @> (contains) operator
  // via a raw filter. Supabase doesn't expose array overlap natively in the
  // JS client, so we fetch topics and filter in JS.
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, tags')
    .neq('status', 'proposed')    // only active / voting / law / failed
    .limit(5000)

  type TopicRow = { id: string; tags: string[] }
  const topics = (topicRows ?? []) as TopicRow[]

  // Build per-tag topic sets
  const topicsByTag = new Map<string, Set<string>>()
  for (const t of topics) {
    for (const tg of t.tags ?? []) {
      if (tagNames.includes(tg)) {
        if (!topicsByTag.has(tg)) topicsByTag.set(tg, new Set())
        topicsByTag.get(tg)!.add(t.id)
      }
    }
  }

  // Follower counts per tag
  const { data: allTagFollowRows } = await supabase
    .from('user_tag_follows')
    .select('tag')
    .in('tag', tagNames)

  const followerCountMap = new Map<string, number>()
  for (const row of allTagFollowRows ?? []) {
    const r = row as { tag: string }
    followerCountMap.set(r.tag, (followerCountMap.get(r.tag) ?? 0) + 1)
  }

  // User's votes on topics in these tags
  const allTagTopicIds = [...new Set([...topicsByTag.values()].flatMap((s) => [...s]))]

  let userVoteTopicIds = new Set<string>()
  if (allTagTopicIds.length > 0) {
    const { data: voteRows } = await supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', profile.id)
      .in('topic_id', allTagTopicIds)
    userVoteTopicIds = new Set(
      (voteRows ?? []).map((v: { topic_id: string }) => v.topic_id)
    )
  }

  // Per-tag user vote count
  const userVoteCountMap = new Map<string, number>()
  for (const [tag, topicSet] of topicsByTag) {
    let count = 0
    for (const tid of topicSet) {
      if (userVoteTopicIds.has(tid)) count++
    }
    userVoteCountMap.set(tag, count)
  }

  // ── Viewer-follows-tag status ──────────────────────────────────────────────
  let viewerFollowedTags = new Set<string>()
  if (viewer && !isOwner) {
    const { data: viewerFollows } = await supabase
      .from('user_tag_follows')
      .select('tag')
      .eq('user_id', viewer.id)
      .in('tag', tagNames)
    viewerFollowedTags = new Set(
      (viewerFollows ?? []).map((r: { tag: string }) => r.tag)
    )
  } else if (isOwner) {
    viewerFollowedTags = new Set(tagNames)
  }

  // ── Assemble tags ──────────────────────────────────────────────────────────
  const tags: ProfileTag[] = userTags.map((r) => ({
    tag: r.tag,
    followed_at: r.created_at,
    topic_count: topicsByTag.get(r.tag)?.size ?? 0,
    follower_count: followerCountMap.get(r.tag) ?? 0,
    user_vote_count: userVoteCountMap.get(r.tag) ?? 0,
    viewer_is_following: viewerFollowedTags.has(r.tag),
  }))

  // ── Aggregate stats ────────────────────────────────────────────────────────
  const totalTopicsCovered = new Set(
    [...topicsByTag.values()].flatMap((s) => [...s])
  ).size

  return NextResponse.json({
    profile: {
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
    },
    tags,
    is_own_profile: isOwner,
    stats: {
      total_followed: tags.length,
      total_topics_covered: totalTopicsCovered,
      total_votes_via_tags: userVoteTopicIds.size,
    },
  } satisfies ProfileTagsResponse)
}
