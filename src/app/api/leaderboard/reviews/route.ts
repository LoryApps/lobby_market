import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReviewerEntry {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  review_count: number
  helpful_total: number
  avg_helpful_per_review: number
  avg_stars_given: number
  written_reviews: number  // reviews with text body
}

export interface TopReviewedLaw {
  law_id: string
  statement: string
  category: string | null
  established_at: string
  review_count: number
  avg_stars: number
  helpful_total: number
}

export interface RecentReview {
  review_id: string
  law_id: string
  law_statement: string
  stars: number
  body: string | null
  helpful: number
  created_at: string
  reviewer_username: string
  reviewer_avatar: string | null
}

export interface ReviewLeaderboardResponse {
  topReviewers: ReviewerEntry[]
  mostHelpful: ReviewerEntry[]
  topRatedLaws: TopReviewedLaw[]
  recentReviews: RecentReview[]
  totals: {
    total_reviews: number
    written_reviews: number
    unique_reviewers: number
    unique_laws_reviewed: number
    total_helpful_votes: number
    platform_avg_stars: number
  }
  myStats: {
    review_count: number
    helpful_total: number
    avg_stars_given: number
    written_reviews: number
    reviewer_rank: number | null
  } | null
}

const LIMIT = 25

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Fetch all reviews ──────────────────────────────────────────────────────
  const { data: allReviews } = await supabase
    .from('law_reviews')
    .select('id, law_id, user_id, stars, body, helpful, created_at')
    .order('created_at', { ascending: false })

  const reviews = allReviews ?? []

  // ── Fetch profiles ─────────────────────────────────────────────────────────
  const reviewerIds = [...new Set(reviews.map(r => r.user_id))]
  const { data: profilesRaw } = reviewerIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, clout')
        .in('id', reviewerIds.slice(0, 500))
    : { data: [] }

  const profileMap = new Map<string, {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  }>()
  for (const p of (profilesRaw ?? [])) {
    profileMap.set(p.id, p)
  }

  // ── Fetch laws for reviewed law data ───────────────────────────────────────
  const lawIds = [...new Set(reviews.map(r => r.law_id))]
  const { data: lawsRaw } = lawIds.length > 0
    ? await supabase
        .from('laws')
        .select('id, statement, category, established_at')
        .in('id', lawIds.slice(0, 500))
    : { data: [] }

  const lawMap = new Map<string, {
    id: string
    statement: string
    category: string | null
    established_at: string
  }>()
  for (const l of (lawsRaw ?? [])) {
    lawMap.set(l.id, l)
  }

  // ── Build reviewer stats ───────────────────────────────────────────────────
  const reviewerMap = new Map<string, {
    review_count: number
    helpful_total: number
    stars_sum: number
    written_reviews: number
  }>()

  for (const r of reviews) {
    const existing = reviewerMap.get(r.user_id) ?? {
      review_count: 0,
      helpful_total: 0,
      stars_sum: 0,
      written_reviews: 0,
    }
    reviewerMap.set(r.user_id, {
      review_count: existing.review_count + 1,
      helpful_total: existing.helpful_total + (r.helpful ?? 0),
      stars_sum: existing.stars_sum + r.stars,
      written_reviews: existing.written_reviews + (r.body ? 1 : 0),
    })
  }

  // ── Build law stats ────────────────────────────────────────────────────────
  const lawStatsMap = new Map<string, {
    review_count: number
    stars_sum: number
    helpful_total: number
  }>()

  for (const r of reviews) {
    const existing = lawStatsMap.get(r.law_id) ?? {
      review_count: 0,
      stars_sum: 0,
      helpful_total: 0,
    }
    lawStatsMap.set(r.law_id, {
      review_count: existing.review_count + 1,
      stars_sum: existing.stars_sum + r.stars,
      helpful_total: existing.helpful_total + (r.helpful ?? 0),
    })
  }

  // ── Convert to arrays ──────────────────────────────────────────────────────
  function buildReviewerEntry(userId: string): ReviewerEntry | null {
    const stats = reviewerMap.get(userId)
    const profile = profileMap.get(userId)
    if (!stats || !profile) return null
    return {
      user_id: userId,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout,
      review_count: stats.review_count,
      helpful_total: stats.helpful_total,
      avg_helpful_per_review: stats.review_count > 0
        ? Math.round((stats.helpful_total / stats.review_count) * 10) / 10
        : 0,
      avg_stars_given: stats.review_count > 0
        ? Math.round((stats.stars_sum / stats.review_count) * 10) / 10
        : 0,
      written_reviews: stats.written_reviews,
    }
  }

  // Top reviewers by count
  const topReviewers: ReviewerEntry[] = Array.from(reviewerMap.entries())
    .map(([uid]) => buildReviewerEntry(uid))
    .filter((e): e is ReviewerEntry => e !== null)
    .sort((a, b) => b.review_count - a.review_count || b.helpful_total - a.helpful_total)
    .slice(0, LIMIT)

  // Most helpful (by total helpful votes, min 2 reviews)
  const mostHelpful: ReviewerEntry[] = Array.from(reviewerMap.entries())
    .map(([uid]) => buildReviewerEntry(uid))
    .filter((e): e is ReviewerEntry => e !== null && e.written_reviews >= 2)
    .sort((a, b) => b.helpful_total - a.helpful_total || b.review_count - a.review_count)
    .slice(0, LIMIT)

  // Top reviewed laws
  const topRatedLaws: TopReviewedLaw[] = Array.from(lawStatsMap.entries())
    .map(([lawId, stats]) => {
      const law = lawMap.get(lawId)
      if (!law) return null
      return {
        law_id: lawId,
        statement: law.statement,
        category: law.category,
        established_at: law.established_at,
        review_count: stats.review_count,
        avg_stars: stats.review_count > 0
          ? Math.round((stats.stars_sum / stats.review_count) * 10) / 10
          : 0,
        helpful_total: stats.helpful_total,
      }
    })
    .filter((e): e is TopReviewedLaw => e !== null)
    .sort((a, b) => b.review_count - a.review_count || b.avg_stars - a.avg_stars)
    .slice(0, 10)

  // Recent reviews (only ones with body text — more interesting)
  const recentReviews: RecentReview[] = reviews
    .filter(r => r.body)
    .slice(0, 8)
    .map(r => {
      const profile = profileMap.get(r.user_id)
      const law = lawMap.get(r.law_id)
      return {
        review_id: r.id,
        law_id: r.law_id,
        law_statement: law?.statement ?? 'Unknown Law',
        stars: r.stars,
        body: r.body,
        helpful: r.helpful ?? 0,
        created_at: r.created_at,
        reviewer_username: profile?.username ?? 'unknown',
        reviewer_avatar: profile?.avatar_url ?? null,
      }
    })

  // ── Platform totals ────────────────────────────────────────────────────────
  const totalHelpful = reviews.reduce((s, r) => s + (r.helpful ?? 0), 0)
  const totalStars = reviews.reduce((s, r) => s + r.stars, 0)
  const totals = {
    total_reviews: reviews.length,
    written_reviews: reviews.filter(r => r.body).length,
    unique_reviewers: reviewerMap.size,
    unique_laws_reviewed: lawStatsMap.size,
    total_helpful_votes: totalHelpful,
    platform_avg_stars: reviews.length > 0
      ? Math.round((totalStars / reviews.length) * 10) / 10
      : 0,
  }

  // ── My stats ───────────────────────────────────────────────────────────────
  let myStats: ReviewLeaderboardResponse['myStats'] = null
  if (user) {
    const myEntry = buildReviewerEntry(user.id)
    const myRank = myEntry
      ? topReviewers.findIndex(e => e.user_id === user.id) + 1 || null
      : null
    if (myEntry) {
      myStats = {
        review_count: myEntry.review_count,
        helpful_total: myEntry.helpful_total,
        avg_stars_given: myEntry.avg_stars_given,
        written_reviews: myEntry.written_reviews,
        reviewer_rank: myRank && myRank <= LIMIT ? myRank : null,
      }
    } else {
      myStats = {
        review_count: 0,
        helpful_total: 0,
        avg_stars_given: 0,
        written_reviews: 0,
        reviewer_rank: null,
      }
    }
  }

  return NextResponse.json({
    topReviewers,
    mostHelpful,
    topRatedLaws,
    recentReviews,
    totals,
    myStats,
  } satisfies ReviewLeaderboardResponse)
}
