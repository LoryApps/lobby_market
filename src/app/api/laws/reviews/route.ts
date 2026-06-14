import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PublicLawReview {
  id: string
  stars: number
  body: string | null
  helpful: number
  created_at: string
  law: {
    id: string
    statement: string
    category: string | null
    established_at: string
    avg_stars: number | null
    review_count: number
  }
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface AllReviewsResponse {
  reviews: PublicLawReview[]
  total: number
  sort: string
  category: string | null
  stars_filter: number | null
  platform_stats: {
    total_reviews: number
    avg_stars: number
    laws_reviewed: number
    reviewers: number
  }
}

// ─── GET /api/laws/reviews ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const sort   = searchParams.get('sort')     ?? 'recent'  // recent | helpful | top | critical
  const cat    = searchParams.get('category') ?? null
  const stars  = searchParams.get('stars')    ?? null      // 1-5 filter
  const limit  = Math.min(50, Math.max(1, parseInt(searchParams.get('limit')  ?? '30', 10)))
  const offset = Math.max(0,               parseInt(searchParams.get('offset') ?? '0', 10))

  const supabase = await createClient()

  // Fetch reviews joined to law and author
  let query = supabase
    .from('law_reviews')
    .select(`
      id,
      law_id,
      stars,
      body,
      helpful,
      created_at,
      user_id,
      profiles!law_reviews_user_id_fkey(id, username, display_name, avatar_url, role),
      laws!law_reviews_law_id_fkey(id, statement, category, established_at, is_active)
    `, { count: 'exact' })
    .eq('laws.is_active', true)
    .not('body', 'is', null)  // only reviews with text

  if (cat) {
    query = query.eq('laws.category', cat)
  }

  if (stars) {
    const starsNum = parseInt(stars, 10)
    if (starsNum >= 1 && starsNum <= 5) {
      query = query.eq('stars', starsNum)
    }
  }

  // Apply sort
  switch (sort) {
    case 'helpful':
      query = query.order('helpful', { ascending: false }).order('created_at', { ascending: false })
      break
    case 'top':
      query = query.order('stars', { ascending: false }).order('created_at', { ascending: false })
      break
    case 'critical':
      query = query.order('stars', { ascending: true }).order('created_at', { ascending: false })
      break
    default: // recent
      query = query.order('created_at', { ascending: false })
      break
  }

  const { data: rows, count, error } = await query.range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch law-level aggregate stats for each unique law_id
  const lawIds = Array.from(new Set((rows ?? []).map((r: Record<string, unknown>) => r.law_id as string)))
  const lawStats = new Map<string, { avg_stars: number; review_count: number }>()

  if (lawIds.length > 0) {
    const { data: statsRows } = await supabase
      .from('law_reviews')
      .select('law_id, stars')
      .in('law_id', lawIds)

    const grouped = new Map<string, number[]>()
    for (const s of statsRows ?? []) {
      const entry = grouped.get(s.law_id) ?? []
      entry.push(s.stars)
      grouped.set(s.law_id, entry)
    }
    for (const [lawId, starArr] of grouped) {
      const avg = starArr.reduce((a, b) => a + b, 0) / starArr.length
      lawStats.set(lawId, { avg_stars: Math.round(avg * 10) / 10, review_count: starArr.length })
    }
  }

  // Platform-wide stats
  const { data: platformRows } = await supabase
    .from('law_reviews')
    .select('law_id, user_id, stars')

  const allReviews = platformRows ?? []
  const totalReviews = allReviews.length
  const platformAvg = totalReviews > 0
    ? allReviews.reduce((s: number, r: { stars: number }) => s + r.stars, 0) / totalReviews
    : 0
  const uniqueLaws = new Set(allReviews.map((r: { law_id: string }) => r.law_id)).size
  const uniqueReviewers = new Set(allReviews.map((r: { user_id: string }) => r.user_id)).size

  // Shape response
  type RawRow = {
    id: string
    law_id: string
    stars: number
    body: string | null
    helpful: number
    created_at: string
    user_id: string
    profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string } | null
    laws: { id: string; statement: string; category: string | null; established_at: string } | null
  }

  const reviews: PublicLawReview[] = (rows ?? []).map((r: RawRow) => {
    const lawId = r.law_id
    const stats = lawStats.get(lawId) ?? { avg_stars: null, review_count: 0 }
    return {
      id: r.id,
      stars: r.stars,
      body: r.body,
      helpful: r.helpful,
      created_at: r.created_at,
      law: r.laws
        ? {
            id: r.laws.id,
            statement: r.laws.statement,
            category: r.laws.category,
            established_at: r.laws.established_at,
            avg_stars: stats.avg_stars,
            review_count: stats.review_count,
          }
        : null as unknown as PublicLawReview['law'],
      author: r.profiles
        ? {
            id: r.profiles.id,
            username: r.profiles.username,
            display_name: r.profiles.display_name,
            avatar_url: r.profiles.avatar_url,
            role: r.profiles.role,
          }
        : null,
    }
  })

  return NextResponse.json({
    reviews,
    total: count ?? 0,
    sort,
    category: cat,
    stars_filter: stars ? parseInt(stars, 10) : null,
    platform_stats: {
      total_reviews: totalReviews,
      avg_stars: Math.round(platformAvg * 10) / 10,
      laws_reviewed: uniqueLaws,
      reviewers: uniqueReviewers,
    },
  } satisfies AllReviewsResponse)
}
