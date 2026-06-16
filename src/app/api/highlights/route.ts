import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 1800 // Refresh every 30 min

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HighlightArgument {
  id: string
  topic_id: string
  user_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  composite_score: number
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
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

export interface CategoryStat {
  category: string
  count: number
  forCount: number
  againstCount: number
  avgScore: number
}

export interface HighlightsResponse {
  arguments: HighlightArgument[]
  total: number
  periodLabel: string
  categoryBreakdown: CategoryStat[]
  generatedAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function compositeScore(upvotes: number, aiScore: number | null): number {
  return upvotes * 3 + (aiScore ?? 0) * 10
}

// ─── GET /api/highlights ──────────────────────────────────────────────────────
//
// Returns top 10 arguments from the last 24 h, ranked by composite score
// (upvotes × 3 + ai_score × 10). One argument per topic to ensure category
// diversity. Falls back to 48 h window if fewer than 5 arguments found.

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const category = searchParams.get('category') ?? null
  const hoursBack = Math.min(parseInt(searchParams.get('hours') ?? '24', 10), 168)

  const supabase = await createClient()

  const windowStart = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()

  const query = supabase
    .from('arguments')
    .select(`
      id,
      topic_id,
      user_id,
      side,
      content,
      upvotes,
      ai_score,
      ai_grade,
      created_at,
      author:profiles!user_id (
        id,
        username,
        display_name,
        avatar_url,
        role,
        clout
      ),
      topic:topics!topic_id (
        id,
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `)
    .gte('created_at', windowStart)
    .gte('upvotes', 1)
    .order('upvotes', { ascending: false })
    .limit(100)

  if (category) {
    // Filter via join — we need a workaround since Supabase doesn't support
    // filtering by nested relation in a single query. Fetch then filter.
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch highlights' }, { status: 500 })
  }

  const rows = (data ?? []) as unknown as HighlightArgument[]

  // Apply category filter if requested
  const filtered = category
    ? rows.filter((a) => (a.topic as { category?: string | null })?.category === category)
    : rows

  // Score and rank
  const scored = filtered.map((a) => ({
    ...a,
    composite_score: compositeScore(a.upvotes, a.ai_score),
  }))

  // Deduplicate: one per topic (keep highest-scoring)
  const seenTopics = new Set<string>()
  const deduped = scored
    .sort((a, b) => b.composite_score - a.composite_score)
    .filter((a) => {
      if (!a.topic_id || seenTopics.has(a.topic_id)) return false
      seenTopics.add(a.topic_id)
      return true
    })
    .slice(0, 10)

  // If we have fewer than 5 results and we're not already at max window, try wider
  let results = deduped
  if (results.length < 5 && hoursBack < 48) {
    const widerStart = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const { data: widerData } = await supabase
      .from('arguments')
      .select(`
        id, topic_id, user_id, side, content, upvotes, ai_score, ai_grade, created_at,
        author:profiles!user_id ( id, username, display_name, avatar_url, role, clout ),
        topic:topics!topic_id ( id, statement, category, status, blue_pct, total_votes )
      `)
      .gte('created_at', widerStart)
      .gte('upvotes', 1)
      .order('upvotes', { ascending: false })
      .limit(200)

    if (widerData) {
      const widerRows = (widerData as unknown as HighlightArgument[]).map((a) => ({
        ...a,
        composite_score: compositeScore(a.upvotes, a.ai_score),
      }))
      const seenTopics2 = new Set<string>()
      results = widerRows
        .sort((a, b) => b.composite_score - a.composite_score)
        .filter((a) => {
          if (!a.topic_id || seenTopics2.has(a.topic_id)) return false
          seenTopics2.add(a.topic_id)
          return true
        })
        .slice(0, 10)
    }
  }

  // Category breakdown
  const catMap = new Map<string, { count: number; forCount: number; againstCount: number; scoreSum: number }>()
  for (const a of results) {
    const cat = (a.topic as { category?: string | null })?.category ?? 'Other'
    const existing = catMap.get(cat) ?? { count: 0, forCount: 0, againstCount: 0, scoreSum: 0 }
    catMap.set(cat, {
      count: existing.count + 1,
      forCount: existing.forCount + (a.side === 'blue' ? 1 : 0),
      againstCount: existing.againstCount + (a.side === 'red' ? 1 : 0),
      scoreSum: existing.scoreSum + a.composite_score,
    })
  }

  const categoryBreakdown: CategoryStat[] = Array.from(catMap.entries())
    .map(([category, s]) => ({
      category,
      count: s.count,
      forCount: s.forCount,
      againstCount: s.againstCount,
      avgScore: s.count > 0 ? Math.round(s.scoreSum / s.count) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  const now = new Date()
  const periodLabel = `${now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })} · Last ${hoursBack}h`

  return NextResponse.json(
    {
      arguments: results,
      total: results.length,
      periodLabel,
      categoryBreakdown,
      generatedAt: new Date().toISOString(),
    } satisfies HighlightsResponse,
    {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    }
  )
}
