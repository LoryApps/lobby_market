import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClashArgument {
  id: string
  content: string
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  source_url: string | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  } | null
}

export interface ClashCard {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    feed_score: number
  }
  for: ClashArgument
  against: ClashArgument
  battleScore: number   // combined upvotes — higher = hotter battle
  momentum: 'for' | 'against' | 'tied'  // which side is gaining
}

export interface ClashResponse {
  clashes: ClashCard[]
  total: number
  generatedAt: string
}

// ─── GET /api/clash ───────────────────────────────────────────────────────────
// Returns topic pairs where both a FOR and AGAINST argument exist,
// sorted by combined upvote activity (hottest battles first).
// Query params:
//   category  - filter by category (e.g. "Politics")
//   sort      - "hottest" | "newest" | "contested" (default: "hottest")
//   limit     - max cards (default 20, max 50)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') ?? null
  const sort = searchParams.get('sort') ?? 'hottest'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)

  try {
    const supabase = await createClient()

    // Fetch active topics with vote data
    let topicQuery = supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, feed_score')
      .in('status', ['active', 'voting', 'proposed', 'law'])
      .gte('total_votes', 1)
      .order('feed_score', { ascending: false })
      .limit(300)

    if (category && category !== 'All') {
      topicQuery = topicQuery.eq('category', category)
    }

    const { data: topics } = await topicQuery

    if (!topics || topics.length === 0) {
      return NextResponse.json({ clashes: [], total: 0, generatedAt: new Date().toISOString() })
    }

    const topicIds = topics.map((t) => t.id)

    // Fetch all arguments for these topics (top upvoted per side)
    const { data: allArgs } = await supabase
      .from('topic_arguments')
      .select(`
        id,
        topic_id,
        side,
        content,
        upvotes,
        ai_score,
        ai_grade,
        source_url,
        created_at,
        author:profiles!user_id ( id, username, display_name, avatar_url, role, clout )
      `)
      .in('topic_id', topicIds)
      .order('upvotes', { ascending: false })

    if (!allArgs || allArgs.length === 0) {
      return NextResponse.json({ clashes: [], total: 0, generatedAt: new Date().toISOString() })
    }

    // Group args by topic and side, take best per side
    const topicMap: Record<string, { blue: typeof allArgs[0] | null; red: typeof allArgs[0] | null }> = {}
    for (const arg of allArgs) {
      if (!topicMap[arg.topic_id]) topicMap[arg.topic_id] = { blue: null, red: null }
      if (arg.side === 'blue' && !topicMap[arg.topic_id].blue) {
        topicMap[arg.topic_id].blue = arg
      } else if (arg.side === 'red' && !topicMap[arg.topic_id].red) {
        topicMap[arg.topic_id].red = arg
      }
    }

    // Build clash cards — only topics with BOTH sides
    const clashes: ClashCard[] = []
    for (const topic of topics) {
      const pair = topicMap[topic.id]
      if (!pair?.blue || !pair?.red) continue

      const forUpvotes = pair.blue.upvotes ?? 0
      const againstUpvotes = pair.red.upvotes ?? 0
      const battleScore = forUpvotes + againstUpvotes

      let momentum: ClashCard['momentum'] = 'tied'
      const diff = forUpvotes - againstUpvotes
      if (diff > 2) momentum = 'for'
      else if (diff < -2) momentum = 'against'

      const normalizeAuthor = (raw: unknown) => {
        if (!raw) return null
        const a = Array.isArray(raw) ? raw[0] : raw
        if (!a) return null
        return {
          id: a.id as string,
          username: a.username as string,
          display_name: a.display_name as string | null,
          avatar_url: a.avatar_url as string | null,
          role: a.role as string,
          clout: a.clout as number,
        }
      }

      clashes.push({
        topic: {
          id: topic.id,
          statement: topic.statement,
          category: topic.category,
          status: topic.status,
          blue_pct: topic.blue_pct,
          total_votes: topic.total_votes,
          feed_score: topic.feed_score,
        },
        for: {
          id: pair.blue.id,
          content: pair.blue.content,
          upvotes: pair.blue.upvotes ?? 0,
          ai_score: pair.blue.ai_score as number | null,
          ai_grade: pair.blue.ai_grade as string | null,
          source_url: pair.blue.source_url as string | null,
          created_at: pair.blue.created_at,
          author: normalizeAuthor(pair.blue.author),
        },
        against: {
          id: pair.red.id,
          content: pair.red.content,
          upvotes: pair.red.upvotes ?? 0,
          ai_score: pair.red.ai_score as number | null,
          ai_grade: pair.red.ai_grade as string | null,
          source_url: pair.red.source_url as string | null,
          created_at: pair.red.created_at,
          author: normalizeAuthor(pair.red.author),
        },
        battleScore,
        momentum,
      })
    }

    // Sort
    if (sort === 'hottest') {
      clashes.sort((a, b) => b.battleScore - a.battleScore)
    } else if (sort === 'contested') {
      // Most contested = FOR and AGAINST close to equal
      clashes.sort((a, b) => {
        const balA = Math.abs(a.for.upvotes - a.against.upvotes)
        const balB = Math.abs(b.for.upvotes - b.against.upvotes)
        return balA - balB
      })
    } else if (sort === 'newest') {
      clashes.sort((a, b) => {
        const latestA = Math.max(
          new Date(a.for.created_at).getTime(),
          new Date(a.against.created_at).getTime(),
        )
        const latestB = Math.max(
          new Date(b.for.created_at).getTime(),
          new Date(b.against.created_at).getTime(),
        )
        return latestB - latestA
      })
    }

    return NextResponse.json({
      clashes: clashes.slice(0, limit),
      total: clashes.length,
      generatedAt: new Date().toISOString(),
    } satisfies ClashResponse)
  } catch (err) {
    console.error('GET /api/clash error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
