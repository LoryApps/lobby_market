import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Response types ───────────────────────────────────────────────────────────

export interface ResumeProfile {
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  role: string
  civic_archetype: string | null
  clout: number
  reputation_score: number
  total_votes: number
  total_arguments: number
  vote_streak: number
  followers_count: number
  following_count: number
  member_since: string
}

export interface ResumeTopArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
}

export interface ResumeLawContribution {
  law_id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
  user_voted: 'blue' | 'red'
}

export interface ResumeCategoryBreakdown {
  category: string
  votes: number
  blue: number
  red: number
  pct_for: number
}

export interface ResumeAchievement {
  id: string
  title: string
  description: string | null
  tier: string | null
  earned_at: string
}

export interface ResumeDebateStat {
  total_debates: number
  debates_won: number
}

export interface ResumeData {
  profile: ResumeProfile
  topArguments: ResumeTopArgument[]
  lawContributions: ResumeLawContribution[]
  categoryBreakdown: ResumeCategoryBreakdown[]
  achievements: ResumeAchievement[]
  debateStats: ResumeDebateStat
  predictionsAccuracy: number | null
  topicsProposed: number
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Profile ────────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'username, display_name, avatar_url, bio, role, civic_archetype, clout, reputation_score, total_votes, total_arguments, vote_streak, followers_count, following_count, created_at'
    )
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // ── Top arguments (by upvotes) ─────────────────────────────────────────────
  const { data: rawArgs } = await supabase
    .from('arguments')
    .select(`
      id, content, side, upvotes,
      topics!inner ( id, statement, category, status )
    `)
    .eq('author_id', user.id)
    .order('upvotes', { ascending: false })
    .limit(5)

  const topArguments: ResumeTopArgument[] = (rawArgs ?? []).map((a) => {
    const topic = Array.isArray(a.topics) ? a.topics[0] : a.topics
    return {
      id: a.id,
      content: a.content,
      side: a.side as 'blue' | 'red',
      upvotes: a.upvotes,
      topic_id: topic?.id ?? '',
      topic_statement: topic?.statement ?? '',
      topic_category: topic?.category ?? null,
      topic_status: topic?.status ?? 'active',
    }
  })

  // ── Law contributions (topics user voted FOR that became law) ──────────────
  const { data: rawVotes } = await supabase
    .from('votes')
    .select(`
      side,
      topics!inner ( id, statement, category, blue_pct, total_votes, voting_ends_at, status )
    `)
    .eq('user_id', user.id)
    .eq('topics.status', 'law')
    .order('topics(voting_ends_at)', { ascending: false })
    .limit(6)

  const lawContributions: ResumeLawContribution[] = (rawVotes ?? []).map((v) => {
    const topic = Array.isArray(v.topics) ? v.topics[0] : v.topics
    return {
      law_id: topic?.id ?? '',
      statement: topic?.statement ?? '',
      category: topic?.category ?? null,
      blue_pct: topic?.blue_pct ?? 0,
      total_votes: topic?.total_votes ?? 0,
      established_at: topic?.voting_ends_at ?? '',
      user_voted: v.side as 'blue' | 'red',
    }
  })

  // ── Category breakdown ─────────────────────────────────────────────────────
  const { data: rawVotesCat } = await supabase
    .from('votes')
    .select(`
      side,
      topics!inner ( category )
    `)
    .eq('user_id', user.id)
    .not('topics.category', 'is', null)

  const catMap = new Map<string, { total: number; blue: number; red: number }>()
  for (const v of rawVotesCat ?? []) {
    const topic = Array.isArray(v.topics) ? v.topics[0] : v.topics
    const cat = topic?.category
    if (!cat) continue
    const existing = catMap.get(cat) ?? { total: 0, blue: 0, red: 0 }
    existing.total += 1
    if (v.side === 'blue') existing.blue += 1
    else existing.red += 1
    catMap.set(cat, existing)
  }

  const categoryBreakdown: ResumeCategoryBreakdown[] = Array.from(catMap.entries())
    .map(([category, stats]) => ({
      category,
      votes: stats.total,
      blue: stats.blue,
      red: stats.red,
      pct_for: stats.total > 0 ? Math.round((stats.blue / stats.total) * 100) : 50,
    }))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 6)

  // ── Achievements ───────────────────────────────────────────────────────────
  const { data: rawAchievements } = await supabase
    .from('user_achievements')
    .select('id, title, description, tier, earned_at')
    .eq('user_id', user.id)
    .order('earned_at', { ascending: false })
    .limit(6)

  const achievements: ResumeAchievement[] = (rawAchievements ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description ?? null,
    tier: a.tier ?? null,
    earned_at: a.earned_at,
  }))

  // ── Debate stats ───────────────────────────────────────────────────────────
  const [{ count: totalDebates }, { count: debatesWon }] = await Promise.all([
    supabase
      .from('debate_participants')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('debate_participants')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('result', 'won'),
  ])

  // ── Prediction accuracy ────────────────────────────────────────────────────
  const { data: predStats } = await supabase
    .from('predictions')
    .select('correct')
    .eq('user_id', user.id)
    .not('correct', 'is', null)

  const totalPreds = predStats?.length ?? 0
  const correctPreds = predStats?.filter((p) => p.correct).length ?? 0
  const predictionsAccuracy =
    totalPreds > 0 ? Math.round((correctPreds / totalPreds) * 100) : null

  // ── Topics proposed ────────────────────────────────────────────────────────
  const { count: topicsProposed } = await supabase
    .from('topics')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', user.id)

  const result: ResumeData = {
    profile: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      role: profile.role,
      civic_archetype: profile.civic_archetype,
      clout: profile.clout,
      reputation_score: profile.reputation_score,
      total_votes: profile.total_votes,
      total_arguments: profile.total_arguments,
      vote_streak: profile.vote_streak,
      followers_count: profile.followers_count,
      following_count: profile.following_count,
      member_since: profile.created_at,
    },
    topArguments,
    lawContributions,
    categoryBreakdown,
    achievements,
    debateStats: {
      total_debates: totalDebates ?? 0,
      debates_won: debatesWon ?? 0,
    },
    predictionsAccuracy,
    topicsProposed: topicsProposed ?? 0,
  }

  return NextResponse.json(result)
}
