import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LighthouseTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string
  blue_pct: number
  total_votes: number
  created_at: string
  updated_at: string
  days_dark: number
  // computed
  neglect_score: number
}

export interface LighthouseStats {
  neglected_count: number
  total_neglected_votes: number
  oldest_dark_topic: LighthouseTopic | null
  longest_dark_days: number
}

export interface LighthouseResponse {
  topics: LighthouseTopic[]
  stats: LighthouseStats
  category: string | null
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || null

  try {
    const supabase = await createClient()

    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

    let query = supabase
      .from('topics')
      .select('id, statement, category, status, scope, blue_pct, total_votes, created_at, updated_at')
      .in('status', ['active', 'proposed'])
      .lt('created_at', cutoff)
      .lt('total_votes', 100)
      .order('total_votes', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(50)

    if (category) {
      query = query.eq('category', category)
    }

    const { data: rows, error } = await query

    if (error) throw error

    const now = Date.now()

    const topics: LighthouseTopic[] = (rows ?? []).map((t) => {
      const daysSinceCreated = (now - new Date(t.created_at).getTime()) / 86_400_000
      const daysSinceActive = (now - new Date(t.updated_at).getTime()) / 86_400_000
      const daysDark = Math.max(daysSinceCreated, daysSinceActive)

      // Neglect score: higher = more neglected
      // Formula: age * (1 / (votes + 1)) — old topics with few votes score highest
      const neglectScore = daysDark / (t.total_votes + 1)

      return {
        ...t,
        days_dark: Math.round(daysDark),
        neglect_score: neglectScore,
      }
    })

    // Sort by neglect_score desc
    topics.sort((a, b) => b.neglect_score - a.neglect_score)

    // Slice to 20 for the page
    const topTopics = topics.slice(0, 20)

    const oldest = topTopics.length > 0 ? topTopics[0] : null
    const longestDays = oldest?.days_dark ?? 0

    const stats: LighthouseStats = {
      neglected_count: topics.length,
      total_neglected_votes: topics.reduce((sum, t) => sum + t.total_votes, 0),
      oldest_dark_topic: oldest,
      longest_dark_days: longestDays,
    }

    return NextResponse.json({ topics: topTopics, stats, category } satisfies LighthouseResponse)
  } catch (err) {
    console.error('[lighthouse]', err)
    return NextResponse.json({ error: 'Failed to load lighthouse data' }, { status: 500 })
  }
}
