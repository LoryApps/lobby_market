import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GradeBreakdown {
  grade: string
  count: number
  pct: number
}

export interface SimilarResolved {
  id: string
  statement: string
  category: string | null
  became_law: boolean
  final_blue_pct: number
  total_votes: number
}

export interface FundamentalsData {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  total_votes: number

  // Claim integrity
  citation_rate: number           // % of arguments with a source URL
  source_count: number            // dedicated topic sources
  for_arg_count: number
  against_arg_count: number
  total_arg_count: number

  // Debate balance (0 = all one side, 100 = perfectly balanced)
  balance_score: number
  for_upvotes: number
  against_upvotes: number

  // AI quality
  graded_count: number            // arguments with an AI grade
  avg_ai_score: number | null     // 1–10
  grade_breakdown: GradeBreakdown[]

  // Category context
  category_topic_count: number    // topics in same category
  category_law_rate: number       // % that became law in this category
  similar_resolved: SimilarResolved[]

  // Integrity score (0–100, composite)
  integrity_score: number

  // Calculated label
  integrity_label: 'Robust' | 'Solid' | 'Developing' | 'Thin'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeIntegrityScore(data: {
  citation_rate: number
  source_count: number
  total_arg_count: number
  balance_score: number
  avg_ai_score: number | null
}): number {
  // Citation quality (30 pts) — cite rate saturates at 50%
  const citeScore = Math.min(data.citation_rate / 50, 1) * 30

  // Source depth (15 pts) — saturates at 5 sources
  const srcScore = Math.min(data.source_count / 5, 1) * 15

  // Argument richness (25 pts) — saturates at 20 arguments
  const argScore = Math.min(data.total_arg_count / 20, 1) * 25

  // Balance (15 pts) — 100 = perfect balance, 0 = fully one-sided
  const balScore = (data.balance_score / 100) * 15

  // AI quality (15 pts) — avg score 1–10 → 0–1
  const qualScore = data.avg_ai_score !== null
    ? ((data.avg_ai_score - 1) / 9) * 15
    : 0

  return Math.round(citeScore + srcScore + argScore + balScore + qualScore)
}

function integrityLabel(score: number): FundamentalsData['integrity_label'] {
  if (score >= 70) return 'Robust'
  if (score >= 45) return 'Solid'
  if (score >= 25) return 'Developing'
  return 'Thin'
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // ── Topic basics ───────────────────────────────────────────────────────
    const { data: topic, error: topicErr } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', params.id)
      .maybeSingle()

    if (topicErr || !topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    const price = Math.round(topic.blue_pct ?? 50)

    // ── Arguments (up to 500 for stats) ───────────────────────────────────
    const { data: argRows } = await supabase
      .from('topic_arguments')
      .select('side, upvotes, citation_url, ai_score, ai_grade')
      .eq('topic_id', params.id)
      .limit(500)

    const args = (argRows ?? []) as Array<{
      side: string
      upvotes: number
      citation_url: string | null
      ai_score: number | null
      ai_grade: string | null
    }>

    const for_args = args.filter((a) => a.side === 'for')
    const against_args = args.filter((a) => a.side === 'against')
    const for_arg_count = for_args.length
    const against_arg_count = against_args.length
    const total_arg_count = args.length

    // Citation rate
    const cited = args.filter((a) => a.citation_url && a.citation_url.trim().length > 0)
    const citation_rate = total_arg_count > 0
      ? Math.round((cited.length / total_arg_count) * 100)
      : 0

    // Upvote balance
    const for_upvotes = for_args.reduce((s, a) => s + (a.upvotes ?? 0), 0)
    const against_upvotes = against_args.reduce((s, a) => s + (a.upvotes ?? 0), 0)

    // Balance score: how evenly split are arguments?
    const total_arg_side = for_arg_count + against_arg_count
    const balance_score = total_arg_side > 0
      ? 100 - Math.round(Math.abs(for_arg_count - against_arg_count) / total_arg_side * 100)
      : 50

    // AI grade breakdown
    const graded = args.filter((a) => a.ai_grade !== null)
    const graded_count = graded.length
    const GRADES = ['A', 'B', 'C', 'D', 'F']
    const grade_breakdown: GradeBreakdown[] = GRADES.map((g) => {
      const count = graded.filter((a) => a.ai_grade === g).length
      return {
        grade: g,
        count,
        pct: graded_count > 0 ? Math.round((count / graded_count) * 100) : 0,
      }
    }).filter((g) => g.count > 0)

    const avg_ai_score = graded_count > 0
      ? Math.round(
          graded
            .filter((a) => a.ai_score !== null)
            .reduce((s, a) => s + (a.ai_score as number), 0) /
            graded.filter((a) => a.ai_score !== null).length * 10
        ) / 10
      : null

    // ── Topic sources ──────────────────────────────────────────────────────
    const { count: sourceCount } = await supabase
      .from('topic_sources')
      .select('id', { count: 'exact', head: true })
      .eq('topic_id', params.id)

    const source_count = sourceCount ?? 0

    // ── Category context ───────────────────────────────────────────────────
    let category_topic_count = 0
    let category_law_rate = 0
    let similar_resolved: SimilarResolved[] = []

    if (topic.category) {
      // Count topics in category
      const { count: catCount } = await supabase
        .from('topics')
        .select('id', { count: 'exact', head: true })
        .eq('category', topic.category)

      category_topic_count = catCount ?? 0

      // Count laws from this category (topics that became law)
      const { data: lawTopics } = await supabase
        .from('topics')
        .select('id, status, blue_pct, total_votes')
        .eq('category', topic.category)
        .in('status', ['law', 'failed'])
        .limit(200)

      const resolved = lawTopics ?? []
      const lawCount = resolved.filter((t) => t.status === 'law').length
      category_law_rate = resolved.length > 0
        ? Math.round((lawCount / resolved.length) * 100)
        : 0

      // Get 4 similar resolved topics
      const { data: similar } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes')
        .eq('category', topic.category)
        .in('status', ['law', 'failed'])
        .neq('id', params.id)
        .order('total_votes', { ascending: false })
        .limit(4)

      similar_resolved = (similar ?? []).map((t) => ({
        id: t.id,
        statement: t.statement ?? '',
        category: t.category,
        became_law: t.status === 'law',
        final_blue_pct: Math.round(t.blue_pct ?? 50),
        total_votes: t.total_votes ?? 0,
      }))
    }

    // ── Integrity score ────────────────────────────────────────────────────
    const integrity_score = computeIntegrityScore({
      citation_rate,
      source_count,
      total_arg_count,
      balance_score,
      avg_ai_score,
    })

    const result: FundamentalsData = {
      id: topic.id,
      statement: topic.statement ?? '',
      category: topic.category,
      status: topic.status,
      price,
      total_votes: topic.total_votes ?? 0,

      citation_rate,
      source_count,
      for_arg_count,
      against_arg_count,
      total_arg_count,

      balance_score,
      for_upvotes,
      against_upvotes,

      graded_count,
      avg_ai_score,
      grade_breakdown,

      category_topic_count,
      category_law_rate,
      similar_resolved,

      integrity_score,
      integrity_label: integrityLabel(integrity_score),
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[exchange/fundamentals] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
