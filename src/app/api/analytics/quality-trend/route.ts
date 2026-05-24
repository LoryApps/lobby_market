import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'
export type Trajectory = 'improving' | 'stable' | 'declining'

export interface MonthlyQuality {
  month: string          // "2025-01"
  month_label: string    // "Jan 2025"
  avg_score: number | null
  grade: Grade | null
  count: number          // arguments scored that month
  grade_counts: Record<Grade, number>
}

export interface TopArgument {
  id: string
  topic_id: string
  topic_statement: string
  category: string | null
  content: string
  side: 'blue' | 'red'
  ai_score: number
  ai_grade: Grade
  upvotes: number
  created_at: string
}

export interface CategoryQuality {
  category: string
  avg_score: number
  grade: Grade
  count: number
  best_score: number | null
}

export interface QualityTrendResponse {
  total_graded: number
  avg_score: number | null
  avg_grade: Grade | null
  trajectory: Trajectory
  trajectory_pct: number | null   // % change from first half to second half of data window
  best_month: string | null       // "Jan 2025"
  best_month_avg: number | null
  monthly: MonthlyQuality[]       // 12 months descending, or fewer if less data
  top_arguments: TopArgument[]    // top 5 by ai_score
  category_quality: CategoryQuality[]
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreToGrade(score: number): Grade {
  if (score >= 8.5) return 'A'
  if (score >= 7)   return 'B'
  if (score >= 5.5) return 'C'
  if (score >= 4)   return 'D'
  return 'F'
}

function computeTrajectory(monthly: MonthlyQuality[]): { trajectory: Trajectory; pct: number | null } {
  const scored = monthly.filter((m) => m.avg_score !== null && m.count >= 1)
  if (scored.length < 3) return { trajectory: 'stable', pct: null }

  // Compare first half vs second half (chronological order)
  const chrono = [...scored].reverse()
  const half = Math.floor(chrono.length / 2)
  const first = chrono.slice(0, half)
  const second = chrono.slice(chrono.length - half)

  const avgFirst = first.reduce((s, m) => s + (m.avg_score ?? 0), 0) / first.length
  const avgSecond = second.reduce((s, m) => s + (m.avg_score ?? 0), 0) / second.length

  if (avgFirst === 0) return { trajectory: 'stable', pct: null }

  const pct = Math.round(((avgSecond - avgFirst) / avgFirst) * 100)
  const trajectory: Trajectory = pct >= 5 ? 'improving' : pct <= -5 ? 'declining' : 'stable'
  return { trajectory, pct }
}

// ─── GET /api/analytics/quality-trend ────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1. Fetch all graded arguments in the past 12 months ─────────────────

  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select(`
      id, topic_id, side, content, upvotes, created_at, ai_score, ai_grade,
      topics:topic_id ( statement, category )
    `)
    .eq('user_id', user.id)
    .not('ai_score', 'is', null)
    .gte('created_at', twelveMonthsAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(500)

  const args = (rawArgs ?? []) as Array<{
    id: string
    topic_id: string
    side: 'blue' | 'red'
    content: string
    upvotes: number
    created_at: string
    ai_score: number
    ai_grade: string | null
    topics: { statement: string; category: string | null } | null
  }>

  // ── 2. Build monthly buckets ─────────────────────────────────────────────

  const buckets: Record<string, {
    scores: number[]
    grade_counts: Record<Grade, number>
  }> = {}

  for (const arg of args) {
    const d = new Date(arg.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!buckets[key]) {
      buckets[key] = { scores: [], grade_counts: { A: 0, B: 0, C: 0, D: 0, F: 0 } }
    }
    buckets[key].scores.push(arg.ai_score)
    const g = (arg.ai_grade as Grade | null) ?? scoreToGrade(arg.ai_score)
    buckets[key].grade_counts[g] = (buckets[key].grade_counts[g] ?? 0) + 1
  }

  // Build the 12-month window (most recent first)
  const monthly: MonthlyQuality[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

    const bucket = buckets[key]
    const avg = bucket && bucket.scores.length > 0
      ? Math.round((bucket.scores.reduce((a, b) => a + b, 0) / bucket.scores.length) * 10) / 10
      : null
    const gradeCounts: Record<Grade, number> = bucket
      ? { ...bucket.grade_counts }
      : { A: 0, B: 0, C: 0, D: 0, F: 0 }

    monthly.push({
      month: key,
      month_label: monthLabel,
      avg_score: avg,
      grade: avg !== null ? scoreToGrade(avg) : null,
      count: bucket?.scores.length ?? 0,
      grade_counts: gradeCounts,
    })
  }

  // ── 3. Overall stats ────────────────────────────────────────────────────

  const allScores = args.map((a) => a.ai_score)
  const avgScore = allScores.length > 0
    ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
    : null
  const avgGrade = avgScore !== null ? scoreToGrade(avgScore) : null

  // Best month (most recent first, pick highest avg among months with >= 2 args)
  const qualifiedMonths = monthly.filter((m) => m.avg_score !== null && m.count >= 2)
  let bestMonth: string | null = null
  let bestMonthAvg: number | null = null
  if (qualifiedMonths.length > 0) {
    const best = qualifiedMonths.reduce((a, b) => (b.avg_score! > a.avg_score! ? b : a))
    bestMonth = best.month_label
    bestMonthAvg = best.avg_score
  }

  // ── 4. Trajectory ────────────────────────────────────────────────────────

  const { trajectory, pct: trajectoryPct } = computeTrajectory(monthly)

  // ── 5. Top 5 arguments by score ──────────────────────────────────────────

  const topArguments: TopArgument[] = args
    .slice()
    .sort((a, b) => b.ai_score - a.ai_score)
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      topic_id: a.topic_id,
      topic_statement: a.topics?.statement ?? 'Unknown topic',
      category: a.topics?.category ?? null,
      content: a.content,
      side: a.side,
      ai_score: a.ai_score,
      ai_grade: (a.ai_grade as Grade | null) ?? scoreToGrade(a.ai_score),
      upvotes: a.upvotes,
      created_at: a.created_at,
    }))

  // ── 6. Category quality breakdown ────────────────────────────────────────

  const catMap: Record<string, { scores: number[]; best: number }> = {}
  for (const arg of args) {
    const cat = arg.topics?.category ?? 'Other'
    if (!catMap[cat]) catMap[cat] = { scores: [], best: 0 }
    catMap[cat].scores.push(arg.ai_score)
    if (arg.ai_score > catMap[cat].best) catMap[cat].best = arg.ai_score
  }

  const categoryQuality: CategoryQuality[] = Object.entries(catMap)
    .map(([category, data]) => {
      const avg = Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10
      return {
        category,
        avg_score: avg,
        grade: scoreToGrade(avg),
        count: data.scores.length,
        best_score: data.best,
      }
    })
    .sort((a, b) => b.avg_score - a.avg_score)
    .slice(0, 8)

  // ── 7. Build response ────────────────────────────────────────────────────

  const response: QualityTrendResponse = {
    total_graded: args.length,
    avg_score: avgScore,
    avg_grade: avgGrade,
    trajectory,
    trajectory_pct: trajectoryPct,
    best_month: bestMonth,
    best_month_avg: bestMonthAvg,
    monthly,
    top_arguments: topArguments,
    category_quality: categoryQuality,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
