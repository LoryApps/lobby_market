import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BestQAPair {
  question: {
    id: string
    topic_id: string
    content: string
    upvotes: number
    answer_count: number
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
  accepted_answer: {
    id: string
    content: string
    upvotes: number
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
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
  // combined engagement score for sorting
  score: number
}

export interface BestQAResponse {
  pairs: BestQAPair[]
  total: number
  has_more: boolean
}

// ─── GET /api/questions/best ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)

    const category = searchParams.get('category') ?? 'All'
    const period   = searchParams.get('period') ?? 'all'   // week | month | all
    const limit    = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
    const offset   = parseInt(searchParams.get('offset') ?? '0', 10)

    // Build date filter
    let since: string | null = null
    if (period === 'week') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      since = d.toISOString()
    } else if (period === 'month') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      since = d.toISOString()
    }

    // Fetch accepted answers with their parent questions and topics
    let answerQuery = supabase
      .from('topic_answers')
      .select(`
        id,
        question_id,
        topic_id,
        author_id,
        content,
        upvotes,
        is_accepted,
        created_at,
        topic_questions!inner (
          id,
          topic_id,
          author_id,
          content,
          upvotes,
          answer_count,
          is_answered,
          created_at
        )
      `)
      .eq('is_accepted', true)
      .eq('topic_questions.is_answered', true)
      .order('upvotes', { ascending: false })

    if (since) {
      answerQuery = answerQuery.gte('created_at', since)
    }

    const { data: rawAnswers, error: answerError } = await answerQuery.range(offset, offset + limit + 9)

    if (answerError) throw answerError
    if (!rawAnswers || rawAnswers.length === 0) {
      return NextResponse.json({ pairs: [], total: 0, has_more: false } satisfies BestQAResponse)
    }

    // Gather all topic IDs to fetch
    const topicIds = [...new Set(rawAnswers.map((a) => a.topic_id).filter(Boolean))]

    // Fetch topics (filter by category if needed)
    let topicQuery = supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', topicIds)

    if (category !== 'All') {
      topicQuery = topicQuery.eq('category', category)
    }

    const { data: topics } = await topicQuery
    const topicMap = new Map((topics ?? []).map((t) => [t.id, t]))

    // Filter answers whose topic matches the category
    const filtered = rawAnswers.filter((a) => topicMap.has(a.topic_id))

    // Gather all author IDs
    const authorIds = [
      ...new Set([
        ...filtered.map((a) => a.author_id),
        ...filtered.map((a) => {
          const q = a.topic_questions as unknown as { author_id: string } | null
          return q?.author_id
        }).filter((id): id is string => !!id),
      ])
    ]

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', authorIds)

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

    // Build pairs
    const pairs: BestQAPair[] = []
    const seenQuestions = new Set<string>()

    for (const answer of filtered) {
      const q = answer.topic_questions as unknown as {
        id: string; topic_id: string; author_id: string;
        content: string; upvotes: number; answer_count: number;
        created_at: string;
      } | null

      if (!q || seenQuestions.has(q.id)) continue
      seenQuestions.add(q.id)

      const topic = topicMap.get(answer.topic_id) ?? null
      const questionAuthor = profileMap.get(q.author_id) ?? null
      const answerAuthor   = profileMap.get(answer.author_id) ?? null

      const score = (q.upvotes ?? 0) + (answer.upvotes ?? 0) * 1.5

      pairs.push({
        question: {
          id: q.id,
          topic_id: q.topic_id,
          content: q.content,
          upvotes: q.upvotes,
          answer_count: q.answer_count,
          created_at: q.created_at,
          author: questionAuthor,
        },
        accepted_answer: {
          id: answer.id,
          content: answer.content,
          upvotes: answer.upvotes,
          created_at: answer.created_at,
          author: answerAuthor,
        },
        topic,
        score,
      })
    }

    // Sort by composite score desc
    pairs.sort((a, b) => b.score - a.score)

    const pagePairs = pairs.slice(0, limit)
    const has_more  = pairs.length > limit

    return NextResponse.json({
      pairs: pagePairs,
      total: pairs.length,
      has_more,
    } satisfies BestQAResponse)
  } catch (err) {
    console.error('[api/questions/best]', err)
    return NextResponse.json({ pairs: [], total: 0, has_more: false }, { status: 500 })
  }
}
