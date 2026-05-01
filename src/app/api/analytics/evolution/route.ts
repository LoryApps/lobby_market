import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeeklySnapshot {
  week: string        // ISO date of the week-start (Monday)
  weekLabel: string   // "Week of Jan 6"
  total: number
  blue: number
  forPct: number
}

export interface CategoryEvolution {
  category: string
  color: string
  weeks: WeeklySnapshot[]
  currentForPct: number   // last 2-week rolling avg
  historicForPct: number  // overall average across all weeks
  drift: number           // currentForPct - historicForPct (positive = trending more FOR)
  totalVotes: number
  flipCount: number       // weeks where for/against flipped relative to prior week
}

export interface EvolutionSummary {
  biggestGainer: string | null   // category trending most toward FOR
  biggestLoser: string | null    // category trending most toward AGAINST
  mostStable: string | null      // category with lowest variance
  mostVolatile: string | null    // category with highest variance
  totalWeeksActive: number       // weeks with at least one vote
  overallDrift: number           // across all categories
}

export interface EvolutionResponse {
  categories: CategoryEvolution[]
  summary: EvolutionSummary
  weeksBack: number
}

// ─── Category colours matching Tailwind theme ─────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics:    '#c9a84c',   // gold
  Politics:     '#3b82f6',   // for-500
  Technology:   '#8b5cf6',   // purple
  Science:      '#10b981',   // emerald
  Ethics:       '#ef4444',   // against-500
  Philosophy:   '#a78bfa',   // violet
  Culture:      '#f59e0b',   // amber
  Health:       '#ec4899',   // pink
  Environment:  '#22c55e',   // green
  Education:    '#06b6d4',   // cyan
}

const DEFAULT_COLOR = '#6b7280'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay()
  // Monday-based weeks
  const diff = (day === 0 ? -6 : 1 - day)
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function weekLabel(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

// ─── GET /api/analytics/evolution ─────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 12 weeks back from now
  const WEEKS_BACK = 12
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - WEEKS_BACK * 7)

  // Fetch all user votes in the window, with topic category
  const { data: rawVotes, error } = await supabase
    .from('votes')
    .select('side, created_at, topics!inner(category)')
    .eq('user_id', user.id)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 })
  }

  // Normalise: flatten the topic category onto each vote row
  type VoteRow = { side: string; created_at: string; category: string | null }
  const votes: VoteRow[] = (rawVotes ?? []).map((v) => {
    const topicRaw = v.topics as unknown
    let category: string | null = null
    if (topicRaw && typeof topicRaw === 'object') {
      const t = topicRaw as { category?: string | null }
      category = t.category ?? null
    }
    return { side: v.side as string, created_at: v.created_at, category }
  })

  // Build the 12 weekly bucket labels (week-start Mondays, most recent last)
  const weekStarts: string[] = []
  for (let i = WEEKS_BACK - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    const ws = getWeekStart(d)
    weekStarts.push(ws.toISOString().slice(0, 10))
  }
  // Deduplicate while preserving order
  const uniqueWeekStarts = Array.from(new Set(weekStarts))

  // Group votes: category → week → { blue, total }
  type WeekBucket = { blue: number; total: number }
  const buckets: Record<string, Record<string, WeekBucket>> = {}

  for (const vote of votes) {
    const cat = vote.category ?? 'Uncategorized'
    const ws = getWeekStart(new Date(vote.created_at)).toISOString().slice(0, 10)
    if (!buckets[cat]) buckets[cat] = {}
    if (!buckets[cat][ws]) buckets[cat][ws] = { blue: 0, total: 0 }
    buckets[cat][ws].total++
    if (vote.side === 'blue') buckets[cat][ws].blue++
  }

  // Collect only categories with enough votes (≥3 total)
  const activeCategories = Object.entries(buckets)
    .filter(([, wks]) => Object.values(wks).reduce((s, w) => s + w.total, 0) >= 3)
    .map(([cat]) => cat)
    .sort()

  // Build CategoryEvolution for each active category
  const categories: CategoryEvolution[] = activeCategories.map((cat) => {
    const catBuckets = buckets[cat] ?? {}

    const weeks: WeeklySnapshot[] = uniqueWeekStarts.map((ws) => {
      const bucket = catBuckets[ws] ?? { blue: 0, total: 0 }
      return {
        week: ws,
        weekLabel: `Week of ${weekLabel(ws)}`,
        total: bucket.total,
        blue: bucket.blue,
        forPct: bucket.total > 0 ? Math.round((bucket.blue / bucket.total) * 100) : -1,
      }
    })

    // Active weeks only (those with votes)
    const activeWeeks = weeks.filter((w) => w.total > 0)
    const totalVotes = activeWeeks.reduce((s, w) => s + w.total, 0)

    // Current FOR% = rolling avg of last 2 active weeks
    const recentWeeks = activeWeeks.slice(-2)
    const recentBlue = recentWeeks.reduce((s, w) => s + w.blue, 0)
    const recentTotal = recentWeeks.reduce((s, w) => s + w.total, 0)
    const currentForPct = recentTotal > 0 ? Math.round((recentBlue / recentTotal) * 100) : 50

    // Historic FOR% = all-time average
    const allBlue = activeWeeks.reduce((s, w) => s + w.blue, 0)
    const historicForPct = totalVotes > 0 ? Math.round((allBlue / totalVotes) * 100) : 50

    const drift = currentForPct - historicForPct

    // Count "flip" weeks — where the lean (>50 vs <50) changed relative to prior active week
    let flipCount = 0
    for (let i = 1; i < activeWeeks.length; i++) {
      const prev = activeWeeks[i - 1].forPct
      const curr = activeWeeks[i].forPct
      if (prev !== -1 && curr !== -1 && ((prev >= 50) !== (curr >= 50))) {
        flipCount++
      }
    }

    return {
      category: cat,
      color: CATEGORY_COLOR[cat] ?? DEFAULT_COLOR,
      weeks,
      currentForPct,
      historicForPct,
      drift,
      totalVotes,
      flipCount,
    }
  })

  // Summary
  const withDrift = categories.filter((c) => c.totalVotes >= 5)
  const sorted = [...withDrift].sort((a, b) => b.drift - a.drift)

  const forPctStdDevs = categories.map((c) => ({
    cat: c.category,
    sd: stdDev(c.weeks.filter((w) => w.forPct !== -1).map((w) => w.forPct)),
  }))
  const sortedByVariance = [...forPctStdDevs].sort((a, b) => a.sd - b.sd)

  const totalWeeksActive = new Set(
    votes.map((v) => getWeekStart(new Date(v.created_at)).toISOString().slice(0, 10))
  ).size

  const overallDrift =
    categories.length > 0
      ? Math.round(categories.reduce((s, c) => s + c.drift, 0) / categories.length)
      : 0

  const summary: EvolutionSummary = {
    biggestGainer: sorted[0]?.category ?? null,
    biggestLoser: sorted[sorted.length - 1]?.category ?? null,
    mostStable: sortedByVariance[0]?.cat ?? null,
    mostVolatile: sortedByVariance[sortedByVariance.length - 1]?.cat ?? null,
    totalWeeksActive,
    overallDrift,
  }

  return NextResponse.json({
    categories,
    summary,
    weeksBack: WEEKS_BACK,
  } satisfies EvolutionResponse)
}
