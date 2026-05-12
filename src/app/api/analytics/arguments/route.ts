import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArgumentStat {
  id: string
  topic_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  created_at: string
  ai_grade: string | null
  ai_score: number | null
  reply_count: number
  arena_wins: number
  arena_bouts: number
  arena_win_pct: number | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null
}

export interface GradeDistribution {
  grade: string
  count: number
  pct: number
}

export interface CategoryBreakdown {
  category: string
  count: number
  for_count: number
  against_count: number
  avg_upvotes: number
}

export interface MonthlyArgCount {
  month: string
  count: number
}

export interface ArenaRecord {
  total_wins: number
  total_bouts: number
  win_rate: number | null
  arguments_with_bouts: number
}

export interface ArgumentPortfolioResponse {
  total: number
  total_upvotes: number
  avg_upvotes: number | null
  for_count: number
  against_count: number
  grade_distribution: GradeDistribution[]
  avg_ai_score: number | null
  best_argument: ArgumentStat | null
  most_upvoted: ArgumentStat | null
  most_active: ArgumentStat | null    // most replies
  arena: ArenaRecord
  category_breakdown: CategoryBreakdown[]
  monthly_activity: MonthlyArgCount[]
  recent_arguments: ArgumentStat[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GRADE_ORDER = ['A', 'B', 'C', 'D', 'F']

function gradeFromScore(score: number | null): string | null {
  if (score === null) return null
  if (score >= 8.5) return 'A'
  if (score >= 7)   return 'B'
  if (score >= 5.5) return 'C'
  if (score >= 4)   return 'D'
  return 'F'
}

// ─── GET /api/analytics/arguments ────────────────────────────────────────────
// Returns the authenticated user's argument portfolio stats.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all the user's arguments with AI scores
  const { data: rawArgs, error: argsError } = await supabase
    .from('topic_arguments')
    .select('id, topic_id, side, content, upvotes, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (argsError || !rawArgs) {
    return NextResponse.json({ error: 'Failed to fetch arguments' }, { status: 500 })
  }

  if (rawArgs.length === 0) {
    return NextResponse.json({
      total: 0,
      total_upvotes: 0,
      avg_upvotes: null,
      for_count: 0,
      against_count: 0,
      grade_distribution: [],
      avg_ai_score: null,
      best_argument: null,
      most_upvoted: null,
      most_active: null,
      arena: { total_wins: 0, total_bouts: 0, win_rate: null, arguments_with_bouts: 0 },
      category_breakdown: [],
      monthly_activity: [],
      recent_arguments: [],
    } satisfies ArgumentPortfolioResponse)
  }

  const argIds = rawArgs.map((a) => a.id)

  // Fetch AI scores, reply counts, arena stats, and topics in parallel
  const [aiScoresRes, repliesRes, arenaRes, topicsRes] = await Promise.all([
    supabase
      .from('argument_ai_scores')
      .select('argument_id, score, grade')
      .in('argument_id', argIds),
    supabase
      .from('argument_replies')
      .select('argument_id')
      .in('argument_id', argIds),
    supabase
      .from('argument_arena_stats')
      .select('argument_id, wins, bouts, win_pct')
      .in('argument_id', argIds),
    supabase
      .from('topics')
      .select('id, statement, category, status')
      .in('id', rawArgs.map((a) => a.topic_id)),
  ])

  // Build lookup maps
  const aiByArgId = new Map<string, { score: number | null; grade: string | null }>()
  for (const row of aiScoresRes.data ?? []) {
    aiByArgId.set(row.argument_id, {
      score: row.score ?? null,
      grade: row.grade ?? null,
    })
  }

  const replyCounts = new Map<string, number>()
  for (const row of repliesRes.data ?? []) {
    replyCounts.set(row.argument_id, (replyCounts.get(row.argument_id) ?? 0) + 1)
  }

  const arenaByArgId = new Map<
    string,
    { wins: number; bouts: number; win_pct: number | null }
  >()
  for (const row of arenaRes.data ?? []) {
    arenaByArgId.set(row.argument_id, {
      wins: row.wins ?? 0,
      bouts: row.bouts ?? 0,
      win_pct: row.win_pct ?? null,
    })
  }

  const topicById = new Map<
    string,
    { id: string; statement: string; category: string | null; status: string }
  >()
  for (const t of topicsRes.data ?? []) {
    topicById.set(t.id, t)
  }

  // Build enriched arguments
  const args: ArgumentStat[] = rawArgs.map((a) => {
    const ai = aiByArgId.get(a.id)
    const arena = arenaByArgId.get(a.id)
    const score = ai?.score ?? null
    return {
      id: a.id,
      topic_id: a.topic_id,
      side: a.side as 'blue' | 'red',
      content: a.content,
      upvotes: a.upvotes,
      created_at: a.created_at,
      ai_grade: ai?.grade ?? gradeFromScore(score),
      ai_score: score,
      reply_count: replyCounts.get(a.id) ?? 0,
      arena_wins: arena?.wins ?? 0,
      arena_bouts: arena?.bouts ?? 0,
      arena_win_pct: arena?.win_pct ?? null,
      topic: topicById.get(a.topic_id) ?? null,
    }
  })

  // ── Aggregate stats ─────────────────────────────────────────────────────────

  const total = args.length
  const total_upvotes = args.reduce((s, a) => s + a.upvotes, 0)
  const avg_upvotes = total > 0 ? Math.round((total_upvotes / total) * 10) / 10 : null
  const for_count = args.filter((a) => a.side === 'blue').length
  const against_count = args.filter((a) => a.side === 'red').length

  // Grade distribution
  const gradedArgs = args.filter((a) => a.ai_grade !== null)
  const gradeCounts = new Map<string, number>()
  for (const grade of GRADE_ORDER) gradeCounts.set(grade, 0)
  for (const a of gradedArgs) {
    const g = a.ai_grade!
    gradeCounts.set(g, (gradeCounts.get(g) ?? 0) + 1)
  }
  const gradeTotal = gradedArgs.length
  const grade_distribution: GradeDistribution[] = GRADE_ORDER.map((grade) => ({
    grade,
    count: gradeCounts.get(grade) ?? 0,
    pct: gradeTotal > 0 ? Math.round(((gradeCounts.get(grade) ?? 0) / gradeTotal) * 100) : 0,
  }))

  const scoredArgs = args.filter((a) => a.ai_score !== null)
  const avg_ai_score =
    scoredArgs.length > 0
      ? Math.round(
          (scoredArgs.reduce((s, a) => s + (a.ai_score ?? 0), 0) / scoredArgs.length) * 10
        ) / 10
      : null

  // Best argument (highest composite: upvotes×3 + ai_score×10)
  const best_argument =
    args.length > 0
      ? args.reduce((best, a) => {
          const score = a.upvotes * 3 + (a.ai_score ?? 0) * 10 + a.arena_wins * 2
          const bestScore =
            best.upvotes * 3 + (best.ai_score ?? 0) * 10 + best.arena_wins * 2
          return score > bestScore ? a : best
        })
      : null

  const most_upvoted =
    args.length > 0
      ? args.reduce((best, a) => (a.upvotes > best.upvotes ? a : best))
      : null

  const most_active =
    args.length > 0
      ? args.reduce((best, a) => (a.reply_count > best.reply_count ? a : best))
      : null

  // Arena record
  const arenaArgs = args.filter((a) => a.arena_bouts > 0)
  const total_arena_wins = args.reduce((s, a) => s + a.arena_wins, 0)
  const total_arena_bouts = args.reduce((s, a) => s + a.arena_bouts, 0)
  const arena: ArenaRecord = {
    total_wins: total_arena_wins,
    total_bouts: total_arena_bouts,
    win_rate:
      total_arena_bouts > 0
        ? Math.round((total_arena_wins / total_arena_bouts) * 1000) / 10
        : null,
    arguments_with_bouts: arenaArgs.length,
  }

  // Category breakdown
  const catMap = new Map<
    string,
    { count: number; for: number; against: number; upvotes: number }
  >()
  for (const a of args) {
    const cat = a.topic?.category ?? 'Other'
    const existing = catMap.get(cat) ?? { count: 0, for: 0, against: 0, upvotes: 0 }
    catMap.set(cat, {
      count: existing.count + 1,
      for: existing.for + (a.side === 'blue' ? 1 : 0),
      against: existing.against + (a.side === 'red' ? 1 : 0),
      upvotes: existing.upvotes + a.upvotes,
    })
  }
  const category_breakdown: CategoryBreakdown[] = Array.from(catMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([category, data]) => ({
      category,
      count: data.count,
      for_count: data.for,
      against_count: data.against,
      avg_upvotes: Math.round((data.upvotes / data.count) * 10) / 10,
    }))

  // Monthly activity (last 12 months)
  const monthlyMap = new Map<string, number>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyMap.set(key, 0)
  }
  for (const a of args) {
    const month = a.created_at.slice(0, 7)
    if (monthlyMap.has(month)) {
      monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + 1)
    }
  }
  const monthly_activity: MonthlyArgCount[] = Array.from(monthlyMap.entries()).map(
    ([month, count]) => ({ month, count })
  )

  // Recent arguments (last 10)
  const recent_arguments = args.slice(0, 10)

  return NextResponse.json({
    total,
    total_upvotes,
    avg_upvotes,
    for_count,
    against_count,
    grade_distribution,
    avg_ai_score,
    best_argument,
    most_upvoted,
    most_active,
    arena,
    category_breakdown,
    monthly_activity,
    recent_arguments,
  } satisfies ArgumentPortfolioResponse)
}
