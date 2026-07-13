import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface PmqSession {
  id: string
  session_number: number
  coalition_id: string | null
  pm_user_id: string | null
  title: string
  status: 'open' | 'in_progress' | 'closed' | 'archived'
  questions_due_at: string
  closes_at: string
  created_at: string
  pm_profile?: {
    username: string
    display_name: string | null
    avatar_url: string | null
    clout_score: number | null
  } | null
  coalition?: {
    name: string
    color: string | null
  } | null
  question_count?: number
  answered_count?: number
}

export interface PmqsResponse {
  current: PmqSession | null
  past: PmqSession[]
}

export async function GET(): Promise<NextResponse<PmqsResponse>> {
  const supabase = await createClient()

  const { data: sessions } = await supabase
    .from('pmq_sessions')
    .select(`
      *,
      pm_profile:profiles!pm_user_id(username, display_name, avatar_url, clout_score),
      coalition:coalitions!coalition_id(name, color)
    `)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!sessions) {
    return NextResponse.json({ current: null, past: [] })
  }

  // Attach question/answer counts
  const enriched: PmqSession[] = await Promise.all(
    sessions.map(async (s) => {
      const { count: qCount } = await supabase
        .from('pmq_questions')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', s.id)

      const { count: aCount } = await supabase
        .from('pmq_answers')
        .select('pmq_questions!inner(session_id)', { count: 'exact', head: true })
        .eq('pmq_questions.session_id', s.id)

      return {
        ...s,
        pm_profile: s.pm_profile ?? null,
        coalition: s.coalition ?? null,
        question_count: qCount ?? 0,
        answered_count: aCount ?? 0,
      } as PmqSession
    })
  )

  const current = enriched.find((s) => s.status === 'open' || s.status === 'in_progress') ?? null
  const past = enriched.filter((s) => s.status === 'closed' || s.status === 'archived')

  return NextResponse.json({ current, past })
}
