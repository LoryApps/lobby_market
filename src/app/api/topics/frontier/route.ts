import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FrontierTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  support_count: number
  activation_threshold: number
  argument_count: number
  scope: string | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

export interface FrontierResponse {
  newest: FrontierTopic[]        // Proposed in the last 72 h — freshest debates
  uncharted: FrontierTopic[]     // Few votes, first arguments just landing
  almostActive: FrontierTopic[]  // Close to activation threshold
  uncoveredCategories: {
    category: string
    proposedCount: number
    lawCount: number
    gap: number                  // lawCount == 0 ? Infinity proxy : proposedCount / lawCount
  }[]
}

const TOPIC_COLS =
  'id, statement, category, status, blue_pct, total_votes, support_count, activation_threshold, scope, created_at, author_id'

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const since72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

  const [newestRes, unchartedRes, almostRes, categoryGapRes] = await Promise.all([
    // 1. Newest proposed topics — just hit the platform
    supabase
      .from('topics')
      .select(TOPIC_COLS)
      .eq('status', 'proposed')
      .gte('created_at', since72h)
      .order('created_at', { ascending: false })
      .limit(15),

    // 2. Uncharted — proposed topics with very few votes but at least 1 argument
    supabase
      .from('topics')
      .select(TOPIC_COLS)
      .eq('status', 'proposed')
      .lt('total_votes', 20)
      .gt('support_count', 0)
      .order('created_at', { ascending: false })
      .limit(20),

    // 3. Almost active — proposed topics at 60–95% of their activation threshold
    supabase
      .from('topics')
      .select(TOPIC_COLS)
      .eq('status', 'proposed')
      .gt('support_count', 0)
      .order('support_count', { ascending: false })
      .limit(50),

    // 4. Category gap: count proposed + active vs laws per category
    supabase
      .from('topics')
      .select('category, status')
      .in('status', ['proposed', 'active', 'voting', 'law'])
      .not('category', 'is', null),
  ])

  // ── Author lookup ──────────────────────────────────────────────────────────
  const authorIds = new Set<string>()
  for (const res of [newestRes, unchartedRes, almostRes]) {
    for (const t of (res.data ?? [])) {
      if (t.author_id) authorIds.add(t.author_id)
    }
  }

  const authorMap = new Map<string, FrontierTopic['author']>()
  if (authorIds.size > 0) {
    const { data: authors } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', Array.from(authorIds))
    for (const a of (authors ?? [])) {
      authorMap.set(a.id, a)
    }
  }

  // ── Argument counts for uncharted topics ──────────────────────────────────
  const unchartedTopics = unchartedRes.data ?? []
  const argCountMap = new Map<string, number>()
  if (unchartedTopics.length > 0) {
    const { data: argCounts } = await supabase
      .from('topic_arguments')
      .select('topic_id')
      .in('topic_id', unchartedTopics.map((t) => t.id))
    for (const row of (argCounts ?? [])) {
      argCountMap.set(row.topic_id, (argCountMap.get(row.topic_id) ?? 0) + 1)
    }
  }

  function hydrate(raw: typeof newestRes.data, argFallback = 0): FrontierTopic[] {
    return (raw ?? []).map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct,
      total_votes: t.total_votes,
      support_count: t.support_count,
      activation_threshold: t.activation_threshold,
      argument_count: argCountMap.get(t.id) ?? argFallback,
      scope: t.scope,
      created_at: t.created_at,
      author: authorMap.get(t.author_id) ?? null,
    }))
  }

  // ── Almost-active filter (60–95% of threshold) ────────────────────────────
  const almostActive = hydrate(
    (almostRes.data ?? []).filter((t) => {
      const pct = t.activation_threshold > 0 ? t.support_count / t.activation_threshold : 0
      return pct >= 0.6 && pct < 0.95
    }).slice(0, 12),
  )

  // ── Category gap calculation ───────────────────────────────────────────────
  const catProposed = new Map<string, number>()
  const catLaws = new Map<string, number>()
  for (const row of (categoryGapRes.data ?? [])) {
    const cat = row.category!
    if (row.status === 'law') {
      catLaws.set(cat, (catLaws.get(cat) ?? 0) + 1)
    } else {
      catProposed.set(cat, (catProposed.get(cat) ?? 0) + 1)
    }
  }
  const uncoveredCategories = Array.from(catProposed.entries())
    .filter(([cat]) => (catLaws.get(cat) ?? 0) < 3)
    .map(([category, proposedCount]) => {
      const lawCount = catLaws.get(category) ?? 0
      return {
        category,
        proposedCount,
        lawCount,
        gap: lawCount === 0 ? proposedCount * 10 : proposedCount / lawCount,
      }
    })
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 6)

  const body: FrontierResponse = {
    newest: hydrate(newestRes.data),
    uncharted: hydrate(unchartedTopics, 0).filter((t) => argCountMap.has(t.id)).slice(0, 12),
    almostActive,
    uncoveredCategories,
  }

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=60' },
  })
}
