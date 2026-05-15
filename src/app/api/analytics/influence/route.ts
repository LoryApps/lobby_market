import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InfluenceTier =
  | 'amplifier'
  | 'advocate'
  | 'contributor'
  | 'emerging'
  | 'newcomer'

export interface TopArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  reply_count: number
  ai_grade: string | null
  ai_score: number | null
  has_citation: boolean
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  created_at: string
}

export interface CategoryEngagement {
  category: string
  argument_count: number
  total_upvotes: number
  avg_upvotes: number
  avg_ai_score: number | null
}

export interface LegislativePick {
  topic_id: string
  statement: string
  category: string | null
  status: 'law' | 'failed'
  user_side: 'blue' | 'red'
  outcome: 'correct' | 'incorrect'
  blue_pct: number
  voted_at: string
}

export interface InfluenceResponse {
  authenticated: true
  user: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    reputation_score: number
    followers_count: number
    following_count: number
    total_votes: number
    total_arguments: number
  }
  influence_score: number            // 0–100 composite
  tier: InfluenceTier
  tier_label: string
  tier_description: string
  score_breakdown: {
    engagement: number               // 0–40
    quality: number                  // 0–25
    reach: number                    // 0–20
    civic_impact: number             // 0–15
  }
  // Argument impact
  total_arguments: number
  total_upvotes_received: number
  total_replies_received: number
  avg_upvotes_per_argument: number
  avg_ai_score: number | null
  citation_rate: number              // 0–1 fraction of args with citations
  top_arguments: TopArgument[]
  // Category breakdown
  category_breakdown: CategoryEngagement[]
  // Legislative footprint
  laws_correctly_backed: number
  fails_correctly_opposed: number
  legislative_accuracy: number | null // 0–100 %, null if < 3 resolved votes
  legislative_picks: LegislativePick[]
}

export interface InfluenceResponseUnauthenticated {
  authenticated: false
}

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  InfluenceTier,
  { label: string; description: string; minScore: number }
> = {
  amplifier: {
    label: 'The Amplifier',
    description:
      'Your arguments move mountains. You sit at the top of the influence hierarchy — high upvotes, quality discourse, a broad follower base, and a sharp legislative track record.',
    minScore: 75,
  },
  advocate: {
    label: 'The Advocate',
    description:
      'You have built a meaningful presence in the Lobby. Your arguments attract genuine engagement and your legislative instincts are reliable.',
    minScore: 50,
  },
  contributor: {
    label: 'The Contributor',
    description:
      'You participate consistently and your arguments draw real upvotes. Keep sharpening your reasoning — you are on the path to Advocate.',
    minScore: 30,
  },
  emerging: {
    label: 'The Emerging Voice',
    description:
      'You are finding your footing. A few well-placed arguments and a growing follower base mark you as someone worth watching.',
    minScore: 10,
  },
  newcomer: {
    label: 'The Newcomer',
    description:
      'Every Amplifier starts here. Cast votes, write arguments, earn upvotes, and your influence score will climb.',
    minScore: 0,
  },
}

function classifyTier(score: number): InfluenceTier {
  if (score >= 75) return 'amplifier'
  if (score >= 50) return 'advocate'
  if (score >= 30) return 'contributor'
  if (score >= 10) return 'emerging'
  return 'newcomer'
}

// ─── Score helpers ────────────────────────────────────────────────────────────

