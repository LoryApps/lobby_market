import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InfluxTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  view_count: number
  created_at: string
  // computed
  viewer_gap: number
  conversion_rate: number
  influx_score: number
}

export interface InfluxStats {
  total_viewer_gap: number
  avg_conversion_rate: number
  highest_gap_topic: InfluxTopic | null
  lowest_conversion_topic: InfluxTopic | null
}

export interface InfluxResponse {
  topics: InfluxTopic[]
  stats: InfluxStats
  category: string | null
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || null

  try {
    const supabase = await createClient()

    let query = supabase
      .from('topics')
      .select('id, statement, category, status, scope, blue_pct, total_votes, view_count, created_at')
      .in('status', ['active', 'voting'])
      // Must have meaningful viewer data and at least some votes
      .gt('view_count', 30)
      .gt('total_votes', 3)
      .order('view_count', { ascending: false })
      .limit(200)

    if (category) {
      query = query.eq('category', category)
    }

    const { data: rows, error } = await query
    if (error) throw error

    const topics: InfluxTopic[] = (rows ?? [])
      .map((t) => {
        const viewCount = t.view_count ?? 0
        const totalVotes = t.total_votes ?? 0
        const viewerGap = Math.max(0, viewCount - totalVotes)
        const conversionRate = viewCount > 0 ? totalVotes / viewCount : 0
        // Influx score: raw viewer gap weighted by total scale
        // Higher = more untapped interest
        const influxScore = viewerGap * (1 - conversionRate)
        return {
          ...t,
          view_count: viewCount,
          total_votes: totalVotes,
          viewer_gap: viewerGap,
          conversion_rate: conversionRate,
          influx_score: influxScore,
        }
      })
      // Only topics where most viewers haven't voted (< 70% conversion)
      .filter((t) => t.conversion_rate < 0.7)
      .sort((a, b) => b.influx_score - a.influx_score)
      .slice(0, 30)

    // ── Stats ─────────────────────────────────────────────────────────────────
    const totalViewerGap = topics.reduce((s, t) => s + t.viewer_gap, 0)
    const avgConversion =
      topics.length > 0
        ? topics.reduce((s, t) => s + t.conversion_rate, 0) / topics.length
        : 0
    const highestGap = topics[0] ?? null
    const lowestConversion = topics.length > 0
      ? [...topics].sort((a, b) => a.conversion_rate - b.conversion_rate)[0]
      : null

    const stats: InfluxStats = {
      total_viewer_gap: totalViewerGap,
      avg_conversion_rate: avgConversion,
      highest_gap_topic: highestGap,
      lowest_conversion_topic: lowestConversion,
    }

    return NextResponse.json({ topics, stats, category } satisfies InfluxResponse)
  } catch (err) {
    console.error('[/api/topics/influx]', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
