import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type BedrockTier =
  | 'constitutional'
  | 'foundational'
  | 'established'
  | 'settled'
  | 'contested'

export interface BedrockLaw {
  id: string
  topic_id: string
  statement: string
  category: string | null
  established_at: string
  blue_pct: number
  total_votes: number
  // computed
  days_as_law: number
  consensus_strength: number
  bedrock_score: number
  tier: BedrockTier
}

export interface BedrockStats {
  total_laws: number
  avg_consensus: number
  constitutional_count: number
  oldest_law: BedrockLaw | null
  strongest_law: BedrockLaw | null
  avg_days_as_law: number
}

export interface BedrockResponse {
  laws: BedrockLaw[]
  stats: BedrockStats
  category: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tier(consensusStrength: number): BedrockTier {
  if (consensusStrength >= 70) return 'constitutional'
  if (consensusStrength >= 50) return 'foundational'
  if (consensusStrength >= 30) return 'established'
  if (consensusStrength >= 10) return 'settled'
  return 'contested'
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || null

  try {
    const supabase = await createClient()

    let query = supabase
      .from('laws')
      .select('id, topic_id, statement, category, established_at, blue_pct, total_votes')
      .eq('is_active', true)
      .gt('total_votes', 5)
      .order('established_at', { ascending: true })
      .limit(200)

    if (category) {
      query = query.eq('category', category)
    }

    const { data: rows, error } = await query
    if (error) throw error

    const now = Date.now()

    const laws: BedrockLaw[] = (rows ?? [])
      .map((law) => {
        const establishedMs = new Date(law.established_at).getTime()
        const daysAsLaw = Math.max(1, (now - establishedMs) / 86_400_000)
        // consensusStrength: 0–100, how far from 50/50
        const consensusStrength = Math.abs((law.blue_pct ?? 50) - 50) * 2
        const voteWeight = Math.log10(Math.max(10, law.total_votes ?? 10))
        const bedrockScore = daysAsLaw * consensusStrength * voteWeight

        return {
          id: law.id,
          topic_id: law.topic_id,
          statement: law.statement,
          category: law.category,
          established_at: law.established_at,
          blue_pct: law.blue_pct ?? 50,
          total_votes: law.total_votes ?? 0,
          days_as_law: Math.round(daysAsLaw),
          consensus_strength: Math.round(consensusStrength),
          bedrock_score: Math.round(bedrockScore),
          tier: tier(consensusStrength),
        }
      })
      .sort((a, b) => b.bedrock_score - a.bedrock_score)

    const stats: BedrockStats = (() => {
      if (!laws.length) {
        return {
          total_laws: 0,
          avg_consensus: 0,
          constitutional_count: 0,
          oldest_law: null,
          strongest_law: null,
          avg_days_as_law: 0,
        }
      }
      const avgConsensus = Math.round(
        laws.reduce((s, l) => s + l.consensus_strength, 0) / laws.length
      )
      const constitutionalCount = laws.filter((l) => l.tier === 'constitutional').length
      const oldestLaw = [...laws].sort(
        (a, b) => new Date(a.established_at).getTime() - new Date(b.established_at).getTime()
      )[0]
      const strongestLaw = [...laws].sort(
        (a, b) => b.consensus_strength - a.consensus_strength
      )[0]
      const avgDaysAsLaw = Math.round(
        laws.reduce((s, l) => s + l.days_as_law, 0) / laws.length
      )
      return {
        total_laws: laws.length,
        avg_consensus: avgConsensus,
        constitutional_count: constitutionalCount,
        oldest_law: oldestLaw,
        strongest_law: strongestLaw,
        avg_days_as_law: avgDaysAsLaw,
      }
    })()

    return NextResponse.json({ laws, stats, category } satisfies BedrockResponse)
  } catch (err) {
    console.error('[bedrock]', err)
    return NextResponse.json({ laws: [], stats: { total_laws: 0, avg_consensus: 0, constitutional_count: 0, oldest_law: null, strongest_law: null, avg_days_as_law: 0 }, category } satisfies BedrockResponse)
  }
}
