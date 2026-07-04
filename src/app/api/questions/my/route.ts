import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MyQuestion {
  id: string
  topic_id: string
  content: string
  upvotes: number
  answer_count: number
  is_answered: boolean
  created_at: string
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null
}

export interface MyAnswer {
  id: string
  question_id: string
  content: string
  upvotes: number
  is_accepted: boolean
  created_at: string
  question: {
    id: string
    content: string
    topic_id: string
    is_answered: boolean
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null
}

export interface MyExpertise {
  category: string
  accepted_count: number
  tier: 'contributor' | 'expert' | 'sage'
}

export interface OpportunityQuestion {
  id: string
  topic_id: string
  content: string
  upvotes: number
  answer_count: number
  created_at: string
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null
}

export interface MyQAResponse {
  questions: MyQuestion[]
  answers: MyAnswer[]
  expertise: MyExpertise[]
  opportunities: OpportunityQuestion[]
  stats: {
    questions_asked: number
    answers_given: number
    answers_accepted: number
    total_question_upvotes: number
    total_answer_upvotes: number
  }
}

// ─── GET /api/questions/my ────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── 1. Fetch user's questions, answers, and expertise in parallel ──────────
    const [
      { data: rawQuestions },
      { data: rawAnswers },
      { data: expertiseRaw },
    ] = await Promise.all([
      supabase
        .from('topic_questions')
        .select('id, topic_id, content, upvotes, answer_count, is_answered, created_at')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('topic_answers')
        .select('id, question_id, content, upvotes, is_accepted, created_at')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('qa_user_expertise')
        .select('category, accepted_count, tier')
        .eq('user_id', user.id)
        .order('accepted_count', { ascending: false }),
    ])

    const questions = rawQuestions ?? []
    const answers = rawAnswers ?? []
    const expertise = (expertiseRaw ?? []) as MyExpertise[]

    // ── 2. Collect IDs for enrichment ─────────────────────────────────────────
    const questionTopicIds = [...new Set(questions.map((q) => q.topic_id))]
    const answerQuestionIds = [...new Set(answers.map((a) => a.question_id))]
    const expertCategories = expertise
      .filter((e) => e.tier === 'expert' || e.tier === 'sage')
      .map((e) => e.category)
      .slice(0, 3)

    // ── 3. Fetch topics for questions + questions for answers (parallel) ────────
    type TopicRow = { id: string; statement: string; category: string | null; status: string }
    type QuestionRow = { id: string; content: string; topic_id: string; is_answered: boolean }

    const [{ data: questionTopics }, { data: answerQuestions }] = await Promise.all([
      questionTopicIds.length > 0
        ? supabase
            .from('topics')
            .select('id, statement, category, status')
            .in('id', questionTopicIds)
        : { data: [] as TopicRow[] },
      answerQuestionIds.length > 0
        ? supabase
            .from('topic_questions')
            .select('id, content, topic_id, is_answered')
            .in('id', answerQuestionIds)
        : { data: [] as QuestionRow[] },
    ])

    // ── 4. Fetch topics for answers + topics in expert categories (parallel) ───
    const answerTopicIds = [...new Set((answerQuestions ?? []).map((q) => q.topic_id))].filter(
      (id) => !questionTopicIds.includes(id)
    )

    const [{ data: answerTopics }, { data: expertCategoryTopics }] = await Promise.all([
      answerTopicIds.length > 0
        ? supabase
            .from('topics')
            .select('id, statement, category, status')
            .in('id', answerTopicIds)
        : { data: [] as TopicRow[] },
      expertCategories.length > 0
        ? supabase
            .from('topics')
            .select('id, statement, category, status')
            .in('category', expertCategories)
            .limit(80)
        : { data: [] as TopicRow[] },
    ])

    // ── 5. Build unified topic map ─────────────────────────────────────────────
    const topicMap = new Map<string, TopicRow>()
    for (const t of [
      ...(questionTopics ?? []),
      ...(answerTopics ?? []),
      ...(expertCategoryTopics ?? []),
    ]) {
      topicMap.set(t.id, t)
    }

    // ── 6. Fetch expert-category opportunity questions ─────────────────────────
    const oppTopicIds = (expertCategoryTopics ?? []).map((t) => t.id)
    let opportunities: OpportunityQuestion[] = []

    if (oppTopicIds.length > 0) {
      const { data: oppRaw } = await supabase
        .from('topic_questions')
        .select('id, topic_id, content, upvotes, answer_count, created_at')
        .in('topic_id', oppTopicIds)
        .eq('is_answered', false)
        .neq('author_id', user.id)
        .order('upvotes', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(15)

      opportunities = (oppRaw ?? []).map((q) => ({
        id: q.id,
        topic_id: q.topic_id,
        content: q.content,
        upvotes: q.upvotes ?? 0,
        answer_count: q.answer_count ?? 0,
        created_at: q.created_at,
        topic: topicMap.get(q.topic_id) ?? null,
      }))
    }

    // ── 7. Assemble ────────────────────────────────────────────────────────────
    const answerQuestionMap = new Map((answerQuestions ?? []).map((q) => [q.id, q]))

    const myQuestions: MyQuestion[] = questions.map((q) => ({
      id: q.id,
      topic_id: q.topic_id,
      content: q.content,
      upvotes: q.upvotes ?? 0,
      answer_count: q.answer_count ?? 0,
      is_answered: q.is_answered ?? false,
      created_at: q.created_at,
      topic: topicMap.get(q.topic_id) ?? null,
    }))

    const myAnswers: MyAnswer[] = answers.map((a) => {
      const aq = answerQuestionMap.get(a.question_id)
      return {
        id: a.id,
        question_id: a.question_id,
        content: a.content,
        upvotes: a.upvotes ?? 0,
        is_accepted: a.is_accepted ?? false,
        created_at: a.created_at,
        question: aq
          ? {
              id: aq.id,
              content: aq.content,
              topic_id: aq.topic_id,
              is_answered: aq.is_answered,
            }
          : null,
        topic: aq ? (topicMap.get(aq.topic_id) ?? null) : null,
      }
    })

    const stats = {
      questions_asked: myQuestions.length,
      answers_given: myAnswers.length,
      answers_accepted: myAnswers.filter((a) => a.is_accepted).length,
      total_question_upvotes: myQuestions.reduce((s, q) => s + q.upvotes, 0),
      total_answer_upvotes: myAnswers.reduce((s, a) => s + a.upvotes, 0),
    }

    return NextResponse.json({
      questions: myQuestions,
      answers: myAnswers,
      expertise,
      opportunities,
      stats,
    } satisfies MyQAResponse)
  } catch (err) {
    console.error('/api/questions/my error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
