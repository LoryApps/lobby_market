import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 1800 // 30 min

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReviewItem {
  id: string
  stars: number
  body: string | null
  helpful: number
  created_at: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  } | null
}

export interface SentimentBand {
  label: string
  count: number
  pct: number
}

export interface LawSentimentData {
  law: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string | null
  }
  /** Star rating distribution */
  ratingBands: SentimentBand[]
  /** Average star rating (1–5 or null if no reviews) */
  avgStars: number | null
  /** Total review count */
  totalReviews: number
  /** Recent reviews (up to 12) */
  recentReviews: ReviewItem[]
  /** Post-passage argument sentiment */
  argumentSentiment: {
    totalArguments: number
    forArguments: number
    againstArguments: number
    topUpvotedFor: { content: string; upvotes: number } | null
    topUpvotedAgainst: { content: string; upvotes: number } | null
  }
  /** Challenge activity — friction signal */
  challengeSignal: {
    totalChallenges: number
    openChallenges: number
    uphelChallenges: number
    dismissedChallenges: number
  }
  /** Amendment pressure — calls for change */
  amendmentSignal: {
    totalAmendments: number
    pendingAmendments: number
    ratifiedAmendments: number
  }
  /** Composite community sentiment score 0–100 (higher = more positive) */
  sentimentScore: number
  sentimentLabel: 'Endorsed' | 'Accepted' | 'Contested' | 'Disputed' | 'Opposed'
  /** Similar laws in same category for benchmark */
  categoryBenchmark: {
    avgSentimentScore: number
    lawCount: number
  }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function computeSentimentScore(
  avgStars: number | null,
  reviewCount: number,
  challengeCount: number,
  openChallenges: number,
  pendingAmendments: number,
  totalVotes: number,
  bluePct: number,
): number {
  // Star rating contribution (0–40 pts)
  const starScore = avgStars !== null
    ? Math.round(((avgStars - 1) / 4) * 40 * Math.min(reviewCount / 5, 1))
    : 20 // neutral if no reviews

  // Original mandate strength (0–20 pts)
  const mandateScore = Math.round(Math.max(0, (bluePct - 50) / 50) * 20)

  // Challenge friction penalty (-15 pts max)
  const challengePenalty = Math.min(openChallenges * 3 + challengeCount, 15)

  // Amendment pressure signal (-10 pts max)
  const amendmentPenalty = Math.min(pendingAmendments * 2, 10)

  // Base engagement bonus (0–15 pts) — activity shows relevance
  const engagementBonus = Math.min(Math.log10(Math.max(totalVotes, 1)) * 3, 15)

  const score = starScore + mandateScore + engagementBonus - challengePenalty - amendmentPenalty
  return Math.max(0, Math.min(100, Math.round(score)))
}

function scoreLabel(
  score: number,
): LawSentimentData['sentimentLabel'] {
  if (score >= 75) return 'Endorsed'
  if (score >= 58) return 'Accepted'
  if (score >= 42) return 'Contested'
  if (score >= 25) return 'Disputed'
  return 'Opposed'
}

