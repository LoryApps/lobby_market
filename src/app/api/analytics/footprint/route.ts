import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FootprintTier =
  | 'newcomer'
  | 'citizen'
  | 'contributor'
  | 'influencer'
  | 'architect'
  | 'legend'

export interface LawContribution {
  law_id: string
  topic_id: string
  statement: string
  category: string | null
  established_at: string | null
  total_votes: number
  blue_pct: number
  user_side: 'for' | 'against'
  voted_with_majority: boolean
}

export interface FootprintArgument {
  id: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  reply_count: number
  created_at: string
  footprint_score: number
}

export interface CategoryFootprint {
  category: string
  laws_shaped: number
  arguments_posted: number
  argument_upvotes: number
  topics_voted: number
  footprint_points: number
}

export interface FootprintData {
  authenticated: true
  user: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    created_at: string
  }
  footprint_score: number
  tier: FootprintTier
  tier_label: string
  tier_description: string
  laws_shaped: number
  laws_against_majority: number
  law_contributions: LawContribution[]
  top_arguments: FootprintArgument[]
  total_arguments: number
  total_argument_upvotes: number
  total_topics_voted: number
  categories: CategoryFootprint[]
  earliest_law_contribution: string | null
  days_active: number
  next_tier_score: number | null
  next_tier_label: string | null
}

export type FootprintResponse =
  | FootprintData
  | { authenticated: false }

// ─── Tier config ──────────────────────────────────────────────────────────────

interface TierConfig {
  id: FootprintTier
  label: string
  description: string
  min_score: number
}

const TIERS: TierConfig[] = [
  {
    id: 'newcomer',
    label: 'Newcomer',
    description: 'You\'re just getting started. Cast votes and write arguments to build your civic footprint.',
    min_score: 0,
  },
  {
    id: 'citizen',
    label: 'Citizen',
    description: 'You\'ve begun leaving a mark. Keep voting and arguing to expand your civic footprint.',
    min_score: 50,
  },
  {
    id: 'contributor',
    label: 'Contributor',
    description: 'Your arguments are resonating and you\'ve helped shape the civic landscape.',
    min_score: 250,
  },
  {
    id: 'influencer',
    label: 'Influencer',
    description: 'Your civic voice carries weight. Laws bear your influence, and arguments win upvotes.',
    min_score: 750,
  },
  {
    id: 'architect',
    label: 'Civic Architect',
    description: 'You\'ve helped shape the legal fabric of this platform in a meaningful way.',
    min_score: 2000,
  },
  {
    id: 'legend',
    label: 'Legend',
    description: 'An enduring civic force. Your votes, arguments, and laws define what this platform stands for.',
    min_score: 5000,
  },
]

function getTier(score: number): TierConfig & { next_tier: TierConfig | null } {
  let current = TIERS[0]
  for (const t of TIERS) {
    if (score >= t.min_score) current = t
  }
  const idx = TIERS.indexOf(current)
  const next = idx < TIERS.length - 1 ? TIERS[idx + 1] : null
  return { ...current, next_tier: next }
}

// ─── Score formula ─────────────────────────────────────────────────────────────
// law shaped (voted with majority) = 200 pts
// law shaped (voted against majority) = 100 pts   (minority voice that won anyway)
// argument upvote = 5 pts
// argument reply = 2 pts
// topic voted = 1 pt

