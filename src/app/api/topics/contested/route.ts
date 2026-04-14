import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface ContestedTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  view_count: number
  created_at: string
  updated_at: string
  scope: string | null
  /** Distance from 50/50: 100 = perfectly split, 0 = full consensus */
  controversy_score: number
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') // 'active', 'voting', 'proposed', or null for all
  const category = searchParams.get('category')
  const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 100)

  const supabase = await createClient()

  let query = supabase
    .from('topics')
    .select(
      'id, statement, category, status, blue_pct, total_votes, view_count, created_at, updated_at, scope'
    )
    // Only count topics with at least 5 votes so stats are meaningful
    .gt('total_votes', 4)

  if (status) {
    query = query.eq('status', status as 'proposed' | 'active' | 'voting')
  } else {
    // Default: live topics only (proposed, active, voting)
    query = query.in('status', ['proposed', 'active', 'voting'])
  }

  if (category) {
    query = query.eq('category', category)
  }

  // Fetch a large batch so we can sort by controversy in JS
  const { data, error } = await query.order('total_votes', { ascending: false }).limit(500)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 })
  }

  // Sort by controversy: closest to 50/50 wins
  // controversy_score = 100 - abs(blue_pct - 50) * 2
  //   → 100 means perfect 50/50
  //   → 0 means 100% one-sided
  const sorted: ContestedTopic[] = (data ?? [])
    .map((topic) => ({
      ...topic,
      blue_pct: topic.blue_pct ?? 50,
      controversy_score:
        100 - Math.abs((topic.blue_pct ?? 50) - 50) * 2,
    }))
    .filter((t) => t.controversy_score >= 60) // At least moderately contested (40–60% range)
    .sort((a, b) => {
      // Primary: closest to 50/50
      const scoreDiff = b.controversy_score - a.controversy_score
      if (Math.abs(scoreDiff) > 0.5) return scoreDiff
      // Tie-break: more votes first (more significant contest)
      return b.total_votes - a.total_votes
    })
    .slice(0, limit)

  return NextResponse.json({ topics: sorted })
}
