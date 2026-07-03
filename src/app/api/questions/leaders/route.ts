import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QALeader {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  question_count: number
  total_question_upvotes: number
  answer_count: number
  accepted_count: number
  total_answer_upvotes: number
}

export interface OpenQuestion {
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
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null
}

export interface QALeadersResponse {
  topQuestioners: QALeader[]
  topAnswerers: QALeader[]
  openQuestions: OpenQuestion[]
  stats: {
    total_questions: number
    total_answers: number
    answered_questions: number
    unique_questioners: number
    unique_answerers: number
  }
}

// ─── GET /api/questions/leaders ───────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // ── 1. Platform-wide Q&A stats ──────────────────────────────────────────────
    const [
      { count: totalQuestions },
      { count: totalAnswers },
      { count: answeredQuestions },
    ] = await Promise.all([
      supabase.from('topic_questions').select('*', { count: 'exact', head: true }),
      supabase.from('topic_answers').select('*', { count: 'exact', head: true }),
      supabase
        .from('topic_questions')
        .select('*', { count: 'exact', head: true })
        .eq('is_answered', true),
    ])

    // ── 2. Top questioners — users with most upvoted questions ──────────────────
    const { data: rawQuestions } = await supabase
      .from('topic_questions')
      .select('author_id, upvotes')
      .order('created_at', { ascending: false })
      .limit(2000)

    // Aggregate by author
    const questionerMap = new Map<string, { count: number; upvotes: number }>()
    for (const q of rawQuestions ?? []) {
      if (!q.author_id) continue
      const prev = questionerMap.get(q.author_id) ?? { count: 0, upvotes: 0 }
      questionerMap.set(q.author_id, {
        count: prev.count + 1,
        upvotes: prev.upvotes + (q.upvotes ?? 0),
      })
    }

    // Sort by upvotes, take top 15
    const topQuestionerIds = Array.from(questionerMap.entries())
      .sort((a, b) => b[1].upvotes - a[1].upvotes || b[1].count - a[1].count)
      .slice(0, 15)
      .map(([id]) => id)

    // ── 3. Top answerers — users with most accepted/upvoted answers ─────────────
    const { data: rawAnswers } = await supabase
      .from('topic_answers')
      .select('author_id, upvotes, is_accepted')
      .order('created_at', { ascending: false })
      .limit(2000)

    const answererMap = new Map<
      string,
      { count: number; accepted: number; upvotes: number }
    >()
    for (const a of rawAnswers ?? []) {
      if (!a.author_id) continue
      const prev = answererMap.get(a.author_id) ?? { count: 0, accepted: 0, upvotes: 0 }
      answererMap.set(a.author_id, {
        count: prev.count + 1,
        accepted: prev.accepted + (a.is_accepted ? 1 : 0),
        upvotes: prev.upvotes + (a.upvotes ?? 0),
      })
    }

    const topAnswererIds = Array.from(answererMap.entries())
      .sort(
        (a, b) =>
          b[1].accepted - a[1].accepted ||
          b[1].upvotes - a[1].upvotes ||
          b[1].count - a[1].count
      )
      .slice(0, 15)
      .map(([id]) => id)

    // ── 4. Fetch profiles for both sets (deduplicated) ─────────────────────────
    const allIds = Array.from(new Set([...topQuestionerIds, ...topAnswererIds]))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', allIds.length > 0 ? allIds : ['00000000-0000-0000-0000-000000000000'])

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? [])

    function buildLeader(
      id: string,
      qStats: { count: number; upvotes: number } | undefined,
      aStats: { count: number; accepted: number; upvotes: number } | undefined
    ): QALeader | null {
      const p = profileMap.get(id)
      if (!p) return null
      return {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role ?? 'person',
        clout: p.clout ?? 0,
        question_count: qStats?.count ?? 0,
        total_question_upvotes: qStats?.upvotes ?? 0,
        answer_count: aStats?.count ?? 0,
        accepted_count: aStats?.accepted ?? 0,
        total_answer_upvotes: aStats?.upvotes ?? 0,
      }
    }

    const topQuestioners: QALeader[] = topQuestionerIds
      .map((id) =>
        buildLeader(id, questionerMap.get(id), answererMap.get(id))
      )
      .filter((x): x is QALeader => x !== null)
      .slice(0, 10)

    const topAnswerers: QALeader[] = topAnswererIds
      .map((id) =>
        buildLeader(id, questionerMap.get(id), answererMap.get(id))
      )
      .filter((x): x is QALeader => x !== null)
      .slice(0, 10)

    // ── 5. Open questions — most upvoted with no accepted answer ─────────────────
    const { data: openRaw } = await supabase
      .from('topic_questions')
      .select('id, topic_id, content, upvotes, answer_count, created_at, author_id')
      .eq('is_answered', false)
      .gt('upvotes', 0)
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30)

    // Fetch authors + topics for open questions
    const openAuthorIds = [
      ...new Set((openRaw ?? []).map((q) => q.author_id).filter(Boolean)),
    ]
    const openTopicIds = [
      ...new Set((openRaw ?? []).map((q) => q.topic_id).filter(Boolean)),
    ]

    const [{ data: openAuthors }, { data: openTopics }] = await Promise.all([
      openAuthorIds.length > 0
        ? supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, role')
            .in('id', openAuthorIds)
        : { data: [] },
      openTopicIds.length > 0
        ? supabase
            .from('topics')
            .select('id, statement, category, status')
            .in('id', openTopicIds)
        : { data: [] },
    ])

    const authorMap2 = new Map(openAuthors?.map((a) => [a.id, a]) ?? [])
    const topicMap = new Map(openTopics?.map((t) => [t.id, t]) ?? [])

    const openQuestions: OpenQuestion[] = (openRaw ?? [])
      .slice(0, 10)
      .map((q) => ({
        id: q.id,
        topic_id: q.topic_id,
        content: q.content,
        upvotes: q.upvotes ?? 0,
        answer_count: q.answer_count ?? 0,
        created_at: q.created_at,
        author: authorMap2.get(q.author_id) ?? null,
        topic: topicMap.get(q.topic_id) ?? null,
      }))

    const uniqueQuestioners = questionerMap.size
    const uniqueAnswerers = answererMap.size

    return NextResponse.json({
      topQuestioners,
      topAnswerers,
      openQuestions,
      stats: {
        total_questions: totalQuestions ?? 0,
        total_answers: totalAnswers ?? 0,
        answered_questions: answeredQuestions ?? 0,
        unique_questioners: uniqueQuestioners,
        unique_answerers: uniqueAnswerers,
      },
    } satisfies QALeadersResponse)
  } catch (err) {
    console.error('/api/questions/leaders error:', err)
    return NextResponse.json({ error: 'Failed to load leaders' }, { status: 500 })
  }
}
