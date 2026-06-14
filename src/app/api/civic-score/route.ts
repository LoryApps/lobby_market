import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoreDimension {
  key: string
  label: string
  score: number      // 0–100
  grade: string      // A–F
  description: string
  breakdown: string  // one-liner explaining the score
  platform_avg: number
}

export interface CivicScoreResponse {
  composite: number
  grade: string
  percentile: number | null
  dimensions: ScoreDimension[]
  stats: {
    total_votes: number
    vote_streak: number
    total_arguments: number
    avg_ai_score: number | null
    categories_engaged: number
    prediction_accuracy: number | null
    clout: number
    reputation_score: number
    account_age_days: number
    member_since: string
  }
  level: string
  level_description: string
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
  if (score >= 90) return { level: 'Civic Elder', description: 'A pillar of the platform — your participation shapes policy.' }
  if (score >= 80) return { level: 'Policy Architect', description: 'A deep, consistent contributor across all civic dimensions.' }
  if (score >= 70) return { level: 'Civic Champion', description: 'Highly engaged — your arguments and votes carry real weight.' }
  if (score >= 60) return { level: 'Active Citizen', description: 'Consistently present, making your voice heard across issues.' }
  if (score >= 50) return { level: 'Engaged Voter', description: 'A steady participant with room to deepen your engagement.' }
  if (score >= 35) return { level: 'Civic Apprentice', description: 'Building your civic foundation — keep showing up.' }
  return { level: 'New Citizen', description: 'Just getting started. Cast your first votes to unlock your score.' }
}

// ─── Score computations ───────────────────────────────────────────────────────

// 1. Participation: vote volume + consistency (streak ratio vs age)
function participationScore(
  totalVotes: number,
  streak: number,
  accountAgeDays: number,
): { score: number; breakdown: string } {
  // Volume sub-score: log scale, 500 votes = ~85
  const volumeRaw = Math.min(100, (Math.log10(Math.max(1, totalVotes)) / Math.log10(500)) * 85)

  // Consistency sub-score: streak / age, capped at 1 year
  const maxAge = Math.max(1, Math.min(accountAgeDays, 365))
  const consistencyRaw = Math.min(100, (streak / maxAge) * 100 * 3)

  const score = clamp(Math.round(volumeRaw * 0.6 + consistencyRaw * 0.4))
  const breakdown = `${totalVotes} votes cast · ${streak}-day streak · account ${Math.round(accountAgeDays)}d old`
  return { score, breakdown }
}

// 2. Argumentation: avg AI score + upvote density
function argumentationScore(
  totalArguments: number,
  avgAiScore: number | null,
  totalUpvotes: number,
): { score: number; breakdown: string } {
  if (totalArguments === 0) {
    return { score: 0, breakdown: 'No arguments submitted yet' }
  }

  // AI quality sub-score (0–10 → 0–100)
  const qualityRaw = avgAiScore !== null ? clamp(avgAiScore * 10) : 50

  // Volume sub-score: log scale, 50 args = ~85
  const volumeRaw = Math.min(100, (Math.log10(Math.max(1, totalArguments)) / Math.log10(50)) * 85)

  // Upvote density (upvotes per argument, 10+ avg = full score)
  const upvoteAvg = totalArguments > 0 ? totalUpvotes / totalArguments : 0
  const upvoteRaw = Math.min(100, (upvoteAvg / 10) * 100)

  const score = clamp(Math.round(qualityRaw * 0.5 + volumeRaw * 0.3 + upvoteRaw * 0.2))
  const breakdown = `${totalArguments} arguments · avg AI score ${avgAiScore?.toFixed(1) ?? 'N/A'}/10 · ${totalUpvotes} total upvotes`
  return { score, breakdown }
}

// 3. Breadth: distinct categories + topics engaged
function breadthScore(
  categoriesEngaged: number,
  topicsEngaged: number,
): { score: number; breakdown: string } {
  const totalCategories = 10 // Economics, Politics, Technology, etc.
  const catRaw = Math.min(100, (categoriesEngaged / totalCategories) * 100)
  const topicRaw = Math.min(100, (Math.log10(Math.max(1, topicsEngaged)) / Math.log10(200)) * 100)
  const score = clamp(Math.round(catRaw * 0.6 + topicRaw * 0.4))
  const breakdown = `${categoriesEngaged}/${totalCategories} categories · ${topicsEngaged} distinct topics`
  return { score, breakdown }
}

