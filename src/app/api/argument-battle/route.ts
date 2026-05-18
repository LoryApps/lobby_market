import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface BattleArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  author_id: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
}

export interface BattlePayload {
  arguments: BattleArgument[]
  date: string
  seed: string
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function mulberry32(s: number) {
  return function () {
    let t = (s += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  const rand = mulberry32(seed)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * GET /api/argument-battle
 *
 * Returns 8 top arguments from the past 48 h to seed the daily Argument Battle.
 * Arguments are chosen to be balanced: 4 FOR (blue) + 4 AGAINST (red).
 * The same 8 are returned for all visitors on a given calendar day (deterministic
 * daily seed) so everyone participates in the same bracket.
 */
export async function GET() {
  const supabase = await createClient()

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { data: rows, error } = await supabase
    .from('topic_arguments')
    .select(
      `id, content, side, upvotes, ai_score, ai_grade, created_at, topic_id,
       topics!inner(statement, category, status),
       profiles!inner(id, username, display_name, avatar_url, role)`
    )
    .gte('created_at', cutoff)
    .gte('upvotes', 0)
    .in('topics.status', ['active', 'voting', 'law'])
    .order('upvotes', { ascending: false })
    .limit(80)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch arguments' }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ arguments: [], date: todayUTC(), seed: '' } satisfies BattlePayload)
  }

  type Row = (typeof rows)[number] & {
    topics: { statement: string; category: string | null; status: string }
    profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }
  }

  const mapped = (rows as Row[]).map((r) => ({
    id: r.id as string,
    content: r.content as string,
    side: r.side as 'blue' | 'red',
    upvotes: (r.upvotes as number) ?? 0,
    ai_score: r.ai_score as number | null,
    ai_grade: r.ai_grade as string | null,
    created_at: r.created_at as string,
    topic_id: r.topic_id as string,
    topic_statement: r.topics.statement,
    topic_category: r.topics.category,
    author_id: r.profiles.id,
    author_username: r.profiles.username,
    author_display_name: r.profiles.display_name,
    author_avatar_url: r.profiles.avatar_url,
    author_role: r.profiles.role,
  })) satisfies BattleArgument[]

  const blue = mapped.filter((a) => a.side === 'blue')
  const red = mapped.filter((a) => a.side === 'red')

  const today = todayUTC()
  const seedNum = parseInt(today.replace(/-/g, ''), 10)

  // Pick 4 from each side, seed-shuffled
  const pickedBlue = seededShuffle(blue, seedNum).slice(0, 4)
  const pickedRed = seededShuffle(red, seedNum + 1).slice(0, 4)

  // Interleave: B R B R B R B R so seedings alternate sides
  const final: BattleArgument[] = []
  const maxLen = Math.max(pickedBlue.length, pickedRed.length)
  for (let i = 0; i < maxLen; i++) {
    if (pickedBlue[i]) final.push(pickedBlue[i])
    if (pickedRed[i]) final.push(pickedRed[i])
  }

  return NextResponse.json({
    arguments: final.slice(0, 8),
    date: today,
    seed: String(seedNum),
  } satisfies BattlePayload)
}
