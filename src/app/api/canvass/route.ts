import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CanvassTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string
  blue_pct: number
  total_votes: number
  total_arguments: number
  created_at: string
}

export interface CanvassStats {
  total_active: number
  voted_count: number
  unvoted_count: number
  completion_pct: number
  category_breakdown: CategoryStat[]
}

export interface CategoryStat {
  category: string
  total: number
  voted: number
  unvoted: number
}

export interface CanvassResponse {
  topics: CanvassTopic[]
  stats: CanvassStats
  category: string | null
  authenticated: boolean
}

// ─── GET /api/canvass ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || null
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 60)

  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // ── Fetch all non-failed topics ─────────────────────────────────────────
    let allTopicsQuery = supabase
      .from('topics')
      .select('id, statement, category, status, scope, blue_pct, total_votes, total_arguments, created_at')
      .in('status', ['active', 'proposed', 'voting'])
      .order('total_votes', { ascending: false })

    if (category) allTopicsQuery = allTopicsQuery.eq('category', category)

    const { data: allTopics } = await allTopicsQuery.limit(300)
    const topics = (allTopics ?? []) as CanvassTopic[]

    if (!user) {
      // Unauthenticated: return all topics, mark as not authenticated
      const stats: CanvassStats = {
        total_active: topics.length,
        voted_count: 0,
        unvoted_count: topics.length,
        completion_pct: 0,
        category_breakdown: [],
      }
      return NextResponse.json({
        topics: topics.slice(0, limit),
        stats,
        category,
        authenticated: false,
      } satisfies CanvassResponse)
    }

    // ── Fetch this user's votes ─────────────────────────────────────────────
    const { data: userVotes } = await supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', user.id)

    const votedSet = new Set((userVotes ?? []).map((v) => v.topic_id as string))

    // ── Split: voted vs unvoted ─────────────────────────────────────────────
    const unvotedTopics = topics.filter((t) => !votedSet.has(t.id))
    const votedCount = topics.length - unvotedTopics.length

    // ── Category breakdown ──────────────────────────────────────────────────
    const catMap = new Map<string, { total: number; voted: number }>()
    for (const t of topics) {
      const cat = t.category ?? 'Other'
      const entry = catMap.get(cat) ?? { total: 0, voted: 0 }
      entry.total += 1
      if (votedSet.has(t.id)) entry.voted += 1
      catMap.set(cat, entry)
    }

    const category_breakdown: CategoryStat[] = Array.from(catMap.entries())
      .map(([cat, { total, voted }]) => ({
        category: cat,
        total,
        voted,
        unvoted: total - voted,
      }))
      .sort((a, b) => b.unvoted - a.unvoted)

    const stats: CanvassStats = {
      total_active: topics.length,
      voted_count: votedCount,
      unvoted_count: unvotedTopics.length,
      completion_pct:
        topics.length > 0 ? Math.round((votedCount / topics.length) * 100) : 0,
      category_breakdown,
    }

    const filtered = category
      ? unvotedTopics.filter((t) => (t.category ?? 'Other') === category)
      : unvotedTopics

    return NextResponse.json({
      topics: filtered.slice(0, limit),
      stats,
      category,
      authenticated: true,
    } satisfies CanvassResponse)
  } catch (err) {
    console.error('[canvass]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
