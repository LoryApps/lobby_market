import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlindSpotTopic {
  id: string
  statement: string
  category: string
  status: string
  blue_pct: number
  total_votes: number
}

export interface CategoryCoverage {
  category: string
  vote_count: number
  is_blind_spot: boolean
  is_thin: boolean      // < 5 votes
  topics: BlindSpotTopic[]
}

export interface BlindSpotsResponse {
  coverage: CategoryCoverage[]
  covered_count: number
  total_categories: number
  coverage_pct: number
  challenge_topic: BlindSpotTopic | null
  authenticated: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const KNOWN_CATEGORIES = [
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const THIN_THRESHOLD = 5    // fewer than this = "thin" coverage
const TOPICS_PER_BLIND_SPOT = 3

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  type RawTopic = { id: string; statement: string; category: string | null; status: string; blue_pct: number | null; total_votes: number | null }

  // ── Unauthenticated: return platform-wide category activity only ──────────

  if (!user) {
    const { data: topicsRaw } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .not('status', 'in', '(failed,archived)')
      .order('feed_score', { ascending: false })
      .limit(200)

    const topics = (topicsRaw ?? []) as RawTopic[]

    const coverage: CategoryCoverage[] = KNOWN_CATEGORIES.map((cat) => {
      const catTopics: BlindSpotTopic[] = topics
        .filter((t) => t.category === cat)
        .slice(0, TOPICS_PER_BLIND_SPOT)
        .map((t) => ({
          id: t.id,
          statement: t.statement,
          category: t.category ?? '',
          status: t.status,
          blue_pct: t.blue_pct ?? 50,
          total_votes: t.total_votes ?? 0,
        }))
      return {
        category: cat,
        vote_count: 0,
        is_blind_spot: true,
        is_thin: true,
        topics: catTopics,
      }
    })

    return NextResponse.json({
      coverage,
      covered_count: 0,
      total_categories: KNOWN_CATEGORIES.length,
      coverage_pct: 0,
      challenge_topic: coverage.find((c) => c.topics.length > 0)?.topics[0] ?? null,
      authenticated: false,
    } satisfies BlindSpotsResponse)
  }

  // ── Authenticated: personalised blind spots ───────────────────────────────

  // 1. Fetch user's vote counts per category via join
  const { data: votesByCategory } = await supabase
    .from('votes')
    .select('topics(category)')
    .eq('user_id', user.id)

  const categoryCounts: Record<string, number> = {}
  for (const row of (votesByCategory ?? []) as Array<{ topics: { category: string | null } | null }>) {
    const cat = row.topics?.category
    if (cat) {
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1
    }
  }

  // 2. Fetch active topics for blind-spot and thin categories
  const blindOrThin = KNOWN_CATEGORIES.filter((cat) => (categoryCounts[cat] ?? 0) < THIN_THRESHOLD)

  let topicPool: BlindSpotTopic[] = []

  if (blindOrThin.length > 0) {
    const { data: topicsRaw } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('category', blindOrThin)
      .not('status', 'in', '(failed,archived)')
      .order('total_votes', { ascending: false })
      .limit(blindOrThin.length * (TOPICS_PER_BLIND_SPOT + 2))

    topicPool = ((topicsRaw ?? []) as RawTopic[]).map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category ?? '',
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
    }))
  }

  // 3. Build coverage data for all categories
  const coverage: CategoryCoverage[] = KNOWN_CATEGORIES.map((cat) => {
    const voteCount = categoryCounts[cat] ?? 0
    const isBlindSpot = voteCount === 0
    const isThin = voteCount > 0 && voteCount < THIN_THRESHOLD

    const catTopics = topicPool
      .filter((t) => t.category === cat)
      .slice(0, TOPICS_PER_BLIND_SPOT)

    return {
      category: cat,
      vote_count: voteCount,
      is_blind_spot: isBlindSpot,
      is_thin: isThin,
      topics: catTopics,
    }
  })

  // 4. Pick challenge from most neglected blind-spot category
  const trueBlindSpots = coverage.filter((c) => c.is_blind_spot && c.topics.length > 0)
  const challengeTopic = trueBlindSpots[0]?.topics[0] ?? null

  // 5. Covered = 5+ votes (not blind, not thin)
  const coveredCount = coverage.filter((c) => !c.is_blind_spot && !c.is_thin).length

  return NextResponse.json({
    coverage,
    covered_count: coveredCount,
    total_categories: KNOWN_CATEGORIES.length,
    coverage_pct: Math.round((coveredCount / KNOWN_CATEGORIES.length) * 100),
    challenge_topic: challengeTopic,
    authenticated: true,
  } satisfies BlindSpotsResponse)
}
