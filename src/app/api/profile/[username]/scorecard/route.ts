import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScorecardDimension {
  key: string
  label: string
  score: number
  grade: string
  platform_avg: number
}

export interface ScorecardResponse {
  profile: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    archetype: string | null
    member_since: string
    clout: number
    reputation_score: number
    total_votes: number
    total_arguments: number
    vote_streak: number
    blue_vote_count: number
    red_vote_count: number
  }
  composite: number
  grade: string
  level: string
  level_description: string
  percentile: number
  dimensions: ScorecardDimension[]
  stats: {
    categories_engaged: number
    top_category: string | null
    prediction_accuracy: number | null
    avg_ai_score: number | null
    total_upvotes: number
    account_age_days: number
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v))
}

function toGrade(score: number): string {
  if (score >= 90) return 'A+'
  if (score >= 85) return 'A'
  if (score >= 80) return 'A-'
  if (score >= 75) return 'B+'
  if (score >= 70) return 'B'
  if (score >= 65) return 'B-'
  if (score >= 60) return 'C+'
  if (score >= 55) return 'C'
  if (score >= 50) return 'C-'
  if (score >= 40) return 'D'
  return 'F'
}

function civicLevel(score: number): { level: string; description: string } {
  if (score >= 90) return { level: 'Civic Elder', description: 'A pillar of the platform — participation shapes policy.' }
  if (score >= 80) return { level: 'Policy Architect', description: 'A deep, consistent contributor across all civic dimensions.' }
  if (score >= 70) return { level: 'Civic Champion', description: 'Highly engaged — arguments and votes carry real weight.' }
  if (score >= 60) return { level: 'Active Citizen', description: 'Consistently present, making their voice heard across issues.' }
  if (score >= 50) return { level: 'Engaged Voter', description: 'A steady participant with room to deepen engagement.' }
  if (score >= 35) return { level: 'Civic Apprentice', description: 'Building a civic foundation — showing up consistently.' }
  return { level: 'New Citizen', description: 'Just getting started on the civic journey.' }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { username: string } },
) {
  const supabase = await createClient()

  // 1. Fetch the target profile by username
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, role, archetype, created_at, clout, reputation_score, total_votes, total_arguments, vote_streak, blue_vote_count, red_vote_count'
    )
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const accountAgeDays = Math.max(
    1,
    (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24),
  )

  // 2. Fetch argument stats
  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select('upvotes, ai_score')
    .eq('author_id', profile.id)
    .limit(500)

  const args = argsRaw ?? []
  const totalUpvotes = args.reduce((s, a) => s + (a.upvotes ?? 0), 0)
  const scoredArgs = args.filter((a) => a.ai_score !== null)
  const avgAiScore = scoredArgs.length > 0
    ? scoredArgs.reduce((s, a) => s + (a.ai_score ?? 0), 0) / scoredArgs.length
    : null

  // 3. Vote breadth — categories engaged + top category
  const { data: votesRaw } = await supabase
    .from('votes')
    .select('topic_id')
    .eq('user_id', profile.id)
    .limit(2000)

  const topicIds = Array.from(new Set((votesRaw ?? []).map((v) => v.topic_id)))
  const topicsEngaged = topicIds.length

  let categoriesEngaged = 0
  let topCategory: string | null = null

  if (topicIds.length > 0) {
    const { data: topicsData } = await supabase
      .from('topics')
      .select('category')
      .in('id', topicIds.slice(0, 500))

    const catCounts: Record<string, number> = {}
    for (const t of topicsData ?? []) {
      if (t.category) catCounts[t.category] = (catCounts[t.category] ?? 0) + 1
    }
    categoriesEngaged = Object.keys(catCounts).length
    topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  }

  // 4. Prediction accuracy
  const { data: predsRaw } = await supabase
    .from('topic_predictions')
    .select('correct')
    .eq('user_id', profile.id)
    .not('correct', 'is', null)
    .limit(200)

  const preds = predsRaw ?? []
  const predictionAccuracy = preds.length >= 3
    ? preds.filter((p) => p.correct).length / preds.length
    : null

  // 5. Vote calibration
  let winningVotePct: number | null = null
  if (topicIds.length >= 5) {
    const { data: resolvedTopics } = await supabase
      .from('topics')
      .select('id, blue_pct')
      .in('id', topicIds.slice(0, 300))
      .in('status', ['law', 'failed'])

    if (resolvedTopics && resolvedTopics.length >= 5) {
      const blueWins = new Set(resolvedTopics.filter((t) => t.blue_pct >= 50).map((t) => t.id))
      const resolvedIds = resolvedTopics.map((t) => t.id)

      const { data: calibVotes } = await supabase
        .from('votes')
        .select('topic_id, side')
        .eq('user_id', profile.id)
        .in('topic_id', resolvedIds)

      const cv = calibVotes ?? []
      if (cv.length >= 5) {
        const correct = cv.filter((v) =>
          (v.side === 'blue' && blueWins.has(v.topic_id)) ||
          (v.side === 'red' && !blueWins.has(v.topic_id))
        ).length
        winningVotePct = correct / cv.length
      }
    }
  }

  // 6. Compute dimension scores
  const PLATFORM_AVGS = { participation: 42, argumentation: 35, breadth: 38, accuracy: 55, reputation: 30 }

  // Participation
  const volRaw = Math.min(100, (Math.log10(Math.max(1, profile.total_votes)) / Math.log10(500)) * 85)
  const maxAge = Math.max(1, Math.min(accountAgeDays, 365))
  const conRaw = Math.min(100, (profile.vote_streak / maxAge) * 100 * 3)
  const participationScore = clamp(Math.round(volRaw * 0.6 + conRaw * 0.4))

  // Argumentation
  let argumentationScore = 0
  if (profile.total_arguments > 0) {
    const qualRaw = avgAiScore !== null ? clamp(avgAiScore * 10) : 50
    const argVolRaw = Math.min(100, (Math.log10(Math.max(1, profile.total_arguments)) / Math.log10(50)) * 85)
    const upvoteAvg = profile.total_arguments > 0 ? totalUpvotes / profile.total_arguments : 0
    const upvoteRaw = Math.min(100, (upvoteAvg / 10) * 100)
    argumentationScore = clamp(Math.round(qualRaw * 0.5 + argVolRaw * 0.3 + upvoteRaw * 0.2))
  }

  // Breadth
  const catRaw = Math.min(100, (categoriesEngaged / 10) * 100)
  const topicRaw = Math.min(100, (Math.log10(Math.max(1, topicsEngaged)) / Math.log10(200)) * 100)
  const breadthScore = clamp(Math.round(catRaw * 0.6 + topicRaw * 0.4))

  // Accuracy
  const accParts: number[] = []
  if (predictionAccuracy !== null) accParts.push(clamp(((predictionAccuracy - 0.5) / 0.5) * 100))
  if (winningVotePct !== null) accParts.push(clamp(((winningVotePct - 0.4) / 0.6) * 100))
  const accuracyScore = accParts.length > 0
    ? clamp(Math.round(accParts.reduce((a, b) => a + b, 0) / accParts.length))
    : 0

  // Reputation
  const cloutRaw = Math.min(90, (Math.log10(Math.max(1, profile.clout)) / Math.log10(10000)) * 90)
  const repRaw = Math.min(100, profile.reputation_score)
  const roleBonus = profile.role === 'elder' ? 10 : profile.role === 'troll_catcher' ? 7 : profile.role === 'debator' ? 4 : 0
  const reputationScore = clamp(Math.round(cloutRaw * 0.4 + repRaw * 0.5 + roleBonus))

  const dimensions: ScorecardDimension[] = [
    { key: 'participation', label: 'Participation', score: participationScore, grade: toGrade(participationScore), platform_avg: PLATFORM_AVGS.participation },
    { key: 'argumentation', label: 'Argumentation', score: argumentationScore, grade: toGrade(argumentationScore), platform_avg: PLATFORM_AVGS.argumentation },
    { key: 'breadth',       label: 'Breadth',       score: breadthScore,       grade: toGrade(breadthScore),       platform_avg: PLATFORM_AVGS.breadth },
    { key: 'accuracy',      label: 'Accuracy',      score: accuracyScore,      grade: toGrade(accuracyScore),      platform_avg: PLATFORM_AVGS.accuracy },
    { key: 'reputation',    label: 'Reputation',    score: reputationScore,    grade: toGrade(reputationScore),    platform_avg: PLATFORM_AVGS.reputation },
  ]

  const composite = clamp(
    Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length)
  )

  const { level, description: level_description } = civicLevel(composite)
  const percentile = Math.min(99, Math.round(clamp((composite / 100) * 120 - 10)))

  return NextResponse.json({
    profile: {
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      archetype: profile.archetype ?? null,
      member_since: profile.created_at,
      clout: profile.clout,
      reputation_score: profile.reputation_score,
      total_votes: profile.total_votes,
      total_arguments: profile.total_arguments,
      vote_streak: profile.vote_streak,
      blue_vote_count: profile.blue_vote_count ?? 0,
      red_vote_count: profile.red_vote_count ?? 0,
    },
    composite,
    grade: toGrade(composite),
    level,
    level_description,
    percentile,
    dimensions,
    stats: {
      categories_engaged: categoriesEngaged,
      top_category: topCategory,
      prediction_accuracy: predictionAccuracy,
      avg_ai_score: avgAiScore,
      total_upvotes: totalUpvotes,
      account_age_days: Math.round(accountAgeDays),
    },
  } satisfies ScorecardResponse)
}
