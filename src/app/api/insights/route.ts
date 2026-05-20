import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 1800 // 30-minute CDN cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryMomentum {
  category: string
  votes_this_week: number
  votes_last_week: number
  change_pct: number // positive = growing
  avg_for_pct: number
  law_count: number
  active_count: number
}

export interface ConsensusSnapshot {
  strong_consensus_pct: number  // ≥70% one side
  contested_pct: number          // 44–56% split
  trending_to_law: number        // topics 62–79% FOR
  avg_platform_for_pct: number
}

export interface ArgumentQualitySnapshot {
  grade_a_pct: number
  grade_b_pct: number
  grade_c_pct: number
  grade_df_pct: number
  avg_score: number | null
  total_graded: number
  total_this_week: number
}

export interface TopMoverTopic {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  status: string
  votes_7d: number
  arguments_7d: number
  engagement_score: number
}

export interface RisingContributor {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  votes_7d: number
  arguments_7d: number
  upvotes_received_7d: number
  impact_score: number
}

export interface LawVelocity {
  avg_days_to_law_30d: number | null
  avg_days_to_law_all: number | null
  laws_this_month: number
  laws_last_month: number
  fastest_recent_law: { statement: string; days: number } | null
}

export interface InsightsResponse {
  generated_at: string
  week_start: string
  category_momentum: CategoryMomentum[]
  consensus: ConsensusSnapshot
  argument_quality: ArgumentQualitySnapshot
  top_movers: TopMoverTopic[]
  rising_contributors: RisingContributor[]
  law_velocity: LawVelocity
  platform_totals: {
    total_votes_7d: number
    total_arguments_7d: number
    new_topics_7d: number
    new_laws_7d: number
    active_citizens_7d: number
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 3600 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
  const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 3600 * 1000)

  const weekAgoISO = weekAgo.toISOString()
  const twoWeeksAgoISO = twoWeeksAgo.toISOString()

