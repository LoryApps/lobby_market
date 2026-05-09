import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface GauntletTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  /** Distance from 50/50 — lower = more contested = harder */
  contestedness: number
}

export interface GauntletResponse {
  rounds: GauntletTopic[]
}

/**
 * GET /api/gauntlet
 *
 * Returns a batch of 30 topics ordered by ascending difficulty:
 *   - Easy first: strong majorities (blue_pct far from 50)
 *   - Hard later:  near-deadlocks (blue_pct close to 50)
 *
 * Topics must have ≥ 20 votes to be a reliable signal.
 * Only active/voting/law/failed topics (topics with a decided outcome or
 * enough signal to determine the majority position).
 */
export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['active', 'voting', 'law', 'failed'])
    .gte('total_votes', 20)
    .order('total_votes', { ascending: false })
    .limit(200)

  if (error || !data) {
    return NextResponse.json({ rounds: [] } satisfies GauntletResponse)
  }

  // Compute contestedness (distance from 50) and sort easiest → hardest
  const rounds: GauntletTopic[] = data
    .map((t) => ({
      id: t.id as string,
      statement: t.statement as string,
      category: t.category as string | null,
      status: t.status as string,
      blue_pct: t.blue_pct as number,
      total_votes: t.total_votes as number,
      contestedness: Math.abs((t.blue_pct as number) - 50),
    }))
    // Shuffle within contestedness bands to keep the game fresh each session
    .sort((a, b) => {
      // Group into 5-point bands, then randomise within each band
      const bandA = Math.floor(a.contestedness / 5)
      const bandB = Math.floor(b.contestedness / 5)
      if (bandA !== bandB) return bandB - bandA // descending contestedness band = easiest first
      return Math.random() - 0.5
    })
    .slice(0, 30)

  return NextResponse.json({ rounds } satisfies GauntletResponse)
}