function computeFootprintScore(
  lawsWithMajority: number,
  lawsAgainstMajority: number,
  argumentUpvotes: number,
  argumentReplies: number,
  topicsVoted: number,
): number {
  return (
    lawsWithMajority * 200 +
    lawsAgainstMajority * 100 +
    argumentUpvotes * 5 +
    argumentReplies * 2 +
    topicsVoted * 1
  )
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ authenticated: false } satisfies FootprintResponse)

  const url = new URL(request.url)
  const targetUsername = url.searchParams.get('username')

  // Resolve target user
  let targetUserId = user.id
  if (targetUsername) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', targetUsername)
      .maybeSingle()
    if (!profile) return NextResponse.json({ authenticated: false } satisfies FootprintResponse)
    targetUserId = profile.id
  }

  // ── Fetch profile ──
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, role, clout, created_at')
    .eq('id', targetUserId)
    .maybeSingle()

  if (!profile) return NextResponse.json({ authenticated: false } satisfies FootprintResponse)

  // ── Votes that became laws ──
  // Fetch user's votes, then cross-reference with laws via topic_id
  const { data: userVotes } = await supabase
    .from('votes')
    .select('side, topic_id')
    .eq('user_id', targetUserId)
    .limit(2000)

  // Get all law topics in one query
  const votedTopicIds = (userVotes ?? []).map((v) => v.topic_id as string)
  const lawTopicMap = new Map<string, { id: string; statement: string; category: string | null; blue_pct: number | null; total_votes: number; law_id: string; established_at: string | null }>()

  if (votedTopicIds.length > 0) {
    const { data: lawTopics } = await supabase
      .from('topics')
      .select(`
        id,
        statement,
        category,
        blue_pct,
        total_votes,
        laws (
          id,
          established_at
        )
      `)
      .in('id', votedTopicIds)
      .eq('status', 'law')
      .limit(500)

    for (const t of lawTopics ?? []) {
      const lawsArr = (t.laws ?? []) as Array<{ id: string; established_at: string | null }>
      if (lawsArr.length > 0) {
        lawTopicMap.set(t.id as string, {
          id: t.id as string,
          statement: t.statement as string,
          category: (t.category as string | null),
          blue_pct: (t.blue_pct as number | null),
          total_votes: (t.total_votes as number) ?? 0,
          law_id: lawsArr[0].id,
          established_at: lawsArr[0].established_at,
        })
      }
    }
  }

  const votesOnLaws = (userVotes ?? []).filter((v) => lawTopicMap.has(v.topic_id as string))

  const lawContributions: LawContribution[] = []
  for (const row of votesOnLaws) {
    const topicId = row.topic_id as string
    const topic = lawTopicMap.get(topicId)
    if (!topic) continue

    const forPct = topic.blue_pct ?? 50
    const userSide = (row.side as string) === 'blue' ? 'for' : 'against'
    const majorityWasFor = forPct >= 50
    const votedWithMajority =
      (userSide === 'for' && majorityWasFor) || (userSide === 'against' && !majorityWasFor)

    lawContributions.push({
      law_id: topic.law_id,
      topic_id: topic.id,
      statement: topic.statement,
      category: topic.category,
      established_at: topic.established_at,
      total_votes: topic.total_votes,
      blue_pct: forPct,
      user_side: userSide,
      voted_with_majority: votedWithMajority,
    })
  }

  // Sort by established_at desc
  lawContributions.sort((a, b) => {
    const da = a.established_at ? new Date(a.established_at).getTime() : 0
    const db = b.established_at ? new Date(b.established_at).getTime() : 0
    return db - da
  })

  const lawsWithMajority = lawContributions.filter((l) => l.voted_with_majority).length
  const lawsAgainstMajority = lawContributions.filter((l) => !l.voted_with_majority).length

  // ── Top arguments ──
  const { data: rawArguments } = await supabase
    .from('topic_arguments')
    .select(`
      id,
      topic_id,
      side,
      content,
      upvotes,
      reply_count,
      created_at,
      topics (
        statement,
        category,
        status
      )
    `)
    .eq('user_id', targetUserId)
    .order('upvotes', { ascending: false })
    .limit(200)

  const args = (rawArguments ?? []).map((a) => {
    const t = a.topics as { statement: string; category: string | null; status: string } | null
    const upvotes = (a.upvotes as number) ?? 0
    const replyCount = (a.reply_count as number) ?? 0
    const argScore = upvotes * 5 + replyCount * 2
    return {
      id: a.id as string,
      topic_id: a.topic_id as string,
      topic_statement: t?.statement ?? '',
      topic_category: t?.category ?? null,
      topic_status: t?.status ?? 'proposed',
      side: (a.side as 'blue' | 'red'),
      content: ((a.content as string) ?? '').slice(0, 300),
      upvotes,
      reply_count: replyCount,
      created_at: a.created_at as string,
      footprint_score: argScore,
    }
  })

  // Sort by footprint_score and take top 5
  args.sort((a, b) => b.footprint_score - a.footprint_score)
  const topArguments = args.slice(0, 5)

  const totalArgumentUpvotes = args.reduce((s, a) => s + a.upvotes, 0)
  const totalArgumentReplies = args.reduce((s, a) => s + a.reply_count, 0)

  // ── Total votes (use profile field for efficiency) ──
  const { data: voteCountProfile } = await supabase
    .from('profiles')
    .select('total_votes')
    .eq('id', targetUserId)
    .maybeSingle()

  const totalTopicsVoted = (voteCountProfile?.total_votes as number | null) ?? userVotes?.length ?? 0

  // ── Category footprint ──
  const categoryMap = new Map<string, CategoryFootprint>()

  for (const law of lawContributions) {
    const cat = law.category ?? 'Other'
    const entry = categoryMap.get(cat) ?? {
      category: cat,
      laws_shaped: 0,
      arguments_posted: 0,
      argument_upvotes: 0,
      topics_voted: 0,
      footprint_points: 0,
    }
    entry.laws_shaped += 1
    entry.footprint_points += law.voted_with_majority ? 200 : 100
    categoryMap.set(cat, entry)
  }

  for (const arg of args) {
    const cat = arg.topic_category ?? 'Other'
    const entry = categoryMap.get(cat) ?? {
      category: cat,
      laws_shaped: 0,
      arguments_posted: 0,
      argument_upvotes: 0,
      topics_voted: 0,
      footprint_points: 0,
    }
    entry.arguments_posted += 1
    entry.argument_upvotes += arg.upvotes
    entry.footprint_points += arg.footprint_score
    categoryMap.set(cat, entry)
  }

  const categories = Array.from(categoryMap.values())
    .sort((a, b) => b.footprint_points - a.footprint_points)
    .slice(0, 6)

  // ── Footprint score ──
  const footprintScore = computeFootprintScore(
    lawsWithMajority,
    lawsAgainstMajority,
    totalArgumentUpvotes,
    totalArgumentReplies,
    totalTopicsVoted,
  )

  const tierInfo = getTier(footprintScore)

  // ── Days active ──
  const joinedAt = new Date(profile.created_at).getTime()
  const daysActive = Math.floor((Date.now() - joinedAt) / 86_400_000)

  // ── Earliest law contribution ──
  const earliestLaw = lawContributions
    .filter((l) => l.established_at)
    .sort((a, b) => new Date(a.established_at!).getTime() - new Date(b.established_at!).getTime())[0]

  const response: FootprintData = {
    authenticated: true,
    user: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout,
      created_at: profile.created_at,
    },
    footprint_score: footprintScore,
    tier: tierInfo.id,
    tier_label: tierInfo.label,
    tier_description: tierInfo.description,
    laws_shaped: lawContributions.length,
    laws_against_majority: lawsAgainstMajority,
    law_contributions: lawContributions.slice(0, 12),
    top_arguments: topArguments as FootprintArgument[],
    total_arguments: args.length,
    total_argument_upvotes: totalArgumentUpvotes,
    total_topics_voted: totalTopicsVoted,
    categories,
    earliest_law_contribution: earliestLaw?.established_at ?? null,
    days_active: daysActive,
    next_tier_score: tierInfo.next_tier?.min_score ?? null,
    next_tier_label: tierInfo.next_tier?.label ?? null,
  }

  return NextResponse.json(response satisfies FootprintResponse)
}
