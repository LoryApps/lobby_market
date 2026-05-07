import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface RecommendedArgument {
  id: string
  topic_id: string
  user_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  created_at: string
  relevance: 'voted_topic' | 'preferred_category' | 'trending'
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
}

export interface RecommendedArgumentsResponse {
  arguments: RecommendedArgument[]
  source: 'personalized' | 'trending'
  preferred_categories: string[]
  voted_topic_count: number
}

/**
 * GET /api/arguments/recommended
 *
 * Returns personalized argument recommendations for the authenticated user.
 *
 * Personalisation strategy (layered):
 *   1. Arguments on topics the user has voted on (highest relevance)
 *   2. Arguments in the user's preferred categories (from onboarding / history)
 *   3. Globally trending arguments as a fallback
 *
 * Excludes:
 *   - Arguments authored by the current user
 *   - Arguments the user has already upvoted
 */
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const LIMIT = 30

  // ── Unauthenticated: return trending fallback ──────────────────────────────
  if (!user) {
    const { data: trendingRows } = await supabase
      .from('topic_arguments')
      .select(
        `id, topic_id, user_id, side, content, upvotes, created_at,
         profiles!topic_arguments_user_id_fkey(id, username, display_name, avatar_url, role),
         topics!topic_arguments_topic_id_fkey(id, statement, category, status, blue_pct, total_votes)`
      )
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('upvotes', { ascending: false })
      .limit(LIMIT)

    const args = (trendingRows ?? []).map((row: Record<string, unknown>) => {
      const profiles = row.profiles as Record<string, unknown> | null
      const topics = row.topics as Record<string, unknown> | null
      return {
        id: row.id as string,
        topic_id: row.topic_id as string,
        user_id: row.user_id as string,
        side: row.side as 'blue' | 'red',
        content: row.content as string,
        upvotes: row.upvotes as number,
        created_at: row.created_at as string,
        relevance: 'trending' as const,
        author: profiles
          ? {
              id: profiles.id as string,
              username: profiles.username as string,
              display_name: profiles.display_name as string | null,
              avatar_url: profiles.avatar_url as string | null,
              role: profiles.role as string,
            }
          : null,
        topic: topics
          ? {
              id: topics.id as string,
              statement: topics.statement as string,
              category: topics.category as string | null,
              status: topics.status as string,
              blue_pct: topics.blue_pct as number,
              total_votes: topics.total_votes as number,
            }
          : null,
      }
    })

    return NextResponse.json({
      arguments: args,
      source: 'trending',
      preferred_categories: [],
      voted_topic_count: 0,
    } satisfies RecommendedArgumentsResponse)
  }

  // ── Fetch user context in parallel ────────────────────────────────────────
  const [profileRes, votedTopicsRes, upvotedArgumentsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('category_preferences')
      .eq('id', user.id)
      .single(),
    supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('topic_argument_votes')
      .select('argument_id')
      .eq('user_id', user.id),
  ])

  const categoryPrefs: string[] =
    (profileRes.data?.category_preferences as string[] | null) ?? []

  const votedTopicIds = (votedTopicsRes.data ?? []).map((v: { topic_id: string }) => v.topic_id)
  const upvotedArgIds = new Set(
    (upvotedArgumentsRes.data ?? []).map((v: { argument_id: string }) => v.argument_id)
  )

  const results: RecommendedArgument[] = []
  const seenIds = new Set<string>()

  // ── Layer 1: arguments on topics the user has voted on ────────────────────
  if (votedTopicIds.length > 0) {
    const { data: votedRows } = await supabase
      .from('topic_arguments')
      .select(
        `id, topic_id, user_id, side, content, upvotes, created_at,
         profiles!topic_arguments_user_id_fkey(id, username, display_name, avatar_url, role),
         topics!topic_arguments_topic_id_fkey(id, statement, category, status, blue_pct, total_votes)`
      )
      .in('topic_id', votedTopicIds.slice(0, 25))
      .neq('user_id', user.id)
      .order('upvotes', { ascending: false })
      .limit(20)

    for (const row of votedRows ?? []) {
      const r = row as Record<string, unknown>
      if (seenIds.has(r.id as string) || upvotedArgIds.has(r.id as string)) continue
      seenIds.add(r.id as string)
      const profiles = r.profiles as Record<string, unknown> | null
      const topics = r.topics as Record<string, unknown> | null
      results.push({
        id: r.id as string,
        topic_id: r.topic_id as string,
        user_id: r.user_id as string,
        side: r.side as 'blue' | 'red',
        content: r.content as string,
        upvotes: r.upvotes as number,
        created_at: r.created_at as string,
        relevance: 'voted_topic',
        author: profiles
          ? {
              id: profiles.id as string,
              username: profiles.username as string,
              display_name: profiles.display_name as string | null,
              avatar_url: profiles.avatar_url as string | null,
              role: profiles.role as string,
            }
          : null,
        topic: topics
          ? {
              id: topics.id as string,
              statement: topics.statement as string,
              category: topics.category as string | null,
              status: topics.status as string,
              blue_pct: topics.blue_pct as number,
              total_votes: topics.total_votes as number,
            }
          : null,
      })
    }
  }

  // ── Layer 2: arguments in preferred categories ────────────────────────────
  const activeCategories = categoryPrefs.length > 0 ? categoryPrefs : []
  if (activeCategories.length > 0 && results.length < LIMIT) {
    const { data: catRows } = await supabase
      .from('topic_arguments')
      .select(
        `id, topic_id, user_id, side, content, upvotes, created_at,
         profiles!topic_arguments_user_id_fkey(id, username, display_name, avatar_url, role),
         topics!topic_arguments_topic_id_fkey(id, statement, category, status, blue_pct, total_votes)`
      )
      .in('topics.category', activeCategories)
      .neq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .order('upvotes', { ascending: false })
      .limit(20)

    for (const row of catRows ?? []) {
      const r = row as Record<string, unknown>
      if (seenIds.has(r.id as string) || upvotedArgIds.has(r.id as string)) continue
      seenIds.add(r.id as string)
      const profiles = r.profiles as Record<string, unknown> | null
      const topics = r.topics as Record<string, unknown> | null
      results.push({
        id: r.id as string,
        topic_id: r.topic_id as string,
        user_id: r.user_id as string,
        side: r.side as 'blue' | 'red',
        content: r.content as string,
        upvotes: r.upvotes as number,
        created_at: r.created_at as string,
        relevance: 'preferred_category',
        author: profiles
          ? {
              id: profiles.id as string,
              username: profiles.username as string,
              display_name: profiles.display_name as string | null,
              avatar_url: profiles.avatar_url as string | null,
              role: profiles.role as string,
            }
          : null,
        topic: topics
          ? {
              id: topics.id as string,
              statement: topics.statement as string,
              category: topics.category as string | null,
              status: topics.status as string,
              blue_pct: topics.blue_pct as number,
              total_votes: topics.total_votes as number,
            }
          : null,
      })
    }
  }

  // ── Layer 3: trending fallback ────────────────────────────────────────────
  if (results.length < LIMIT) {
    const { data: fallbackRows } = await supabase
      .from('topic_arguments')
      .select(
        `id, topic_id, user_id, side, content, upvotes, created_at,
         profiles!topic_arguments_user_id_fkey(id, username, display_name, avatar_url, role),
         topics!topic_arguments_topic_id_fkey(id, statement, category, status, blue_pct, total_votes)`
      )
      .neq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('upvotes', { ascending: false })
      .limit(LIMIT - results.length + 10)

    for (const row of fallbackRows ?? []) {
      const r = row as Record<string, unknown>
      if (seenIds.has(r.id as string) || upvotedArgIds.has(r.id as string)) continue
      seenIds.add(r.id as string)
      const profiles = r.profiles as Record<string, unknown> | null
      const topics = r.topics as Record<string, unknown> | null
      results.push({
        id: r.id as string,
        topic_id: r.topic_id as string,
        user_id: r.user_id as string,
        side: r.side as 'blue' | 'red',
        content: r.content as string,
        upvotes: r.upvotes as number,
        created_at: r.created_at as string,
        relevance: 'trending',
        author: profiles
          ? {
              id: profiles.id as string,
              username: profiles.username as string,
              display_name: profiles.display_name as string | null,
              avatar_url: profiles.avatar_url as string | null,
              role: profiles.role as string,
            }
          : null,
        topic: topics
          ? {
              id: topics.id as string,
              statement: topics.statement as string,
              category: topics.category as string | null,
              status: topics.status as string,
              blue_pct: topics.blue_pct as number,
              total_votes: topics.total_votes as number,
            }
          : null,
      })
      if (results.length >= LIMIT) break
    }
  }

  const hasPersonalization = votedTopicIds.length > 0 || categoryPrefs.length > 0

  return NextResponse.json({
    arguments: results.slice(0, LIMIT),
    source: hasPersonalization ? 'personalized' : 'trending',
    preferred_categories: categoryPrefs,
    voted_topic_count: votedTopicIds.length,
  } satisfies RecommendedArgumentsResponse)
}
