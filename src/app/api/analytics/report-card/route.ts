import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type GradeLetter = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F'
export type GradePoints = 4.3 | 4.0 | 3.7 | 3.3 | 3.0 | 2.7 | 2.3 | 2.0 | 1.7 | 1.0 | 0.0

export interface ReportCardSubject {
  id: string
  label: string
  grade: GradeLetter
  points: GradePoints
  score: number
  maxScore: number
  description: string
  tip: string | null
}

export interface ReportCardData {
  subjects: ReportCardSubject[]
  gpa: number
  gpaLetter: GradeLetter
  username: string
  displayName: string | null
  role: string
  memberDays: number
  totalVotes: number
  totalArguments: number
  voteStreak: number
  reputation: number
}

// ─── Grade helpers ────────────────────────────────────────────────────────────

function toGrade(score: number): { letter: GradeLetter; points: GradePoints } {
  if (score >= 97) return { letter: 'A+', points: 4.3 }
  if (score >= 93) return { letter: 'A', points: 4.0 }
  if (score >= 90) return { letter: 'A-', points: 3.7 }
  if (score >= 87) return { letter: 'B+', points: 3.3 }
  if (score >= 83) return { letter: 'B', points: 3.0 }
  if (score >= 80) return { letter: 'B-', points: 2.7 }
  if (score >= 77) return { letter: 'C+', points: 2.3 }
  if (score >= 73) return { letter: 'C', points: 2.0 }
  if (score >= 70) return { letter: 'C-', points: 1.7 }
  if (score >= 60) return { letter: 'D', points: 1.0 }
  return { letter: 'F', points: 0.0 }
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1. Profile ─────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'username, display_name, role, total_votes, total_arguments, vote_streak, clout, reputation_score, created_at, category_preferences'
    )
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const memberDays = Math.max(
    1,
    Math.floor(
      (Date.now() - new Date(profile.created_at).getTime()) / 86_400_000
    )
  )

  // ── 2. Vote category diversity ─────────────────────────────────────────────
  const { data: votedTopics } = await supabase
    .from('votes')
    .select('topic_id')
    .eq('user_id', user.id)
    .limit(500)

  const votedTopicIds = Array.from(
    new Set((votedTopics ?? []).map((v) => v.topic_id))
  )

  let distinctCategories = 0
  if (votedTopicIds.length > 0) {
    const { data: topicsForCats } = await supabase
      .from('topics')
      .select('category')
      .in('id', votedTopicIds)
    const cats = new Set(
      (topicsForCats ?? [])
        .map((t) => t.category)
        .filter((c): c is string => !!c)
    )
    distinctCategories = cats.size
  }

  // ── 3. Predictions ──────────────────────────────────────────────────────────
  const { data: predictions } = await supabase
    .from('topic_predictions')
    .select('correct')
    .eq('user_id', user.id)
    .not('correct', 'is', null)

  const predTotal = predictions?.length ?? 0
  const predCorrect = (predictions ?? []).filter((p) => p.correct === true).length
  const predAccuracy = predTotal >= 3 ? (predCorrect / predTotal) * 100 : null

  // ── 4. Argument upvotes ─────────────────────────────────────────────────────
  const { data: argStats } = await supabase
    .from('topic_arguments')
    .select('upvotes')
    .eq('user_id', user.id)
    .limit(200)

  const argCount = argStats?.length ?? 0
  const totalUpvotes = (argStats ?? []).reduce((s, a) => s + (a.upvotes ?? 0), 0)
  const avgUpvotes = argCount > 0 ? totalUpvotes / argCount : 0

  // ── 5. Compute subject scores ──────────────────────────────────────────────

  // Participation: votes per day (0→F, 0.1→60, 0.3→70, 0.7→80, 1.5→90, 3+→100)
  const votesPerDay = profile.total_votes / memberDays
  const participationScore = Math.min(
    100,
    votesPerDay < 0.05 ? 20
    : votesPerDay < 0.15 ? 55
    : votesPerDay < 0.4  ? 68
    : votesPerDay < 0.8  ? 76
    : votesPerDay < 1.5  ? 83
    : votesPerDay < 2.5  ? 90
    : votesPerDay < 4    ? 95
    : 100
  )
  const participationTip =
    participationScore < 70
      ? 'Vote on at least 1 topic per day to boost this grade.'
      : participationScore < 90
      ? 'Try the Daily Challenge for extra voting credit.'
      : null

  // Prediction accuracy (null if < 3 predictions)
  const predScore =
    predAccuracy === null ? 50
    : predAccuracy >= 80 ? 100
    : predAccuracy >= 70 ? 90
    : predAccuracy >= 60 ? 80
    : predAccuracy >= 50 ? 70
    : predAccuracy >= 40 ? 55
    : 30
  const predTip =
    predTotal < 3
      ? 'Make at least 3 predictions on active topics to unlock this grade.'
      : predScore < 70
      ? 'Study the current vote percentages before predicting to improve accuracy.'
      : null

  // Debate Influence: avg upvotes + argument count
  const debateScore =
    argCount === 0 ? 5
    : avgUpvotes < 0.5  ? 55
    : avgUpvotes < 1.5  ? 65
    : avgUpvotes < 3    ? 75
    : avgUpvotes < 6    ? 85
    : avgUpvotes < 10   ? 93
    : 100
  const debateTip =
    argCount === 0
      ? 'Post your first argument on any topic to start building your influence score.'
      : debateScore < 70
      ? 'Add sources and evidence to your arguments to earn more upvotes.'
      : null

  // Category Breadth: distinct categories voted in
  const breadthScore =
    distinctCategories <= 0 ? 5
    : distinctCategories === 1 ? 50
    : distinctCategories === 2 ? 65
    : distinctCategories === 3 ? 75
    : distinctCategories === 4 ? 82
    : distinctCategories === 5 ? 88
    : distinctCategories === 6 ? 93
    : 100
  const breadthTip =
    breadthScore < 80
      ? `You've engaged with ${distinctCategories} categor${distinctCategories === 1 ? 'y' : 'ies'}. Explore more topics across different fields.`
      : null

  // Community Standing: reputation score
  const repScore = profile.reputation_score ?? 0
  const standingScore =
    repScore < 10 ? 30
    : repScore < 50 ? 55
    : repScore < 150 ? 65
    : repScore < 400 ? 75
    : repScore < 800 ? 85
    : repScore < 1500 ? 93
    : 100
  const standingTip =
    standingScore < 70
      ? 'Vote regularly and post quality arguments to build your reputation.'
      : null

  // Consistency: vote streak
  const streak = profile.vote_streak ?? 0
  const consistencyScore =
    streak === 0 ? 30
    : streak < 3  ? 50
    : streak < 7  ? 65
    : streak < 14 ? 78
    : streak < 30 ? 88
    : streak < 60 ? 95
    : 100
  const consistencyTip =
    consistencyScore < 70
      ? `Your current streak is ${streak} day${streak === 1 ? '' : 's'}. Vote daily to build consistency.`
      : null

  // ── 6. Build subjects ──────────────────────────────────────────────────────
  const subjectDefs: Array<{
    id: string
    label: string
    score: number
    maxScore: number
    description: string
    tip: string | null
  }> = [
    {
      id: 'participation',
      label: 'Civic Participation',
      score: participationScore,
      maxScore: 100,
      description: `${profile.total_votes.toLocaleString()} votes cast over ${memberDays} day${memberDays === 1 ? '' : 's'} (${votesPerDay.toFixed(1)}/day avg)`,
      tip: participationTip,
    },
    {
      id: 'predictions',
      label: 'Predictive Accuracy',
      score: predScore,
      maxScore: 100,
      description:
        predTotal < 3
          ? 'Not enough predictions yet — make at least 3 to earn a grade.'
          : `${predCorrect} correct out of ${predTotal} prediction${predTotal === 1 ? '' : 's'} (${predAccuracy!.toFixed(0)}% accuracy)`,
      tip: predTip,
    },
    {
      id: 'influence',
      label: 'Debate Influence',
      score: debateScore,
      maxScore: 100,
      description:
        argCount === 0
          ? 'No arguments posted yet.'
          : `${argCount} argument${argCount === 1 ? '' : 's'} · ${totalUpvotes} total upvote${totalUpvotes === 1 ? '' : 's'} (${avgUpvotes.toFixed(1)} avg)`,
      tip: debateTip,
    },
    {
      id: 'breadth',
      label: 'Category Breadth',
      score: breadthScore,
      maxScore: 100,
      description:
        distinctCategories === 0
          ? 'No category engagement recorded yet.'
          : `Engaged in ${distinctCategories} out of 10 civic categor${distinctCategories === 1 ? 'y' : 'ies'}`,
      tip: breadthTip,
    },
    {
      id: 'standing',
      label: 'Community Standing',
      score: standingScore,
      maxScore: 100,
      description: `${repScore.toLocaleString()} reputation · ${(profile.clout ?? 0).toLocaleString()} clout balance`,
      tip: standingTip,
    },
    {
      id: 'consistency',
      label: 'Consistency',
      score: consistencyScore,
      maxScore: 100,
      description:
        streak === 0
          ? 'No active streak. Vote today to start one.'
          : `${streak}-day streak · longest active run`,
      tip: consistencyTip,
    },
  ]

  const subjects: ReportCardSubject[] = subjectDefs.map((s) => {
    const g = toGrade(s.score)
    return { ...s, grade: g.letter, points: g.points }
  })

  // ── 7. GPA ─────────────────────────────────────────────────────────────────
  const gpa =
    Math.round(
      (subjects.reduce((sum, s) => sum + s.points, 0) / subjects.length) * 100
    ) / 100

  const gpaScore = (gpa / 4.3) * 100
  const gpaGrade = toGrade(gpaScore).letter

  const data: ReportCardData = {
    subjects,
    gpa,
    gpaLetter: gpaGrade,
    username: profile.username,
    displayName: profile.display_name,
    role: profile.role,
    memberDays,
    totalVotes: profile.total_votes,
    totalArguments: profile.total_arguments,
    voteStreak: profile.vote_streak ?? 0,
    reputation: profile.reputation_score ?? 0,
  }

  return NextResponse.json(data)
}