// ─── GET /api/laws/[id]/sentiment ────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const lawId = params.id

  // Law info
  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
    .eq('id', lawId)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // Run data fetches in parallel
  const [reviewsRes, challengesRes, amendmentsRes, argsRes] = await Promise.all([
    db
      .from('law_reviews')
      .select(`
        id, stars, body, helpful, created_at, user_id,
        profiles:user_id (username, display_name, avatar_url, role, clout)
      `)
      .eq('law_id', lawId)
      .order('helpful', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),

    db
      .from('law_challenges')
      .select('id, status')
      .eq('law_id', lawId),

    db
      .from('law_amendments')
      .select('id, status')
      .eq('law_id', lawId),

    law.topic_id
      ? db
          .from('topic_arguments')
          .select('id, side, content, upvotes, created_at')
          .eq('topic_id', law.topic_id)
          .order('upvotes', { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] }),
  ])

  const reviews: ReviewItem[] = (reviewsRes.data ?? []).map((r: {
    id: string
    stars: number
    body: string | null
    helpful: number
    created_at: string
    profiles: { username: string; display_name: string | null; avatar_url: string | null; role: string; clout: number } | null
  }) => ({
    id: r.id,
    stars: r.stars,
    body: r.body,
    helpful: r.helpful,
    created_at: r.created_at,
    author: r.profiles ?? null,
  }))

  const challenges = (challengesRes.data ?? []) as { id: string; status: string }[]
  const amendments = (amendmentsRes.data ?? []) as { id: string; status: string }[]
  const args = (argsRes.data ?? []) as { id: string; side: string; content: string; upvotes: number }[]

  // Compute rating bands
  const starCounts = [0, 0, 0, 0, 0]
  let starSum = 0
  for (const r of reviews) {
    const s = Math.min(5, Math.max(1, r.stars))
    starCounts[s - 1]++
    starSum += s
  }
  const totalReviews = reviews.length
  const avgStars = totalReviews > 0 ? starSum / totalReviews : null
  const ratingBands: SentimentBand[] = [5, 4, 3, 2, 1].map((stars) => ({
    label: `${stars} star${stars !== 1 ? 's' : ''}`,
    count: starCounts[stars - 1],
    pct: totalReviews > 0 ? Math.round((starCounts[stars - 1] / totalReviews) * 100) : 0,
  }))

  // Argument sentiment
  const forArgs = args.filter((a) => a.side === 'blue')
  const againstArgs = args.filter((a) => a.side === 'red')
  const topFor = forArgs.length > 0 ? forArgs[0] : null
  const topAgainst = againstArgs.length > 0 ? againstArgs[0] : null

  // Challenge signal
  const openChallenges = challenges.filter((c) => c.status === 'open').length
  const upheldChallenges = challenges.filter((c) => c.status === 'upheld').length
  const dismissedChallenges = challenges.filter((c) => c.status === 'dismissed').length

  // Amendment signal
  const pendingAmendments = amendments.filter((a) => a.status === 'pending').length
  const ratifiedAmendments = amendments.filter((a) => a.status === 'ratified').length

  // Sentiment score
  const sentimentScore = computeSentimentScore(
    avgStars,
    totalReviews,
    challenges.length,
    openChallenges,
    pendingAmendments,
    law.total_votes ?? 0,
    law.blue_pct ?? 50,
  )

  // Category benchmark (average score for similar laws — rough proxy using avg blue_pct)
  const { data: categoryLaws } = law.category
    ? await supabase
        .from('laws')
        .select('id, blue_pct')
        .eq('category', law.category)
        .eq('is_active', true)
        .neq('id', lawId)
        .limit(30)
    : { data: [] }

  const catLaws = (categoryLaws ?? []) as { id: string; blue_pct: number | null }[]
  const catAvgScore = catLaws.length > 0
    ? Math.round(catLaws.reduce((s, l) => s + computeSentimentScore(null, 0, 0, 0, 0, 100, l.blue_pct ?? 50), 0) / catLaws.length)
    : 50

  const recentReviews = reviews.slice(0, 12)

  const payload: LawSentimentData = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      blue_pct: law.blue_pct ?? 50,
      total_votes: law.total_votes ?? 0,
      established_at: law.established_at,
    },
    ratingBands,
    avgStars,
    totalReviews,
    recentReviews,
    argumentSentiment: {
      totalArguments: args.length,
      forArguments: forArgs.length,
      againstArguments: againstArgs.length,
      topUpvotedFor: topFor ? { content: topFor.content, upvotes: topFor.upvotes } : null,
      topUpvotedAgainst: topAgainst ? { content: topAgainst.content, upvotes: topAgainst.upvotes } : null,
    },
    challengeSignal: {
      totalChallenges: challenges.length,
      openChallenges,
      uphelChallenges: upheldChallenges,
      dismissedChallenges,
    },
    amendmentSignal: {
      totalAmendments: amendments.length,
      pendingAmendments,
      ratifiedAmendments,
    },
    sentimentScore,
    sentimentLabel: scoreLabel(sentimentScore),
    categoryBenchmark: {
      avgSentimentScore: catAvgScore,
      lawCount: catLaws.length,
    },
  }

  return NextResponse.json(payload)
}
