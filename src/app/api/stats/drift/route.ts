import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 900 // 15 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriftWindow {
  /** Identifying key */
  period: '7d' | '30d' | '90d' | 'all'
  label: string
  avg_for_pct: number   // weighted avg FOR% (0–100)
  vote_count: number    // raw votes in this window
  topic_count: number   // distinct topics in this window
}

export interface CategoryDrift {
  category: string
  windows: DriftWindow[]
  /** 7-day avg minus all-time avg; positive = trending FOR, negative = trending AGAINST */
  drift: number
  drift_direction: 'toward_for' | 'toward_against' | 'stable'
  /** law passage rate 0–100 */
  law_rate: number
  total_topics: number
  total_votes: number
}

export interface DriftResponse {
  categories: CategoryDrift[]
  generated_at: string
  /** ISO of earliest vote used */
  data_from: string
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

const STABLE_THRESHOLD = 3 // %-pts delta to consider "stable"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weightedForPct(votes: Array<{ side: string }>): number {
  if (votes.length === 0) return 50
  const forCount = votes.filter((v) => v.side === 'blue').length
  return Math.round((forCount / votes.length) * 100)
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = Date.now()
  const ms7d = 7 * 24 * 60 * 60 * 1000
  const ms30d = 30 * 24 * 60 * 60 * 1000
  const ms90d = 90 * 24 * 60 * 60 * 1000

  const since90d = new Date(now - ms90d).toISOString()
  const since30d = new Date(now - ms30d).toISOString()
  const since7d = new Date(now - ms7d).toISOString()

  // Fetch topic metadata for all-time stats
  const { data: topicsRaw } = await supabase
    .from('topics')
    .select('id, category, status, blue_pct, total_votes')
    .in('status', ['active', 'voting', 'law', 'failed', 'proposed'])
    .not('category', 'is', null)
    .order('total_votes', { ascending: false })
    .limit(2000)

  const topics = (topicsRaw ?? []) as Array<{
    id: string
    category: string
    status: string
    blue_pct: number
    total_votes: number
  }>

  // Build a map: topicId → category
  const topicCategory = new Map<string, string>()
  for (const t of topics) {
    if (t.category) topicCategory.set(t.id, t.category)
  }

  // Fetch recent votes (last 90d) in one shot — limit to avoid timeouts
  const { data: recentVotesRaw } = await supabase
    .from('votes')
    .select('topic_id, side, created_at')
    .gte('created_at', since90d)
    .limit(50000)

  const recentVotes = (recentVotesRaw ?? []) as Array<{
    topic_id: string
    side: string
    created_at: string
  }>

  // Fetch ALL votes for all-time calculation (just topic_id + side for speed)
  const { data: allVotesRaw } = await supabase
    .from('votes')
    .select('topic_id, side')
    .limit(100000)

  const allVotes = (allVotesRaw ?? []) as Array<{ topic_id: string; side: string }>

  // ── Bucket votes by window ─────────────────────────────────────────────────

  const WINDOWS = [
    { period: '7d' as const, label: 'Last 7 days', cutoff: since7d },
    { period: '30d' as const, label: 'Last 30 days', cutoff: since30d },
    { period: '90d' as const, label: 'Last 90 days', cutoff: since90d },
  ]

  // Per category, per window — votes array
  type CategoryVotes = Map<string, Array<{ side: string }>>
  const windowBuckets: Record<string, CategoryVotes> = {
    '7d': new Map(),
    '30d': new Map(),
    '90d': new Map(),
    'all': new Map(),
  }

  for (const w of WINDOWS) {
    const bucket = windowBuckets[w.period]
    for (const v of recentVotes) {
      if (v.created_at < w.cutoff) continue
      const cat = topicCategory.get(v.topic_id)
      if (!cat) continue
      const arr = bucket.get(cat) ?? []
      arr.push({ side: v.side })
      bucket.set(cat, arr)
    }
  }

  // All-time bucket from full votes dataset
  for (const v of allVotes) {
    const cat = topicCategory.get(v.topic_id)
    if (!cat) continue
    const arr = windowBuckets['all'].get(cat) ?? []
    arr.push({ side: v.side })
    windowBuckets['all'].set(cat, arr)
  }

  // ── Build per-category drift ──────────────────────────────────────────────

  const categories: CategoryDrift[] = []

  for (const cat of CATEGORIES) {
    // All-time topic stats for this category
    const catTopics = topics.filter((t) => t.category === cat)
    const totalTopics = catTopics.length
    const totalVotes = catTopics.reduce((s, t) => s + (t.total_votes ?? 0), 0)
    const lawCount = catTopics.filter((t) => t.status === 'law').length
    const resolvedCount = catTopics.filter(
      (t) => t.status === 'law' || t.status === 'failed'
    ).length
    const lawRate = resolvedCount > 0 ? Math.round((lawCount / resolvedCount) * 100) : 0

    // Build window data
    const windows: DriftWindow[] = []

    for (const w of [...WINDOWS, { period: 'all' as const, label: 'All time', cutoff: '' }]) {
      const votes = windowBuckets[w.period].get(cat) ?? []
      // Count distinct topic IDs in this window for topic_count
      const topicIds = new Set<string>()
      for (const v of recentVotes) {
        if (w.period !== 'all' && v.created_at < w.cutoff) continue
        if (topicCategory.get(v.topic_id) === cat) topicIds.add(v.topic_id)
      }
      if (w.period === 'all') {
        for (const v of allVotes) {
          if (topicCategory.get(v.topic_id) === cat) topicIds.add(v.topic_id)
        }
      }

      windows.push({
        period: w.period,
        label: w.label,
        avg_for_pct: votes.length > 0 ? weightedForPct(votes) : 50,
        vote_count: votes.length,
        topic_count: topicIds.size,
      })
    }

    const allTimeAvg = windows.find((w) => w.period === 'all')?.avg_for_pct ?? 50
    const sevenDayAvg = windows.find((w) => w.period === '7d')
    const driftVal =
      sevenDayAvg && sevenDayAvg.vote_count >= 10
        ? Math.round((sevenDayAvg.avg_for_pct - allTimeAvg) * 10) / 10
        : 0

    let drift_direction: CategoryDrift['drift_direction'] = 'stable'
    if (driftVal > STABLE_THRESHOLD) drift_direction = 'toward_for'
    else if (driftVal < -STABLE_THRESHOLD) drift_direction = 'toward_against'

    categories.push({
      category: cat,
      windows,
      drift: driftVal,
      drift_direction,
      law_rate: lawRate,
      total_topics: totalTopics,
      total_votes: totalVotes,
    })
  }

  // Sort by total votes descending (most engaged categories first)
  categories.sort((a, b) => b.total_votes - a.total_votes)

  return NextResponse.json({
    categories,
    generated_at: new Date().toISOString(),
    data_from: since90d,
  } satisfies DriftResponse)
}
