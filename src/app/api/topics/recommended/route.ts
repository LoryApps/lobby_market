import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Topic } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export interface RecommendedTopic {
  id: string
  statement: string
  category: string | null
  scope: string
  status: string
  blue_pct: number
  total_votes: number
  support_count: number
  activation_threshold: number
  feed_score: number
  view_count: number
  created_at: string
  reason: 'category_match' | 'trending' | 'coalition_stance' | 'near_law' | 'near_threshold'
  reason_label: string
}

export interface RecommendedTopicsResponse {
  topics: RecommendedTopic[]
  personalized: boolean
  categories_used: string[]
}

const FALLBACK_STATUSES = ['active', 'voting', 'proposed'] as const

/**
 * GET /api/topics/recommended
 *
 * Returns up to 20 personalized topic recommendations for the authenticated
 * user. Falls back to top active topics for anonymous users.
 *
 * Priority order:
 *   1. Active/voting topics in the user's preferred categories not yet voted on
 *   2. Proposed topics near their activation threshold in preferred categories
 *   3. Topics where user's coalition has taken an official stance
 *   4. Trending topics platform-wide the user hasn't seen
 */
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Anonymous / no-preference fallback ────────────────────────────────────
  if (!user) {
    const { data: topTopics } = await supabase
      .from('topics')
      .select('*')
      .in('status', ['active', 'voting'])
      .order('feed_score', { ascending: false })
      .limit(20)

    const topics = (topTopics ?? []) as Topic[]
    return NextResponse.json({
      topics: topics.map((t) => ({
        id: t.id,
        statement: t.statement,
        category: t.category,
        scope: t.scope,
        status: t.status,
        blue_pct: t.blue_pct,
        total_votes: t.total_votes,
        support_count: t.support_count,
        activation_threshold: t.activation_threshold,
        feed_score: t.feed_score,
        view_count: t.view_count,
        created_at: t.created_at,
        reason: 'trending' as const,
        reason_label: 'Trending Now',
      })),
      personalized: false,
      categories_used: [],
    } satisfies RecommendedTopicsResponse)
  }

  // ── Load user context in parallel ─────────────────────────────────────────
  const [profileRes, votedRes, coalitionRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('category_preferences, clout, reputation_score')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', user.id)
      .limit(500),
    supabase
      .from('coalition_members')
      .select('coalition_id')
      .eq('user_id', user.id)
      .limit(10),
  ])

  const profile = profileRes.data
  const votedTopicIds = new Set((votedRes.data ?? []).map((v) => v.topic_id))
  const coalitionIds = (coalitionRes.data ?? []).map((cm) => cm.coalition_id)

  const preferredCategories: string[] =
    profile?.category_preferences && profile.category_preferences.length > 0
      ? profile.category_preferences
      : []

  const collected: Map<string, RecommendedTopic> = new Map()

  // ── 1. Active/voting topics in preferred categories ───────────────────────
  if (preferredCategories.length > 0) {
    const { data: catTopics } = await supabase
      .from('topics')
      .select('*')
      .in('status', ['active', 'voting'])
      .in('category', preferredCategories)
      .order('feed_score', { ascending: false })
      .limit(30)

    for (const t of (catTopics ?? []) as Topic[]) {
      if (!votedTopicIds.has(t.id) && !collected.has(t.id)) {
        collected.set(t.id, {
          id: t.id,
          statement: t.statement,
          category: t.category,
          scope: t.scope,
          status: t.status,
          blue_pct: t.blue_pct,
          total_votes: t.total_votes,
          support_count: t.support_count,
          activation_threshold: t.activation_threshold,
          feed_score: t.feed_score,
          view_count: t.view_count,
          created_at: t.created_at,
          reason: 'category_match',
          reason_label: `In ${t.category ?? 'your categories'}`,
        })
      }
    }
  }

  // ── 2. Proposed topics near threshold in preferred categories ─────────────
  if (preferredCategories.length > 0 && collected.size < 20) {
    const { data: nearThreshold } = await supabase
      .from('topics')
      .select('*')
      .eq('status', 'proposed')
      .in('category', preferredCategories)
      .order('support_count', { ascending: false })
      .limit(20)

    for (const t of (nearThreshold ?? []) as Topic[]) {
      if (!votedTopicIds.has(t.id) && !collected.has(t.id)) {
        const pct =
          t.activation_threshold > 0
            ? Math.round((t.support_count / t.activation_threshold) * 100)
            : 0
        if (pct >= 40) {
          collected.set(t.id, {
            id: t.id,
            statement: t.statement,
            category: t.category,
            scope: t.scope,
            status: t.status,
            blue_pct: t.blue_pct,
            total_votes: t.total_votes,
            support_count: t.support_count,
            activation_threshold: t.activation_threshold,
            feed_score: t.feed_score,
            view_count: t.view_count,
            created_at: t.created_at,
            reason: 'near_threshold',
            reason_label: `${pct}% to activation`,
          })
        }
      }
    }
  }

  // ── 3. Topics where user's coalitions have stances ────────────────────────
  if (coalitionIds.length > 0 && collected.size < 20) {
    const { data: stanceRows } = await supabase
      .from('coalition_stances')
      .select('topic_id, stance, coalition_id')
      .in('coalition_id', coalitionIds)
      .in('stance', ['for', 'against'])
      .limit(30)

    if (stanceRows && stanceRows.length > 0) {
      const stanceTopicIds = Array.from(
        new Set(stanceRows.map((s) => s.topic_id))
      ).filter((id) => !votedTopicIds.has(id) && !collected.has(id))

      if (stanceTopicIds.length > 0) {
        const { data: stanceTopics } = await supabase
          .from('topics')
          .select('*')
          .in('id', stanceTopicIds.slice(0, 15))
          .in('status', FALLBACK_STATUSES)

        for (const t of (stanceTopics ?? []) as Topic[]) {
          if (!collected.has(t.id)) {
            collected.set(t.id, {
              id: t.id,
              statement: t.statement,
              category: t.category,
              scope: t.scope,
              status: t.status,
              blue_pct: t.blue_pct,
              total_votes: t.total_votes,
              support_count: t.support_count,
              activation_threshold: t.activation_threshold,
              feed_score: t.feed_score,
              view_count: t.view_count,
              created_at: t.created_at,
              reason: 'coalition_stance',
              reason_label: 'Your coalition has a stance',
            })
          }
        }
      }
    }
  }

  // ── 4. Near-law topics (voting, close to 67% threshold) ──────────────────
  if (collected.size < 20) {
    const { data: nearLaw } = await supabase
      .from('topics')
      .select('*')
      .eq('status', 'voting')
      .gte('blue_pct', 55)
      .order('blue_pct', { ascending: false })
      .limit(10)

    for (const t of (nearLaw ?? []) as Topic[]) {
      if (!votedTopicIds.has(t.id) && !collected.has(t.id)) {
        collected.set(t.id, {
          id: t.id,
          statement: t.statement,
          category: t.category,
          scope: t.scope,
          status: t.status,
          blue_pct: t.blue_pct,
          total_votes: t.total_votes,
          support_count: t.support_count,
          activation_threshold: t.activation_threshold,
          feed_score: t.feed_score,
          view_count: t.view_count,
          created_at: t.created_at,
          reason: 'near_law',
          reason_label: `${Math.round(t.blue_pct)}% FOR · near law`,
        })
      }
    }
  }

  // ── 5. Trending fallback to fill remaining slots ───────────────────────────
  if (collected.size < 20) {
    const { data: trending } = await supabase
      .from('topics')
      .select('*')
      .in('status', ['active', 'voting'])
      .order('feed_score', { ascending: false })
      .limit(40)

    for (const t of (trending ?? []) as Topic[]) {
      if (!votedTopicIds.has(t.id) && !collected.has(t.id)) {
        collected.set(t.id, {
          id: t.id,
          statement: t.statement,
          category: t.category,
          scope: t.scope,
          status: t.status,
          blue_pct: t.blue_pct,
          total_votes: t.total_votes,
          support_count: t.support_count,
          activation_threshold: t.activation_threshold,
          feed_score: t.feed_score,
          view_count: t.view_count,
          created_at: t.created_at,
          reason: 'trending',
          reason_label: 'Trending Now',
        })
      }
      if (collected.size >= 20) break
    }
  }

  return NextResponse.json({
    topics: Array.from(collected.values()).slice(0, 20),
    personalized: preferredCategories.length > 0,
    categories_used: preferredCategories,
  } satisfies RecommendedTopicsResponse)
}
