import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/deadlock
 *
 * Topics that have been locked in near-perfect 50/50 disagreement for at
 * least 7 days.  These are the civic community's hardest questions —
 * not because nobody cares (they have real votes), but because no side
 * can gain the upper hand.
 *
 * Algorithm:
 *   1. Topics with blue_pct between 44 and 56 (within 6 pp of 50/50)
 *   2. At least 25 votes cast (meaningful sample, not just noise)
 *   3. Status: 'active' or 'voting' only (resolved proposals aren't deadlocked)
 *   4. Created at least 7 days ago (brand-new topics haven't had time to break)
 *   5. Score by "grip" = proximity to 50% × log10(votes) — tightest standoff
 *      with the most votes ranks highest
 *
 * Distinct from:
 *   /api/feed/battleground  — any contested 35–65% split, regardless of duration
 *   /api/feed/swing         — topics that recently CHANGED direction
 *   /api/feed/stalled       — topics with no recent votes at all
 *   /api/feed/flux          — rapid opinion volatility (changing, not stuck)
 *
 * Query params:
 *   offset  – pagination offset (default 0)
 *   limit   – page size (default 20, max 50)
 *   sort    – "grip" (tightest + most-voted) | "age" (oldest deadlock) | "hot" (most votes) (default "grip")
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const offset = Number(searchParams.get('offset') ?? '0')
  const sort = searchParams.get('sort') ?? 'grip'

  const supabase = await createClient()

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('topics')
    .select(`
      *,
      author:profiles!topics_author_id_fkey(
        id,
        username,
        display_name,
        avatar_url,
        role,
        clout
      )
    `)
    .in('status', ['active', 'voting'])
    .gte('total_votes', 25)
    .gte('blue_pct', 44)
    .lte('blue_pct', 56)
    .lte('created_at', since7d)
    .limit(300)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as TopicRow[]

  // Compute deadlock score
  const scored = rows.map((t) => {
    const deviation = Math.abs((t.blue_pct ?? 50) - 50) // 0 = perfect tie, 6 = edge of range
    const grip = (6 - deviation) / 6 // 1.0 = perfect tie, 0 = barely in range
    const ageMs = Date.now() - new Date(t.created_at).getTime()
    const ageDays = ageMs / (1000 * 60 * 60 * 24)
    return {
      ...t,
      _deadlock_deviation: deviation,
      _deadlock_grip: grip,
      _deadlock_score: grip * Math.log10(Math.max(t.total_votes ?? 1, 1)),
      _deadlock_days: Math.floor(ageDays),
    }
  })

  // Sort
  if (sort === 'age') {
    scored.sort((a, b) => b._deadlock_days - a._deadlock_days)
  } else if (sort === 'hot') {
    scored.sort((a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0))
  } else {
    // grip: tightest standoff with most votes first
    scored.sort((a, b) => b._deadlock_score - a._deadlock_score)
  }

  const page = scored.slice(offset, offset + limit)
  const hasMore = scored.length > offset + limit

  // Aggregate stats
  const avgDeviation = scored.length > 0
    ? scored.reduce((s, t) => s + t._deadlock_deviation, 0) / scored.length
    : 0

  return NextResponse.json({
    topics: page,
    hasMore,
    total: scored.length,
    avgDeviation: Math.round(avgDeviation * 10) / 10,
  })
}

// ── Type helpers ──────────────────────────────────────────────────────────────

interface TopicRow {
  id: string
  statement: string
  description: string | null
  category: string | null
  scope: string
  status: string
  blue_pct: number
  total_votes: number
  total_arguments: number
  blue_votes: number
  red_votes: number
  support_count: number
  activation_threshold: number
  voting_ends_at: string | null
  created_at: string
  updated_at: string
  author_id: string
  feed_score: number
  tags: string[] | null
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  } | null
}
