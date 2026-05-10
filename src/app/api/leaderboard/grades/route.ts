import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GradeDebater {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  graded_count: number
  avg_score: number
  a_count: number
  b_count: number
  c_count: number
  d_count: number
  f_count: number
  top_grade: string
  rank: number
}

export interface GradeDistribution {
  grade: string
  count: number
  pct: number
}

export interface CategoryQuality {
  category: string
  graded_count: number
  avg_score: number
  top_grade: string
}

export interface GradesLeaderboardResponse {
  topByGrade: GradeDebater[]
  topByVolume: GradeDebater[]
  gradeDistribution: GradeDistribution[]
  categoryQuality: CategoryQuality[]
  platformStats: {
    total_graded: number
    avg_platform_score: number
    avg_platform_grade: string
    pct_graded: number
    total_arguments: number
    debaters_qualified: number
  }
}

const MIN_GRADED = 2

function avgGradeLabel(avgScore: number): string {
  if (avgScore >= 9) return 'A+'
  if (avgScore >= 8.5) return 'A'
  if (avgScore >= 7.5) return 'B+'
  if (avgScore >= 7) return 'B'
  if (avgScore >= 6) return 'C+'
  if (avgScore >= 5) return 'C'
  if (avgScore >= 4) return 'D'
  return 'F'
}

