import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface BracketTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  scope: string
}

export interface BracketResponse {
  topics: BracketTopic[]
  weekKey: string
}

function getWeekKey(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const start = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil(
    ((now.getTime() - start.getTime()) / 86_400_000 + start.getUTCDay() + 1) / 7
  )
  return `${year}-${String(week).padStart(2, '0')}`
}

/**
 * GET /api/bracket
 *
 * Returns 8 of the most contested active/voting topics to seed this week's
 * Civic Bracket Tournament. "Contested" = vote split closest to 50/50.
 *
 * We pick the 40 most-voted active topics then sort by |blue_pct - 50| asc
 * to find the tightest races. Returns the 8 tightest.
 */
export async function GET() {
  const supabase = await createClient()

  const { data: topics, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope')
    .in('status', ['active', 'voting'])
    .gte('total_votes', 1)
    .order('total_votes', { ascending: false })
    .limit(60)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 })
  }

  const sorted = (topics ?? [])
    .map((t) => ({ ...t, _contestedness: Math.abs((t.blue_pct ?? 50) - 50) }))
    .sort((a, b) => a._contestedness - b._contestedness)
    .slice(0, 8)
    .map(({ _contestedness: _, ...t }) => t)

  // Pad to 8 with any extra topics if not enough contested ones
  if (sorted.length < 8 && topics && topics.length > sorted.length) {
    const needed = 8 - sorted.length
    const ids = new Set(sorted.map((t) => t.id))
    const extras = topics.filter((t) => !ids.has(t.id)).slice(0, needed)
    sorted.push(...extras)
  }

  return NextResponse.json({ topics: sorted, weekKey: getWeekKey() } satisfies BracketResponse)
}
