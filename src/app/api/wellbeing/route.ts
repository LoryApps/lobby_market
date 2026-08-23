import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type WellbeingPeriod = '7d' | '30d' | '90d'

export interface DailyWellbeingPoint {
  date: string          // "YYYY-MM-DD"
  label: string         // e.g. "Mon 14"
  quality_score: number // 0–100 argument quality composite
  positive_mood_pct: number // % of mood reactions that were positive
  polarization: number  // 0–100 where 100 = fully polarised (50/50 splits dominate)
  engagement: number    // arguments per 100 votes
}

export interface WellbeingDimension {
  key: string
  label: string
  current: number   // 0–100
  previous: number  // 0–100 (prior period)
  delta: number     // current - previous
  trend: 'improving' | 'stable' | 'declining'
  description: string
}

export interface WellbeingReport {
  period: WellbeingPeriod
  overall_score: number    // weighted composite 0–100
  overall_label: string    // "Thriving" | "Healthy" | "Fair" | "Struggling"
  overall_delta: number    // change vs prior period

  dimensions: WellbeingDimension[]
  daily: DailyWellbeingPoint[]

  // Highlights
  best_day: string | null   // ISO date with highest composite score
  worst_day: string | null  // ISO date with lowest composite score

  // Context counts
  total_arguments: number
  total_mood_reactions: number
  total_thesis_resolved: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return `${days[d.getUTCDay()]} ${d.getUTCDate()}`
}

function wellbeingLabel(score: number): string {
  if (score >= 75) return 'Thriving'
  if (score >= 55) return 'Healthy'
  if (score >= 35) return 'Fair'
  return 'Struggling'
}

