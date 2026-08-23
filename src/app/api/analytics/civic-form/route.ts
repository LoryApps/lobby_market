import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FormRating = 'on_fire' | 'sharp' | 'steady' | 'cold' | 'dormant'

export interface FormPeriod {
  args_count: number
  avg_score: number | null   // 0–100 AI quality score
  votes_count: number
}

export interface TopArg {
  id: string
  content: string
  ai_score: number | null
  ai_grade: string | null
  side: 'blue' | 'red'
  created_at: string
  topic_statement: string | null
}

export interface WeeklyPoint {
  week: string              // "Aug 4" label
  avg_score: number | null  // null = no scored args that week
  count: number
}

export interface CivicFormData {
  form_rating: FormRating
  form_label: string
  form_desc: string
  form_score: number      // 0–100 composite

  recent: FormPeriod      // last 30 days
  historical: FormPeriod  // 31–90 days ago

  quality_delta: number   // recent avg_score minus historical avg_score
  volume_delta: number    // recent args_count minus historical args_count
  vote_delta: number      // recent votes minus historical votes

  top_recent_args: TopArg[]          // best args from last 30d, up to 5
  weekly_quality: WeeklyPoint[]      // last 6 weeks oldest-first
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avgScore(items: Array<{ ai_score: number | null }>): number | null {
  const scored = items.filter((a) => a.ai_score !== null)
  if (!scored.length) return null
  const sum = scored.reduce((s, a) => s + (a.ai_score ?? 0), 0)
  return Math.round((sum / scored.length) * 10) / 10
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = user.id
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString()

  // Fetch arguments from last 90 days with topic statement via join
  const { data: argsRows } = await supabase
    .from('topic_arguments')
    .select('id, content, ai_score, ai_grade, side, created_at, topics(statement)')
    .eq('user_id', uid)
    .gte('created_at', ninetyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(500)

  // Fetch votes from last 90 days
  const { data: voteRows } = await supabase
    .from('votes')
    .select('created_at')
    .eq('user_id', uid)
    .gte('created_at', ninetyDaysAgo)
    .limit(1000)

  const args = (argsRows ?? []) as Array<{
    id: string
    content: string
    ai_score: number | null
    ai_grade: string | null
    side: 'blue' | 'red'
    created_at: string
    topics: { statement: string } | null
  }>

  const votes = (voteRows ?? []) as Array<{ created_at: string }>

  // ── Split into recent vs historical ────────────────────────────────────────

  const recentArgs = args.filter((a) => a.created_at >= thirtyDaysAgo)
  const historicalArgs = args.filter((a) => a.created_at < thirtyDaysAgo)
  const recentVotes = votes.filter((v) => v.created_at >= thirtyDaysAgo)
  const historicalVotes = votes.filter((v) => v.created_at < thirtyDaysAgo)

  const recent: FormPeriod = {
    args_count: recentArgs.length,
    avg_score: avgScore(recentArgs),
    votes_count: recentVotes.length,
  }

  const historical: FormPeriod = {
    args_count: historicalArgs.length,
    avg_score: avgScore(historicalArgs),
    votes_count: historicalVotes.length,
  }

  const quality_delta =
    recent.avg_score !== null && historical.avg_score !== null
      ? Math.round((recent.avg_score - historical.avg_score) * 10) / 10
      : 0

  const volume_delta = recent.args_count - historical.args_count
  const vote_delta = recent.votes_count - historical.votes_count

  // ── Form score & rating ───────────────────────────────────────────────────

  let form_rating: FormRating
  let form_label: string
  let form_desc: string
  let form_score: number

  const totalActivity = args.length + votes.length

  if (totalActivity === 0) {
    form_rating = 'dormant'
    form_label = 'Not Yet Active'
    form_desc = 'Start voting and writing arguments to see your civic form.'
    form_score = 0
  } else if (recent.args_count === 0 && recent.votes_count < 5) {
    form_rating = 'cold'
    form_label = 'Gone Cold'
    form_desc =
      "You've been quiet lately. Your civic engagement has dropped significantly in the past 30 days."
    form_score = 12
  } else {
    // Composite form score:
    //   50% recent argument quality (0-100 scale)
    //   30% quality delta (centered at 50, ±5 per point delta)
    //   20% recent activity volume (capped at 10 args = 100)
    const qualityScore = recent.avg_score !== null ? recent.avg_score : 50
    const qualityDeltaScore = Math.min(100, Math.max(0, 50 + quality_delta * 5))
    const activityScore = Math.min(100, (recent.args_count / 10) * 100)

    form_score = Math.round(qualityScore * 0.5 + qualityDeltaScore * 0.3 + activityScore * 0.2)
    form_score = Math.min(100, Math.max(0, form_score))

    if (form_score >= 78 && quality_delta >= 0) {
      form_rating = 'on_fire'
      form_label = 'On Fire'
      form_desc =
        "You're at peak civic form. Your arguments are sharper and more frequent than your recent baseline."
    } else if (form_score >= 62 || quality_delta > 3) {
      form_rating = 'sharp'
      form_label = 'Sharp'
      form_desc =
        'Performing above your baseline. Your argument quality has been consistently strong this month.'
    } else if (form_score >= 38) {
      form_rating = 'steady'
      form_label = 'Steady'
      form_desc =
        'Consistent and reliable. Your civic engagement is holding at a solid level.'
    } else {
      form_rating = 'cold'
      form_label = 'Cold'
      form_desc =
        'Your recent engagement is below your usual standard. Time to sharpen up and get back in the debate.'
    }
  }

  // ── Top recent arguments ──────────────────────────────────────────────────

  const top_recent_args: TopArg[] = recentArgs
    .filter((a) => a.ai_score !== null)
    .sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0))
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      content: a.content,
      ai_score: a.ai_score,
      ai_grade: a.ai_grade,
      side: a.side,
      created_at: a.created_at,
      topic_statement: a.topics?.statement ?? null,
    }))

  // ── Weekly quality trend (last 6 weeks) ──────────────────────────────────

  const weekly_quality: WeeklyPoint[] = []
  for (let w = 5; w >= 0; w--) {
    const weekEnd = new Date(now.getTime() - w * 7 * 86400000)
    const weekStart = new Date(weekEnd.getTime() - 7 * 86400000)
    const weekArgs = args.filter((a) => {
      const d = new Date(a.created_at)
      return d >= weekStart && d < weekEnd
    })
    const weekLabel = weekStart.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
    weekly_quality.push({
      week: weekLabel,
      avg_score: avgScore(weekArgs),
      count: weekArgs.length,
    })
  }

  // ── Return ────────────────────────────────────────────────────────────────

  const result: CivicFormData = {
    form_rating,
    form_label,
    form_desc,
    form_score,
    recent,
    historical,
    quality_delta,
    volume_delta,
    vote_delta,
    top_recent_args,
    weekly_quality,
  }

  return NextResponse.json(result)
}
