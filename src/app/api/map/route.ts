import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface MapTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  view_count: number
  created_at: string
}

export interface MapDataResponse {
  topics: MapTopic[]
  categories: string[]
  stats: {
    total: number
    active: number
    laws: number
    failed: number
    max_votes: number
    avg_blue_pct: number
  }
}

const COLS = 'id, statement, category, status, blue_pct, total_votes, view_count, created_at'
const MIN_VOTES = 3

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topics')
    .select(COLS)
    .gte('total_votes', MIN_VOTES)
    .not('status', 'eq', 'proposed')
    .order('total_votes', { ascending: false })
    .limit(400)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also grab proposed topics with at least some support
  const { data: proposed } = await supabase
    .from('topics')
    .select(COLS)
    .eq('status', 'proposed')
    .gte('total_votes', MIN_VOTES)
    .order('total_votes', { ascending: false })
    .limit(100)

  const all = [...(data ?? []), ...(proposed ?? [])] as MapTopic[]

  const categories = Array.from(
    new Set(all.map((t) => t.category ?? 'Other').filter(Boolean))
  ).sort()

  const maxVotes = all.reduce((m, t) => Math.max(m, t.total_votes), 0)
  const totalBlue = all.reduce((s, t) => s + t.blue_pct, 0)

  const stats = {
    total: all.length,
    active: all.filter((t) => t.status === 'active' || t.status === 'voting').length,
    laws: all.filter((t) => t.status === 'law').length,
    failed: all.filter((t) => t.status === 'failed').length,
    max_votes: maxVotes,
    avg_blue_pct: all.length ? Math.round(totalBlue / all.length) : 50,
  }

  return NextResponse.json({ topics: all, categories, stats } satisfies MapDataResponse)
}
