import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface FeaturedQuestion {
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
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
}

export interface FeaturedQuestionsResponse {
  questions: FeaturedQuestion[]
}

// GET /api/questions/featured
// Returns the top 5 unanswered questions from active/voting topics, sorted by upvotes.
// Cached 5 minutes via Cache-Control; used to inject Q&A prompts into the main feed.

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: rawQuestions, error } = await supabase
      .from('topic_questions')
      .select('*')
      .eq('is_answered', false)
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(25)

    if (error) throw error

    const questions = rawQuestions ?? []
    if (questions.length === 0) {
      return NextResponse.json({ questions: [] } satisfies FeaturedQuestionsResponse, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
      })
    }

    const topicIds = [...new Set(questions.map((q) => q.topic_id))]
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', topicIds)
      .in('status', ['active', 'voting'])

    const topicMap = new Map((topics ?? []).map((t) => [t.id, t]))

    // Only keep questions whose topic is currently active or voting
    const liveQuestions = questions
      .filter((q) => topicMap.has(q.topic_id))
      .slice(0, 5)

    if (liveQuestions.length === 0) {
      return NextResponse.json({ questions: [] } satisfies FeaturedQuestionsResponse, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
      })
    }

    const authorIds = [...new Set(liveQuestions.map((q) => q.author_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', authorIds)

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

    const enriched: FeaturedQuestion[] = liveQuestions.map((q) => ({
      id: q.id,
      topic_id: q.topic_id,
      content: q.content,
      upvotes: q.upvotes,
      answer_count: q.answer_count,
      created_at: q.created_at,
      author: profileMap.get(q.author_id) ?? null,
      topic: topicMap.get(q.topic_id) ?? null,
    }))

    return NextResponse.json({ questions: enriched } satisfies FeaturedQuestionsResponse, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
