import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryStat {
  category: string
  color: string
  voteCount: number
  forCount: number
  againstCount: number
  forPct: number
  resolvedCount: number
  accurateCount: number
  accuracyPct: number | null
}

export interface MonthlyActivity {
  month: string       // "Jan 2025"
  monthKey: string    // "2025-01"
  voteCount: number
  forCount: number
  againstCount: number
}

export interface ResolvedVotedTopic {
  topicId: string
  statement: string
  category: string | null
  status: 'law' | 'failed'
  userSide: 'blue' | 'red'
  correct: boolean
  bluePct: number
  totalVotes: number
  votedAt: string
}

export interface ArgumentedTopic {
  topicId: string
  statement: string
  category: string | null
  status: string
  argCount: number
  totalUpvotes: number
  bestGrade: string | null
}

export interface TopicsAnalyticsResponse {
  totalVoted: number
  uniqueTopics: number
  forCount: number
  againstCount: number
  forPct: number
  resolvedCount: number
  accurateCount: number
  accuracyPct: number | null
  categoryStats: CategoryStat[]
  monthlyActivity: MonthlyActivity[]
  recentResolved: ResolvedVotedTopic[]
  topArgumentedTopics: ArgumentedTopic[]
  streakData: {
    longestAccurateStreak: number
    currentAccurateStreak: number
  }
}

