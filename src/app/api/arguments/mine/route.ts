import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MineArgument {
  id: string
  topic_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  source_url: string | null
  created_at: string
  reply_count: number
  topic_statement: string
  topic_category: string | null
  topic_status: string
  ai_score: number | null
  ai_grade: string | null
}

export interface WeekBucket {
  week: string   // ISO date of Monday (YYYY-MM-DD)
  count: number
}

export interface CategoryStat {
  category: string
  forCount: number
  againstCount: number
  total: number
  totalUpvotes: number
  avgGrade: number | null
}

export type GradeKey = 'A' | 'B' | 'C' | 'D' | 'F'

export interface GradeDistribution {
  grade: GradeKey
  count: number
  pct: number
}

export interface MineResponse {
  arguments: MineArgument[]
  totalArguments: number
  totalUpvotes: number
  avgUpvotes: number
  sourcedCount: number    // args with a citation URL
  forCount: number
  againstCount: number
  topUpvoted: MineArgument[]   // top 5 by upvotes
  recentArgs: MineArgument[]   // most recent 5
  topGraded: MineArgument[]    // top 5 by ai_score
  categoryStats: CategoryStat[]
  weeklyBuckets: WeekBucket[]  // last 12 weeks
  gradedCount: number
  avgAiScore: number | null
  gradeDistribution: GradeDistribution[]
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch all arguments by this user (including AI grade data)
  const { data: rawArgs, error } = await supabase
    .from('topic_arguments')
    .select('id, topic_id, side, content, upvotes, source_url, created_at, ai_score, ai_grade')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch arguments' }, { status: 500 })
  }

  const args = rawArgs ?? []

  if (args.length === 0) {
    return NextResponse.json({
      arguments: [],
      totalArguments: 0,
      totalUpvotes: 0,
      avgUpvotes: 0,
      sourcedCount: 0,
      forCount: 0,
      againstCount: 0,
      topUpvoted: [],
      recentArgs: [],
      topGraded: [],
      categoryStats: [],
      weeklyBuckets: [],
      gradedCount: 0,
      avgAiScore: null,
      gradeDistribution: [],
    } satisfies MineResponse)
  }

  // 2. Fetch topic metadata
  const topicIds = Array.from(new Set(args.map((a) => a.topic_id)))
  const { data: topicsRaw } = await supabase
    .from('topics')
    .select('id, statement, category, status')
    .in('id', topicIds)
  const topicMap = new Map<string, { statement: string; category: string | null; status: string }>()
  for (const t of topicsRaw ?? []) {
    topicMap.set(t.id, { statement: t.statement, category: t.category, status: t.status })
  }

  // 3. Fetch reply counts per argument
  const argIds = args.map((a) => a.id)
  const { data: repliesRaw } = await supabase
    .from('argument_replies')
    .select('argument_id')
    .in('argument_id', argIds)
  const replyCountMap = new Map<string, number>()
  for (const r of repliesRaw ?? []) {
    replyCountMap.set(r.argument_id, (replyCountMap.get(r.argument_id) ?? 0) + 1)
  }

  // 4. Assemble enriched args
  const enriched: MineArgument[] = args.map((a) => {
    const topic = topicMap.get(a.topic_id)
    const raw = a as { source_url?: string | null; ai_score?: number | null; ai_grade?: string | null }
    return {
      id: a.id,
      topic_id: a.topic_id,
      side: a.side as 'blue' | 'red',
      content: a.content,
      upvotes: a.upvotes,
      source_url: raw.source_url ?? null,
      created_at: a.created_at,
      reply_count: replyCountMap.get(a.id) ?? 0,
      topic_statement: topic?.statement ?? 'Unknown topic',
      topic_category: topic?.category ?? null,
      topic_status: topic?.status ?? 'unknown',
      ai_score: raw.ai_score ?? null,
      ai_grade: raw.ai_grade ?? null,
    }
  })

  // 5. Aggregate stats
  const totalUpvotes = enriched.reduce((s, a) => s + a.upvotes, 0)
  const avgUpvotes = enriched.length > 0 ? Math.round(totalUpvotes / enriched.length) : 0
  const sourcedCount = enriched.filter((a) => a.source_url).length
  const forCount = enriched.filter((a) => a.side === 'blue').length
  const againstCount = enriched.filter((a) => a.side === 'red').length

  // 6. Top by upvotes
  const topUpvoted = [...enriched]
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 5)

  // 7. Recent (already sorted desc by created_at)
  const recentArgs = enriched.slice(0, 5)

  // 8. Top by AI grade
  const topGraded = [...enriched]
    .filter((a) => a.ai_score !== null)
    .sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0))
    .slice(0, 5)

  // 9. Grade analytics
  const gradedArgs = enriched.filter((a) => a.ai_score !== null && a.ai_grade !== null)
  const gradedCount = gradedArgs.length
  const avgAiScore = gradedCount > 0
    ? Math.round((gradedArgs.reduce((s, a) => s + (a.ai_score ?? 0), 0) / gradedCount) * 10) / 10
    : null

  const gradeOrder: GradeKey[] = ['A', 'B', 'C', 'D', 'F']
  const gradeCounts: Record<GradeKey, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 }
  for (const a of gradedArgs) {
    const g = a.ai_grade as GradeKey
    if (g in gradeCounts) gradeCounts[g]++
  }
  const gradeDistribution: GradeDistribution[] = gradeOrder.map((grade) => ({
    grade,
    count: gradeCounts[grade],
    pct: gradedCount > 0 ? Math.round((gradeCounts[grade] / gradedCount) * 100) : 0,
  }))

  // 10. Category stats (with avg grade per category)
  const catMap = new Map<string, CategoryStat & { scoreSum: number; scoreCount: number }>()
  for (const a of enriched) {
    const cat = a.topic_category ?? 'Other'
    const existing = catMap.get(cat) ?? {
      category: cat,
      forCount: 0,
      againstCount: 0,
      total: 0,
      totalUpvotes: 0,
      avgGrade: null,
      scoreSum: 0,
      scoreCount: 0,
    }
    existing.total++
    existing.totalUpvotes += a.upvotes
    if (a.side === 'blue') existing.forCount++
    else existing.againstCount++
    if (a.ai_score !== null) {
      existing.scoreSum += a.ai_score
      existing.scoreCount++
    }
    catMap.set(cat, existing)
  }
  const categoryStats: CategoryStat[] = Array.from(catMap.values())
    .map(({ scoreSum, scoreCount, ...rest }) => ({
      ...rest,
      avgGrade: scoreCount > 0
        ? Math.round((scoreSum / scoreCount) * 10) / 10
        : null,
    }))
    .sort((a, b) => b.total - a.total)

  // 9. Weekly buckets — last 12 weeks
  const now = new Date()
  const bucketMap = new Map<string, number>()
  // Initialise 12 empty weeks
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    // Move to Monday
    const day = d.getDay()
    d.setDate(d.getDate() - ((day + 6) % 7))
    const key = d.toISOString().slice(0, 10)
    bucketMap.set(key, 0)
  }
  for (const a of enriched) {
    const d = new Date(a.created_at)
    const day = d.getDay()
    d.setDate(d.getDate() - ((day + 6) % 7))
    const key = d.toISOString().slice(0, 10)
    if (bucketMap.has(key)) {
      bucketMap.set(key, (bucketMap.get(key) ?? 0) + 1)
    }
  }
  const weeklyBuckets: WeekBucket[] = Array.from(bucketMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }))

  return NextResponse.json({
    arguments: enriched,
    totalArguments: enriched.length,
    totalUpvotes,
    avgUpvotes,
    sourcedCount,
    forCount,
    againstCount,
    topUpvoted,
    recentArgs,
    topGraded,
    categoryStats,
    weeklyBuckets,
    gradedCount,
    avgAiScore,
    gradeDistribution,
  } satisfies MineResponse)
}
