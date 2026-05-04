import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KarmaDimension {
  id: string
  label: string
  description: string
  score: number
  maxScore: number
  pct: number
  tip: string | null
  detail: string
}

export type KarmaTier =
  | 'Newcomer'
  | 'Observer'
  | 'Participant'
  | 'Contributor'
  | 'Advocate'
  | 'Elder'
  | 'Civic Champion'

export interface KarmaData {
  totalScore: number
  maxScore: number
  percentile: number
  tier: KarmaTier
  tierColor: string
  dimensions: KarmaDimension[]
  profile: {
    username: string
    displayName: string | null
    role: string
    totalVotes: number
    totalArguments: number
    voteStreak: number
    clout: number
    reputation: number
    followers: number
    memberDays: number
  }
  recentBoosts: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function tier(score: number): { tier: KarmaTier; color: string } {
  if (score >= 96) return { tier: 'Civic Champion', color: 'text-gold' }
  if (score >= 86) return { tier: 'Elder', color: 'text-purple' }
  if (score >= 71) return { tier: 'Advocate', color: 'text-for-400' }
  if (score >= 56) return { tier: 'Contributor', color: 'text-emerald' }
  if (score >= 41) return { tier: 'Participant', color: 'text-for-300' }
  if (score >= 21) return { tier: 'Observer', color: 'text-surface-500' }
  return { tier: 'Newcomer', color: 'text-surface-400' }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parallel data fetches ──────────────────────────────────────────────────

  const [profileRes, argsRes, predictionsRes, repliesRes, votedCategoriesRes] =
    await Promise.all([
      supabase
        .from('profiles')
        .select(
          'username, display_name, role, total_votes, total_arguments, vote_streak, clout, reputation_score, followers_count, created_at',
        )
        .eq('id', user.id)
        .single(),

      supabase
        .from('topic_arguments')
        .select('id, upvotes, created_at')
        .eq('user_id', user.id),

      supabase
        .from('topic_predictions')
        .select('correct, confidence, brier_score')
        .eq('user_id', user.id)
        .not('correct', 'is', null),

      supabase
        .from('argument_replies')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),

      // Get categories of topics the user has argued in
      supabase
        .from('topic_arguments')
        .select('topics!inner(category)')
        .eq('user_id', user.id),
    ])

  if (!profileRes.data) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const profile = profileRes.data
  const args = argsRes.data ?? []
  const predictions = predictionsRes.data ?? []
  const repliesCount = repliesRes.count ?? 0

  // Extract unique categories from arguments
  const categorySet = new Set<string>()
  if (votedCategoriesRes.data) {
    for (const row of votedCategoriesRes.data) {
      const cat = (row.topics as { category: string | null } | null)?.category
      if (cat) categorySet.add(cat)
    }
  }
  const uniqueCategories = categorySet.size

