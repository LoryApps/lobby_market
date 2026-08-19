import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ThesisForTopic {
  id: string
  statement: string
  rationale: string | null
  status: string
  agree_count: number
  disagree_count: number
  resolution_date: string | null
  created_at: string
  user_id: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface TopicWithTheses {
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  topic_blue_pct: number | null
  topic_total_votes: number
  theses: ThesisForTopic[]
  thesis_count: number
  total_agree: number
  total_disagree: number
  controversy_score: number
}

export interface ThesisTopicsResponse {
  topics: TopicWithTheses[]
  total: number
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = req.nextUrl

  const sort = searchParams.get('sort') || 'controversial'
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 40)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const category = searchParams.get('category') || null

  // Fetch active theses that have a related topic
  let query = supabase
    .from('civic_theses')
    .select(
      `
      id, user_id, statement, rationale, status,
      agree_count, disagree_count, resolution_date, created_at,
      related_topic_id,
      profiles!civic_theses_user_id_fkey(
        id, username, display_name, avatar_url, role
      ),
      topics!civic_theses_related_topic_id_fkey(
        id, statement, category, status, blue_pct, total_votes
      )
    `
    )
    .eq('is_public', true)
    .eq('status', 'active')
    .not('related_topic_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(400)

  if (category) {
    query = query.eq('category', category)
  }

  const { data: theses, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Group theses by related_topic_id
  const topicMap = new Map<string, {
    topic: { id: string; statement: string; category: string | null; status: string; blue_pct: number | null; total_votes: number }
    theses: ThesisForTopic[]
  }>()

  for (const t of theses ?? []) {
    const topicData = t.topics as { id: string; statement: string; category: string | null; status: string; blue_pct: number | null; total_votes: number } | null
    if (!topicData) continue

    const existing = topicMap.get(topicData.id)
    const authorData = t.profiles as { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string } | null

    const thesisEntry: ThesisForTopic = {
      id: t.id,
      statement: t.statement,
      rationale: t.rationale,
      status: t.status,
      agree_count: t.agree_count,
      disagree_count: t.disagree_count,
      resolution_date: t.resolution_date,
      created_at: t.created_at,
      user_id: t.user_id,
      author: authorData,
    }

    if (existing) {
      existing.theses.push(thesisEntry)
    } else {
      topicMap.set(topicData.id, {
        topic: topicData,
        theses: [thesisEntry],
      })
    }
  }

  // Filter to topics with 2+ theses, compute scores
  const topics: TopicWithTheses[] = Array.from(topicMap.values())
    .filter((g) => g.theses.length >= 2)
    .map((g) => {
      const total_agree = g.theses.reduce((s, t) => s + t.agree_count, 0)
      const total_disagree = g.theses.reduce((s, t) => s + t.disagree_count, 0)
      const thesis_count = g.theses.length

      // Controversy: high when theses are split in community support
      // Pick the top 2 by (agree_count + disagree_count)
      const sorted = [...g.theses].sort(
        (a, b) => (b.agree_count + b.disagree_count) - (a.agree_count + a.disagree_count)
      )
      const top2 = sorted.slice(0, 2)
      const a = top2[0]?.agree_count ?? 0
      const b = top2[1]?.agree_count ?? 0
      const totalVotes = top2.reduce((s, t) => s + t.agree_count + t.disagree_count, 1)
      // Controversy: high when top 2 theses have similar community support levels
      const controversy_score = totalVotes > 0
        ? 1 - Math.abs(a - b) / Math.max(a + b, 1)
        : 0

      return {
        topic_id: g.topic.id,
        topic_statement: g.topic.statement,
        topic_category: g.topic.category,
        topic_status: g.topic.status,
        topic_blue_pct: g.topic.blue_pct,
        topic_total_votes: g.topic.total_votes,
        theses: sorted.slice(0, 4), // show top 4 per topic
        thesis_count,
        total_agree,
        total_disagree,
        controversy_score,
      }
    })

  // Sort
  if (sort === 'controversial') {
    topics.sort((a, b) => b.controversy_score - a.controversy_score)
  } else if (sort === 'most_theses') {
    topics.sort((a, b) => b.thesis_count - a.thesis_count)
  } else if (sort === 'newest') {
    topics.sort((a, b) => {
      const latestA = a.theses[0]?.created_at ?? ''
      const latestB = b.theses[0]?.created_at ?? ''
      return latestB.localeCompare(latestA)
    })
  } else if (sort === 'active') {
    topics.sort((a, b) => (b.total_agree + b.total_disagree) - (a.total_agree + a.total_disagree))
  }

  const total = topics.length
  const paginated = topics.slice(offset, offset + limit)

  return NextResponse.json({ topics: paginated, total } satisfies ThesisTopicsResponse)
}