  // ── 1. All active/voting/law topics for consensus snapshot ─────────────────
  const { data: allTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .in('status', ['active', 'voting', 'law', 'failed'])
    .gt('total_votes', 5)

  const topics = allTopics ?? []

  // ── 2. Recent votes (last 7d and prior 7d) for category momentum ──────────
  const { data: recentVotes } = await supabase
    .from('votes')
    .select('created_at, topic_id')
    .gte('created_at', twoWeeksAgoISO)

  const votes7d = (recentVotes ?? []).filter(
    (v) => new Date(v.created_at) >= weekAgo
  )
  const votesPrev7d = (recentVotes ?? []).filter(
    (v) => new Date(v.created_at) < weekAgo
  )

  // Build topic→category map
  const topicCategoryMap = new Map(
    topics.map((t) => [t.id, t.category ?? 'Other'])
  )

  // ── 3. Category momentum ──────────────────────────────────────────────────
  const catVotes7d: Record<string, number> = {}
  const catVotesPrev7d: Record<string, number> = {}
  for (const v of votes7d) {
    const cat = topicCategoryMap.get(v.topic_id) ?? 'Other'
    catVotes7d[cat] = (catVotes7d[cat] ?? 0) + 1
  }
  for (const v of votesPrev7d) {
    const cat = topicCategoryMap.get(v.topic_id) ?? 'Other'
    catVotesPrev7d[cat] = (catVotesPrev7d[cat] ?? 0) + 1
  }

  const CATEGORIES = [
    'Politics', 'Technology', 'Ethics', 'Culture', 'Economics',
    'Science', 'Philosophy', 'Health', 'Environment', 'Education',
  ]

  const category_momentum: CategoryMomentum[] = CATEGORIES.map((cat) => {
    const thisWeek = catVotes7d[cat] ?? 0
    const lastWeek = catVotesPrev7d[cat] ?? 0
    const changePct = lastWeek === 0
      ? (thisWeek > 0 ? 100 : 0)
      : Math.round(((thisWeek - lastWeek) / lastWeek) * 100)

    const catTopics = topics.filter((t) => (t.category ?? 'Other') === cat)
    const forPcts = catTopics.filter((t) => t.total_votes > 0).map((t) => t.blue_pct)
    const avgForPct = forPcts.length > 0
      ? Math.round(forPcts.reduce((a, b) => a + b, 0) / forPcts.length)
      : 50

    return {
      category: cat,
      votes_this_week: thisWeek,
      votes_last_week: lastWeek,
      change_pct: changePct,
      avg_for_pct: avgForPct,
      law_count: catTopics.filter((t) => t.status === 'law').length,
      active_count: catTopics.filter((t) => ['active', 'voting'].includes(t.status)).length,
    }
  }).sort((a, b) => b.votes_this_week - a.votes_this_week)

  // ── 4. Consensus snapshot ────────────────────────────────────────────────
  const activeTopics = topics.filter((t) =>
    ['active', 'voting'].includes(t.status) && t.total_votes >= 10
  )

  const strongConsensus = activeTopics.filter(
    (t) => t.blue_pct >= 70 || t.blue_pct <= 30
  ).length

  const contested = activeTopics.filter(
    (t) => t.blue_pct >= 44 && t.blue_pct <= 56
  ).length

  const trendingToLaw = activeTopics.filter(
    (t) => t.blue_pct >= 62 && t.blue_pct <= 79
  ).length

  const allForPcts = activeTopics.map((t) => t.blue_pct)
  const avgPlatformFor = allForPcts.length > 0
    ? Math.round(allForPcts.reduce((a, b) => a + b, 0) / allForPcts.length)
    : 50

  const consensus: ConsensusSnapshot = {
    strong_consensus_pct: activeTopics.length > 0
      ? Math.round((strongConsensus / activeTopics.length) * 100)
      : 0,
    contested_pct: activeTopics.length > 0
      ? Math.round((contested / activeTopics.length) * 100)
      : 0,
    trending_to_law: trendingToLaw,
    avg_platform_for_pct: avgPlatformFor,
  }

  // ── 5. Argument quality snapshot ────────────────────────────────────────
  const { data: gradedArgs } = await supabase
    .from('topic_arguments')
    .select('ai_grade, ai_score, created_at')
    .not('ai_grade', 'is', null)

  const allGraded = gradedArgs ?? []
  const recentGraded = allGraded.filter(
    (a) => new Date(a.created_at) >= weekAgo
  )

  function gradeDist(args: typeof allGraded) {
    const total = args.length
    if (total === 0) return { a: 0, b: 0, c: 0, df: 0, avgScore: null }
    const a = args.filter((x) => x.ai_grade === 'A').length
    const b = args.filter((x) => x.ai_grade === 'B').length
    const c = args.filter((x) => x.ai_grade === 'C').length
    const df = args.filter((x) => !['A', 'B', 'C'].includes(x.ai_grade ?? '')).length
    const scores = args.filter((x) => typeof x.ai_score === 'number').map((x) => x.ai_score as number)
    const avgScore = scores.length > 0
      ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10
      : null
    return {
      a: Math.round((a / total) * 100),
      b: Math.round((b / total) * 100),
      c: Math.round((c / total) * 100),
      df: Math.round((df / total) * 100),
      avgScore,
    }
  }

  const dist = gradeDist(allGraded)
  const argument_quality: ArgumentQualitySnapshot = {
    grade_a_pct: dist.a,
    grade_b_pct: dist.b,
    grade_c_pct: dist.c,
    grade_df_pct: dist.df,
    avg_score: dist.avgScore,
    total_graded: allGraded.length,
    total_this_week: recentGraded.length,
  }

  // ── 6. Top-mover topics (most engagement last 7d) ─────────────────────────
  const { data: recentArgs } = await supabase
    .from('topic_arguments')
    .select('topic_id, created_at')
    .gte('created_at', weekAgoISO)

  const argsPerTopic: Record<string, number> = {}
  for (const a of recentArgs ?? []) {
    argsPerTopic[a.topic_id] = (argsPerTopic[a.topic_id] ?? 0) + 1
  }

  const votesPerTopic7d: Record<string, number> = {}
  for (const v of votes7d) {
    votesPerTopic7d[v.topic_id] = (votesPerTopic7d[v.topic_id] ?? 0) + 1
  }

  const activeAndVoting = topics.filter((t) =>
    ['active', 'voting'].includes(t.status)
  )

  const top_movers: TopMoverTopic[] = activeAndVoting
    .map((t) => {
      const v7d = votesPerTopic7d[t.id] ?? 0
      const a7d = argsPerTopic[t.id] ?? 0
      return {
        id: t.id,
        statement: t.statement,
        category: t.category,
        blue_pct: t.blue_pct,
        total_votes: t.total_votes,
        status: t.status,
        votes_7d: v7d,
        arguments_7d: a7d,
        engagement_score: v7d * 1 + a7d * 3,
      }
    })
    .filter((t) => t.engagement_score > 0)
    .sort((a, b) => b.engagement_score - a.engagement_score)
    .slice(0, 6)

  // ── 7. Rising contributors ────────────────────────────────────────────────
  const { data: recentVoterIds } = await supabase
    .from('votes')
    .select('user_id, created_at')
    .gte('created_at', weekAgoISO)

  const { data: recentArgWriters } = await supabase
    .from('topic_arguments')
    .select('user_id, upvotes, created_at')
    .gte('created_at', weekAgoISO)

  const contributorMap: Record<string, {
    votes: number
    arguments: number
    upvotes_received: number
  }> = {}

  for (const v of recentVoterIds ?? []) {
    if (!v.user_id) continue
    contributorMap[v.user_id] ??= { votes: 0, arguments: 0, upvotes_received: 0 }
    contributorMap[v.user_id].votes++
  }

  for (const a of recentArgWriters ?? []) {
    if (!a.user_id) continue
    contributorMap[a.user_id] ??= { votes: 0, arguments: 0, upvotes_received: 0 }
    contributorMap[a.user_id].arguments++
    contributorMap[a.user_id].upvotes_received += a.upvotes ?? 0
  }

  const topContributorIds = Object.entries(contributorMap)
    .map(([id, stats]) => ({
      id,
      score: stats.votes * 2 + stats.arguments * 4 + stats.upvotes_received * 3,
      ...stats,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((c) => c.id)

  let rising_contributors: RisingContributor[] = []
  if (topContributorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', topContributorIds)

    rising_contributors = (profiles ?? []).map((p) => {
      const stats = contributorMap[p.id] ?? { votes: 0, arguments: 0, upvotes_received: 0 }
      return {
        user_id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        votes_7d: stats.votes,
        arguments_7d: stats.arguments,
        upvotes_received_7d: stats.upvotes_received,
        impact_score: stats.votes * 2 + stats.arguments * 4 + stats.upvotes_received * 3,
      }
    }).sort((a, b) => b.impact_score - a.impact_score)
  }

  // ── 8. Law velocity ───────────────────────────────────────────────────────
  const { data: recentLaws } = await supabase
    .from('laws')
    .select('statement, established_at, total_votes')
    .eq('is_active', true)
    .order('established_at', { ascending: false })
    .limit(60)

  const lawsThisMonth = (recentLaws ?? []).filter(
    (l) => new Date(l.established_at) >= monthAgo
  )
  const lawsLastMonth = (recentLaws ?? []).filter(
    (l) =>
      new Date(l.established_at) < monthAgo &&
      new Date(l.established_at) >= twoMonthsAgo
  )

  // Find corresponding topics to measure time-to-law
  const lawStatements = lawsThisMonth.slice(0, 10).map((l) => l.statement)
  let fastestRecent: { statement: string; days: number } | null = null

  if (lawStatements.length > 0) {
    const { data: matchedTopics } = await supabase
      .from('topics')
      .select('statement, created_at, status')
      .in('statement', lawStatements)
      .eq('status', 'law')

    if (matchedTopics && matchedTopics.length > 0) {
      const paired = matchedTopics.map((t) => {
        const law = (recentLaws ?? []).find((l) => l.statement === t.statement)
        if (!law) return null
        const days = Math.max(
          1,
          Math.round(
            (new Date(law.established_at).getTime() - new Date(t.created_at).getTime()) /
              (24 * 3600 * 1000)
          )
        )
        return { statement: t.statement, days }
      }).filter(Boolean) as { statement: string; days: number }[]

      if (paired.length > 0) {
        fastestRecent = paired.sort((a, b) => a.days - b.days)[0]
      }
    }
  }

  const law_velocity: LawVelocity = {
    avg_days_to_law_30d: null,
    avg_days_to_law_all: null,
    laws_this_month: lawsThisMonth.length,
    laws_last_month: lawsLastMonth.length,
    fastest_recent_law: fastestRecent,
  }

  // ── 9. Platform totals ────────────────────────────────────────────────────
  const uniqueVoters7d = new Set((recentVoterIds ?? []).map((v) => v.user_id)).size
  const newLaws7d = (recentLaws ?? []).filter(
    (l) => new Date(l.established_at) >= weekAgo
  ).length
  const newTopics7d = topics.filter(
    (t) => new Date(t.created_at) >= weekAgo
  ).length

  const platform_totals = {
    total_votes_7d: votes7d.length,
    total_arguments_7d: (recentArgs ?? []).length,
    new_topics_7d: newTopics7d,
    new_laws_7d: newLaws7d,
    active_citizens_7d: uniqueVoters7d,
  }

  const response: InsightsResponse = {
    generated_at: now.toISOString(),
    week_start: weekAgo.toISOString(),
    category_momentum,
    consensus,
    argument_quality,
    top_movers,
    rising_contributors,
    law_velocity,
    platform_totals,
  }

  return NextResponse.json(response)
}
