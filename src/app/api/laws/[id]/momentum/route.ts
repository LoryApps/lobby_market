import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MomentumWeek {
  week: string          // ISO date of week start (YYYY-MM-DD)
  amendments: number   // amendment proposals that week
  wiki_edits: number   // wiki edits that week
  reviews: number      // reviews left that week
  avg_stars: number    // average stars that week (0 if no reviews)
}

export interface LawMomentumData {
  law: {
    id: string
    statement: string
    category: string | null
    scope: string | null
    established_at: string
    total_votes: number
    blue_pct: number
  }
  aggregate: {
    total_amendments: number
    ratified_amendments: number
    total_wiki_edits: number
    total_reviews: number
    avg_stars: number | null
    days_since_established: number
  }
  weekly: MomentumWeek[]
  momentum_score: number   // 0-100: composite of engagement velocity
  momentum_label: string
  momentum_dir: 'rising' | 'falling' | 'stable'
  top_amendment: {
    id: string
    title: string
    status: string
    for_count: number
    against_count: number
    created_at: string
  } | null
}

// ─── GET /api/laws/[id]/momentum ──────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const lawId = params.id

  // ── Law metadata ─────────────────────────────────────────────────────────────
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select('id, statement, category, scope, established_at, total_votes, blue_pct')
    .eq('id', lawId)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // ── Amendment history ─────────────────────────────────────────────────────────
  const { data: amendments } = await supabase
    .from('law_amendments')
    .select('id, title, status, for_count, against_count, created_at')
    .eq('law_id', lawId)
    .order('created_at', { ascending: false })

  const amendmentList = amendments ?? []

  // ── Wiki edit history ─────────────────────────────────────────────────────────
  const { data: wikiEdits } = await supabase
    .from('law_wiki_history')
    .select('id, created_at')
    .eq('law_id', lawId)
    .order('created_at', { ascending: true })

  const wikiList = wikiEdits ?? []

  // ── Review history ────────────────────────────────────────────────────────────
  const { data: reviews } = await supabase
    .from('law_reviews')
    .select('id, stars, created_at')
    .eq('law_id', lawId)
    .order('created_at', { ascending: true })

  const reviewList = reviews ?? []

  // ── Build weekly buckets ──────────────────────────────────────────────────────
  const established = new Date(law.established_at)
  const now = new Date()

  // Build a map of week-start (Monday) → bucket
  const weekMap = new Map<string, MomentumWeek>()

  function weekStart(d: Date): string {
    const copy = new Date(d)
    const day = copy.getUTCDay()
    // Shift to Monday
    copy.setUTCDate(copy.getUTCDate() - ((day + 6) % 7))
    copy.setUTCHours(0, 0, 0, 0)
    return copy.toISOString().slice(0, 10)
  }

  function getOrCreate(weekKey: string): MomentumWeek {
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        week: weekKey,
        amendments: 0,
        wiki_edits: 0,
        reviews: 0,
        avg_stars: 0,
      })
    }
    return weekMap.get(weekKey)!
  }

  for (const a of amendmentList) {
    const w = weekStart(new Date(a.created_at))
    getOrCreate(w).amendments++
  }

  for (const w of wikiList) {
    const wk = weekStart(new Date(w.created_at))
    getOrCreate(wk).wiki_edits++
  }

  // For reviews, accumulate stars then average later
  const reviewStarsMap = new Map<string, { sum: number; count: number }>()
  for (const r of reviewList) {
    const wk = weekStart(new Date(r.created_at))
    getOrCreate(wk).reviews++
    const entry = reviewStarsMap.get(wk) ?? { sum: 0, count: 0 }
    entry.sum += r.stars
    entry.count++
    reviewStarsMap.set(wk, entry)
  }

  // Finalise avg_stars per week
  for (const [wk, { sum, count }] of reviewStarsMap) {
    const bucket = weekMap.get(wk)
    if (bucket) bucket.avg_stars = Math.round((sum / count) * 10) / 10
  }

  // Fill gaps so chart is continuous from establishment week to today
  const establishedWeek = weekStart(established)
  const currentWeek = weekStart(now)
  {
    const cursor = new Date(establishedWeek)
    while (cursor.toISOString().slice(0, 10) <= currentWeek) {
      const key = cursor.toISOString().slice(0, 10)
      getOrCreate(key)
      cursor.setUTCDate(cursor.getUTCDate() + 7)
    }
  }

  const weekly = Array.from(weekMap.values()).sort((a, b) =>
    a.week.localeCompare(b.week)
  )

  // ── Aggregate stats ───────────────────────────────────────────────────────────
  const totalAmendments = amendmentList.length
  const ratifiedAmendments = amendmentList.filter((a) => a.status === 'ratified').length
  const totalWikiEdits = wikiList.length
  const totalReviews = reviewList.length
  const avgStars = totalReviews > 0
    ? reviewList.reduce((s, r) => s + r.stars, 0) / totalReviews
    : null
  const daysSince = Math.max(
    1,
    Math.floor((now.getTime() - established.getTime()) / 86_400_000)
  )

  // ── Momentum score (0-100) ────────────────────────────────────────────────────
  // Based on activity in the last 28 days vs the first 28 days
  const cutoff28 = new Date(now.getTime() - 28 * 86_400_000)
  const cutoff56 = new Date(now.getTime() - 56 * 86_400_000)

  function activityInRange(from: Date, to: Date): number {
    const amendments28 = amendmentList.filter((a) => {
      const d = new Date(a.created_at)
      return d >= from && d < to
    }).length
    const wikis28 = wikiList.filter((w) => {
      const d = new Date(w.created_at)
      return d >= from && d < to
    }).length
    const reviews28 = reviewList.filter((r) => {
      const d = new Date(r.created_at)
      return d >= from && d < to
    }).length
    return amendments28 * 3 + wikis28 * 1 + reviews28 * 2
  }

  const recentActivity = activityInRange(cutoff28, now)
  const priorActivity = activityInRange(cutoff56, cutoff28)

  // Normalize: high activity = high score
  const maxExpected = 30 // generous ceiling per 28-day window
  const rawScore = Math.min(100, (recentActivity / maxExpected) * 100)
  const momentumScore = Math.round(rawScore)

  let momentumDir: 'rising' | 'falling' | 'stable' = 'stable'
  if (recentActivity > priorActivity * 1.2) momentumDir = 'rising'
  else if (recentActivity < priorActivity * 0.8 && priorActivity > 0) momentumDir = 'falling'

  let momentumLabel = 'Stable'
  if (momentumScore >= 70) momentumLabel = momentumDir === 'falling' ? 'Fading' : 'High Traction'
  else if (momentumScore >= 40) momentumLabel = momentumDir === 'rising' ? 'Building' : 'Moderate'
  else if (momentumScore >= 15) momentumLabel = 'Low Activity'
  else momentumLabel = 'Dormant'

  // ── Top amendment ─────────────────────────────────────────────────────────────
  const topAmendment = amendmentList.length > 0 ? {
    id: amendmentList[0].id,
    title: amendmentList[0].title,
    status: amendmentList[0].status,
    for_count: amendmentList[0].for_count,
    against_count: amendmentList[0].against_count,
    created_at: amendmentList[0].created_at,
  } : null

  const response: LawMomentumData = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      scope: law.scope,
      established_at: law.established_at,
      total_votes: law.total_votes,
      blue_pct: law.blue_pct,
    },
    aggregate: {
      total_amendments: totalAmendments,
      ratified_amendments: ratifiedAmendments,
      total_wiki_edits: totalWikiEdits,
      total_reviews: totalReviews,
      avg_stars: avgStars !== null ? Math.round(avgStars * 10) / 10 : null,
      days_since_established: daysSince,
    },
    weekly,
    momentum_score: momentumScore,
    momentum_label: momentumLabel,
    momentum_dir: momentumDir,
    top_amendment: topAmendment,
  }

  return NextResponse.json(response)
}