// ─── Category colours matching Tailwind theme ─────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics:    '#c9a84c',
  Politics:     '#3b82f6',
  Technology:   '#8b5cf6',
  Science:      '#10b981',
  Ethics:       '#ef4444',
  Philosophy:   '#a78bfa',
  Culture:      '#f59e0b',
  Health:       '#ec4899',
  Environment:  '#22c55e',
  Education:    '#06b6d4',
}
const DEFAULT_COLOR = '#6b7280'

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1. Fetch all votes ────────────────────────────────────────────────────
  const { data: votesRaw } = await supabase
    .from('votes')
    .select('id, side, created_at, topic_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(2000)

  const votes = votesRaw ?? []

  // ── 2. Fetch topic details for all voted topics ───────────────────────────
  const votedTopicIds = Array.from(new Set(votes.map((v) => v.topic_id)))

  type TopicRow = {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    created_at: string
  }

  const topicMap = new Map<string, TopicRow>()

  if (votedTopicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, created_at')
      .in('id', votedTopicIds)

    for (const t of topics ?? []) {
      topicMap.set(t.id, t as TopicRow)
    }
  }

  // ── 3. Fetch user's arguments on these topics ─────────────────────────────
  type ArgRow = {
    topic_id: string
    upvotes: number
    ai_grade: string | null
  }

  let argRows: ArgRow[] = []
  if (votedTopicIds.length > 0) {
    const { data: args } = await supabase
      .from('topic_arguments')
      .select('topic_id, upvotes, ai_grade')
      .eq('user_id', user.id)
      .in('topic_id', votedTopicIds)

    argRows = (args ?? []) as ArgRow[]
  }

  // ── 4. Compute aggregate stats ────────────────────────────────────────────

  let forCount = 0
  let againstCount = 0
  let resolvedCount = 0
  let accurateCount = 0

  const categoryMap = new Map<string, {
    voteCount: number; forCount: number; againstCount: number
    resolvedCount: number; accurateCount: number
  }>()

  const monthMap = new Map<string, { voteCount: number; forCount: number; againstCount: number }>()

  const recentResolved: ResolvedVotedTopic[] = []

  for (const vote of votes) {
    const topic = topicMap.get(vote.topic_id)
    if (!vote.side) continue

    const isFor = vote.side === 'blue'
    if (isFor) forCount++; else againstCount++

    // Category accumulation
    const cat = topic?.category ?? 'Unknown'
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, { voteCount: 0, forCount: 0, againstCount: 0, resolvedCount: 0, accurateCount: 0 })
    }
    const cs = categoryMap.get(cat)!
    cs.voteCount++
    if (isFor) cs.forCount++; else cs.againstCount++

    // Monthly accumulation
    const d = new Date(vote.created_at)
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { voteCount: 0, forCount: 0, againstCount: 0 })
    }
    const ms = monthMap.get(monthKey)!
    ms.voteCount++
    if (isFor) ms.forCount++; else ms.againstCount++

    // Accuracy for resolved topics
    if (topic && (topic.status === 'law' || topic.status === 'failed')) {
      resolvedCount++
      cs.resolvedCount++
      const correct = (topic.status === 'law' && isFor) || (topic.status === 'failed' && !isFor)
      if (correct) { accurateCount++; cs.accurateCount++ }

      // Collect recent resolved (max 20)
      if (recentResolved.length < 20) {
        recentResolved.push({
          topicId: vote.topic_id,
          statement: topic.statement,
          category: topic.category,
          status: topic.status as 'law' | 'failed',
          userSide: vote.side as 'blue' | 'red',
          correct,
          bluePct: topic.blue_pct,
          totalVotes: topic.total_votes,
          votedAt: vote.created_at,
        })
      }
    }
  }

  // ── 5. Streak calculation (ordered chronologically) ───────────────────────
  const resolvedChron = [...votes]
    .reverse()
    .filter((v) => {
      const t = topicMap.get(v.topic_id)
      return t && (t.status === 'law' || t.status === 'failed')
    })

  let longestAccurateStreak = 0
  let currentAccurateStreak = 0
  let runningStreak = 0
  for (const vote of resolvedChron) {
    const topic = topicMap.get(vote.topic_id)!
    const isFor = vote.side === 'blue'
    const correct = (topic.status === 'law' && isFor) || (topic.status === 'failed' && !isFor)
    if (correct) {
      runningStreak++
      if (runningStreak > longestAccurateStreak) longestAccurateStreak = runningStreak
    } else {
      runningStreak = 0
    }
  }
  // Current streak: from latest vote backwards
  for (let i = 0; i < resolvedChron.length; i++) {
    const vote = resolvedChron[resolvedChron.length - 1 - i]
    const topic = topicMap.get(vote.topic_id)!
    const isFor = vote.side === 'blue'
    const correct = (topic.status === 'law' && isFor) || (topic.status === 'failed' && !isFor)
    if (correct) currentAccurateStreak++
    else break
  }

  // ── 6. Category stats ─────────────────────────────────────────────────────
  const categoryStats: CategoryStat[] = Array.from(categoryMap.entries())
    .sort((a, b) => b[1].voteCount - a[1].voteCount)
    .map(([cat, s]) => ({
      category: cat,
      color: CATEGORY_COLOR[cat] ?? DEFAULT_COLOR,
      voteCount: s.voteCount,
      forCount: s.forCount,
      againstCount: s.againstCount,
      forPct: s.voteCount > 0 ? Math.round((s.forCount / s.voteCount) * 100) : 50,
      resolvedCount: s.resolvedCount,
      accurateCount: s.accurateCount,
      accuracyPct: s.resolvedCount > 0
        ? Math.round((s.accurateCount / s.resolvedCount) * 100)
        : null,
    }))

  // ── 7. Monthly activity (last 12 months) ──────────────────────────────────
  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthlyActivity: MonthlyActivity[] = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([key, s]) => {
      const [y, m] = key.split('-')
      const label = `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y}`
      return { month: label, monthKey: key, ...s }
    })

  // ── 8. Top argumented topics ──────────────────────────────────────────────
  const argByTopic = new Map<string, { count: number; upvotes: number; bestGrade: string | null }>()
  for (const arg of argRows) {
    const existing = argByTopic.get(arg.topic_id)
    const gradeRank = (g: string | null) => {
      if (!g) return 0
      return { A: 6, 'A-': 5, 'B+': 4, B: 3, 'B-': 2, 'C+': 1 }[g] ?? 0
    }
    if (!existing) {
      argByTopic.set(arg.topic_id, { count: 1, upvotes: arg.upvotes, bestGrade: arg.ai_grade })
    } else {
      existing.count++
      existing.upvotes += arg.upvotes
      if (gradeRank(arg.ai_grade) > gradeRank(existing.bestGrade)) {
        existing.bestGrade = arg.ai_grade
      }
    }
  }

  const topArgumentedTopics: ArgumentedTopic[] = Array.from(argByTopic.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([topicId, s]) => {
      const topic = topicMap.get(topicId)
      return {
        topicId,
        statement: topic?.statement ?? 'Unknown topic',
        category: topic?.category ?? null,
        status: topic?.status ?? 'active',
        argCount: s.count,
        totalUpvotes: s.upvotes,
        bestGrade: s.bestGrade,
      }
    })

  // ── 9. Response ───────────────────────────────────────────────────────────
  const response: TopicsAnalyticsResponse = {
    totalVoted: votes.length,
    uniqueTopics: votedTopicIds.length,
    forCount,
    againstCount,
    forPct: votes.length > 0 ? Math.round((forCount / votes.length) * 100) : 50,
    resolvedCount,
    accurateCount,
    accuracyPct: resolvedCount > 0 ? Math.round((accurateCount / resolvedCount) * 100) : null,
    categoryStats,
    monthlyActivity,
    recentResolved,
    topArgumentedTopics,
    streakData: { longestAccurateStreak, currentAccurateStreak },
  }

  return NextResponse.json(response)
}
