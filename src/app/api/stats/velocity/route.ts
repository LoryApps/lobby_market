import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VelocityBucket {
  /** UTC hour 0-23, representing the start of this 1-hour window */
  hour: number
  /** Label e.g. "14:00" */
  label: string
  votes: number
  forVotes: number
}

export interface CategoryVelocity {
  category: string
  buckets: VelocityBucket[]
  totalVotes24h: number
  votesLast1h: number
  votesLast6h: number
  avgVotesPerHour: number
  /** Ratio of last-6h rate vs prior-18h rate. >1 means accelerating. */
  momentum: number
  topicCount: number
  forPct24h: number
}

export interface VelocityResponse {
  categories: CategoryVelocity[]
  totalVotes24h: number
  peakCategory: string | null
  peakHour: number | null
  peakHourVotes: number
  generatedAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
] as const

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = new Date()
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Fetch all votes from the last 24 hours with topic category
  // Supabase join: votes -> topics!inner(category)
  const { data: rawVotes, error } = await supabase
    .from('votes')
    .select('side, created_at, topics!inner(category)')
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: true })
    .limit(50000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const votes = rawVotes ?? []

  // ── Build 24 hourly buckets (0 = oldest, 23 = most recent) ───────────────
  // Map: category -> hour index (0-23) -> { votes, forVotes }

  type BucketMap = Map<number, { votes: number; forVotes: number }>
  const byCat = new Map<string, BucketMap>()
  const topicsByCat = new Map<string, Set<string>>()

  for (const vote of votes) {
    const cat = (vote.topics as { category: string | null } | null)?.category
    if (!cat || !(CATEGORIES as readonly string[]).includes(cat)) continue

    // Hour index from cutoff: 0 = first hour (24h ago), 23 = most recent
    const msSinceCutoff = new Date(vote.created_at).getTime() - cutoff.getTime()
    const hourIndex = Math.min(23, Math.floor(msSinceCutoff / (60 * 60 * 1000)))

    if (!byCat.has(cat)) byCat.set(cat, new Map())
    const buckets = byCat.get(cat)!
    if (!buckets.has(hourIndex)) buckets.set(hourIndex, { votes: 0, forVotes: 0 })
    const b = buckets.get(hourIndex)!
    b.votes++
    if (vote.side === 'blue') b.forVotes++

    if (!topicsByCat.has(cat)) topicsByCat.set(cat, new Set())
  }

  // Fetch distinct topic counts per category (separate lightweight query)
  const { data: topicRows } = await supabase
    .from('topics')
    .select('category')
    .in('category', [...CATEGORIES])
    .in('status', ['active', 'voting'])

  const topicCountByCat = new Map<string, number>()
  for (const row of topicRows ?? []) {
    if (!row.category) continue
    topicCountByCat.set(row.category, (topicCountByCat.get(row.category) ?? 0) + 1)
  }

  // ── Build hour labels ─────────────────────────────────────────────────────

  const nowHour = now.getUTCHours()
  function hourLabel(index: number): string {
    const h = (nowHour - 23 + index + 24) % 24
    return `${String(h).padStart(2, '0')}:00`
  }

  // ── Assemble CategoryVelocity per category ────────────────────────────────

  const categories: CategoryVelocity[] = []
  let globalPeakVotes = 0
  let globalPeakCat: string | null = null
  let globalPeakHour: number | null = null

  for (const cat of CATEGORIES) {
    const bucketMap = byCat.get(cat) ?? new Map<number, { votes: number; forVotes: number }>()

    const buckets: VelocityBucket[] = Array.from({ length: 24 }, (_, i) => {
      const b = bucketMap.get(i) ?? { votes: 0, forVotes: 0 }
      return { hour: i, label: hourLabel(i), votes: b.votes, forVotes: b.forVotes }
    })

    const totalVotes24h = buckets.reduce((s, b) => s + b.votes, 0)
    const votesLast1h = buckets[23].votes
    const votesLast6h = buckets.slice(18).reduce((s, b) => s + b.votes, 0)
    const votesFirst18h = buckets.slice(0, 18).reduce((s, b) => s + b.votes, 0)
    const avgVotesPerHour = totalVotes24h / 24
    const rateRecent = votesLast6h / 6
    const rateEarly = votesFirst18h / 18
    const momentum = rateEarly === 0 ? (rateRecent > 0 ? 2 : 1) : rateRecent / rateEarly

    const totalFor = buckets.reduce((s, b) => s + b.forVotes, 0)
    const forPct24h = totalVotes24h > 0 ? (totalFor / totalVotes24h) * 100 : 50

    // Track global peak
    for (const b of buckets) {
      if (b.votes > globalPeakVotes) {
        globalPeakVotes = b.votes
        globalPeakCat = cat
        globalPeakHour = b.hour
      }
    }

    categories.push({
      category: cat,
      buckets,
      totalVotes24h,
      votesLast1h,
      votesLast6h,
      avgVotesPerHour,
      momentum,
      topicCount: topicCountByCat.get(cat) ?? 0,
      forPct24h,
    })
  }

  const totalVotes24h = categories.reduce((s, c) => s + c.totalVotes24h, 0)

  // Sort by total votes descending (most active first)
  categories.sort((a, b) => b.totalVotes24h - a.totalVotes24h)

  return NextResponse.json({
    categories,
    totalVotes24h,
    peakCategory: globalPeakCat,
    peakHour: globalPeakHour,
    peakHourVotes: globalPeakVotes,
    generatedAt: now.toISOString(),
  } satisfies VelocityResponse)
}
