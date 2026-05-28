import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MagnitudeTopic {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  // Magnitude components
  magnitude_score: number     // 0–100 composite score
  vote_mass: number           // raw vote count contribution
  consensus_force: number     // how far from 50/50 (0–50)
  argument_density: number    // arguments per 100 votes
  arg_count: number
  // Magnitude class (like Richter scale)
  magnitude_class: string     // 'M1'–'M5'
}

export interface MagnitudeStats {
  total_topics: number
  avg_score: number
  top_score: number
  class_distribution: Record<string, number>
}

export interface MagnitudeResponse {
  topics: MagnitudeTopic[]
  stats: MagnitudeStats
  category: string | null
}

// ─── Magnitude class thresholds ───────────────────────────────────────────────

function getMagnitudeClass(score: number): string {
  if (score >= 85) return 'M5'
  if (score >= 65) return 'M4'
  if (score >= 45) return 'M3'
  if (score >= 25) return 'M2'
  return 'M1'
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') ?? null
  const statusFilter = searchParams.get('status') ?? 'all'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)

  try {
    const supabase = await createClient()

    // ── 1. Fetch topics with argument counts ──────────────────────────────

    let topicsQuery = supabase
      .from('topics')
      .select('id, statement, category, status, total_votes, blue_pct')
      .not('status', 'eq', 'archived')
      .gte('total_votes', 10)
      .order('total_votes', { ascending: false })
      .limit(500)

    if (category) topicsQuery = topicsQuery.eq('category', category)
    if (statusFilter !== 'all') topicsQuery = topicsQuery.eq('status', statusFilter)

    const { data: topics } = await topicsQuery

    // ── 2. Fetch argument counts per topic ────────────────────────────────

    const topicIds = (topics ?? []).map((t) => t.id)

    const argCounts: Record<string, number> = {}
    if (topicIds.length > 0) {
      const { data: argRows } = await supabase
        .from('topic_arguments')
        .select('topic_id')
        .in('topic_id', topicIds.slice(0, 200))
        .limit(10000)

      for (const row of argRows ?? []) {
        argCounts[row.topic_id] = (argCounts[row.topic_id] ?? 0) + 1
      }
    }

    // ── 3. Compute magnitude scores ───────────────────────────────────────

    const scored: MagnitudeTopic[] = (topics ?? []).map((t) => {
      const votes = t.total_votes ?? 0
      const forPct = t.blue_pct ?? 50
      const argCount = argCounts[t.id] ?? 0

      // Vote mass: log scale so massive topics don't dominate completely
      // max ~100 for 100,000 votes
      const vote_mass = Math.min(Math.log10(votes + 1) * 20, 100)

      // Consensus force: how far from 50/50 (0 = deadlock, 50 = unanimous)
      const consensus_force = Math.abs(forPct - 50)

      // Argument density: arguments per 100 votes (capped at 50)
      const argument_density = votes > 0
        ? Math.min((argCount / votes) * 100, 50)
        : 0

      // Composite magnitude score:
      // 40% vote mass + 35% consensus force (scaled 0-100) + 25% arg density (scaled 0-100)
      const magnitude_score = Math.round(
        vote_mass * 0.40 +
        (consensus_force * 2) * 0.35 +
        (argument_density * 2) * 0.25,
      )

      return {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        total_votes: votes,
        blue_pct: forPct,
        magnitude_score,
        vote_mass: Math.round(vote_mass),
        consensus_force: Math.round(consensus_force),
        argument_density: Math.round(argument_density * 10) / 10,
        arg_count: argCount,
        magnitude_class: getMagnitudeClass(magnitude_score),
      }
    })

    // Sort by magnitude score descending
    scored.sort((a, b) => b.magnitude_score - a.magnitude_score)

    const topN = scored.slice(0, limit)

    // ── 4. Stats ──────────────────────────────────────────────────────────

    const classDistribution: Record<string, number> = { M1: 0, M2: 0, M3: 0, M4: 0, M5: 0 }
    for (const t of scored) {
      classDistribution[t.magnitude_class] = (classDistribution[t.magnitude_class] ?? 0) + 1
    }

    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((s, t) => s + t.magnitude_score, 0) / scored.length)
      : 0
    const topScore = scored[0]?.magnitude_score ?? 0

    return NextResponse.json({
      topics: topN,
      stats: {
        total_topics: scored.length,
        avg_score: avgScore,
        top_score: topScore,
        class_distribution: classDistribution,
      },
      category,
    } satisfies MagnitudeResponse)
  } catch (err) {
    console.error('/api/magnitude error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
