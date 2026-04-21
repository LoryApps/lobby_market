import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ActivityPost {
  type: 'post'
  id: string
  content: string
  is_pinned: boolean
  coalition_id: string
  coalition_name: string
  member_count: number
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface ActivityStance {
  type: 'stance'
  id: string
  stance: 'for' | 'against' | 'neutral'
  statement: string | null
  coalition_id: string
  coalition_name: string
  member_count: number
  topic_id: string
  topic_statement: string
  topic_category: string | null
  created_at: string
  declarer: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export type ActivityItem = ActivityPost | ActivityStance

export interface ActivityResponse {
  items: ActivityItem[]
  has_more: boolean
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const filterType = searchParams.get('type') ?? 'all' // 'all' | 'post' | 'stance'
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '40', 10) || 40))
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0)

  // ── Fetch public coalitions ─────────────────────────────────────────────────
  const { data: coalitionRows } = await supabase
    .from('coalitions')
    .select('id, name, member_count')
    .eq('is_public', true)

  const coalitions = coalitionRows ?? []
  const coalitionMap = new Map<string, { name: string; member_count: number }>()
  for (const c of coalitions) {
    coalitionMap.set(c.id, { name: c.name, member_count: c.member_count })
  }

  if (coalitions.length === 0) {
    return NextResponse.json({ items: [], has_more: false } satisfies ActivityResponse)
  }

  const publicCoalitionIds = coalitions.map((c) => c.id)

  const items: ActivityItem[] = []

  // ── Fetch coalition posts ──────────────────────────────────────────────────
  if (filterType === 'all' || filterType === 'post') {
    const postLimit = filterType === 'all' ? limit * 2 : limit + 1
    const { data: postRows } = await supabase
      .from('coalition_posts')
      .select('id, coalition_id, author_id, content, is_pinned, created_at')
      .in('coalition_id', publicCoalitionIds)
      .order('created_at', { ascending: false })
      .range(filterType === 'post' ? offset : 0, filterType === 'post' ? offset + postLimit - 1 : postLimit - 1)

    const rawPosts = postRows ?? []

    // Enrich with author profiles
    const authorIds = Array.from(new Set(rawPosts.map((p) => p.author_id)))
    const profileMap = new Map<string, { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }>()

    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', authorIds)
      for (const p of profiles ?? []) profileMap.set(p.id, p)
    }

    for (const post of rawPosts) {
      const coal = coalitionMap.get(post.coalition_id)
      if (!coal) continue
      items.push({
        type: 'post',
        id: post.id,
        content: post.content,
        is_pinned: post.is_pinned,
        coalition_id: post.coalition_id,
        coalition_name: coal.name,
        member_count: coal.member_count,
        created_at: post.created_at,
        author: profileMap.get(post.author_id) ?? null,
      })
    }
  }

  // ── Fetch coalition stances ────────────────────────────────────────────────
  if (filterType === 'all' || filterType === 'stance') {
    const stanceLimit = filterType === 'all' ? limit * 2 : limit + 1
    const { data: stanceRows } = await supabase
      .from('coalition_stances')
      .select('id, coalition_id, topic_id, stance, statement, declared_by, created_at')
      .in('coalition_id', publicCoalitionIds)
      .order('created_at', { ascending: false })
      .range(filterType === 'stance' ? offset : 0, filterType === 'stance' ? offset + stanceLimit - 1 : stanceLimit - 1)

    const rawStances = stanceRows ?? []

    // Enrich with declarer profiles and topic statements
    const declarerIds = Array.from(new Set(rawStances.map((s) => s.declared_by)))
    const topicIds = Array.from(new Set(rawStances.map((s) => s.topic_id)))

    const declarerMap = new Map<string, { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }>()
    const topicMap = new Map<string, { statement: string; category: string | null }>()

    const [profilesRes, topicsRes] = await Promise.all([
      declarerIds.length > 0
        ? supabase.from('profiles').select('id, username, display_name, avatar_url, role').in('id', declarerIds)
        : Promise.resolve({ data: [] }),
      topicIds.length > 0
        ? supabase.from('topics').select('id, statement, category').in('id', topicIds)
        : Promise.resolve({ data: [] }),
    ])

    for (const p of profilesRes.data ?? []) declarerMap.set(p.id, p)
    for (const t of topicsRes.data ?? []) topicMap.set(t.id, { statement: t.statement, category: t.category })

    for (const stance of rawStances) {
      const coal = coalitionMap.get(stance.coalition_id)
      const topic = topicMap.get(stance.topic_id)
      if (!coal || !topic) continue
      items.push({
        type: 'stance',
        id: stance.id,
        stance: stance.stance as 'for' | 'against' | 'neutral',
        statement: stance.statement,
        coalition_id: stance.coalition_id,
        coalition_name: coal.name,
        member_count: coal.member_count,
        topic_id: stance.topic_id,
        topic_statement: topic.statement,
        topic_category: topic.category,
        created_at: stance.created_at,
        declarer: declarerMap.get(stance.declared_by) ?? null,
      })
    }
  }

  // Sort all items together by created_at descending, then paginate
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const paginated = filterType === 'all' ? items.slice(offset, offset + limit) : items.slice(0, limit)
  const has_more = filterType === 'all'
    ? items.length > offset + limit
    : items.length > limit

  return NextResponse.json({
    items: paginated,
    has_more,
  } satisfies ActivityResponse)
}