// 4. Accuracy: prediction hit rate + vote calibration (winning side pct)
function accuracyScore(
  predictionAccuracy: number | null,
  winningVotePct: number | null,
): { score: number; breakdown: string } {
  const parts: number[] = []
  const desc: string[] = []

  if (predictionAccuracy !== null) {
    // 50% base rate; 80%+ accuracy = near 100
    const predRaw = clamp(((predictionAccuracy - 0.5) / 0.5) * 100)
    parts.push(predRaw)
    desc.push(`${Math.round(predictionAccuracy * 100)}% prediction accuracy`)
  }

  if (winningVotePct !== null) {
    // How often did the user vote on the winning side? 50% base = random
    const voteRaw = clamp(((winningVotePct - 0.4) / 0.6) * 100)
    parts.push(voteRaw)
    desc.push(`${Math.round(winningVotePct * 100)}% voted with winning side`)
  }

  if (parts.length === 0) {
    return { score: 0, breakdown: 'No resolved predictions or votes yet' }
  }

  const score = clamp(Math.round(parts.reduce((a, b) => a + b, 0) / parts.length))
  return { score, breakdown: desc.join(' · ') }
}

// 5. Reputation: clout + reputation_score + role
function reputationScore(
  clout: number,
  reputationScore: number,
  role: string,
): { score: number; breakdown: string } {
  // Clout: log scale, 10000 clout = 90
  const cloutRaw = Math.min(90, (Math.log10(Math.max(1, clout)) / Math.log10(10000)) * 90)

  // Reputation score: already 0–100 range (assume so)
  const repRaw = Math.min(100, reputationScore)

  // Role bonus
  const roleBonus = role === 'elder' ? 10 : role === 'troll_catcher' ? 7 : role === 'debator' ? 4 : 0

  const score = clamp(Math.round(cloutRaw * 0.4 + repRaw * 0.5 + roleBonus))
  const breakdown = `${clout.toLocaleString()} clout · rep score ${Math.round(reputationScore)} · role: ${role}`
  return { score, breakdown }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1. Fetch profile ──────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('total_votes, vote_streak, clout, reputation_score, total_arguments, blue_vote_count, red_vote_count, role, created_at')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const accountAgeDays = Math.max(
    1,
    (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24),
  )

  // ── 2. Fetch arguments ────────────────────────────────────────────────────
  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select('upvotes, ai_score')
    .eq('author_id', user.id)
    .limit(500)

  const args = argsRaw ?? []
  const totalUpvotes = args.reduce((s, a) => s + (a.upvotes ?? 0), 0)
  const scoredArgs = args.filter((a) => a.ai_score !== null)
  const avgAiScore = scoredArgs.length > 0
    ? scoredArgs.reduce((s, a) => s + (a.ai_score ?? 0), 0) / scoredArgs.length
    : null

  // ── 3. Fetch vote category breadth ────────────────────────────────────────
  const { data: votesRaw } = await supabase
    .from('votes')
    .select('topic_id')
    .eq('user_id', user.id)
    .limit(2000)

  const topicIds = Array.from(new Set((votesRaw ?? []).map((v) => v.topic_id)))
  const topicsEngaged = topicIds.length

  let categoriesEngaged = 0
  if (topicIds.length > 0) {
    const { data: topicsData } = await supabase
      .from('topics')
      .select('category')
      .in('id', topicIds.slice(0, 500))

    const cats = new Set((topicsData ?? []).map((t) => t.category).filter(Boolean))
    categoriesEngaged = cats.size
  }

  // ── 4. Fetch prediction accuracy ─────────────────────────────────────────
  const { data: predsRaw } = await supabase
    .from('topic_predictions')
    .select('correct')
    .eq('user_id', user.id)
    .not('correct', 'is', null)
    .limit(200)

  const preds = predsRaw ?? []
  const predictionAccuracy = preds.length >= 3
    ? preds.filter((p) => p.correct).length / preds.length
    : null

  // ── 5. Vote calibration (how often did they vote on the winning side?) ────
  // "Winning side" = side that had > 50% on resolved topics
  let winningVotePct: number | null = null
  if (topicIds.length >= 5) {
    const { data: resolvedTopics } = await supabase
      .from('topics')
      .select('id, blue_pct, status')
      .in('id', topicIds.slice(0, 300))
      .in('status', ['law', 'failed'])

    if (resolvedTopics && resolvedTopics.length >= 5) {
      const resolvedIds = resolvedTopics.map((t) => t.id)
      const blueWins = new Set(
        resolvedTopics.filter((t) => t.blue_pct >= 50).map((t) => t.id)
      )

      const { data: calibrationVotes } = await supabase
        .from('votes')
        .select('topic_id, side')
        .eq('user_id', user.id)
        .in('topic_id', resolvedIds)

      const calibVotes = calibrationVotes ?? []
      if (calibVotes.length >= 5) {
        const correctCount = calibVotes.filter((v) =>
          (v.side === 'blue' && blueWins.has(v.topic_id)) ||
          (v.side === 'red' && !blueWins.has(v.topic_id))
        ).length
        winningVotePct = correctCount / calibVotes.length
      }
    }
  }

  // ── 6. Platform average stats (rough benchmarks) ─────────────────────────
  // We use sensible platform-wide averages rather than a full scan
  const PLATFORM_AVGS = {
    participation: 42,
    argumentation: 35,
    breadth: 38,
    accuracy: 55,
    reputation: 30,
  }

  // ── 7. Compute dimension scores ───────────────────────────────────────────
  const participation = participationScore(profile.total_votes, profile.vote_streak, accountAgeDays)
  const argumentation = argumentationScore(profile.total_arguments, avgAiScore, totalUpvotes)
  const breadth = breadthScore(categoriesEngaged, topicsEngaged)
  const accuracy = accuracyScore(predictionAccuracy, winningVotePct)
  const reputation = reputationScore(profile.clout, profile.reputation_score, profile.role)

  const dimensions: ScoreDimension[] = [
    {
      key: 'participation',
      label: 'Participation',
      score: participation.score,
      grade: toGrade(participation.score),
      description: 'Vote volume and consistency',
      breakdown: participation.breakdown,
      platform_avg: PLATFORM_AVGS.participation,
    },
    {
      key: 'argumentation',
      label: 'Argumentation',
      score: argumentation.score,
      grade: toGrade(argumentation.score),
      description: 'Argument quality and engagement',
      breakdown: argumentation.breakdown,
      platform_avg: PLATFORM_AVGS.argumentation,
    },
    {
      key: 'breadth',
      label: 'Breadth',
      score: breadth.score,
      grade: toGrade(breadth.score),
      description: 'Coverage across categories and topics',
      breakdown: breadth.breakdown,
      platform_avg: PLATFORM_AVGS.breadth,
    },
    {
      key: 'accuracy',
      label: 'Accuracy',
      score: accuracy.score,
      grade: toGrade(accuracy.score),
      description: 'Prediction and vote calibration',
      breakdown: accuracy.breakdown,
      platform_avg: PLATFORM_AVGS.accuracy,
    },
    {
      key: 'reputation',
      label: 'Reputation',
      score: reputation.score,
      grade: toGrade(reputation.score),
      description: 'Clout, reputation, and platform standing',
      breakdown: reputation.breakdown,
      platform_avg: PLATFORM_AVGS.reputation,
    },
  ]

  const composite = clamp(
    Math.round(
      dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length
    )
  )

  const { level, description: levelDescription } = civicLevel(composite)

  // Rough percentile (linear approximation: platform avg composite ~40)
  const percentile = Math.min(99, Math.round(clamp((composite / 100) * 120 - 10)))

  return NextResponse.json({
    composite,
    grade: toGrade(composite),
    percentile,
    dimensions,
    stats: {
      total_votes: profile.total_votes,
      vote_streak: profile.vote_streak,
      total_arguments: profile.total_arguments,
      avg_ai_score: avgAiScore,
      categories_engaged: categoriesEngaged,
      prediction_accuracy: predictionAccuracy,
      clout: profile.clout,
      reputation_score: profile.reputation_score,
      account_age_days: Math.round(accountAgeDays),
      member_since: profile.created_at,
    },
    level,
    level_description: levelDescription,
  } satisfies CivicScoreResponse)
}
