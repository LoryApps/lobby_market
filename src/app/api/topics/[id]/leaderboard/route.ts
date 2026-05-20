import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeaderboardArguer {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  argument_count: number
  total_upvotes: number
  for_upvotes: number
  against_upvotes: number
  dominant_side: 'for' | 'against' | 'mixed'
  best_ai_grade: string | null
  avg_ai_score: number | null
  reply_count: number
  rank: number
}

export interface LeaderboardPredictor {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  confidence: number
  predicted_law: boolean
  correct: boolean | null
  resolved_at: string | null
  reputation_score: number
  rank: number
}

export interface LeaderboardOverall {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  total_upvotes: number
  argument_count: number
  prediction_correct: boolean | null
  argument_rank: number | null
  predictor_rank: number | null
  impact_score: number
  rank: number
}

export interface TopicLeaderboardResponse {
  topic: {
    id: string
    statement: string
    status: string
    blue_pct: number
    total_votes: number
  }
  arguers: LeaderboardArguer[]
  predictors: LeaderboardPredictor[]
  overall: LeaderboardOverall[]
  totals: {
    total_arguers: number
    total_predictors: number
    total_arguments: number
  }
}

// ─── AI grade ordering ────────────────────────────────────────────────────────

const GRADE_ORDER: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 }

