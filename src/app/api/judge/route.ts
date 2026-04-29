import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JudgeArgument {
  id: string
  content: string
  upvotes: number
  source_url: string | null
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface JudgeRound {
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  blue_pct: number
  total_votes: number
  for_argument: JudgeArgument
  against_argument: JudgeArgument
}

export interface JudgeResponse {
  rounds: JudgeRound[]
  generatedAt: string
}

// ─── GET /api/judge ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const category = searchParams.get('category') || null
  const count = Math.min(parseInt(searchParams.get('count') || '8', 10), 15)

  const supabase = await createClient()

  // Fetch active/voting topics with meaningful vote counts
  let topicsQuery = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['active', 'voting', 'proposed'])
    .gt('total_votes', 4)
    .order('total_votes', { ascending: false })
    .limit(120)

  if (category) {
    topicsQuery = topicsQuery.eq('category', category)
  }

  const { data: topics } = await topicsQuery

  if (!topics || topics.length === 0) {
    return NextResponse.json({ rounds: [], generatedAt: new Date().toISOString() } satisfies JudgeResponse)
  }

  const topicIds = topics.map((t) => t.id)

  // Fetch top arguments for these topics
  const { data: args } = await supabase
    .from('topic_arguments')
    .select(
      `id, topic_id, side, content, upvotes, source_url,
       profiles:user_id (id, username, display_name, avatar_url, role)`
    )
    .in('topic_id', topicIds)
    .gt('upvotes', -1)
    .order('upvotes', { ascending: false })

  if (!args || args.length === 0) {
    return NextResponse.json({ rounds: [], generatedAt: new Date().toISOString() } satisfies JudgeResponse)
  }

  // Build map: topic_id → { blue: best arg, red: best arg }
  const argMap = new Map<string, { blue: JudgeArgument | null; red: JudgeArgument | null }>()
  for (const a of args) {
    if (!argMap.has(a.topic_id)) argMap.set(a.topic_id, { blue: null, red: null })
    const entry = argMap.get(a.topic_id)!
    const authorRaw = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles
    const author = authorRaw
      ? { id: authorRaw.id, username: authorRaw.username, display_name: authorRaw.display_name, avatar_url: authorRaw.avatar_url, role: authorRaw.role }
      : null

    const mapped: JudgeArgument = { id: a.id, content: a.content, upvotes: a.upvotes ?? 0, source_url: a.source_url ?? null, author }

    if (a.side === 'blue' && !entry.blue) entry.blue = mapped
    if (a.side === 'red' && !entry.red) entry.red = mapped
  }

  // Build rounds — only topics with BOTH sides represented
  const rounds: JudgeRound[] = []
  for (const topic of topics) {
    const sides = argMap.get(topic.id)
    if (!sides?.blue || !sides?.red) continue
    // Skip rounds where arguments are too short to be meaningful
    if (sides.blue.content.length < 20 || sides.red.content.length < 20) continue
    rounds.push({
      topic_id: topic.id,
      topic_statement: topic.statement,
      topic_category: topic.category ?? null,
      topic_status: topic.status,
      blue_pct: Math.round(topic.blue_pct ?? 50),
      total_votes: topic.total_votes ?? 0,
      for_argument: sides.blue,
      against_argument: sides.red,
    })
    if (rounds.length >= count) break
  }

  // Shuffle the rounds for variety
  for (let i = rounds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rounds[i], rounds[j]] = [rounds[j], rounds[i]]
  }

  return NextResponse.json({ rounds, generatedAt: new Date().toISOString() } satisfies JudgeResponse)
}
