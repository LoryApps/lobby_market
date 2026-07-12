import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HallOfFameProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface HallOfFameExchange {
  id: string
  question_text: string
  context_text: string | null
  category: string
  question_upvotes: number
  answered_at: string
  questioner: HallOfFameProfile
  minister: HallOfFameProfile
  answer: {
    id: string
    answer_text: string
    answer_upvotes: number
    topic_links: string[]
    created_at: string
  }
  topic_statement: string | null
  combined_score: number
}

export interface MinisterStat {
  minister: HallOfFameProfile
  total_answered: number
  total_answer_upvotes: number
  avg_upvotes: number
  best_answer_upvotes: number
}

export interface HallOfFameResponse {
  top_exchanges: HallOfFameExchange[]
  top_ministers: MinisterStat[]
  category_best: Record<string, HallOfFameExchange>
  stats: {
    total_questions: number
    total_answered: number
    total_answer_upvotes: number
    total_question_upvotes: number
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // ── Fetch all answered questions with their answers and profiles ──────────
  const { data: rawQuestions, error } = await supabase
    .from('civic_minister_questions')
    .select(`
      id,
      question_text,
      context_text,
      category,
      upvote_count,
      answered_at,
      topic_id,
      questioner:profiles!questioner_id(id, username, display_name, avatar_url, role),
      minister:profiles!minister_id(id, username, display_name, avatar_url, role),
      answer:civic_minister_answers!question_id(
        id,
        answer_text,
        upvote_count,
        topic_links,
        created_at
      )
    `)
    .eq('status', 'answered')
    .not('answer', 'is', null)
    .order('upvote_count', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const questions = rawQuestions ?? []

  // ── Fetch topic statements for enrichment ────────────────────────────────
  const topicIds = [...new Set(
    questions.map((q: Record<string, unknown>) => q.topic_id as string | null).filter(Boolean)
  )] as string[]

  const topicMap: Record<string, string> = {}
  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement')
      .in('id', topicIds)
    for (const t of topics ?? []) {
      topicMap[(t as { id: string; statement: string }).id] = (t as { id: string; statement: string }).statement
    }
  }

  // ── Build exchanges ──────────────────────────────────────────────────────
  const exchanges: HallOfFameExchange[] = questions
    .filter((q: Record<string, unknown>) => q.answer)
    .map((q: Record<string, unknown>) => {
      const answer = (Array.isArray(q.answer) ? q.answer[0] : q.answer) as {
        id: string; answer_text: string; upvote_count: number; topic_links: string[]; created_at: string
      }
      return {
        id: q.id as string,
        question_text: q.question_text as string,
        context_text: q.context_text as string | null,
        category: q.category as string,
        question_upvotes: (q.upvote_count as number) ?? 0,
        answered_at: q.answered_at as string,
        questioner: q.questioner as HallOfFameProfile,
        minister: q.minister as HallOfFameProfile,
        answer: {
          id: answer.id,
          answer_text: answer.answer_text,
          answer_upvotes: answer.upvote_count ?? 0,
          topic_links: answer.topic_links ?? [],
          created_at: answer.created_at,
        },
        topic_statement: (q.topic_id as string) ? (topicMap[q.topic_id as string] ?? null) : null,
        combined_score: ((q.upvote_count as number) ?? 0) + (answer.upvote_count ?? 0),
      }
    })
    .sort((a, b) => b.combined_score - a.combined_score)

  // ── Top 20 exchanges ─────────────────────────────────────────────────────
  const top_exchanges = exchanges.slice(0, 20)

  // ── Category best ────────────────────────────────────────────────────────
  const category_best: Record<string, HallOfFameExchange> = {}
  for (const ex of exchanges) {
    if (!category_best[ex.category] || ex.combined_score > category_best[ex.category].combined_score) {
      category_best[ex.category] = ex
    }
  }

  // ── Minister stats ───────────────────────────────────────────────────────
  const ministerMap: Record<string, {
    minister: HallOfFameProfile
    total_answered: number
    total_answer_upvotes: number
    best_answer_upvotes: number
  }> = {}

  for (const ex of exchanges) {
    const id = ex.minister.id
    if (!ministerMap[id]) {
      ministerMap[id] = {
        minister: ex.minister,
        total_answered: 0,
        total_answer_upvotes: 0,
        best_answer_upvotes: 0,
      }
    }
    ministerMap[id].total_answered += 1
    ministerMap[id].total_answer_upvotes += ex.answer.answer_upvotes
    ministerMap[id].best_answer_upvotes = Math.max(
      ministerMap[id].best_answer_upvotes,
      ex.answer.answer_upvotes
    )
  }

  const top_ministers: MinisterStat[] = Object.values(ministerMap)
    .map((m) => ({
      ...m,
      avg_upvotes:
        m.total_answered > 0
          ? Math.round((m.total_answer_upvotes / m.total_answered) * 10) / 10
          : 0,
    }))
    .sort((a, b) => b.total_answer_upvotes - a.total_answer_upvotes)
    .slice(0, 10)

  // ── Platform stats ───────────────────────────────────────────────────────
  const [totalRes, answeredRes] = await Promise.all([
    supabase
      .from('civic_minister_questions')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('civic_minister_questions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'answered'),
  ])

  const totalQuestionUpvotes = questions.reduce(
    (sum: number, q: Record<string, unknown>) => sum + ((q.upvote_count as number) ?? 0),
    0
  )
  const totalAnswerUpvotes = exchanges.reduce(
    (sum, ex) => sum + ex.answer.answer_upvotes,
    0
  )

  return NextResponse.json({
    top_exchanges,
    top_ministers,
    category_best,
    stats: {
      total_questions: totalRes.count ?? 0,
      total_answered: answeredRes.count ?? 0,
      total_question_upvotes: totalQuestionUpvotes,
      total_answer_upvotes: totalAnswerUpvotes,
    },
  } satisfies HallOfFameResponse)
}
