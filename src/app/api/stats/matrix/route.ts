import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 900 // 15-minute cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryStat {
  category: string
  topic_count: number
  total_votes: number
  law_count: number
  avg_blue_pct: number   // 0–100
  law_rate: number       // 0–1: fraction of resolved topics that became law
}

export interface CategoryPair {
  cat_a: string
  cat_b: string
  shared_voters: number
  correlation: number    // Pearson r: −1 to 1 (null = insufficient data)
}

export interface MatrixResponse {
  categories: string[]
  stats: CategoryStat[]
  pairs: CategoryPair[]
  total_voters_analyzed: number
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const CATEGORIES = [
    'Economics', 'Politics', 'Technology', 'Science',
    'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
  ]

  // ── 1. Per-category aggregate stats ──────────────────────────────────────
  const { data: rawStats, error: statsError } = await supabase
    .from('topics')
    .select('category, status, blue_pct, total_votes')
    .in('category', CATEGORIES)
    .gte('total_votes', 5)

  if (statsError) {
    console.error('[matrix/stats]', statsError)
    return NextResponse.json({ error: statsError.message }, { status: 500 })
  }

  const statMap: Record<string, {
    topic_count: number; total_votes: number; law_count: number
    resolved_count: number; blue_sum: number
  }> = {}

  for (const t of rawStats ?? []) {
    const cat = t.category as string
    if (!statMap[cat]) {
      statMap[cat] = { topic_count: 0, total_votes: 0, law_count: 0, resolved_count: 0, blue_sum: 0 }
    }
    const s = statMap[cat]
    s.topic_count++
    s.total_votes += t.total_votes ?? 0
    s.blue_sum += t.blue_pct ?? 50
    if (t.status === 'law') { s.law_count++; s.resolved_count++ }
    if (t.status === 'failed') { s.resolved_count++ }
  }

  const stats: CategoryStat[] = CATEGORIES.map((cat) => {
    const s = statMap[cat] ?? { topic_count: 0, total_votes: 0, law_count: 0, resolved_count: 0, blue_sum: 0 }
    return {
      category: cat,
      topic_count: s.topic_count,
      total_votes: s.total_votes,
      law_count: s.law_count,
      avg_blue_pct: s.topic_count > 0 ? s.blue_sum / s.topic_count : 50,
      law_rate: s.resolved_count > 0 ? s.law_count / s.resolved_count : 0,
    }
  })

  // ── 2. Cross-category voter alignment via raw SQL ─────────────────────────
  // Build a user→category→avg_for_fraction table, then self-join for pairs.
  // We use the Supabase rpc escape hatch for complex SQL.
  // The function may not exist if the migration hasn't run in production yet,
  // so we fall back gracefully.

  const { data: pairData, error: pairError } = await supabase.rpc(
    'get_category_matrix',
    { p_min_shared: 5 }
  )

  // If the RPC doesn't exist yet, compute a simplified version from topics data
  const pairs: CategoryPair[] = []
  let totalVoters = 0

  if (pairError || !pairData) {
    // Fallback: approximate correlation from topic-level blue_pct similarity
    for (let i = 0; i < CATEGORIES.length; i++) {
      for (let j = i + 1; j < CATEGORIES.length; j++) {
        const catA = CATEGORIES[i]
        const catB = CATEGORIES[j]
        const sA = statMap[catA]
        const sB = statMap[catB]
        if (!sA || !sB || sA.topic_count < 2 || sB.topic_count < 2) continue

        const avgA = sA.blue_sum / sA.topic_count
        const avgB = sB.blue_sum / sB.topic_count

        // Approximate correlation: categories with similar avg lean correlate positively
        // Transform: how similar are their average stances (both progressive, both conservative, etc.)
        const diff = Math.abs(avgA - avgB)          // 0 = same lean, 100 = opposite
        const approxCorr = 1 - (diff / 50)          // rough Pearson approximation
        const clampedCorr = Math.max(-1, Math.min(1, approxCorr))

        pairs.push({
          cat_a: catA,
          cat_b: catB,
          shared_voters: 0,          // unknown without SQL RPC
          correlation: clampedCorr,
        })
      }
    }
  } else {
    // Use actual SQL results
    for (const row of pairData as Array<{
      cat_a: string; cat_b: string; shared_voters: number | string; correlation: number | null
    }>) {
      if (row.correlation === null) continue
      pairs.push({
        cat_a: row.cat_a,
        cat_b: row.cat_b,
        shared_voters: Number(row.shared_voters),
        correlation: row.correlation,
      })
      totalVoters = Math.max(totalVoters, Number(row.shared_voters))
    }
  }

  return NextResponse.json({
    categories: CATEGORIES,
    stats,
    pairs,
    total_voters_analyzed: totalVoters,
  } satisfies MatrixResponse)
}
