import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface MosaicTile {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  view_count: number
  created_at: string
}

export interface MosaicStats {
  total: number
  total_laws: number
  total_active: number
  total_contested: number
  total_mandates: number
  total_votes_cast: number
  avg_consensus: number
}

export interface MosaicResponse {
  tiles: MosaicTile[]
  stats: MosaicStats
  categories: string[]
  updated_at: string
}

const COLS = 'id, statement, category, status, blue_pct, total_votes, view_count, created_at'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topics')
    .select(COLS)
    .not('status', 'eq', 'proposed')
    .order('total_votes', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also include proposed topics that have enough support to show
  const { data: proposed } = await supabase
    .from('topics')
    .select(COLS)
    .eq('status', 'proposed')
    .gte('total_votes', 3)
    .order('total_votes', { ascending: false })
    .limit(100)

  const allTiles: MosaicTile[] = [
    ...(data ?? []),
    ...(proposed ?? []),
  ].map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category,
    status: t.status,
    blue_pct: t.blue_pct ?? 50,
    total_votes: t.total_votes ?? 0,
    view_count: t.view_count ?? 0,
    created_at: t.created_at,
  }))

  const laws = allTiles.filter((t) => t.status === 'law')
  const active = allTiles.filter((t) => ['active', 'voting'].includes(t.status))
  const contested = allTiles.filter(
    (t) => Math.abs((t.blue_pct ?? 50) - 50) < 10
  )
  const mandates = allTiles.filter(
    (t) => Math.abs((t.blue_pct ?? 50) - 50) > 25
  )
  const totalVotes = allTiles.reduce((s, t) => s + (t.total_votes ?? 0), 0)
  const avgConsensus =
    allTiles.length > 0
      ? allTiles.reduce((s, t) => s + Math.abs((t.blue_pct ?? 50) - 50), 0) /
        allTiles.length
      : 0

  const categories = Array.from(
    new Set(allTiles.map((t) => t.category).filter(Boolean) as string[])
  ).sort()

  const stats: MosaicStats = {
    total: allTiles.length,
    total_laws: laws.length,
    total_active: active.length,
    total_contested: contested.length,
    total_mandates: mandates.length,
    total_votes_cast: totalVotes,
    avg_consensus: Math.round(avgConsensus * 10) / 10,
  }

  return NextResponse.json({
    tiles: allTiles,
    stats,
    categories,
    updated_at: new Date().toISOString(),
  } satisfies MosaicResponse)
}
