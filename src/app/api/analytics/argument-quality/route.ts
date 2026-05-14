import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface GradeCount {
  grade: Grade
  count: number
  pct: number
  color: string
}

export interface CategoryQuality {
  category: string
  avg_score: number | null
  graded_count: number
  total_count: number
  graded_pct: number
  top_grade: Grade | null
  score_bar: number // 0-100 for display
}

export interface TopArguer {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  a_grade_count: number
  total_graded: number
  avg_score: number
}

export interface WeeklyTrend {
  week: string   // ISO date string for start of week
  avg_score: number
  graded_count: number
}

export interface ArgumentQualityIndexResponse {
  totals: {
    total_arguments: number
    graded_arguments: number
    graded_pct: number
    avg_score: number | null
    platform_grade: Grade | null
  }
  grade_distribution: GradeCount[]
  category_quality: CategoryQuality[]
  top_arguers: TopArguer[]
  weekly_trend: WeeklyTrend[]
  generated_at: string
}

function scoreToGrade(score: number): Grade {
  if (score >= 9) return 'A'
  if (score >= 7.5) return 'A'
  if (score >= 6)   return 'B'
  if (score >= 4.5) return 'C'
  if (score >= 3)   return 'D'
  return 'F'
}

const GRADE_COLORS: Record<Grade, string> = {
  A: '#10b981', // emerald
  B: '#3b82f6', // for-blue
  C: '#a855f7', // purple
  D: '#f59e0b', // gold/amber
  F: '#ef4444', // against-red
}

