import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConsensusTier =
  | 'unanimous'
  | 'strong'
  | 'clear'
  | 'slim'
  | 'contested'

export interface QualityLaw {
  id: string
  topic_id: string
  statement: string
  category: string | null
  established_at: string
  blue_pct: number
  total_votes: number
  quality_score: number
  consensus_tier: ConsensusTier
  mandate_pct: number // how far above 50%
}

export interface QualityLawsResponse {
  laws: QualityLaw[]
  stats: {
    total: number
    unanimous_count: number
    strong_count: number
    clear_count: number
    slim_count: number
    contested_count: number
    avg_votes: number
    avg_mandate: number
  }
  category: string | null
  sort: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function consensusTier(bluePct: number): ConsensusTier {
  const forPct = Math.max(bluePct, 100 - bluePct)
  if (forPct >= 90) return 'unanimous'
  if (forPct >= 80) return 'strong'
  if (forPct >= 70) return 'clear'
  if (forPct >= 55) return 'slim'
  return 'contested'
}

/**
 * quality_score = sqrt(total_votes) * mandate_strength
 *
 * mandate_strength = (|blue_pct - 50| / 50) — ranges 0–1.
 * A law with 95% FOR and 10 000 votes is much higher quality than
 * one that scraped through at 51% with 50 votes.
 */
function qualityScore(totalVotes: number, bluePct: number): number {
  const mandateStrength = Math.abs(bluePct - 50) / 50
  return Math.round(Math.sqrt(totalVotes) * mandateStrength * 100) / 100
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') ?? null
  const sort = searchParams.get('sort') ?? 'quality'  // quality | votes | mandate | recent
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100)

  try {
    const supabase = await createClient()

    let query = supabase
      .from('laws')
      .select('id, topic_id, statement, category, established_at, blue_pct, total_votes')
      .eq('is_active', true)

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const laws: QualityLaw[] = (data ?? []).map((row) => {
      const bp = row.blue_pct ?? 50
      const tv = row.total_votes ?? 0
      return {
        id: row.id,
        topic_id: row.topic_id,
        statement: row.statement,
        category: row.category ?? null,
        established_at: row.established_at,
        blue_pct: bp,
        total_votes: tv,
        quality_score: qualityScore(tv, bp),
        consensus_tier: consensusTier(bp),
        mandate_pct: Math.round(Math.abs(bp - 50) * 10) / 10,
      }
    })

    // Sort
    laws.sort((a, b) => {
      if (sort === 'votes')   return b.total_votes - a.total_votes
      if (sort === 'mandate') return b.mandate_pct - a.mandate_pct
      if (sort === 'recent')  return new Date(b.established_at).getTime() - new Date(a.established_at).getTime()
      return b.quality_score - a.quality_score
    })

    const paginated = laws.slice(0, limit)

    // Stats
    const stats = {
      total: laws.length,
      unanimous_count: laws.filter(l => l.consensus_tier === 'unanimous').length,
      strong_count: laws.filter(l => l.consensus_tier === 'strong').length,
      clear_count: laws.filter(l => l.consensus_tier === 'clear').length,
      slim_count: laws.filter(l => l.consensus_tier === 'slim').length,
      contested_count: laws.filter(l => l.consensus_tier === 'contested').length,
      avg_votes: laws.length > 0
        ? Math.round(laws.reduce((s, l) => s + l.total_votes, 0) / laws.length)
        : 0,
      avg_mandate: laws.length > 0
        ? Math.round(laws.reduce((s, l) => s + l.mandate_pct, 0) / laws.length * 10) / 10
        : 0,
    }

    return NextResponse.json({
      laws: paginated,
      stats,
      category,
      sort,
    } satisfies QualityLawsResponse)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
