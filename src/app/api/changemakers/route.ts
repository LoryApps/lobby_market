import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopChangemakerEntry {
  id: string
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  topic_blue_pct: number
  current_vote: 'for' | 'against'
  condition: string
  upvotes: number
  created_at: string
}

export interface ChangemakerTopicEntry {
  topic_id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  changemaker_count: number
  for_count: number
  against_count: number
  top_condition: string | null
  top_upvotes: number
}

export interface OpenMindUser {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  statement_count: number
  total_upvotes: number
  categories: string[]
}

export interface ChangemakersStats {
  total_statements: number
  total_topics_with_changemakers: number
  total_users_participating: number
  for_pct: number
  against_pct: number
}

export interface ChangemakersResponse {
  stats: ChangemakersStats
  top_statements: TopChangemakerEntry[]
  most_active_topics: ChangemakerTopicEntry[]
  open_minds: OpenMindUser[]
  recent: TopChangemakerEntry[]
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Fetch top changemakers by upvotes (across all topics)
  const { data: topRows } = await supabase
    .from('topic_changemakers')
    .select(`
      id,
      user_id,
      topic_id,
      current_vote,
      condition,
      upvotes,
      created_at,
      profiles!inner(username, display_name, avatar_url, role),
      topics!inner(statement, category, status, blue_pct, total_votes)
    `)
    .order('upvotes', { ascending: false })
    .limit(50)

  const topStatements: TopChangemakerEntry[] = (topRows ?? []).map((r) => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    const topic   = Array.isArray(r.topics)   ? r.topics[0]   : r.topics
    return {
      id: r.id,
      user_id: r.user_id,
      username: profile?.username ?? 'unknown',
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      role: profile?.role ?? 'person',
      topic_id: r.topic_id,
      topic_statement: topic?.statement ?? '',
      topic_category: topic?.category ?? null,
      topic_status: topic?.status ?? 'active',
      topic_blue_pct: topic?.blue_pct ?? 50,
      current_vote: r.current_vote as 'for' | 'against',
      condition: r.condition,
      upvotes: r.upvotes ?? 0,
      created_at: r.created_at,
    }
  })

  // Fetch recent changemakers
  const { data: recentRows } = await supabase
    .from('topic_changemakers')
    .select(`
      id,
      user_id,
      topic_id,
      current_vote,
      condition,
      upvotes,
      created_at,
      profiles!inner(username, display_name, avatar_url, role),
      topics!inner(statement, category, status, blue_pct, total_votes)
    `)
    .order('created_at', { ascending: false })
    .limit(20)

  const recent: TopChangemakerEntry[] = (recentRows ?? []).map((r) => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    const topic   = Array.isArray(r.topics)   ? r.topics[0]   : r.topics
    return {
      id: r.id,
      user_id: r.user_id,
      username: profile?.username ?? 'unknown',
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      role: profile?.role ?? 'person',
      topic_id: r.topic_id,
      topic_statement: topic?.statement ?? '',
      topic_category: topic?.category ?? null,
      topic_status: topic?.status ?? 'active',
      topic_blue_pct: topic?.blue_pct ?? 50,
      current_vote: r.current_vote as 'for' | 'against',
      condition: r.condition,
      upvotes: r.upvotes ?? 0,
      created_at: r.created_at,
    }
  })

  // Aggregate stats: topics with most changemakers
  const { data: topicAggRows } = await supabase
    .from('topic_changemakers')
    .select(`
      topic_id,
      current_vote,
      condition,
      upvotes,
      topics!inner(statement, category, status, blue_pct, total_votes)
    `)
    .order('created_at', { ascending: false })

  const topicMap = new Map<string, {
    statement: string; category: string | null; status: string
    blue_pct: number; total_votes: number
    for_count: number; against_count: number
    conditions: Array<{ condition: string; upvotes: number }>
  }>()

  for (const r of topicAggRows ?? []) {
    const topic = Array.isArray(r.topics) ? r.topics[0] : r.topics
    if (!topic) continue
    let entry = topicMap.get(r.topic_id)
    if (!entry) {
      entry = {
        statement: topic.statement,
        category: topic.category,
        status: topic.status,
        blue_pct: topic.blue_pct ?? 50,
        total_votes: topic.total_votes ?? 0,
        for_count: 0,
        against_count: 0,
        conditions: [],
      }
      topicMap.set(r.topic_id, entry)
    }
    if (r.current_vote === 'for') entry.for_count++
    else entry.against_count++
    entry.conditions.push({ condition: r.condition, upvotes: r.upvotes ?? 0 })
  }

  const mostActiveTopics: ChangemakerTopicEntry[] = Array.from(topicMap.entries())
    .map(([topic_id, data]) => {
      const sorted = [...data.conditions].sort((a, b) => b.upvotes - a.upvotes)
      return {
        topic_id,
        statement: data.statement,
        category: data.category,
        status: data.status,
        blue_pct: data.blue_pct,
        total_votes: data.total_votes,
        changemaker_count: data.for_count + data.against_count,
        for_count: data.for_count,
        against_count: data.against_count,
        top_condition: sorted[0]?.condition ?? null,
        top_upvotes: sorted[0]?.upvotes ?? 0,
      }
    })
    .sort((a, b) => b.changemaker_count - a.changemaker_count)
    .slice(0, 20)

  // Users with most changemaker statements (open minds leaderboard)
  const { data: userAggRows } = await supabase
    .from('topic_changemakers')
    .select(`
      user_id,
      upvotes,
      topics!inner(category)
    `)

  const userMap = new Map<string, {
    total_upvotes: number
    statement_count: number
    categories: Set<string>
  }>()

  for (const r of userAggRows ?? []) {
    const topic = Array.isArray(r.topics) ? r.topics[0] : r.topics
    let entry = userMap.get(r.user_id)
    if (!entry) {
      entry = { total_upvotes: 0, statement_count: 0, categories: new Set() }
      userMap.set(r.user_id, entry)
    }
    entry.statement_count++
    entry.total_upvotes += r.upvotes ?? 0
    if (topic?.category) entry.categories.add(topic.category)
  }

  // Fetch profile data for top users
  const topUserIds = Array.from(userMap.entries())
    .sort((a, b) => b[1].statement_count - a[1].statement_count)
    .slice(0, 20)
    .map(([id]) => id)

  const { data: profileRows } = topUserIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', topUserIds)
    : { data: [] }

  const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]))

  const openMinds: OpenMindUser[] = topUserIds
    .map((uid) => {
      const profile = profileMap.get(uid)
      const stats = userMap.get(uid)!
      return {
        user_id: uid,
        username: profile?.username ?? 'unknown',
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        role: profile?.role ?? 'person',
        statement_count: stats.statement_count,
        total_upvotes: stats.total_upvotes,
        categories: Array.from(stats.categories).slice(0, 3),
      }
    })
    .filter((u) => u.username !== 'unknown')

  // Platform-wide stats
  const allEntries = topicAggRows ?? []
  const forCount = allEntries.filter((r) => r.current_vote === 'for').length
  const totalCount = allEntries.length
  const stats: ChangemakersStats = {
    total_statements: totalCount,
    total_topics_with_changemakers: topicMap.size,
    total_users_participating: userMap.size,
    for_pct: totalCount > 0 ? Math.round((forCount / totalCount) * 100) : 50,
    against_pct: totalCount > 0 ? Math.round(((totalCount - forCount) / totalCount) * 100) : 50,
  }

  return NextResponse.json({
    stats,
    top_statements: topStatements,
    most_active_topics: mostActiveTopics,
    open_minds: openMinds,
    recent,
  } satisfies ChangemakersResponse)
}
