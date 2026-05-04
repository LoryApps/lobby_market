import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ARCHETYPE_IDS } from '@/lib/config/archetypes'

export const dynamic = 'force-dynamic'
export const revalidate = 600 // 10-minute cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArchetypeTendency {
  archetype: string
  blue_count: number
  red_count: number
  total: number
  blue_pct: number  // 0–100
}

export interface DivisiveTopic {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  // FOR% for each archetype that voted (null = no data)
  archetype_pcts: Record<string, number | null>
  // Variance score: higher = more divisive
  variance: number
  global_blue_pct: number
}

export interface IntelligenceResponse {
  tendencies: ArchetypeTendency[]
  divisive: DivisiveTopic[]
  unifying: DivisiveTopic[]
  total_archetype_votes: number
  sample_size: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeVariance(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // ── 1. Fetch recent votes with archetype info ────────────────────────────
  // Sample the 15k most recent votes that have an archetype-tagged voter.
  // This is enough to get statistically meaningful patterns without hammering DB.
  const { data: rawVotes, error: vErr } = await supabase
    .from('votes')
    .select('topic_id, side, profiles!votes_user_id_fkey(civic_archetype)')
    .not('profiles.civic_archetype', 'is', null)
    .order('created_at', { ascending: false })
    .limit(15000)

  if (vErr || !rawVotes) {
    return NextResponse.json({
      tendencies: [],
      divisive: [],
      unifying: [],
      total_archetype_votes: 0,
      sample_size: 0,
    } satisfies IntelligenceResponse)
  }

  // ── 2. Aggregate in memory ───────────────────────────────────────────────

  // Overall tendency per archetype
  const overallCounts: Record<string, { blue: number; red: number }> = {}

  // Per-topic per-archetype vote counts
  const topicMap: Record<string, Record<string, { blue: number; red: number }>> = {}

  for (const row of rawVotes) {
    const profile = row.profiles as { civic_archetype: string | null } | null
    const arch = profile?.civic_archetype
    if (!arch || !row.side) continue

    const side = row.side as 'blue' | 'red'

    // Overall
    if (!overallCounts[arch]) overallCounts[arch] = { blue: 0, red: 0 }
    overallCounts[arch][side]++

    // Per-topic
    if (!topicMap[row.topic_id]) topicMap[row.topic_id] = {}
    if (!topicMap[row.topic_id][arch]) topicMap[row.topic_id][arch] = { blue: 0, red: 0 }
    topicMap[row.topic_id][arch][side]++
  }

  // ── 3. Build tendency objects ────────────────────────────────────────────

  const tendencies: ArchetypeTendency[] = ARCHETYPE_IDS
    .filter((id) => overallCounts[id])
    .map((id) => {
      const { blue, red } = overallCounts[id]
      const total = blue + red
      return {
        archetype: id,
        blue_count: blue,
        red_count: red,
        total,
        blue_pct: total > 0 ? Math.round((blue / total) * 100) : 50,
      }
    })
    .sort((a, b) => b.total - a.total)

  const totalArchetypeVotes = tendencies.reduce((s, t) => s + t.total, 0)

  // ── 4. Find divisive and unifying topics ────────────────────────────────

  // Only consider topics that have at least 3 archetypes with ≥2 votes each
  const eligibleTopicIds = Object.entries(topicMap)
    .filter(([, archs]) => {
      const qualified = Object.values(archs).filter((c) => c.blue + c.red >= 2)
      return qualified.length >= 3
    })
    .map(([id]) => id)

  if (eligibleTopicIds.length === 0) {
    return NextResponse.json({
      tendencies,
      divisive: [],
      unifying: [],
      total_archetype_votes: totalArchetypeVotes,
      sample_size: rawVotes.length,
    } satisfies IntelligenceResponse)
  }

  // Fetch topic metadata for eligible topics
  const { data: topicsData } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('id', eligibleTopicIds.slice(0, 300))

  const topicMeta = new Map((topicsData ?? []).map((t) => [t.id, t]))

  // Compute per-topic stats
  interface TopicStats {
    id: string
    statement: string
    category: string | null
    status: string
    total_votes: number
    archetype_pcts: Record<string, number | null>
    variance: number
    global_blue_pct: number
  }

  const topicStats: TopicStats[] = []

  for (const topicId of eligibleTopicIds) {
    const meta = topicMeta.get(topicId)
    if (!meta) continue

    const archVotes = topicMap[topicId]
    const archPcts: Record<string, number | null> = {}
    const pctValues: number[] = []

    for (const arch of ARCHETYPE_IDS) {
      const counts = archVotes[arch]
      if (!counts || counts.blue + counts.red < 2) {
        archPcts[arch] = null
        continue
      }
      const pct = Math.round((counts.blue / (counts.blue + counts.red)) * 100)
      archPcts[arch] = pct
      pctValues.push(pct)
    }

    if (pctValues.length < 3) continue

    topicStats.push({
      id: topicId,
      statement: meta.statement,
      category: meta.category,
      status: meta.status,
      total_votes: meta.total_votes,
      archetype_pcts: archPcts,
      variance: computeVariance(pctValues),
      global_blue_pct: Math.round(meta.blue_pct ?? 50),
    })
  }

  // Sort by variance: highest = most divisive, lowest = most unifying
  const sorted = [...topicStats].sort((a, b) => b.variance - a.variance)

  const divisive = sorted.slice(0, 6)
  const unifying = sorted
    .filter((t) => t.variance < 100)  // low variance = strong consensus
    .slice(-6)
    .reverse()

  return NextResponse.json({
    tendencies,
    divisive,
    unifying,
    total_archetype_votes: totalArchetypeVotes,
    sample_size: rawVotes.length,
  } satisfies IntelligenceResponse)
}