function gradeScore(grade: string | null): number {
  return grade ? (GRADE_ORDER[grade] ?? 0) : 0
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const topicId = params.id

  // Parallel fetch: topic info, arguments, predictions
  const [topicRes, argsRes, predsRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, status, blue_pct, total_votes')
      .eq('id', topicId)
      .single(),

    supabase
      .from('topic_arguments')
      .select('id, user_id, side, upvotes, ai_score, ai_grade')
      .eq('topic_id', topicId),

    supabase
      .from('predictions')
      .select('user_id, confidence, predicted_law, correct, resolved_at')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: false }),
  ])

  if (topicRes.error || !topicRes.data) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const topic = topicRes.data
  const args = argsRes.data ?? []
  const preds = predsRes.data ?? []

  // ── Argument reply counts ───────────────────────────────────────────────────
  const argIds = args.map((a) => a.id)
  const replyCounts: Record<string, number> = {}
  if (argIds.length > 0) {
    const { data: replies } = await supabase
      .from('argument_replies')
      .select('argument_id')
      .in('argument_id', argIds)

    for (const r of replies ?? []) {
      replyCounts[r.argument_id] = (replyCounts[r.argument_id] ?? 0) + 1
    }
  }

  // ── Aggregate arguments per user ───────────────────────────────────────────
  type ArgAgg = {
    for_upvotes: number
    against_upvotes: number
    argument_count: number
    reply_count: number
    best_grade: string | null
    ai_score_sum: number
    ai_score_count: number
  }
  const argByUser = new Map<string, ArgAgg>()

  for (const arg of args) {
    const uid = arg.user_id as string
    const existing = argByUser.get(uid) ?? {
      for_upvotes: 0,
      against_upvotes: 0,
      argument_count: 0,
      reply_count: 0,
      best_grade: null,
      ai_score_sum: 0,
      ai_score_count: 0,
    }

    const upvotes = (arg.upvotes as number) ?? 0
    const replies = replyCounts[arg.id] ?? 0

    if (arg.side === 'blue') existing.for_upvotes += upvotes
    else existing.against_upvotes += upvotes

    existing.argument_count += 1
    existing.reply_count += replies

    const grade = arg.ai_grade as string | null
    if (grade && gradeScore(grade) > gradeScore(existing.best_grade)) {
      existing.best_grade = grade
    }

    if (arg.ai_score != null) {
      existing.ai_score_sum += arg.ai_score as number
      existing.ai_score_count += 1
    }

    argByUser.set(uid, existing)
  }

  // ── Aggregate predictions per user (most recent per user) ─────────────────
  const predByUser = new Map<string, typeof preds[0]>()
  for (const p of preds) {
    if (!predByUser.has(p.user_id)) predByUser.set(p.user_id, p)
  }

  // ── Collect all user IDs ───────────────────────────────────────────────────
  const allUserIds = new Set([
    ...argByUser.keys(),
    ...predByUser.keys(),
  ])

  if (allUserIds.size === 0) {
    return NextResponse.json({
      topic,
      arguers: [],
      predictors: [],
      overall: [],
      totals: { total_arguers: 0, total_predictors: 0, total_arguments: 0 },
    } satisfies TopicLeaderboardResponse)
  }

  // ── Batch-fetch profiles ───────────────────────────────────────────────────
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, reputation_score')
    .in('id', Array.from(allUserIds))

  const profileMap = new Map<string, (typeof profiles)[0]>()
  for (const p of profiles ?? []) {
    profileMap.set(p.id, p)
  }

  // ── Build arguer list ──────────────────────────────────────────────────────
  const arguersUnsorted: Omit<LeaderboardArguer, 'rank'>[] = []
  for (const [uid, stats] of argByUser.entries()) {
    const prof = profileMap.get(uid)
    if (!prof) continue
    const totalUp = stats.for_upvotes + stats.against_upvotes
    const dominant: 'for' | 'against' | 'mixed' =
      stats.for_upvotes > stats.against_upvotes
        ? 'for'
        : stats.against_upvotes > stats.for_upvotes
        ? 'against'
        : 'mixed'

    arguersUnsorted.push({
      user_id: uid,
      username: prof.username,
      display_name: prof.display_name,
      avatar_url: prof.avatar_url,
      role: prof.role,
      argument_count: stats.argument_count,
      total_upvotes: totalUp,
      for_upvotes: stats.for_upvotes,
      against_upvotes: stats.against_upvotes,
      dominant_side: dominant,
      best_ai_grade: stats.best_grade,
      avg_ai_score: stats.ai_score_count > 0
        ? Math.round((stats.ai_score_sum / stats.ai_score_count) * 10) / 10
        : null,
      reply_count: stats.reply_count,
    })
  }

  // Sort by total_upvotes desc, then argument_count desc, then reply_count desc
  arguersUnsorted.sort(
    (a, b) =>
      b.total_upvotes - a.total_upvotes ||
      b.argument_count - a.argument_count ||
      b.reply_count - a.reply_count
  )

  const arguers: LeaderboardArguer[] = arguersUnsorted
    .slice(0, 20)
    .map((a, i) => ({ ...a, rank: i + 1 }))

  // ── Build predictor list ───────────────────────────────────────────────────
  const predictorsUnsorted: Omit<LeaderboardPredictor, 'rank'>[] = []
  for (const [uid, pred] of predByUser.entries()) {
    const prof = profileMap.get(uid)
    if (!prof) continue
    predictorsUnsorted.push({
      user_id: uid,
      username: prof.username,
      display_name: prof.display_name,
      avatar_url: prof.avatar_url,
      role: prof.role,
      confidence: pred.confidence as number,
      predicted_law: pred.predicted_law as boolean,
      correct: pred.correct as boolean | null,
      resolved_at: pred.resolved_at as string | null,
      reputation_score: prof.reputation_score,
    })
  }

  // Sort: correct predictions first (desc confidence), then unresolved (desc confidence), then wrong
  predictorsUnsorted.sort((a, b) => {
    if (a.correct === true && b.correct !== true) return -1
    if (b.correct === true && a.correct !== true) return 1
    if (a.correct === null && b.correct !== null) return -1
    if (b.correct === null && a.correct !== null) return 1
    return b.confidence - a.confidence
  })

  const predictors: LeaderboardPredictor[] = predictorsUnsorted
    .slice(0, 20)
    .map((p, i) => ({ ...p, rank: i + 1 }))

  // ── Build overall list (union of arguers and predictors) ───────────────────
  const overallMap = new Map<string, {
    total_upvotes: number
    argument_count: number
    prediction_correct: boolean | null
    argument_rank: number | null
    predictor_rank: number | null
  }>()

  for (const arguer of arguers) {
    overallMap.set(arguer.user_id, {
      total_upvotes: arguer.total_upvotes,
      argument_count: arguer.argument_count,
      prediction_correct: null,
      argument_rank: arguer.rank,
      predictor_rank: null,
    })
  }

  for (const pred of predictors) {
    const existing = overallMap.get(pred.user_id)
    if (existing) {
      existing.prediction_correct = pred.correct
      existing.predictor_rank = pred.rank
    } else {
      overallMap.set(pred.user_id, {
        total_upvotes: 0,
        argument_count: 0,
        prediction_correct: pred.correct,
        argument_rank: null,
        predictor_rank: pred.rank,
      })
    }
  }

  // Compute impact score: upvotes×2 + argument_count×5 + prediction bonus
  const overallUnsorted: Omit<LeaderboardOverall, 'rank'>[] = []
  for (const [uid, stats] of overallMap.entries()) {
    const prof = profileMap.get(uid)
    if (!prof) continue
    const predBonus = stats.prediction_correct === true ? 30 : 0
    const impactScore =
      stats.total_upvotes * 2 +
      stats.argument_count * 5 +
      predBonus

    overallUnsorted.push({
      user_id: uid,
      username: prof.username,
      display_name: prof.display_name,
      avatar_url: prof.avatar_url,
      role: prof.role,
      total_upvotes: stats.total_upvotes,
      argument_count: stats.argument_count,
      prediction_correct: stats.prediction_correct,
      argument_rank: stats.argument_rank,
      predictor_rank: stats.predictor_rank,
      impact_score: impactScore,
    })
  }

  overallUnsorted.sort((a, b) => b.impact_score - a.impact_score)

  const overall: LeaderboardOverall[] = overallUnsorted
    .slice(0, 20)
    .map((o, i) => ({ ...o, rank: i + 1 }))

  return NextResponse.json({
    topic,
    arguers,
    predictors,
    overall,
    totals: {
      total_arguers: argByUser.size,
      total_predictors: predByUser.size,
      total_arguments: args.length,
    },
  } satisfies TopicLeaderboardResponse, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  })
}
