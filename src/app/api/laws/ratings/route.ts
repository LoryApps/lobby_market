import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RatedLaw {
  id: string
  statement: string
  category: string | null
  established_at: string
  blue_pct: number | null
  total_votes: number | null
  // review stats
  review_count: number
  avg_stars: number
  star_1: number
  star_2: number
  star_3: number
  star_4: number
  star_5: number
}

export interface RatingsResponse {
  laws: RatedLaw[]
  total: number
  sort: string
  category: string | null
  min_reviews: number
}

// ─── GET /api/laws/ratings ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const sort = searchParams.get('sort') ?? 'top'          // top | bottom | most | recent
  const category = searchParams.get('category') ?? null
  const minReviews = Math.max(1, parseInt(searchParams.get('min_reviews') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))

  const supabase = await createClient()

  // Join laws with aggregated law_reviews
  let query = supabase
    .from('laws')
    .select(`
      id,
      statement,
      category,
      established_at,
      blue_pct,
      total_votes,
      law_reviews (
        stars
      )
    `)
    .eq('is_active', true)

  if (category) {
    query = query.eq('category', category)
  }

  const { data: lawRows, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Compute aggregate stats per law in JS
  type RawLaw = {
    id: string
    statement: string
    category: string | null
    established_at: string
    blue_pct: number | null
    total_votes: number | null
    law_reviews: Array<{ stars: number }>
  }

  const aggregated: RatedLaw[] = (lawRows as RawLaw[] ?? [])
    .map((law) => {
      const reviews = law.law_reviews ?? []
      const review_count = reviews.length
      const star_1 = reviews.filter((r) => r.stars === 1).length
      const star_2 = reviews.filter((r) => r.stars === 2).length
      const star_3 = reviews.filter((r) => r.stars === 3).length
      const star_4 = reviews.filter((r) => r.stars === 4).length
      const star_5 = reviews.filter((r) => r.stars === 5).length
      const avg_stars =
        review_count > 0
          ? reviews.reduce((sum, r) => sum + r.stars, 0) / review_count
          : 0
      return {
        id: law.id,
        statement: law.statement,
        category: law.category,
        established_at: law.established_at,
        blue_pct: law.blue_pct,
        total_votes: law.total_votes,
        review_count,
        avg_stars,
        star_1,
        star_2,
        star_3,
        star_4,
        star_5,
      }
    })
    .filter((l) => l.review_count >= minReviews)

  // Sort
  const sorted = aggregated.slice().sort((a, b) => {
    if (sort === 'bottom') return a.avg_stars - b.avg_stars
    if (sort === 'most') return b.review_count - a.review_count
    if (sort === 'recent') {
      return new Date(b.established_at).getTime() - new Date(a.established_at).getTime()
    }
    // 'top' — bayesian-style: weight avg by review count (min 3 threshold)
    const m = 3
    const c = 3.0 // global prior
    const bayesA = (a.review_count * a.avg_stars + m * c) / (a.review_count + m)
    const bayesB = (b.review_count * b.avg_stars + m * c) / (b.review_count + m)
    return bayesB - bayesA
  })

  const laws = sorted.slice(0, limit)

  return NextResponse.json({
    laws,
    total: sorted.length,
    sort,
    category,
    min_reviews: minReviews,
  } satisfies RatingsResponse)
}
