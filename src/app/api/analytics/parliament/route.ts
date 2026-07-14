import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BillStat {
  id: string
  short_title: string
  category: string | null
  stage: string
  status: string
  votes_for: number
  votes_against: number
  created_at: string
}

export interface EdmStat {
  id: string
  title: string
  grounds: string
  category: string
  second_count: number
  status: string
  created_at: string
}

export interface QuestionStat {
  id: string
  type: 'pmq' | 'oral' | 'written'
  text: string
  department: string | null
  status: string
  is_answered: boolean
  upvotes: number
  created_at: string
}

export interface LordsReviewStat {
  id: string
  law_statement: string
  verdict: 'ratify' | 'send_back' | 'abstain'
  amendment_note: string | null
  created_at: string
}

export type ParliamentaryRole =
  | 'The Legislator'
  | 'The Questioner'
  | 'The Lord'
  | 'The Campaigner'
  | 'The Back-Bencher'

export interface ParliamentAnalyticsResponse {
  // Totals
  total_bills: number
  total_edms: number
  total_pmqs: number
  total_oral_questions: number
  total_written_questions: number
  total_lords_reviews: number

  // Derived
  bills_enacted: number
  bills_in_progress: number
  edm_seconds_gathered: number
  questions_answered: number
  lords_ratifications: number

  // Role archetype
  role: ParliamentaryRole

  // Recent records
  recent_bills: BillStat[]
  recent_edms: EdmStat[]
  recent_questions: QuestionStat[]
  recent_lords: LordsReviewStat[]
}

// ─── Role logic ───────────────────────────────────────────────────────────────

function deriveRole(
  bills: number,
  edms: number,
  questions: number,
  lords: number,
): ParliamentaryRole {
  if (bills === 0 && edms === 0 && questions === 0 && lords === 0) return 'The Back-Bencher'
  const scores: { role: ParliamentaryRole; score: number }[] = [
    { role: 'The Legislator', score: bills * 5 },
    { role: 'The Questioner', score: questions * 2 },
    { role: 'The Lord', score: lords * 3 },
    { role: 'The Campaigner', score: edms * 3 },
  ]
  scores.sort((a, b) => b.score - a.score)
  return scores[0].score > 0 ? scores[0].role : 'The Back-Bencher'
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Bills sponsored ───────────────────────────────────────────────────────
    const { data: bills } = await supabase
      .from('civic_bills')
      .select('id, short_title, category, stage, status, votes_for, votes_against, created_at')
      .eq('sponsor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const billsList = (bills ?? []) as BillStat[]
    const billsEnacted = billsList.filter((b) => b.status === 'enacted').length
    const billsInProgress = billsList.filter((b) =>
      b.status === 'introduced' || b.status === 'progressing'
    ).length

    // ── EDMs filed ────────────────────────────────────────────────────────────
    const { data: edms } = await supabase
      .from('early_day_motions')
      .select('id, title, grounds, category, second_count, status, created_at')
      .eq('filed_by', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const edmsList = (edms ?? []) as EdmStat[]
    const totalEdmSeconds = edmsList.reduce((s, e) => s + (e.second_count ?? 0), 0)

    // ── PMQ questions ─────────────────────────────────────────────────────────
    const { data: pmqs } = await supabase
      .from('pmq_questions')
      .select('id, question, upvotes, status, created_at')
      .eq('asker_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    const pmqList: QuestionStat[] = (pmqs ?? []).map((q) => ({
      id: q.id,
      type: 'pmq',
      text: q.question,
      department: null,
      status: q.status,
      is_answered: q.status === 'answered',
      upvotes: q.upvotes ?? 0,
      created_at: q.created_at,
    }))

    // ── Oral questions ────────────────────────────────────────────────────────
    const { data: oralQs } = await supabase
      .from('civic_oral_questions')
      .select('id, question_text, upvotes, is_answered, created_at')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    const oralList: QuestionStat[] = (oralQs ?? []).map((q) => ({
      id: q.id,
      type: 'oral',
      text: q.question_text,
      department: null,
      status: q.is_answered ? 'answered' : 'open',
      is_answered: q.is_answered ?? false,
      upvotes: q.upvotes ?? 0,
      created_at: q.created_at,
    }))

    // ── Written questions ─────────────────────────────────────────────────────
    const { data: writtenQs } = await supabase
      .from('civic_written_questions')
      .select('id, question_text, department, upvotes, status, answered_at, created_at')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    const writtenList: QuestionStat[] = (writtenQs ?? []).map((q) => ({
      id: q.id,
      type: 'written',
      text: q.question_text,
      department: q.department ?? null,
      status: q.status,
      is_answered: q.status === 'answered',
      upvotes: q.upvotes ?? 0,
      created_at: q.created_at,
    }))

    // Merge all questions sorted by date desc
    const allQuestions: QuestionStat[] = [
      ...pmqList,
      ...oralList,
      ...writtenList,
    ].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    const questionsAnswered = allQuestions.filter((q) => q.is_answered).length

    // ── Lords reviews ─────────────────────────────────────────────────────────
    const { data: lordsRaw } = await supabase
      .from('lords_reviews')
      .select('id, verdict, amendment_note, created_at, law_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    const lordsWithLaw: LordsReviewStat[] = []
    if (lordsRaw && lordsRaw.length > 0) {
      const lawIds = [...new Set(lordsRaw.map((r) => r.law_id))]
      const { data: lawsData } = await supabase
        .from('laws')
        .select('id, statement')
        .in('id', lawIds)

      const lawMap = new Map((lawsData ?? []).map((l) => [l.id, l.statement]))
      for (const r of lordsRaw) {
        lordsWithLaw.push({
          id: r.id,
          law_statement: lawMap.get(r.law_id) ?? 'Unknown law',
          verdict: r.verdict,
          amendment_note: r.amendment_note ?? null,
          created_at: r.created_at,
        })
      }
    }

    const lordsRatifications = lordsWithLaw.filter((r) => r.verdict === 'ratify').length

    // ── Assemble response ─────────────────────────────────────────────────────
    const role = deriveRole(
      billsList.length,
      edmsList.length,
      allQuestions.length,
      lordsWithLaw.length,
    )

    const response: ParliamentAnalyticsResponse = {
      total_bills: billsList.length,
      total_edms: edmsList.length,
      total_pmqs: pmqList.length,
      total_oral_questions: oralList.length,
      total_written_questions: writtenList.length,
      total_lords_reviews: lordsWithLaw.length,

      bills_enacted: billsEnacted,
      bills_in_progress: billsInProgress,
      edm_seconds_gathered: totalEdmSeconds,
      questions_answered: questionsAnswered,
      lords_ratifications: lordsRatifications,

      role,

      recent_bills: billsList.slice(0, 5),
      recent_edms: edmsList.slice(0, 5),
      recent_questions: allQuestions.slice(0, 8),
      recent_lords: lordsWithLaw.slice(0, 5),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[analytics/parliament]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
