import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryDiscourse {
  category: string
  total_arguments: number
  scored_arguments: number
  avg_score: number | null
  grade_a_pct: number
  grade_b_pct: number
  grade_c_pct: number
  reply_rate: number        // % of arguments that received at least one reply
  avg_upvotes: number
  health_score: number      // composite 0–100
}

export interface GradeBucket {
  grade: string
  count: number
  pct: number
}

export interface HealthyTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  total_arguments: number
  scored_arguments: number
  avg_score: number | null
  reply_rate: number
  health_score: number
}

export interface MonthlyTrend {
  month: string             // "YYYY-MM"
  total_arguments: number
  scored_arguments: number
  avg_score: number | null
  grade_a_count: number
}

export interface DiscourseResponse {
  // Platform totals
  total_arguments: number
  scored_pct: number         // % that have been AI-scored
  platform_avg_score: number | null
  platform_health_score: number   // 0–100

  // Grade distribution across all scored arguments
  grade_distribution: GradeBucket[]

  // Reply engagement
  overall_reply_rate: number   // % of args with at least one reply
  avg_replies_per_arg: number

  // Per-category breakdown
  by_category: CategoryDiscourse[]

  // Healthiest topics (most substantive debates)
  healthiest_topics: HealthyTopic[]

  // Monthly trend (last 6 months)
  monthly_trend: MonthlyTrend[]
}

// ─── Health score formula ─────────────────────────────────────────────────────
// Composite health score 0–100:
//   50% AI quality (avg_score / 10 * 50)
//   30% reply engagement (reply_rate * 30, capped at 30)
//   20% upvote signal (min(avg_upvotes / 5, 1) * 20)
function computeHealth(
  avgScore: number | null,
  replyRate: number,
  avgUpvotes: number
): number {
  const qualityPart = avgScore !== null ? (avgScore / 10) * 50 : 25
  const replyPart = Math.min(replyRate * 30, 30)
  const upvotePart = Math.min((avgUpvotes / 5) * 20, 20)
  return Math.round(qualityPart + replyPart + upvotePart)
}

