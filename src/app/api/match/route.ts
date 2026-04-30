import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface MatchTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  scope: string
}

export interface MatchPair {
  left: MatchTopic
  right: MatchTopic
  pair_key: string
}

export interface MatchResponse {
  pairs: MatchPair[]
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const exclude = searchParams.get('exclude')?.split(',').filter(Boolean) ?? []

  // Fetch a pool of active/voting/proposed topics
  const { data: rows, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope')
    .in('status', ['active', 'voting', 'proposed'])
    .order('feed_score', { ascending: false })
    .limit(80)

  if (error || !rows || rows.length < 2) {
    return NextResponse.json({ pairs: [] } as MatchResponse)
  }

  // Exclude already-seen pair keys passed by the client
  const topics = (rows as MatchTopic[]).filter((t) => !exclude.includes(t.id))

  if (topics.length < 2) {
    return NextResponse.json({ pairs: [] } as MatchResponse)
  }

  // Shuffle using Fisher-Yates
  for (let i = topics.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[topics[i], topics[j]] = [topics[j], topics[i]]
  }

  // Build 5 non-overlapping pairs from the shuffled pool
  const pairs: MatchPair[] = []
  let i = 0
  while (pairs.length < 5 && i + 1 < topics.length) {
    const left = topics[i]
    const right = topics[i + 1]
    const a = left.id < right.id ? left.id : right.id
    const b = left.id < right.id ? right.id : left.id
    pairs.push({ left, right, pair_key: `${a}:${b}` })
    i += 2
  }

  return NextResponse.json({ pairs } as MatchResponse)
}
