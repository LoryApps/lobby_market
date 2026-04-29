import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 60

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CrossfireArgument {
  id: string
  content: string
  upvotes: number
  source_url: string | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface CrossfireEntry {
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  topic_scope: string | null
  blue_pct: number
  total_votes: number
  controversy_score: number
  for_argument: CrossfireArgument | null
  against_argument: CrossfireArgument | null
  argument_gap: number
}

export interface CrossfireResponse {
  entries: CrossfireEntry[]
  generatedAt: string
}

// ─── GET /api/crossfire ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const category = searchParams.get('category')
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 30)

  const supabase = await createClient()

  // Fetch contested topics (close to 50/50 with meaningful vote counts)
  let topicsQuery = supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes')
    .in('status', ['active', 'voting'])
    .gt('total_votes', 9)
    .gte('blue_pct', 30)
    .lte('blue_pct', 70)
    .order('total_votes', { ascending: false })
    .limit(50)

  if (category) {
    topicsQuery = topicsQuery.eq('category', category)
  }

  const { data: topics } = await topicsQuery

  if (!topics || topics.length === 0) {
    return NextResponse.json({
      entries: [],
      generatedAt: new Date().toISOString(),
    } satisfies CrossfireResponse)
  }

  // Sort by controversy (closest to 50/50 wins)
  const scored = topics.map((t) => ({
    ...t,
    controversy_score: 100 - Math.abs((t.blue_pct ?? 50) - 50) * 2,
  }))

  scored.sort((a, b) => b.controversy_score - a.controversy_score)

  const topTopics = scored.slice(0, limit)
  const topicIds = topTopics.map((t) => t.id)

  // Fetch arguments for all these topics in one query
  const { data: args } = await supabase
    .from('topic_arguments')
    .select(
      `id, topic_id, side, content, upvotes, source_url, created_at,
       profiles:user_id (id, username, display_name, avatar_url, role)`
    )
    .in('topic_id', topicIds)
    .order('upvotes', { ascending: false })

  // Build a map: topic_id -> { blue: arg, red: arg }
  const argMap = new Map<
    string,
    { blue: CrossfireArgument | null; red: CrossfireArgument | null }
  >()

  for (const a of args ?? []) {
    if (!argMap.has(a.topic_id)) {
      argMap.set(a.topic_id, { blue: null, red: null })
    }
    const entry = argMap.get(a.topic_id)!
    const author = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles

    const mapped: CrossfireArgument = {
      id: a.id,
      content: a.content,
      upvotes: a.upvotes ?? 0,
      source_url: a.source_url ?? null,
      created_at: a.created_at,
      author: author
        ? {
            id: author.id,
            username: author.username,
            display_name: author.display_name,
            avatar_url: author.avatar_url,
            role: author.role,
          }
        : null,
    }

    if (a.side === 'blue' && !entry.blue) {
      entry.blue = mapped
    } else if (a.side === 'red' && !entry.red) {
      entry.red = mapped
    }
  }

  // Build entries — prefer topics that have BOTH sides represented
  const entries: CrossfireEntry[] = topTopics
    .map((topic) => {
      const sides = argMap.get(topic.id) ?? { blue: null, red: null }
      const forUpvotes = sides.blue?.upvotes ?? 0
      const againstUpvotes = sides.red?.upvotes ?? 0
      return {
        topic_id: topic.id,
        topic_statement: topic.statement,
        topic_category: topic.category,
        topic_status: topic.status,
        topic_scope: topic.scope ?? null,
        blue_pct: topic.blue_pct ?? 50,
        total_votes: topic.total_votes ?? 0,
        controversy_score: topic.controversy_score,
        for_argument: sides.blue,
        against_argument: sides.red,
        argument_gap: Math.abs(forUpvotes - againstUpvotes),
      }
    })
    // Sort: entries with both sides first, then by controversy
    .sort((a, b) => {
      const aHasBoth = a.for_argument && a.against_argument ? 1 : 0
      const bHasBoth = b.for_argument && b.against_argument ? 1 : 0
      if (aHasBoth !== bHasBoth) return bHasBoth - aHasBoth
      return b.controversy_score - a.controversy_score
    })

  return NextResponse.json({
    entries,
    generatedAt: new Date().toISOString(),
  } satisfies CrossfireResponse)
}