// ─── GET /api/analytics/discourse ────────────────────────────────────────────
export async function GET() {
  const supabase = await createClient()

  // Fetch recent arguments with AI scores and reply counts
  // Limit to last 90 days for performance
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const { data: args, error: argsError } = await supabase
    .from('topic_arguments')
    .select(`
      id,
      side,
      upvotes,
      ai_score,
      ai_grade,
      created_at,
      topics!inner(id, statement, category, status, blue_pct, total_votes)
    `)
    .gte('created_at', ninetyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(8000)

  if (argsError) {
    return NextResponse.json({ error: argsError.message }, { status: 500 })
  }

  const rawArgs = (args ?? []) as Array<{
    id: string
    side: string
    upvotes: number
    ai_score: number | null
    ai_grade: string | null
    created_at: string
    topics: {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
    }
  }>

  // Fetch reply counts for the same arguments
  const argIds = rawArgs.map((a) => a.id)
  const replyCounts: Record<string, number> = {}

  if (argIds.length > 0) {
    const { data: replies } = await supabase
      .from('argument_replies')
      .select('argument_id')
      .in('argument_id', argIds.slice(0, 5000)) // cap for safety

    if (replies) {
      for (const r of replies as Array<{ argument_id: string }>) {
        replyCounts[r.argument_id] = (replyCounts[r.argument_id] ?? 0) + 1
      }
    }
  }

  // ─── Platform totals ──────────────────────────────────────────────────────
  const total = rawArgs.length
  const scored = rawArgs.filter((a) => a.ai_score !== null)
  const scoredPct = total > 0 ? Math.round((scored.length / total) * 100) : 0

  const sumScore = scored.reduce((s, a) => s + (a.ai_score ?? 0), 0)
  const platformAvgScore = scored.length > 0 ? Math.round((sumScore / scored.length) * 10) / 10 : null

  const withReplies = rawArgs.filter((a) => (replyCounts[a.id] ?? 0) > 0)
  const overallReplyRate = total > 0 ? withReplies.length / total : 0
  const totalReplies = rawArgs.reduce((s, a) => s + (replyCounts[a.id] ?? 0), 0)
  const avgRepliesPerArg = total > 0 ? Math.round((totalReplies / total) * 10) / 10 : 0
  const avgUpvotesOverall = total > 0
    ? rawArgs.reduce((s, a) => s + (a.upvotes ?? 0), 0) / total
    : 0

  const platformHealthScore = computeHealth(platformAvgScore, overallReplyRate, avgUpvotesOverall)

  // ─── Grade distribution ───────────────────────────────────────────────────
  const gradeMap: Record<string, number> = {}
  for (const a of scored) {
    const g = a.ai_grade ?? 'F'
    gradeMap[g] = (gradeMap[g] ?? 0) + 1
  }
  const GRADES = ['A', 'B', 'C', 'D', 'F']
  const gradeDist: GradeBucket[] = GRADES.map((g) => ({
    grade: g,
    count: gradeMap[g] ?? 0,
    pct: scored.length > 0 ? Math.round(((gradeMap[g] ?? 0) / scored.length) * 100) : 0,
  }))

  // ─── Per-category breakdown ───────────────────────────────────────────────
  const catMap = new Map<string, {
    args: typeof rawArgs
    scored: typeof rawArgs
    replied: number
    totalReplies: number
    sumUpvotes: number
  }>()

  for (const a of rawArgs) {
    const cat = a.topics.category ?? 'Uncategorized'
    if (!catMap.has(cat)) {
      catMap.set(cat, { args: [], scored: [], replied: 0, totalReplies: 0, sumUpvotes: 0 })
    }
    const entry = catMap.get(cat)!
    entry.args.push(a)
    if (a.ai_score !== null) entry.scored.push(a)
    const rc = replyCounts[a.id] ?? 0
    if (rc > 0) entry.replied++
    entry.totalReplies += rc
    entry.sumUpvotes += a.upvotes ?? 0
  }

  const byCategory: CategoryDiscourse[] = []
  for (const [cat, entry] of catMap.entries()) {
    if (cat === 'Uncategorized' || entry.args.length < 3) continue

    const catScoredArgs = entry.scored
    const catAvgScore = catScoredArgs.length > 0
      ? Math.round((catScoredArgs.reduce((s, a) => s + (a.ai_score ?? 0), 0) / catScoredArgs.length) * 10) / 10
      : null

    const catArgCount = entry.args.length
    const catScored = catScoredArgs.length
    const gradeA = catScoredArgs.filter((a) => a.ai_grade === 'A').length
    const gradeB = catScoredArgs.filter((a) => a.ai_grade === 'B').length
    const gradeC = catScoredArgs.filter((a) => a.ai_grade === 'C').length
    const replyRate = catArgCount > 0 ? entry.replied / catArgCount : 0
    const avgUpvotes = catArgCount > 0 ? entry.sumUpvotes / catArgCount : 0

    byCategory.push({
      category: cat,
      total_arguments: catArgCount,
      scored_arguments: catScored,
      avg_score: catAvgScore,
      grade_a_pct: catScored > 0 ? Math.round((gradeA / catScored) * 100) : 0,
      grade_b_pct: catScored > 0 ? Math.round((gradeB / catScored) * 100) : 0,
      grade_c_pct: catScored > 0 ? Math.round((gradeC / catScored) * 100) : 0,
      reply_rate: Math.round(replyRate * 100) / 100,
      avg_upvotes: Math.round(avgUpvotes * 10) / 10,
      health_score: computeHealth(catAvgScore, replyRate, avgUpvotes),
    })
  }

  byCategory.sort((a, b) => b.health_score - a.health_score)

  // ─── Healthiest topics ────────────────────────────────────────────────────
  const topicMap = new Map<string, {
    topic: typeof rawArgs[0]['topics']
    args: typeof rawArgs
    scored: typeof rawArgs
    repliedCount: number
    sumUpvotes: number
  }>()

  for (const a of rawArgs) {
    const tid = a.topics.id
    if (!topicMap.has(tid)) {
      topicMap.set(tid, { topic: a.topics, args: [], scored: [], repliedCount: 0, sumUpvotes: 0 })
    }
    const entry = topicMap.get(tid)!
    entry.args.push(a)
    if (a.ai_score !== null) entry.scored.push(a)
    if ((replyCounts[a.id] ?? 0) > 0) entry.repliedCount++
    entry.sumUpvotes += a.upvotes ?? 0
  }

  const healthyTopics: HealthyTopic[] = []
  for (const [, entry] of topicMap.entries()) {
    if (entry.args.length < 5) continue

    const avgScore = entry.scored.length > 0
      ? Math.round((entry.scored.reduce((s, a) => s + (a.ai_score ?? 0), 0) / entry.scored.length) * 10) / 10
      : null
    const replyRate = entry.args.length > 0 ? entry.repliedCount / entry.args.length : 0
    const avgUpvotes = entry.args.length > 0 ? entry.sumUpvotes / entry.args.length : 0

    healthyTopics.push({
      id: entry.topic.id,
      statement: entry.topic.statement,
      category: entry.topic.category,
      status: entry.topic.status,
      blue_pct: entry.topic.blue_pct,
      total_votes: entry.topic.total_votes,
      total_arguments: entry.args.length,
      scored_arguments: entry.scored.length,
      avg_score: avgScore,
      reply_rate: Math.round(replyRate * 100) / 100,
      health_score: computeHealth(avgScore, replyRate, avgUpvotes),
    })
  }

  healthyTopics.sort((a, b) => b.health_score - a.health_score)

  // ─── Monthly trend (last 6 months) ───────────────────────────────────────
  const monthMap = new Map<string, {
    total: number
    scored: typeof rawArgs
    gradeA: number
  }>()

  for (const a of rawArgs) {
    const month = a.created_at.slice(0, 7) // "YYYY-MM"
    if (!monthMap.has(month)) monthMap.set(month, { total: 0, scored: [], gradeA: 0 })
    const m = monthMap.get(month)!
    m.total++
    if (a.ai_score !== null) {
      m.scored.push(a)
      if (a.ai_grade === 'A') m.gradeA++
    }
  }

  // Get last 6 months
  const now = new Date()
  const monthlyTrend: MonthlyTrend[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const entry = monthMap.get(key)
    const scoredList = entry?.scored ?? []
    monthlyTrend.push({
      month: key,
      total_arguments: entry?.total ?? 0,
      scored_arguments: scoredList.length,
      avg_score: scoredList.length > 0
        ? Math.round((scoredList.reduce((s, a) => s + (a.ai_score ?? 0), 0) / scoredList.length) * 10) / 10
        : null,
      grade_a_count: entry?.gradeA ?? 0,
    })
  }

  const response: DiscourseResponse = {
    total_arguments: total,
    scored_pct: scoredPct,
    platform_avg_score: platformAvgScore,
    platform_health_score: platformHealthScore,
    grade_distribution: gradeDist,
    overall_reply_rate: Math.round(overallReplyRate * 100) / 100,
    avg_replies_per_arg: avgRepliesPerArg,
    by_category: byCategory,
    healthiest_topics: healthyTopics.slice(0, 10),
    monthly_trend: monthlyTrend,
  }

  return NextResponse.json(response)
}
