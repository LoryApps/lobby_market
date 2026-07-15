import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Returns the last N price snapshots for a batch of topic IDs.
// GET /api/exchange/trends?ids=uuid1,uuid2&limit=12

export interface PriceTick {
  price: number
  volume: number
  recorded_at: string
}

export type TrendsResponse = Record<string, PriceTick[]>

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const idsParam = searchParams.get('ids') ?? ''
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '12', 10), 30)

  const ids = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 50)

  if (ids.length === 0) {
    return NextResponse.json({} satisfies TrendsResponse)
  }

  try {
    const supabase = await createClient()

    // Fetch up to `limit` most-recent snapshots per topic in one query
    const { data, error } = await supabase
      .from('topic_price_history')
      .select('topic_id, price, volume, recorded_at')
      .in('topic_id', ids)
      .order('recorded_at', { ascending: false })
      .limit(ids.length * limit)

    if (error) {
      return NextResponse.json({} satisfies TrendsResponse, { status: 200 })
    }

    // Group by topic_id, keep only the most-recent `limit` rows, then reverse
    // so arrays are oldest-first (good for rendering left-to-right sparklines)
    const grouped: TrendsResponse = {}

    for (const row of data ?? []) {
      const id = row.topic_id as string
      if (!grouped[id]) grouped[id] = []
      if (grouped[id].length < limit) {
        grouped[id].push({
          price: row.price as number,
          volume: row.volume as number,
          recorded_at: row.recorded_at as string,
        })
      }
    }

    for (const id of Object.keys(grouped)) {
      grouped[id] = grouped[id].reverse()
    }

    // For topics with no history, fall back to the current price from the
    // topics table so every card has at least one data point.
    const missingIds = ids.filter((id) => !grouped[id] || grouped[id].length === 0)
    if (missingIds.length > 0) {
      const { data: topicsData } = await supabase
        .from('topics')
        .select('id, blue_pct, total_votes, created_at')
        .in('id', missingIds)

      for (const t of topicsData ?? []) {
        grouped[t.id as string] = [
          {
            price: (t.blue_pct as number) ?? 50,
            volume: (t.total_votes as number) ?? 0,
            recorded_at: (t.created_at as string) ?? new Date().toISOString(),
          },
        ]
      }
    }

    return NextResponse.json(grouped satisfies TrendsResponse, {
      headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
    })
  } catch (err) {
    console.error('[exchange/trends]', err)
    return NextResponse.json({} satisfies TrendsResponse, { status: 200 })
  }
}
