import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HubQuestion {
  id: string
  topic_id: string
  content: string
  upvotes: number
  answer_count: number
  is_answered: boolean
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
  user_voted: boolean
}

export interface HubQuestionsResponse {
  questions: HubQuestion[]
  total: number
}

// ─── GET /api/questions ───────────────────────────────────────────────────────
//
// Query params:
//   filter: "all" | "unanswered" | "answered"    default: "unanswered"
//   sort:   "top" | "new" | "hot"                 default: "hot"
//   category: string                              optional
//   limit:  number                                default: 40

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { searchParams } = req.nextUrl
    const filter   = searchParams.get('filter')   ?? 'unanswered'
    const sort     = searchParams.get('sort')     ?? 'hot'
    const category = searchParams.get('category') ?? null
    const limit    = Math.min(parseInt(searchParams.get('limit') ?? '40', 10), 100)

    // ── 1. Fetch questions ─────────────────────────────────────────────────────
    let query = supabase
      .from('topic_questions')
      .select('*')

    if (filter === 'unanswered') {
      query = query.eq('is_answered', false)
    } else if (filter === 'answered') {
      query = query.eq('is_answered', true)
    }

    if (sort === 'new') {
      query = query.order('created_at', { ascending: false })
    } else if (sort === 'top') {
      query = query.order('upvotes', { ascending: false }).order('created_at', { ascending: false })
    } else {
      // hot: prioritise recent AND upvoted
      query = query.order('created_at', { ascending: false }).order('upvotes', { ascending: false })
    }

    query = query.limit(limit * 2) // fetch extra so we can filter by category

    const { data: rawQuestions, error } = await query
    if (error) throw error

    const questions = rawQuestions ?? []
    if (questions.length === 0) {
      return NextResponse.json({ questions: [], total: 0 } satisfies HubQuestionsResponse)
    }

    // ── 2. Fetch topics ────────────────────────────────────────────────────────
    const topicIds = [...new Set(questions.map((q) => q.topic_id))]
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', topicIds)

    const topicMap = new Map((topics ?? []).map((t) => [t.id, t]))

    // Filter by category if provided
    const filteredQuestions = category
      ? questions.filter((q) => {
          const t = topicMap.get(q.topic_id)
          return t?.category === category
        })
      : questions

    const sliced = filteredQuestions.slice(0, limit)

    // ── 3. Fetch authors ───────────────────────────────────────────────────────
    const authorIds = [...new Set(sliced.map((q) => q.author_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', authorIds)

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

    // ── 4. Fetch current user's votes ──────────────────────────────────────────
    let votedIds = new Set<string>()
    if (user) {
      const { data: votes } = await supabase
        .from('topic_question_votes')
        .select('question_id')
        .eq('user_id', user.id)
        .in('question_id', sliced.map((q) => q.id))
      votedIds = new Set((votes ?? []).map((v) => v.question_id))
    }

    // ── 5. Assemble ─────────────────────────────────────────────────────────────
    const enriched: HubQuestion[] = sliced.map((q) => ({
      id: q.id,
      topic_id: q.topic_id,
      content: q.content,
      upvotes: q.upvotes,
      answer_count: q.answer_count,
      is_answered: q.is_answered,
      created_at: q.created_at,
      author: profileMap.get(q.author_id) ?? null,
      topic: topicMap.get(q.topic_id) ?? null,
      user_voted: votedIds.has(q.id),
    }))

    return NextResponse.json({
      questions: enriched,
      total: filteredQuestions.length,
    } satisfies HubQuestionsResponse)
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
