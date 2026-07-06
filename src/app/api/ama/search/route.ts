import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Response types ───────────────────────────────────────────────────────────

export interface AMASearchHost {
  username: string
  display_name: string | null
  avatar_url: string | null
}

export interface AMASearchSession {
  id: string
  title: string
  description: string | null
  category: string | null
  status: string
  scheduled_at: string
  question_count: number
  answer_count: number
  host: AMASearchHost | null
}

export interface AMASearchQA {
  answer_id: string
  question_id: string
  session_id: string
  session_title: string
  session_category: string | null
  question_content: string
  question_upvotes: number
  answer_content: string
  host: AMASearchHost | null
}

export interface AMASearchResponse {
  sessions: AMASearchSession[]
  qas: AMASearchQA[]
  total: number
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()

    const url = req.nextUrl
    const q = url.searchParams.get('q')?.trim() ?? ''
    const category = url.searchParams.get('category')
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50)

    if (q.length < 2) {
      return NextResponse.json({ sessions: [], qas: [], total: 0 } as AMASearchResponse)
    }

    const pattern = `%${q}%`

    // ── 1. Search sessions by title or description ────────────────────────────

    let sessionQuery = supabase
      .from('ama_sessions')
      .select('id, host_id, title, description, category, status, scheduled_at, question_count, answer_count')
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .in('status', ['upcoming', 'live', 'ended'])
      .order('scheduled_at', { ascending: false })
      .limit(10)

    if (category) sessionQuery = sessionQuery.eq('category', category)

    const { data: sessionRows } = await sessionQuery

    // ── 2. Search questions (answered ones) by content ────────────────────────

    const questionQuery = supabase
      .from('ama_questions')
      .select('id, content, upvotes, session_id')
      .ilike('content', pattern)
      .eq('is_answered', true)
      .order('upvotes', { ascending: false })
      .limit(limit)

    const { data: questionRows } = await questionQuery

    // ── 3. Search answers by content ──────────────────────────────────────────

    const { data: answerRows } = await supabase
      .from('ama_answers')
      .select('id, question_id, session_id, host_id, content')
      .ilike('content', pattern)
      .limit(limit)

    // ── 4. Merge Q&A results, dedup by answer_id ──────────────────────────────

    // Fetch answers for matching questions (not already in answerRows)
    const existingAnswerQuestionIds = new Set((answerRows ?? []).map((a) => a.question_id))
    const missingQuestionIds = (questionRows ?? [])
      .map((q) => q.id)
      .filter((id) => !existingAnswerQuestionIds.has(id))

    let extraAnswers: { id: string; question_id: string; session_id: string; host_id: string; content: string }[] = []
    if (missingQuestionIds.length > 0) {
      const { data } = await supabase
        .from('ama_answers')
        .select('id, question_id, session_id, host_id, content')
        .in('question_id', missingQuestionIds)
      extraAnswers = (data ?? []) as typeof extraAnswers
    }

    const allAnswers = [...(answerRows ?? []), ...extraAnswers] as {
      id: string
      question_id: string
      session_id: string
      host_id: string
      content: string
    }[]

    // Dedup by answer_id
    const seenAnswerIds = new Set<string>()
    const dedupedAnswers = allAnswers.filter((a) => {
      if (seenAnswerIds.has(a.id)) return false
      seenAnswerIds.add(a.id)
      return true
    })

    // Build a question lookup map
    const questionMap = new Map((questionRows ?? []).map((q) => [q.id, q]))

    // Fetch questions for answers that came from the answer-content search
    const missingFromMap = dedupedAnswers
      .map((a) => a.question_id)
      .filter((qid) => !questionMap.has(qid))

    if (missingFromMap.length > 0) {
      const { data: extraQs } = await supabase
        .from('ama_questions')
        .select('id, content, upvotes')
        .in('id', missingFromMap)
      for (const q of extraQs ?? []) questionMap.set(q.id, q)
    }

    // Fetch sessions for all QA results
    const qaSessionIds = [...new Set(dedupedAnswers.map((a) => a.session_id))]
    let qaSessionMap = new Map<string, { id: string; title: string; category: string | null; status: string }>()
    if (qaSessionIds.length > 0) {
      const { data: qaSessions } = await supabase
        .from('ama_sessions')
        .select('id, title, category, status')
        .in('id', qaSessionIds)
        .eq('status', 'ended')
      qaSessionMap = new Map((qaSessions ?? []).map((s) => [s.id, s]))
    }

    // ── 5. Fetch host profiles for sessions + QAs ─────────────────────────────

    const sessionHostIds = [...new Set((sessionRows ?? []).map((s) => s.host_id))]
    const qaHostIds = [...new Set(dedupedAnswers.map((a) => a.host_id))]
    const allHostIds = [...new Set([...sessionHostIds, ...qaHostIds])]

    let profileMap = new Map<string, AMASearchHost>()
    if (allHostIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', allHostIds)
      profileMap = new Map(
        (profiles ?? []).map((p) => [
          p.id,
          { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url },
        ])
      )
    }

    // ── 6. Shape sessions ─────────────────────────────────────────────────────

    const sessions: AMASearchSession[] = (sessionRows ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      category: s.category,
      status: s.status,
      scheduled_at: s.scheduled_at,
      question_count: s.question_count ?? 0,
      answer_count: s.answer_count ?? 0,
      host: profileMap.get(s.host_id) ?? null,
    }))

    // ── 7. Shape Q&A results ──────────────────────────────────────────────────

    const qas: AMASearchQA[] = dedupedAnswers
      .filter((a) => {
        const session = qaSessionMap.get(a.session_id)
        // Only include Q&As from ended sessions (those are the complete ones)
        return session !== undefined
      })
      .map((a) => {
        const question = questionMap.get(a.question_id)
        const session = qaSessionMap.get(a.session_id)!
        return {
          answer_id: a.id,
          question_id: a.question_id,
          session_id: a.session_id,
          session_title: session.title,
          session_category: session.category,
          question_content: question?.content ?? '',
          question_upvotes: (question as { upvotes?: number } | undefined)?.upvotes ?? 0,
          answer_content: a.content,
          host: profileMap.get(a.host_id) ?? null,
        }
      })
      .slice(0, limit)

    // Filter out sessions that already appear as session results
    const existingSessionIds = new Set(sessions.map((s) => s.id))
    // Remove QAs whose session is already shown in the sessions section if q matches the session title
    // (no dedup needed — QAs are separate type)

    void existingSessionIds

    const total = sessions.length + qas.length

    return NextResponse.json({ sessions, qas, total } as AMASearchResponse)
  } catch (err) {
    console.error('AMA search error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