function topGrade(a: number, b: number, c: number, d: number, f: number): string {
  if (a > 0) return 'A'
  if (b > 0) return 'B'
  if (c > 0) return 'C'
  if (d > 0) return 'D'
  if (f > 0) return 'F'
  return '—'
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  // ── Per-user argument grade aggregates ────────────────────────────────────
  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select(`
      user_id,
      ai_score,
      ai_grade
    `)
    .not('ai_grade', 'is', null)
    .not('user_id', 'is', null)

  if (!rawArgs || rawArgs.length === 0) {
    return NextResponse.json({
      topByGrade: [],
      topByVolume: [],
      gradeDistribution: [],
      categoryQuality: [],
      platformStats: {
        total_graded: 0,
        avg_platform_score: 0,
        avg_platform_grade: '—',
        pct_graded: 0,
        total_arguments: 0,
        debaters_qualified: 0,
      },
    } satisfies GradesLeaderboardResponse)
  }

  // ── Total argument count for pct_graded ──────────────────────────────────
  const { count: totalArgs } = await supabase
    .from('topic_arguments')
    .select('id', { count: 'exact', head: true })
  const totalArgCount = totalArgs ?? 0

  // ── Aggregate per user ───────────────────────────────────────────────────
  type UserAgg = {
    graded_count: number
    score_sum: number
    a_count: number
    b_count: number
    c_count: number
    d_count: number
    f_count: number
  }
  const byUser: Record<string, UserAgg> = {}

  for (const row of rawArgs) {
    if (!row.user_id || !row.ai_grade) continue
    const uid = row.user_id as string
    const grade = row.ai_grade as string
    const score = (row.ai_score as number | null) ?? 5

    if (!byUser[uid]) {
      byUser[uid] = { graded_count: 0, score_sum: 0, a_count: 0, b_count: 0, c_count: 0, d_count: 0, f_count: 0 }
    }
    byUser[uid].graded_count++
    byUser[uid].score_sum += score
    if (grade === 'A') byUser[uid].a_count++
    else if (grade === 'B') byUser[uid].b_count++
    else if (grade === 'C') byUser[uid].c_count++
    else if (grade === 'D') byUser[uid].d_count++
    else if (grade === 'F') byUser[uid].f_count++
  }

  // ── Filter by min_graded and look up profiles ──────────────────────────
  const qualifiedIds = Object.keys(byUser).filter(
    (uid) => byUser[uid].graded_count >= MIN_GRADED
  )

  if (qualifiedIds.length === 0) {
    return NextResponse.json({
      topByGrade: [],
      topByVolume: [],
      gradeDistribution: [],
      categoryQuality: [],
      platformStats: {
        total_graded: rawArgs.length,
        avg_platform_score: 0,
        avg_platform_grade: '—',
        pct_graded: totalArgCount > 0 ? Math.round((rawArgs.length / totalArgCount) * 100) : 0,
        total_arguments: totalArgCount,
        debaters_qualified: 0,
      },
    } satisfies GradesLeaderboardResponse)
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout')
    .in('id', qualifiedIds)

  const profileMap = new Map<string, typeof profiles extends (infer T)[] | null ? T : never>()
  for (const p of profiles ?? []) {
    if (p) profileMap.set(p.id, p)
  }

  const debaters: GradeDebater[] = qualifiedIds
    .map((uid, _) => {
      const agg = byUser[uid]
      const prof = profileMap.get(uid)
      if (!prof) return null
      const avg = agg.graded_count > 0 ? agg.score_sum / agg.graded_count : 0
      return {
        user_id: uid,
        username: prof.username ?? '',
        display_name: prof.display_name ?? null,
        avatar_url: prof.avatar_url ?? null,
        role: prof.role ?? 'person',
        clout: prof.clout ?? 0,
        graded_count: agg.graded_count,
        avg_score: Math.round(avg * 100) / 100,
        a_count: agg.a_count,
        b_count: agg.b_count,
        c_count: agg.c_count,
        d_count: agg.d_count,
        f_count: agg.f_count,
        top_grade: topGrade(agg.a_count, agg.b_count, agg.c_count, agg.d_count, agg.f_count),
        rank: 0,
      } satisfies GradeDebater
    })
    .filter((d): d is GradeDebater => d !== null)

  const topByGrade = [...debaters]
    .sort((a, b) => b.avg_score - a.avg_score || b.graded_count - a.graded_count)
    .slice(0, 50)
    .map((d, i) => ({ ...d, rank: i + 1 }))

  const topByVolume = [...debaters]
    .sort((a, b) => b.graded_count - a.graded_count || b.avg_score - a.avg_score)
    .slice(0, 50)
    .map((d, i) => ({ ...d, rank: i + 1 }))

  // ── Platform-wide grade distribution ──────────────────────────────────────
  const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 }
  let scoreTotal = 0
  let scoreCount = 0

  for (const row of rawArgs) {
    if (!row.ai_grade) continue
    const g = row.ai_grade as string
    if (g in gradeCounts) gradeCounts[g]++
    if (row.ai_score) {
      scoreTotal += row.ai_score as number
      scoreCount++
    }
  }

  const totalGraded = rawArgs.length
  const gradeDistribution: GradeDistribution[] = ['A', 'B', 'C', 'D', 'F'].map((g) => ({
    grade: g,
    count: gradeCounts[g] ?? 0,
    pct: totalGraded > 0 ? Math.round(((gradeCounts[g] ?? 0) / totalGraded) * 100) : 0,
  }))

  const avgPlatformScore = scoreCount > 0 ? scoreTotal / scoreCount : 0

  // ── Category breakdown ────────────────────────────────────────────────────
  const { data: catArgs } = await supabase
    .from('topic_arguments')
    .select('ai_score, ai_grade, topic_id')
    .not('ai_grade', 'is', null)

  const { data: topicCats } = await supabase
    .from('topics')
    .select('id, category')

  const catMap = new Map<string, string>()
  for (const t of topicCats ?? []) {
    if (t.id && t.category) catMap.set(t.id, t.category)
  }

  type CatAgg = { count: number; score_sum: number; a: number; b: number; c: number; d: number; f: number }
  const catAgg: Record<string, CatAgg> = {}

  for (const row of catArgs ?? []) {
    const cat = catMap.get(row.topic_id as string)
    if (!cat || !row.ai_grade) continue
    if (!catAgg[cat]) catAgg[cat] = { count: 0, score_sum: 0, a: 0, b: 0, c: 0, d: 0, f: 0 }
    catAgg[cat].count++
    catAgg[cat].score_sum += (row.ai_score as number | null) ?? 5
    const g = row.ai_grade as string
    if (g === 'A') catAgg[cat].a++
    else if (g === 'B') catAgg[cat].b++
    else if (g === 'C') catAgg[cat].c++
    else if (g === 'D') catAgg[cat].d++
    else if (g === 'F') catAgg[cat].f++
  }

  const categoryQuality: CategoryQuality[] = Object.entries(catAgg)
    .map(([cat, agg]) => ({
      category: cat,
      graded_count: agg.count,
      avg_score: agg.count > 0 ? Math.round((agg.score_sum / agg.count) * 100) / 100 : 0,
      top_grade: topGrade(agg.a, agg.b, agg.c, agg.d, agg.f),
    }))
    .sort((a, b) => b.avg_score - a.avg_score)

  return NextResponse.json({
    topByGrade,
    topByVolume,
    gradeDistribution,
    categoryQuality,
    platformStats: {
      total_graded: totalGraded,
      avg_platform_score: Math.round(avgPlatformScore * 100) / 100,
      avg_platform_grade: avgGradeLabel(avgPlatformScore),
      pct_graded: totalArgCount > 0 ? Math.round((totalGraded / totalArgCount) * 100) : 0,
      total_arguments: totalArgCount,
      debaters_qualified: debaters.length,
    },
  } satisfies GradesLeaderboardResponse)
}
