import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600 // 10-minute cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApexTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
}

export interface ApexRecord {
  label: string
  sublabel: string
  topic: ApexTopic | null
  value: string
  value_color: string
}

export interface ApexCategory {
  category: string
  total_topics: number
  law_count: number
  records: ApexRecord[]
}

export interface ApexResponse {
  platform: {
    total_topics: number
    total_laws: number
    total_failed: number
    total_votes: number
    law_rate: number
    records: ApexRecord[]
  }
  categories: ApexCategory[]
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const MIN_VOTES = 20

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildRecords(topics: ApexTopic[], argCounts: Map<string, number>): ApexRecord[] {
  const qualified = topics.filter((t) => t.total_votes >= MIN_VOTES)

  // 1. Consensus Champion — highest FOR%
  const consensusChamp = qualified.length
    ? [...qualified].sort((a, b) => b.blue_pct - a.blue_pct)[0]
    : null

  // 2. Dissent Leader — lowest FOR%
  const dissentLeader = qualified.length
    ? [...qualified].sort((a, b) => a.blue_pct - b.blue_pct)[0]
    : null

  // 3. Most Voted
  const mostVoted = topics.length
    ? [...topics].sort((a, b) => b.total_votes - a.total_votes)[0]
    : null

  // 4. Most Argued
  let mostArgued: ApexTopic | null = null
  let maxArgs = 0
  for (const t of topics) {
    const count = argCounts.get(t.id) ?? 0
    if (count > maxArgs) {
      maxArgs = count
      mostArgued = t
    }
  }

  // 5. Most Contested (closest to 50/50 among well-voted topics)
  const contested = qualified.length
    ? [...qualified].sort((a, b) => Math.abs(a.blue_pct - 50) - Math.abs(b.blue_pct - 50))[0]
    : null

  // 6. Fastest Law (min days from creation to law status)
  const laws = topics.filter((t) => t.status === 'law')
  let fastestLaw: ApexTopic | null = null
  let minDays = Infinity
  for (const t of laws) {
    const days = (Date.now() - new Date(t.created_at).getTime()) / 86_400_000
    if (days < minDays) {
      minDays = days
      fastestLaw = t
    }
  }

  const fmtPct = (n: number) => `${n.toFixed(1)}%`
  const fmtVotes = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)

  return [
    {
      label: 'Consensus Champion',
      sublabel: 'Highest FOR% mandate',
      topic: consensusChamp,
      value: consensusChamp ? fmtPct(consensusChamp.blue_pct) : '—',
      value_color: 'text-for-300',
    },
    {
      label: 'Dissent Leader',
      sublabel: 'Strongest AGAINST position',
      topic: dissentLeader,
      value: dissentLeader ? fmtPct(dissentLeader.blue_pct) : '—',
      value_color: 'text-against-300',
    },
    {
      label: 'Most Engaged',
      sublabel: 'Highest total votes cast',
      topic: mostVoted,
      value: mostVoted ? fmtVotes(mostVoted.total_votes) + ' votes' : '—',
      value_color: 'text-gold',
    },
    {
      label: 'Most Argued',
      sublabel: 'Most arguments written',
      topic: mostArgued,
      value: mostArgued && maxArgs > 0 ? maxArgs + ' args' : '—',
      value_color: 'text-purple',
    },
    {
      label: 'Most Contested',
      sublabel: 'Closest to 50/50 deadlock',
      topic: contested,
      value: contested ? fmtPct(contested.blue_pct) : '—',
      value_color: 'text-yellow-400',
    },
    {
      label: 'Fastest Law',
      sublabel: 'Law passed in fewest days',
      topic: fastestLaw,
      value: fastestLaw ? `${Math.ceil(minDays)}d` : '—',
      value_color: 'text-emerald',
    },
  ]
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient()

    // Fetch all topics with relevant fields
    const { data: allTopics, error } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, created_at')
      .in('status', ['active', 'voting', 'law', 'failed', 'continued'])
      .order('total_votes', { ascending: false })

    if (error) throw error

    const topics: ApexTopic[] = allTopics ?? []

    // Fetch argument counts per topic (grouped)
    const { data: argRows } = await supabase
      .from('topic_arguments')
      .select('topic_id')

    const argCounts = new Map<string, number>()
    for (const row of argRows ?? []) {
      argCounts.set(row.topic_id, (argCounts.get(row.topic_id) ?? 0) + 1)
    }

    // Platform-wide stats
    const lawTopics = topics.filter((t) => t.status === 'law')
    const failedTopics = topics.filter((t) => t.status === 'failed')
    const platformVotes = topics.reduce((s, t) => s + t.total_votes, 0)
    const resolved = lawTopics.length + failedTopics.length
    const lawRate = resolved > 0 ? (lawTopics.length / resolved) * 100 : 0

    // Build category records
    const categoryData: ApexCategory[] = CATEGORIES.map((cat) => {
      const catTopics = topics.filter((t) => t.category === cat)
      return {
        category: cat,
        total_topics: catTopics.length,
        law_count: catTopics.filter((t) => t.status === 'law').length,
        records: buildRecords(catTopics, argCounts),
      }
    }).filter((c) => c.total_topics > 0)

    const response: ApexResponse = {
      platform: {
        total_topics: topics.length,
        total_laws: lawTopics.length,
        total_failed: failedTopics.length,
        total_votes: platformVotes,
        law_rate: lawRate,
        records: buildRecords(topics, argCounts),
      },
      categories: categoryData,
      generated_at: new Date().toISOString(),
    }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=60' },
    })
  } catch (err) {
    console.error('[apex]', err)
    return NextResponse.json({ error: 'Failed to load apex data' }, { status: 500 })
  }
}