function trend(delta: number): 'improving' | 'stable' | 'declining' {
  if (delta >= 3) return 'improving'
  if (delta <= -3) return 'declining'
  return 'stable'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse<WellbeingReport>> {
  const period = (req.nextUrl.searchParams.get('period') ?? '30d') as WellbeingPeriod
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30

  const supabase = await createClient()
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - days)
  const prevCutoff = new Date(cutoff)
  prevCutoff.setDate(prevCutoff.getDate() - days)

  const cutoffISO = cutoff.toISOString()
  const prevCutoffISO = prevCutoff.toISOString()
  const nowISO = now.toISOString()

  // ── 1. Argument quality ───────────────────────────────────────────────────
  const [{ data: argsNow }, { data: argsPrev }] = await Promise.all([
    supabase
      .from('arguments')
      .select('ai_score, created_at')
      .gte('created_at', cutoffISO)
      .lte('created_at', nowISO)
      .not('ai_score', 'is', null),
    supabase
      .from('arguments')
      .select('ai_score, created_at')
      .gte('created_at', prevCutoffISO)
      .lt('created_at', cutoffISO)
      .not('ai_score', 'is', null),
  ])

  const qualityNow =
    argsNow && argsNow.length > 0
      ? Math.min(
          100,
          Math.round(
            ((argsNow as { ai_score: number }[]).reduce(
              (s, a) => s + (a.ai_score ?? 0),
              0,
            ) /
              argsNow.length) *
              20,
          ),
        )
      : 50

  const qualityPrev =
    argsPrev && argsPrev.length > 0
      ? Math.min(
          100,
          Math.round(
            ((argsPrev as { ai_score: number }[]).reduce(
              (s, a) => s + (a.ai_score ?? 0),
              0,
            ) /
              argsPrev.length) *
              20,
          ),
        )
      : 50

  // ── 2. Mood health ────────────────────────────────────────────────────────
  const POSITIVE_MOODS = ['hopeful', 'inspired', 'proud', 'determined', 'relieved']

  const [{ data: moodsNow }, { data: moodsPrev }] = await Promise.all([
    supabase
      .from('topic_moods')
      .select('mood')
      .gte('created_at', cutoffISO)
      .lte('created_at', nowISO),
    supabase
      .from('topic_moods')
      .select('mood')
      .gte('created_at', prevCutoffISO)
      .lt('created_at', cutoffISO),
  ])

  const moodHealthNow =
    moodsNow && moodsNow.length > 0
      ? Math.round(
          (moodsNow.filter((m: { mood: string }) =>
            POSITIVE_MOODS.includes(m.mood),
          ).length /
            moodsNow.length) *
            100,
        )
      : 50

  const moodHealthPrev =
    moodsPrev && moodsPrev.length > 0
      ? Math.round(
          (moodsPrev.filter((m: { mood: string }) =>
            POSITIVE_MOODS.includes(m.mood),
          ).length /
            moodsPrev.length) *
            100,
        )
      : 50

  // ── 3. Consensus health (low polarisation = healthy) ─────────────────────
  const [{ data: topicsNow }, { data: topicsPrev }] = await Promise.all([
    supabase
      .from('topics')
      .select('blue_pct, total_votes')
      .in('status', ['active', 'voting', 'law', 'failed'])
      .gte('updated_at', cutoffISO),
    supabase
      .from('topics')
      .select('blue_pct, total_votes')
      .in('status', ['active', 'voting', 'law', 'failed'])
      .gte('updated_at', prevCutoffISO)
      .lt('updated_at', cutoffISO),
  ])

  // polarisation = how close to 50/50 topics are (0 = not polarised, 100 = all at 50)
  const polarise = (rows: { blue_pct: number; total_votes: number }[] | null) => {
    if (!rows || rows.length === 0) return 50
    const weighted = rows.reduce((s, t) => {
      const dist = Math.abs((t.blue_pct ?? 50) - 50)
      return s + (50 - dist) // 50 = fully polarised, 0 = one-sided
    }, 0)
    return Math.round((weighted / rows.length / 50) * 100)
  }

  const polarisationNow = polarise(
    topicsNow as { blue_pct: number; total_votes: number }[] | null,
  )
  const polarisationPrev = polarise(
    topicsPrev as { blue_pct: number; total_votes: number }[] | null,
  )
  // Consensus health = inverse of polarisation (less polarised = better)
  const consensusNow = 100 - polarisationNow
  const consensusPrev = 100 - polarisationPrev

  // ── 4. Engagement depth (arguers per voter) ───────────────────────────────
  const [{ count: voteCountNow }, { count: argCountNow }, { count: voteCountPrev }, { count: argCountPrev }] =
    await Promise.all([
      supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', cutoffISO),
      supabase
        .from('arguments')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', cutoffISO),
      supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', prevCutoffISO)
        .lt('created_at', cutoffISO),
      supabase
        .from('arguments')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', prevCutoffISO)
        .lt('created_at', cutoffISO),
    ])

  const engagementNow =
    voteCountNow && voteCountNow > 0
      ? Math.min(100, Math.round(((argCountNow ?? 0) / voteCountNow) * 1000))
      : 0
  const engagementPrev =
    voteCountPrev && voteCountPrev > 0
      ? Math.min(100, Math.round(((argCountPrev ?? 0) / voteCountPrev) * 1000))
      : 0

  // ── 5. Thesis accuracy ───────────────────────────────────────────────────
  const [{ data: thesisNow }, { data: thesisPrev }] = await Promise.all([
    supabase
      .from('civic_theses')
      .select('status')
      .in('status', ['vindicated', 'refuted'])
      .gte('resolved_at', cutoffISO),
    supabase
      .from('civic_theses')
      .select('status')
      .in('status', ['vindicated', 'refuted'])
      .gte('resolved_at', prevCutoffISO)
      .lt('resolved_at', cutoffISO),
  ])

  const thesisAccuracyNow =
    thesisNow && thesisNow.length > 0
      ? Math.round(
          (thesisNow.filter((t: { status: string }) => t.status === 'vindicated')
            .length /
            thesisNow.length) *
            100,
        )
      : 50

  const thesisAccuracyPrev =
    thesisPrev && thesisPrev.length > 0
      ? Math.round(
          (thesisPrev.filter((t: { status: string }) => t.status === 'vindicated')
            .length /
            thesisPrev.length) *
            100,
        )
      : 50

  // ── 6. Compute composite overall score ────────────────────────────────────
  const weights = {
    quality: 0.25,
    mood: 0.20,
    consensus: 0.25,
    engagement: 0.15,
    thesis: 0.15,
  }

  const overallNow = Math.round(
    qualityNow * weights.quality +
      moodHealthNow * weights.mood +
      consensusNow * weights.consensus +
      engagementNow * weights.engagement +
      thesisAccuracyNow * weights.thesis,
  )

  const overallPrev = Math.round(
    qualityPrev * weights.quality +
      moodHealthPrev * weights.mood +
      consensusPrev * weights.consensus +
      engagementPrev * weights.engagement +
      thesisAccuracyPrev * weights.thesis,
  )

  const overallDelta = overallNow - overallPrev

  // ── 7. Build daily trend ──────────────────────────────────────────────────
  // For daily trend we bucket arguments by day for a simplified quality proxy
  const { data: dailyArgs } = await supabase
    .from('arguments')
    .select('ai_score, created_at')
    .gte('created_at', cutoffISO)
    .lte('created_at', nowISO)
    .order('created_at', { ascending: true })

  const { data: dailyMoods } = await supabase
    .from('topic_moods')
    .select('mood, created_at')
    .gte('created_at', cutoffISO)
    .lte('created_at', nowISO)

  const { data: dailyVotes } = await supabase
    .from('votes')
    .select('created_at')
    .gte('created_at', cutoffISO)
    .lte('created_at', nowISO)

  // Build per-day buckets
  const dateMap = new Map<
    string,
    {
      args: number[]
      moods_pos: number
      moods_total: number
      votes: number
      arg_count: number
    }
  >()

  const startDate = new Date(cutoff)
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    dateMap.set(key, { args: [], moods_pos: 0, moods_total: 0, votes: 0, arg_count: 0 })
  }

  ;(dailyArgs ?? []).forEach((a: { ai_score: number | null; created_at: string }) => {
    const key = a.created_at.slice(0, 10)
    const bucket = dateMap.get(key)
    if (bucket && a.ai_score != null) {
      bucket.args.push(a.ai_score)
      bucket.arg_count++
    }
  })

  ;(dailyMoods ?? []).forEach((m: { mood: string; created_at: string }) => {
    const key = m.created_at.slice(0, 10)
    const bucket = dateMap.get(key)
    if (bucket) {
      bucket.moods_total++
      if (POSITIVE_MOODS.includes(m.mood)) bucket.moods_pos++
    }
  })

  ;(dailyVotes ?? []).forEach((v: { created_at: string }) => {
    const key = v.created_at.slice(0, 10)
    const bucket = dateMap.get(key)
    if (bucket) bucket.votes++
  })

  const daily: DailyWellbeingPoint[] = []
  for (const [date, b] of dateMap.entries()) {
    const q =
      b.args.length > 0
        ? Math.min(100, Math.round((b.args.reduce((s, v) => s + v, 0) / b.args.length) * 20))
        : 50
    const m = b.moods_total > 0 ? Math.round((b.moods_pos / b.moods_total) * 100) : 50
    const e =
      b.votes > 0 ? Math.min(100, Math.round((b.arg_count / b.votes) * 1000)) : 0

    daily.push({
      date,
      label: dayLabel(date),
      quality_score: q,
      positive_mood_pct: m,
      polarization: 50, // static placeholder for daily granularity
      engagement: e,
    })
  }

  // Sort by date
  daily.sort((a, b) => a.date.localeCompare(b.date))

  // Best / worst day by composite of quality + mood
  let bestDay: string | null = null
  let worstDay: string | null = null
  if (daily.length > 0) {
    const scored = daily.map((d) => ({
      date: d.date,
      score: d.quality_score * 0.6 + d.positive_mood_pct * 0.4,
    }))
    bestDay = scored.reduce((a, b) => (b.score > a.score ? b : a)).date
    worstDay = scored.reduce((a, b) => (b.score < a.score ? b : a)).date
  }

  // ── 8. Assemble dimensions ────────────────────────────────────────────────
  const dimensions: WellbeingDimension[] = [
    {
      key: 'quality',
      label: 'Argument Quality',
      current: qualityNow,
      previous: qualityPrev,
      delta: qualityNow - qualityPrev,
      trend: trend(qualityNow - qualityPrev),
      description: 'Average quality score of arguments written during the period.',
    },
    {
      key: 'mood',
      label: 'Community Mood',
      current: moodHealthNow,
      previous: moodHealthPrev,
      delta: moodHealthNow - moodHealthPrev,
      trend: trend(moodHealthNow - moodHealthPrev),
      description: 'Share of mood reactions that were positive (hopeful, inspired, etc.).',
    },
    {
      key: 'consensus',
      label: 'Consensus Health',
      current: consensusNow,
      previous: consensusPrev,
      delta: consensusNow - consensusPrev,
      trend: trend(consensusNow - consensusPrev),
      description: 'How strongly the community agrees — higher means less deadlock and division.',
    },
    {
      key: 'engagement',
      label: 'Deliberation Depth',
      current: engagementNow,
      previous: engagementPrev,
      delta: engagementNow - engagementPrev,
      trend: trend(engagementNow - engagementPrev),
      description: 'How many arguments are written per 100 votes cast.',
    },
    {
      key: 'thesis',
      label: 'Prediction Accuracy',
      current: thesisAccuracyNow,
      previous: thesisAccuracyPrev,
      delta: thesisAccuracyNow - thesisAccuracyPrev,
      trend: trend(thesisAccuracyNow - thesisAccuracyPrev),
      description: 'Share of resolved civic theses that were vindicated as correct.',
    },
  ]

  const report: WellbeingReport = {
    period,
    overall_score: overallNow,
    overall_label: wellbeingLabel(overallNow),
    overall_delta: overallDelta,
    dimensions,
    daily,
    best_day: bestDay,
    worst_day: worstDay,
    total_arguments: argCountNow ?? 0,
    total_mood_reactions: moodsNow?.length ?? 0,
    total_thesis_resolved: thesisNow?.length ?? 0,
  }

  return NextResponse.json(report)
}
