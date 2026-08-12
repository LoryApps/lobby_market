import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface PortfolioArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
}

export interface PortfolioLaw {
  id: string
  statement: string
  category: string | null
  established_at: string
  total_votes: number
  blue_pct: number | null
  user_voted: 'for' | 'against' | null
}

export interface PortfolioAchievement {
  slug: string
  name: string
  description: string
  icon: string
  tier: string
  earned_at: string
}

export interface PortfolioCategoryBreakdown {
  category: string
  vote_count: number
  argument_count: number
}

export interface PortfolioProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
  total_arguments: number
  vote_streak: number
  civic_archetype: string | null
  created_at: string
  blue_vote_count: number
  red_vote_count: number
}

export interface PortfolioData {
  profile: PortfolioProfile
  topArguments: PortfolioArgument[]
  laws: PortfolioLaw[]
  achievements: PortfolioAchievement[]
  categoryBreakdown: PortfolioCategoryBreakdown[]
  stats: {
    totalUpvotesReceived: number
    lawsSupported: number
    debateWins: number
    topCategory: string | null
    avgArgumentScore: number | null
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } }
) {
  const supabase = await createClient()

  // ── Profile ───────────────────────────────────────────────────────────────
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, bio, role, clout, reputation_score, total_votes, total_arguments, vote_streak, civic_archetype, created_at, blue_vote_count, red_vote_count'
    )
    .eq('username', params.username)
    .maybeSingle()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // ── Top arguments (by upvotes + ai_score) ─────────────────────────────────
  const { data: rawArgs } = await supabase
    .from('arguments')
    .select(
      'id, content, side, upvotes, ai_score, ai_grade, created_at, topic_id, topics(id, statement, category, status, blue_pct, total_votes)'
    )
    .eq('author_id', profile.id)
    .order('upvotes', { ascending: false })
    .limit(6)

  const topArguments: PortfolioArgument[] = (rawArgs ?? []).map((a) => ({
    id: a.id,
    content: a.content,
    side: a.side as 'blue' | 'red',
    upvotes: a.upvotes ?? 0,
    ai_score: a.ai_score ?? null,
    ai_grade: a.ai_grade ?? null,
    created_at: a.created_at,
    topic: Array.isArray(a.topics) ? (a.topics[0] ?? null) : (a.topics ?? null),
  }))

  // ── Laws the user voted FOR that became law ──────────────────────────────
  const { data: userVotes } = await supabase
    .from('votes')
    .select('topic_id, vote_type')
    .eq('user_id', profile.id)

  const votedTopicIds = (userVotes ?? []).map((v) => v.topic_id)
  const voteMap = Object.fromEntries(
    (userVotes ?? []).map((v) => [v.topic_id, v.vote_type as 'for' | 'against'])
  )

  let laws: PortfolioLaw[] = []
  if (votedTopicIds.length > 0) {
    const { data: rawLaws } = await supabase
      .from('topics')
      .select('id, statement, category, status, total_votes, blue_pct, created_at')
      .in('id', votedTopicIds)
      .eq('status', 'law')
      .order('created_at', { ascending: false })
      .limit(6)

    laws = (rawLaws ?? []).map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      established_at: t.created_at,
      total_votes: t.total_votes ?? 0,
      blue_pct: t.blue_pct ?? null,
      user_voted: voteMap[t.id] ?? null,
    }))
  }

  // ── Top achievements ──────────────────────────────────────────────────────
  const { data: rawAchievements } = await supabase
    .from('user_achievements')
    .select('earned_at, achievements(slug, name, description, icon, tier)')
    .eq('user_id', profile.id)
    .order('earned_at', { ascending: false })
    .limit(6)

  const achievements: PortfolioAchievement[] = (rawAchievements ?? [])
    .filter((a) => a.achievements !== null)
    .map((a) => {
      const ach = Array.isArray(a.achievements) ? a.achievements[0] : a.achievements
      return {
        slug: ach?.slug ?? '',
        name: ach?.name ?? '',
        description: ach?.description ?? '',
        icon: ach?.icon ?? '🏅',
        tier: ach?.tier ?? 'bronze',
        earned_at: a.earned_at,
      }
    })

  // ── Category breakdown via arguments ──────────────────────────────────────
  const { data: argCats } = await supabase
    .from('arguments')
    .select('topics(category)')
    .eq('author_id', profile.id)
    .limit(200)

  const catVotes: Record<string, { votes: number; args: number }> = {}

  for (const a of argCats ?? []) {
    const topicArr = Array.isArray(a.topics) ? a.topics : [a.topics]
    for (const t of topicArr) {
      if (t?.category) {
        if (!catVotes[t.category]) catVotes[t.category] = { votes: 0, args: 0 }
        catVotes[t.category].args += 1
      }
    }
  }

  // Also count votes by category
  if (votedTopicIds.length > 0) {
    const { data: votedTopics } = await supabase
      .from('topics')
      .select('id, category')
      .in('id', votedTopicIds.slice(0, 200))

    for (const t of votedTopics ?? []) {
      if (t.category) {
        if (!catVotes[t.category]) catVotes[t.category] = { votes: 0, args: 0 }
        catVotes[t.category].votes += 1
      }
    }
  }

  const categoryBreakdown: PortfolioCategoryBreakdown[] = Object.entries(catVotes)
    .map(([category, { votes, args }]) => ({ category, vote_count: votes, argument_count: args }))
    .sort((a, b) => (b.vote_count + b.argument_count) - (a.vote_count + a.argument_count))
    .slice(0, 6)

  // ── Aggregate stats ───────────────────────────────────────────────────────
  const totalUpvotesReceived = topArguments.reduce((sum, a) => sum + a.upvotes, 0)
  const lawsSupported = laws.filter((l) => l.user_voted === 'for').length
  const avgArgScore = topArguments.filter((a) => a.ai_score !== null).length > 0
    ? topArguments.filter((a) => a.ai_score !== null).reduce((s, a) => s + (a.ai_score ?? 0), 0) /
      topArguments.filter((a) => a.ai_score !== null).length
    : null

  const topCategory = categoryBreakdown[0]?.category ?? null

  return NextResponse.json({
    profile,
    topArguments,
    laws,
    achievements,
    categoryBreakdown,
    stats: {
      totalUpvotesReceived,
      lawsSupported,
      debateWins: 0,
      topCategory,
      avgArgumentScore: avgArgScore ? Math.round(avgArgScore * 10) / 10 : null,
    },
  } satisfies PortfolioData)
}