  // Member age in days
  const memberDays = Math.max(
    1,
    Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86_400_000),
  )

  // ── Dimension 1: Discourse Quality (0-30) ─────────────────────────────────
  // Points from argument count + avg upvotes
  const argCount = args.length
  const totalUpvotes = args.reduce((s, a) => s + (a.upvotes ?? 0), 0)
  const avgUpvotes = argCount > 0 ? totalUpvotes / argCount : 0

  const argCountScore = clamp(Math.round((argCount / 20) * 15), 0, 15) // 20 args = full 15
  const avgUpvoteScore = clamp(Math.round((avgUpvotes / 5) * 15), 0, 15) // avg 5 upvotes = full 15
  const discourseScore = argCountScore + avgUpvoteScore

  // ── Dimension 2: Predictive Accuracy (0-20) ────────────────────────────────
  const resolvedCount = predictions.length
  const correctCount = predictions.filter((p) => p.correct === true).length
  const winRate = resolvedCount > 0 ? correctCount / resolvedCount : 0
  const predVolumeScore = clamp(Math.round((resolvedCount / 10) * 10), 0, 10) // 10 preds = 10 pts
  const predAccuracyScore = clamp(Math.round(winRate * 10), 0, 10)
  const predictScore = predVolumeScore + predAccuracyScore

  // ── Dimension 3: Civic Breadth (0-20) ─────────────────────────────────────
  // 10 categories max × 2 pts each
  const breadthScore = clamp(uniqueCategories * 2, 0, 20)

  // ── Dimension 4: Engagement Depth (0-15) ──────────────────────────────────
  const replyScore = clamp(Math.round((repliesCount / 10) * 7), 0, 7) // 10 replies = full 7
  const streakScore = clamp(Math.round((profile.vote_streak / 14) * 8), 0, 8) // 14-day streak = full 8
  const engagementScore = replyScore + streakScore

  // ── Dimension 5: Community Trust (0-15) ───────────────────────────────────
  // Follower score + normalised reputation per vote
  const followerScore = clamp(Math.round((profile.followers_count / 25) * 8), 0, 8)
  const repPerVote =
    profile.total_votes > 0 ? profile.reputation_score / profile.total_votes : 0
  const repScore = clamp(Math.round(repPerVote * 35), 0, 7) // ~0.2 rep/vote = full 7
  const trustScore = followerScore + repScore

  const totalScore = discourseScore + predictScore + breadthScore + engagementScore + trustScore
  const { tier: tierLabel, color: tierColor } = tier(totalScore)

  // ── Build dimension objects ────────────────────────────────────────────────
  const dimensions: KarmaDimension[] = [
    {
      id: 'discourse',
      label: 'Discourse Quality',
      description: 'How well you argue — argument volume and community upvotes.',
      score: discourseScore,
      maxScore: 30,
      pct: Math.round((discourseScore / 30) * 100),
      tip:
        discourseScore < 20
          ? 'Write more arguments and focus on quality to earn upvotes.'
          : null,
      detail: `${argCount} argument${argCount !== 1 ? 's' : ''} · avg ${avgUpvotes.toFixed(1)} upvotes`,
    },
    {
      id: 'predictions',
      label: 'Predictive Accuracy',
      description: 'Your track record forecasting which topics become law.',
      score: predictScore,
      maxScore: 20,
      pct: Math.round((predictScore / 20) * 100),
      tip:
        resolvedCount < 5
          ? 'Make more predictions on active topics to build your forecast record.'
          : null,
      detail:
        resolvedCount > 0
          ? `${correctCount}/${resolvedCount} correct (${Math.round(winRate * 100)}%)`
          : 'No resolved predictions yet',
    },
    {
      id: 'breadth',
      label: 'Civic Breadth',
      description: 'Range of debate categories you actively engage with.',
      score: breadthScore,
      maxScore: 20,
      pct: Math.round((breadthScore / 20) * 100),
      tip:
        uniqueCategories < 5
          ? `Explore ${5 - uniqueCategories} more categor${uniqueCategories === 4 ? 'y' : 'ies'} to reach Breadth milestone.`
          : null,
      detail: `${uniqueCategories} of 10 categor${uniqueCategories === 1 ? 'y' : 'ies'} covered`,
    },
    {
      id: 'engagement',
      label: 'Engagement Depth',
      description: 'Quality of your participation — replies and voting consistency.',
      score: engagementScore,
      maxScore: 15,
      pct: Math.round((engagementScore / 15) * 100),
      tip:
        engagementScore < 10
          ? 'Reply to arguments and maintain a daily vote streak to boost engagement.'
          : null,
      detail: `${repliesCount} repl${repliesCount !== 1 ? 'ies' : 'y'} · ${profile.vote_streak}-day streak`,
    },
    {
      id: 'trust',
      label: 'Community Trust',
      description: 'Your standing in the community — followers and earned reputation.',
      score: trustScore,
      maxScore: 15,
      pct: Math.round((trustScore / 15) * 100),
      tip:
        trustScore < 10
          ? 'Build followers by writing quality arguments and engaging consistently.'
          : null,
      detail: `${profile.followers_count} follower${profile.followers_count !== 1 ? 's' : ''} · ${profile.reputation_score} rep`,
    },
  ]

  // ── Recent boosts (narrative events) ──────────────────────────────────────
  const boosts: string[] = []
  if (argCount >= 5) boosts.push('Active arguer — 5+ arguments on record')
  if (avgUpvotes >= 3) boosts.push('Quality discourse — strong argument upvote ratio')
  if (profile.vote_streak >= 7) boosts.push('7-day vote streak maintained')
  if (resolvedCount >= 5 && winRate >= 0.6) boosts.push('Above-average prediction accuracy')
  if (uniqueCategories >= 5) boosts.push('Multi-category civic engagement')
  if (profile.followers_count >= 10) boosts.push('Growing community trust')

  const result: KarmaData = {
    totalScore,
    maxScore: 100,
    percentile: clamp(totalScore, 0, 100),
    tier: tierLabel,
    tierColor,
    dimensions,
    profile: {
      username: profile.username,
      displayName: profile.display_name,
      role: profile.role,
      totalVotes: profile.total_votes,
      totalArguments: profile.total_arguments,
      voteStreak: profile.vote_streak,
      clout: profile.clout,
      reputation: profile.reputation_score,
      followers: profile.followers_count,
      memberDays,
    },
    recentBoosts: boosts,
  }

  return NextResponse.json(result)
}