function logScore(value: number, midpoint: number, max: number): number {
  if (value <= 0) return 0
  const s = Math.log1p(value) / Math.log1p(midpoint + 1)
  return Math.min(max, Math.round(s * max))
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ authenticated: false } satisfies InfluenceResponseUnauthenticated)
  }

  // ── Fetch profile ──────────────────────────────────────────────────────────

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'username, display_name, avatar_url, role, clout, reputation_score, ' +
      'followers_count, following_count, total_votes, total_arguments'
    )
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ authenticated: false } satisfies InfluenceResponseUnauthenticated)
  }

  // ── Fetch user's arguments ─────────────────────────────────────────────────

  type RawArg = {
    id: string
    content: string
    side: string
    upvotes: number
    ai_score: number | null
    ai_grade: string | null
    source_url: string | null
    created_at: string
    topics: {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
    } | null
  }

  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select(
      'id, content, side, upvotes, ai_score, ai_grade, source_url, created_at, ' +
      'topics(id, statement, category, status, blue_pct)'
    )
    .eq('user_id', user.id)
    .order('upvotes', { ascending: false })
    .limit(500)

  const args = (rawArgs as unknown as RawArg[] | null) ?? []

  // ── Reply counts on user's arguments ──────────────────────────────────────

  const argIds = args.map((a) => a.id)
  type ReplyRow = { argument_id: string }
  const replyMap: Record<string, number> = {}

  if (argIds.length > 0) {
    const { data: replies } = await supabase
      .from('argument_replies')
      .select('argument_id')
      .in('argument_id', argIds.slice(0, 200))

    const rows = (replies as unknown as ReplyRow[] | null) ?? []
    for (const r of rows) {
      replyMap[r.argument_id] = (replyMap[r.argument_id] ?? 0) + 1
    }
  }

  // ── Argument metrics ───────────────────────────────────────────────────────

  const totalArgs = args.length
  const totalUpvotes = args.reduce((s, a) => s + (a.upvotes ?? 0), 0)
  const totalReplies = Object.values(replyMap).reduce((s, n) => s + n, 0)
  const avgUpvotes = totalArgs > 0 ? totalUpvotes / totalArgs : 0
  const argsWithCitation = args.filter((a) => a.source_url).length
  const citationRate = totalArgs > 0 ? argsWithCitation / totalArgs : 0

  const gradedArgs = args.filter((a) => a.ai_score !== null)
  const avgAiScore: number | null =
    gradedArgs.length > 0
      ? Math.round(
          (gradedArgs.reduce((s, a) => s + (a.ai_score ?? 0), 0) / gradedArgs.length) * 10
        ) / 10
      : null

  // ── Top arguments ─────────────────────────────────────────────────────────

  const topArguments: TopArgument[] = args.slice(0, 10).map((a) => ({
    id: a.id,
    content: a.content,
    side: a.side === 'blue' ? 'blue' : 'red',
    upvotes: a.upvotes ?? 0,
    reply_count: replyMap[a.id] ?? 0,
    ai_grade: a.ai_grade,
    ai_score: a.ai_score,
    has_citation: !!a.source_url,
    topic_id: a.topics?.id ?? '',
    topic_statement: a.topics?.statement ?? '',
    topic_category: a.topics?.category ?? null,
    topic_status: a.topics?.status ?? '',
    created_at: a.created_at,
  }))

  // ── Category breakdown ────────────────────────────────────────────────────

  const catMap: Record<
    string,
    { count: number; upvotes: number; aiScores: number[] }
  > = {}

  for (const a of args) {
    const cat = a.topics?.category ?? 'Uncategorized'
    if (!catMap[cat]) catMap[cat] = { count: 0, upvotes: 0, aiScores: [] }
    catMap[cat].count += 1
    catMap[cat].upvotes += a.upvotes ?? 0
    if (a.ai_score !== null) catMap[cat].aiScores.push(a.ai_score)
  }

  const categoryBreakdown: CategoryEngagement[] = Object.entries(catMap)
    .map(([category, { count, upvotes, aiScores }]) => ({
      category,
      argument_count: count,
      total_upvotes: upvotes,
      avg_upvotes: count > 0 ? Math.round((upvotes / count) * 10) / 10 : 0,
      avg_ai_score:
        aiScores.length > 0
          ? Math.round((aiScores.reduce((s, n) => s + n, 0) / aiScores.length) * 10) / 10
          : null,
    }))
    .sort((a, b) => b.total_upvotes - a.total_upvotes)
    .slice(0, 8)

  // ── Legislative footprint ─────────────────────────────────────────────────

  type VoteRow = {
    side: string
    created_at: string
    topics: {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
    } | null
  }

  const { data: rawVotes } = await supabase
    .from('votes')
    .select('side, created_at, topics(id, statement, category, status, blue_pct)')
    .eq('user_id', user.id)
    .in('topics.status', ['law', 'failed'])
    .limit(500)

  const resolvedVotes = ((rawVotes as unknown as VoteRow[] | null) ?? []).filter(
    (v) => v.topics?.status === 'law' || v.topics?.status === 'failed'
  )

  let lawsCorrectlyBacked = 0
  let failsCorrectlyOpposed = 0
  const legislativePicks: LegislativePick[] = []

  for (const v of resolvedVotes) {
    const t = v.topics!
    const userSide: 'blue' | 'red' = v.side === 'blue' ? 'blue' : 'red'

    // "Correct" means:
    //   - Voted blue on a topic that became law (majority FOR wins)
    //   - Voted red on a topic that failed (majority AGAINST wins)
    const isLaw = t.status === 'law'
    const isFailed = t.status === 'failed'
    const correct =
      (isLaw && userSide === 'blue') || (isFailed && userSide === 'red')

    if (isLaw && userSide === 'blue') lawsCorrectlyBacked++
    if (isFailed && userSide === 'red') failsCorrectlyOpposed++

    legislativePicks.push({
      topic_id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status as 'law' | 'failed',
      user_side: userSide,
      outcome: correct ? 'correct' : 'incorrect',
      blue_pct: t.blue_pct ?? 50,
      voted_at: v.created_at,
    })
  }

  legislativePicks.sort((a, b) =>
    new Date(b.voted_at).getTime() - new Date(a.voted_at).getTime()
  )

  const legislativeAccuracy: number | null =
    resolvedVotes.length >= 3
      ? Math.round(
          ((lawsCorrectlyBacked + failsCorrectlyOpposed) / resolvedVotes.length) * 100
        )
      : null

  // ── Score computation ─────────────────────────────────────────────────────

  // Engagement: 0–40 — total upvotes received (log scale, midpoint ~50)
  const engagementScore = logScore(totalUpvotes, 50, 40)

  // Quality: 0–25 — avg AI grade (5 pt scale) + citation bonus
  let qualityScore = 0
  if (avgAiScore !== null) {
    // AI scores 1–10, map to 0–20 of the 25 pts
    qualityScore = Math.round((avgAiScore / 10) * 20)
  }
  // Citation bonus: up to 5 extra pts
  qualityScore = Math.min(25, qualityScore + Math.round(citationRate * 5))

  // Reach: 0–20 — followers_count (log scale, midpoint ~20)
  const reachScore = logScore(profile.followers_count ?? 0, 20, 20)

  // Civic impact: 0–15 — legislative accuracy percentage
  const civicScore =
    legislativeAccuracy !== null
      ? Math.round((legislativeAccuracy / 100) * 15)
      : resolvedVotes.length > 0
        ? Math.round(
            ((lawsCorrectlyBacked + failsCorrectlyOpposed) / Math.max(1, resolvedVotes.length)) * 10
          )
        : 0

  const influenceScore = Math.min(
    100,
    engagementScore + qualityScore + reachScore + civicScore
  )

  const tier = classifyTier(influenceScore)
  const tierMeta = TIER_CONFIG[tier]

  return NextResponse.json({
    authenticated: true,
    user: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout ?? 0,
      reputation_score: profile.reputation_score ?? 0,
      followers_count: profile.followers_count ?? 0,
      following_count: profile.following_count ?? 0,
      total_votes: profile.total_votes ?? 0,
      total_arguments: profile.total_arguments ?? 0,
    },
    influence_score: influenceScore,
    tier,
    tier_label: tierMeta.label,
    tier_description: tierMeta.description,
    score_breakdown: {
      engagement: engagementScore,
      quality: qualityScore,
      reach: reachScore,
      civic_impact: civicScore,
    },
    total_arguments: totalArgs,
    total_upvotes_received: totalUpvotes,
    total_replies_received: totalReplies,
    avg_upvotes_per_argument: Math.round(avgUpvotes * 10) / 10,
    avg_ai_score: avgAiScore,
    citation_rate: Math.round(citationRate * 100) / 100,
    top_arguments: topArguments,
    category_breakdown: categoryBreakdown,
    laws_correctly_backed: lawsCorrectlyBacked,
    fails_correctly_opposed: failsCorrectlyOpposed,
    legislative_accuracy: legislativeAccuracy,
    legislative_picks: legislativePicks.slice(0, 20),
  } satisfies InfluenceResponse)
}
