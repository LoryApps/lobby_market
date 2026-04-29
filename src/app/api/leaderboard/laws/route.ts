import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type LawSortBy =
  | 'most_voted'
  | 'unanimous'
  | 'hard_won'
  | 'most_debated'
  | 'fastest'

export interface LawEntry {
  id: string
  topic_id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
  topic_created_at: string
  argument_count: number
  days_to_law: number
  rank: number
}

export interface LawsLeaderboardResponse {
  laws: LawEntry[]
  total: number
  sort: LawSortBy
}

export async function GET(req: NextRequest) {
  const sort = (req.nextUrl.searchParams.get('sort') ?? 'most_voted') as LawSortBy
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10), 100)

  const supabase = await createClient()

  // Fetch all active laws with their topic creation timestamps
  const { data: rawLaws, error } = await supabase
    .from('laws')
    .select(`
      id,
      topic_id,
      statement,
      category,
      blue_pct,
      total_votes,
      established_at,
      topics!inner(created_at)
    `)
    .eq('is_active', true)
    .order('established_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const laws = rawLaws ?? []

  // Fetch argument counts for all law topic_ids
  const topicIds = laws.map((l) => l.topic_id)
  const argCountMap = new Map<string, number>()

  if (topicIds.length > 0) {
    const { data: argCounts } = await supabase
      .from('topic_arguments')
      .select('topic_id')
      .in('topic_id', topicIds)

    for (const row of argCounts ?? []) {
      argCountMap.set(row.topic_id, (argCountMap.get(row.topic_id) ?? 0) + 1)
    }
  }

  // Compute derived fields
  type LawRow = typeof laws[0]
  const enriched: LawEntry[] = laws.map((l: LawRow, i: number) => {
    const topicCreatedAt = (l.topics as unknown as { created_at: string })?.created_at ?? l.established_at
    const msDiff =
      new Date(l.established_at).getTime() - new Date(topicCreatedAt).getTime()
    const daysToLaw = Math.max(0, Math.round(msDiff / 86_400_000))

    return {
      id: l.id,
      topic_id: l.topic_id,
      statement: l.statement,
      category: l.category,
      blue_pct: l.blue_pct ?? 50,
      total_votes: l.total_votes ?? 0,
      established_at: l.established_at,
      topic_created_at: topicCreatedAt,
      argument_count: argCountMap.get(l.topic_id) ?? 0,
      days_to_law: daysToLaw,
      rank: i + 1,
    }
  })

  // Apply sort
  let sorted: LawEntry[]
  switch (sort) {
    case 'most_voted':
      sorted = [...enriched].sort((a, b) => b.total_votes - a.total_votes)
      break
    case 'unanimous':
      sorted = [...enriched].sort((a, b) => b.blue_pct - a.blue_pct)
      break
    case 'hard_won':
      // Laws that passed but with narrow margin (blue_pct 50-65)
      sorted = [...enriched]
        .filter((l) => l.blue_pct >= 50)
        .sort((a, b) => a.blue_pct - b.blue_pct)
      break
    case 'most_debated':
      sorted = [...enriched].sort((a, b) => b.argument_count - a.argument_count)
      break
    case 'fastest':
      sorted = [...enriched]
        .filter((l) => l.days_to_law >= 0)
        .sort((a, b) => a.days_to_law - b.days_to_law)
      break
    default:
      sorted = [...enriched].sort((a, b) => b.total_votes - a.total_votes)
  }

  const ranked = sorted.slice(0, limit).map((l, i) => ({ ...l, rank: i + 1 }))

  return NextResponse.json({
    laws: ranked,
    total: enriched.length,
    sort,
  } satisfies LawsLeaderboardResponse)
}
