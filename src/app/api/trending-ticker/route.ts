import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface TickerTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export const dynamic = 'force-dynamic'
// Cache for 2 minutes — hot topics change quickly but not every second
export const revalidate = 120

export async function GET() {
  try {
    const supabase = await createClient()

    // Grab the 12 hottest active/voting topics by feed_score
    const { data, error } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['active', 'voting'])
      .order('feed_score', { ascending: false })
      .limit(12)

    if (error) {
      return NextResponse.json({ topics: [] }, { status: 200 })
    }

    const topics: TickerTopic[] = (data ?? []).map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      status: t.status,
      blue_pct: typeof t.blue_pct === 'number' ? t.blue_pct : 50,
      total_votes: typeof t.total_votes === 'number' ? t.total_votes : 0,
    }))

    return NextResponse.json({ topics })
  } catch {
    return NextResponse.json({ topics: [] }, { status: 200 })
  }
}