export async function GET() {
  const supabase = await createClient()

  // ── 1. Overall totals ──────────────────────────────────────────────────────

  const { data: totalsData } = await supabase
    .from('topic_arguments')
    .select('ai_score, ai_grade')
    .not('ai_score', 'is', null)

  const { count: totalCount } = await supabase
    .from('topic_arguments')
    .select('id', { count: 'exact', head: true })

  const graded = totalsData ?? []
  const totalArguments = totalCount ?? 0
  const gradedArguments = graded.length

  const avgScore = gradedArguments > 0
    ? graded.reduce((s, r) => s + (r.ai_score as number), 0) / gradedArguments
    : null

  const platformGrade: Grade | null = avgScore !== null ? scoreToGrade(avgScore) : null

  // ── 2. Grade distribution ─────────────────────────────────────────────────

  const gradeBuckets: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 }
  for (const r of graded) {
    const g = (r.ai_grade as Grade | null) ?? scoreToGrade(r.ai_score as number)
    if (g in gradeBuckets) gradeBuckets[g as Grade]++
  }

  const gradeDistribution: GradeCount[] = (['A', 'B', 'C', 'D', 'F'] as Grade[]).map((grade) => ({
    grade,
    count: gradeBuckets[grade],
    pct: gradedArguments > 0 ? Math.round((gradeBuckets[grade] / gradedArguments) * 100) : 0,
    color: GRADE_COLORS[grade],
  }))

  // ── 3. Category quality breakdown ─────────────────────────────────────────

  const { data: categoryRaw } = await supabase
    .from('topic_arguments')
    .select('ai_score, ai_grade, topic_id')
    .not('ai_score', 'is', null)

  const { data: topicCategories } = await supabase
    .from('topics')
    .select('id, category')
    .not('category', 'is', null)

  const { data: allArgsByTopic } = await supabase
    .from('topic_arguments')
    .select('topic_id')

  const catMap = new Map<string, string>()
  for (const t of topicCategories ?? []) {
    catMap.set(t.id as string, t.category as string)
  }

  const catTotals = new Map<string, number>()
  for (const r of allArgsByTopic ?? []) {
    const cat = catMap.get(r.topic_id as string) ?? 'Other'
    catTotals.set(cat, (catTotals.get(cat) ?? 0) + 1)
  }

  const catScores = new Map<string, number[]>()
  for (const r of categoryRaw ?? []) {
    const cat = catMap.get(r.topic_id as string) ?? 'Other'
    if (!catScores.has(cat)) catScores.set(cat, [])
    catScores.get(cat)!.push(r.ai_score as number)
  }

  const categoryQuality: CategoryQuality[] = Array.from(catScores.entries())
    .map(([category, scores]) => {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length
      const total = catTotals.get(category) ?? scores.length
      return {
        category,
        avg_score: Math.round(avg * 10) / 10,
        graded_count: scores.length,
        total_count: total,
        graded_pct: Math.round((scores.length / total) * 100),
        top_grade: scoreToGrade(avg),
        score_bar: Math.round((avg / 10) * 100),
      }
    })
    .sort((a, b) => (b.avg_score ?? 0) - (a.avg_score ?? 0))
    .slice(0, 10)

  // ── 4. Top arguers by A-grade count ──────────────────────────────────────

  const { data: gradedArgs } = await supabase
    .from('topic_arguments')
    .select('user_id, ai_score, ai_grade')
    .not('ai_score', 'is', null)
    .order('ai_score', { ascending: false })
    .limit(2000)

  const arguerMap = new Map<
    string,
    { a_grade_count: number; total_graded: number; score_sum: number }
  >()

  for (const r of gradedArgs ?? []) {
    const uid = r.user_id as string
    if (!arguerMap.has(uid)) {
      arguerMap.set(uid, { a_grade_count: 0, total_graded: 0, score_sum: 0 })
    }
    const entry = arguerMap.get(uid)!
    const grade = (r.ai_grade as Grade | null) ?? scoreToGrade(r.ai_score as number)
    entry.total_graded++
    entry.score_sum += r.ai_score as number
    if (grade === 'A') entry.a_grade_count++
  }

  const topArguerEntries = Array.from(arguerMap.entries())
    .filter(([, v]) => v.a_grade_count >= 1)
    .sort((a, b) => b[1].a_grade_count - a[1].a_grade_count)
    .slice(0, 10)

  const arguerIds = topArguerEntries.map(([id]) => id)
  const profileMap = new Map<string, {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  }>()

  if (arguerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', arguerIds)

    for (const p of profiles ?? []) {
      profileMap.set(p.id as string, {
        username: p.username as string,
        display_name: p.display_name as string | null,
        avatar_url: p.avatar_url as string | null,
        role: p.role as string,
      })
    }
  }

  const topArgumenters: TopArguer[] = topArguerEntries
    .map(([uid, stats]) => {
      const profile = profileMap.get(uid)
      if (!profile) return null
      return {
        user_id: uid,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        a_grade_count: stats.a_grade_count,
        total_graded: stats.total_graded,
        avg_score: Math.round((stats.score_sum / stats.total_graded) * 10) / 10,
      }
    })
    .filter((x): x is TopArguer => x !== null)

  // ── 5. Weekly trend (last 8 weeks) ────────────────────────────────────────

  const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString()

  const { data: weeklyRaw } = await supabase
    .from('topic_arguments')
    .select('ai_score, created_at')
    .not('ai_score', 'is', null)
    .gte('created_at', eightWeeksAgo)
    .order('created_at', { ascending: true })

  // Group by ISO week
  const weekBuckets = new Map<string, number[]>()
  for (const r of weeklyRaw ?? []) {
    const d = new Date(r.created_at as string)
    // Get Monday of the week
    const day = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((day + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    const key = monday.toISOString().slice(0, 10)
    if (!weekBuckets.has(key)) weekBuckets.set(key, [])
    weekBuckets.get(key)!.push(r.ai_score as number)
  }

  const weeklyTrend: WeeklyTrend[] = Array.from(weekBuckets.entries())
    .map(([week, scores]) => ({
      week,
      avg_score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      graded_count: scores.length,
    }))
    .sort((a, b) => a.week.localeCompare(b.week))

  // ── Response ───────────────────────────────────────────────────────────────

  const response: ArgumentQualityIndexResponse = {
    totals: {
      total_arguments: totalArguments,
      graded_arguments: gradedArguments,
      graded_pct: totalArguments > 0 ? Math.round((gradedArguments / totalArguments) * 100) : 0,
      avg_score: avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
      platform_grade: platformGrade,
    },
    grade_distribution: gradeDistribution,
    category_quality: categoryQuality,
    top_arguers: topArgumenters,
    weekly_trend: weeklyTrend,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
