import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VerdictArgument {
  id: string
  content: string
  upvotes: number
}

export interface VerdictTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  for_argument: VerdictArgument
  against_argument: VerdictArgument
}

export interface VerdictPayload {
  topics: VerdictTopic[]
  date: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function seededShuffle<T>(arr: T[], seed: string): T[] {
  const copy = [...arr]
  let h = seed.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  for (let i = copy.length - 1; i > 0; i--) {
    h = ((h * 1664525) + 1013904223) >>> 0
    const j = h % (i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Fetch active/voting topics with meaningful vote counts
  const { data: topics, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['active', 'voting', 'law', 'failed'])
    .gte('total_votes', 10)
    .not('category', 'is', null)
    .order('total_votes', { ascending: false })
    .limit(200)

  if (error || !topics || topics.length < 10) {
    return NextResponse.json({ error: 'Not enough topics' }, { status: 500 })
  }

  // Fetch top arguments for these topics
  const topicIds = topics.map((t) => t.id)

  const { data: args } = await supabase
    .from('topic_arguments')
    .select('id, topic_id, side, content, upvotes')
    .in('topic_id', topicIds)
    .gte('upvotes', 0)
    .order('upvotes', { ascending: false })

  // Build map: topic_id -> { blue: top arg, red: top arg }
  const argMap = new Map<string, { blue: VerdictArgument | null; red: VerdictArgument | null }>()

  for (const a of args ?? []) {
    if (!argMap.has(a.topic_id)) {
      argMap.set(a.topic_id, { blue: null, red: null })
    }
    const entry = argMap.get(a.topic_id)!
    const mapped: VerdictArgument = { id: a.id, content: a.content, upvotes: a.upvotes ?? 0 }
    if (a.side === 'blue' && !entry.blue) entry.blue = mapped
    else if (a.side === 'red' && !entry.red) entry.red = mapped
  }

  // Filter to topics that have BOTH sides represented
  const eligible = topics.filter((t) => {
    const sides = argMap.get(t.id)
    return sides?.blue && sides?.red
  })

  if (eligible.length < 5) {
    return NextResponse.json({ error: 'Not enough topics with arguments on both sides' }, { status: 500 })
  }

  // Deterministic daily selection
  const date = todayUTC()
  const seed = `verdict-${date}`
  const shuffled = seededShuffle(eligible, seed)
  const selected = shuffled.slice(0, 5)

  // Also shuffle the order of FOR/AGAINST within each topic (so it's not always FOR first)
  const argSeedMap = new Map<string, boolean>()
  let h = seed.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 13)
  for (const t of selected) {
    h = ((h * 1664525) + 1013904223) >>> 0
    argSeedMap.set(t.id, (h % 2) === 0)
  }

  const resultTopics: VerdictTopic[] = selected.map((t) => {
    const sides = argMap.get(t.id)!
    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      for_argument: sides.blue!,
      against_argument: sides.red!,
    }
  })

  return NextResponse.json({ topics: resultTopics, date } satisfies VerdictPayload)
}
