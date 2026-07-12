import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OversightLaw {
  id: string
  topic_id: string
  statement: string
  category: string | null
  established_at: string
  blue_pct: number | null
  total_votes: number | null
  // Amendment scrutiny
  pending_amendment_count: number
  ratified_amendment_count: number
  // Review data
  review_count: number
  avg_stars: number | null
  // Reopen petitions
  reopen_count: number
  // Derived
  scrutiny_score: number // higher = more under scrutiny
}

export interface OversightStats {
  total_laws: number
  laws_under_amendment: number
  laws_under_petition: number
  total_pending_amendments: number
  total_reviews: number
  platform_avg_stars: number | null
}

export interface OversightResponse {
  laws: OversightLaw[]
  stats: OversightStats
}

// ─── GET /api/oversight ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const sort = searchParams.get('sort') ?? 'scrutiny'
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100)

  // ── Fetch all active laws ──────────────────────────────────────────────────
  let lawQuery = supabase
    .from('laws')
    .select('id, topic_id, statement, category, established_at, blue_pct, total_votes')
    .eq('is_active', true)
    .order('established_at', { ascending: false })
    .limit(limit)

  if (category) lawQuery = lawQuery.eq('category', category)

  const { data: laws, error: lawError } = await lawQuery
  if (lawError || !laws) {
    return NextResponse.json({ error: 'Failed to fetch laws' }, { status: 500 })
  }
  if (laws.length === 0) {
    return NextResponse.json({
      laws: [],
      stats: {
        total_laws: 0,
        laws_under_amendment: 0,
        laws_under_petition: 0,
        total_pending_amendments: 0,
        total_reviews: 0,
        platform_avg_stars: null,
      },
    } satisfies OversightResponse)
  }

  const lawIds = laws.map((l) => l.id)

  // ── Fetch pending amendment counts per law ─────────────────────────────────
  const { data: amendments } = await supabase
    .from('law_amendments')
    .select('law_id, status')
    .in('law_id', lawIds)
    .in('status', ['pending', 'ratified'])

  const pendingAmendmentMap = new Map<string, number>()
  const ratifiedAmendmentMap = new Map<string, number>()
  for (const a of amendments ?? []) {
    if (a.status === 'pending') {
      pendingAmendmentMap.set(a.law_id, (pendingAmendmentMap.get(a.law_id) ?? 0) + 1)
    } else if (a.status === 'ratified') {
      ratifiedAmendmentMap.set(a.law_id, (ratifiedAmendmentMap.get(a.law_id) ?? 0) + 1)
    }
  }

  // ── Fetch review data per law ──────────────────────────────────────────────
  const { data: reviews } = await supabase
    .from('law_reviews')
    .select('law_id, stars')
    .in('law_id', lawIds)

  const reviewCountMap = new Map<string, number>()
  const reviewSumMap = new Map<string, number>()
  for (const r of reviews ?? []) {
    reviewCountMap.set(r.law_id, (reviewCountMap.get(r.law_id) ?? 0) + 1)
    reviewSumMap.set(r.law_id, (reviewSumMap.get(r.law_id) ?? 0) + r.stars)
  }

  // ── Fetch active reopen requests per law ───────────────────────────────────
  const { data: reopens } = await supabase
    .from('law_reopen_requests')
    .select('law_id, status')
    .in('law_id', lawIds)
    .eq('status', 'pending')

  const reopenMap = new Map<string, number>()
  for (const r of reopens ?? []) {
    reopenMap.set(r.law_id, (reopenMap.get(r.law_id) ?? 0) + 1)
  }

  // ── Assemble results ───────────────────────────────────────────────────────
  const result: OversightLaw[] = laws.map((law) => {
    const pendingAmendments = pendingAmendmentMap.get(law.id) ?? 0
    const ratifiedAmendments = ratifiedAmendmentMap.get(law.id) ?? 0
    const reviewCount = reviewCountMap.get(law.id) ?? 0
    const reviewSum = reviewSumMap.get(law.id) ?? 0
    const avgStars = reviewCount > 0 ? reviewSum / reviewCount : null
    const reopenCount = reopenMap.get(law.id) ?? 0

    // Scrutiny score: higher = more under scrutiny
    // Weights: pending amendment (3pts), reopen request (5pts), low reviews (1pt for each sub-3 review)
    const lowRatingPenalty = avgStars !== null && avgStars < 3 ? Math.round((3 - avgStars) * reviewCount) : 0
    const scrutinyScore = pendingAmendments * 3 + reopenCount * 5 + lowRatingPenalty

    return {
      id: law.id,
      topic_id: law.topic_id,
      statement: law.statement,
      category: law.category,
      established_at: law.established_at,
      blue_pct: law.blue_pct,
      total_votes: law.total_votes,
      pending_amendment_count: pendingAmendments,
      ratified_amendment_count: ratifiedAmendments,
      review_count: reviewCount,
      avg_stars: avgStars !== null ? Math.round(avgStars * 10) / 10 : null,
      reopen_count: reopenCount,
      scrutiny_score: scrutinyScore,
    }
  })

  // ── Sort ───────────────────────────────────────────────────────────────────
  if (sort === 'scrutiny') {
    result.sort((a, b) => b.scrutiny_score - a.scrutiny_score)
  } else if (sort === 'newest') {
    result.sort((a, b) => new Date(b.established_at).getTime() - new Date(a.established_at).getTime())
  } else if (sort === 'oldest') {
    result.sort((a, b) => new Date(a.established_at).getTime() - new Date(b.established_at).getTime())
  } else if (sort === 'rating') {
    result.sort((a, b) => {
      if (a.avg_stars === null && b.avg_stars === null) return 0
      if (a.avg_stars === null) return 1
      if (b.avg_stars === null) return -1
      return a.avg_stars - b.avg_stars // ascending: lowest rated first
    })
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalPendingAmendments = result.reduce((s, l) => s + l.pending_amendment_count, 0)
  const totalReviews = result.reduce((s, l) => s + l.review_count, 0)
  const ratedLaws = result.filter((l) => l.avg_stars !== null)
  const platformAvgStars =
    ratedLaws.length > 0
      ? Math.round((ratedLaws.reduce((s, l) => s + (l.avg_stars ?? 0), 0) / ratedLaws.length) * 10) / 10
      : null

  const stats: OversightStats = {
    total_laws: result.length,
    laws_under_amendment: result.filter((l) => l.pending_amendment_count > 0).length,
    laws_under_petition: result.filter((l) => l.reopen_count > 0).length,
    total_pending_amendments: totalPendingAmendments,
    total_reviews: totalReviews,
    platform_avg_stars: platformAvgStars,
  }

  return NextResponse.json({ laws: result, stats } satisfies OversightResponse)
}
