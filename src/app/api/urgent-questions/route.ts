import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface UQAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

export interface UQResponse {
  id: string
  response_text: string
  is_official: boolean
  created_at: string
  responder: UQAuthor
}

export interface UQSupplementary {
  id: string
  supplementary: string
  upvotes: number
  created_at: string
  author: UQAuthor
}

export interface UrgentQuestion {
  id: string
  question_text: string
  context_note: string | null
  seconds_count: number
  status: 'submitted' | 'certified' | 'answered' | 'expired'
  created_at: string
  expires_at: string
  topic_id: string | null
  author: UQAuthor
  addressed_to: UQAuthor | null
  responses: UQResponse[]
  supplementaries: UQSupplementary[]
  user_has_seconded: boolean
  topic_statement?: string | null
}

export interface UQListResponse {
  questions: UrgentQuestion[]
  user_asked_today: boolean
}

// ── GET: list all active urgent questions ─────────────────────────────────────

export async function GET(): Promise<NextResponse<UQListResponse | { error: string }>> {
  const supabase = await createClient()

  // Expire stale questions first
  await supabase.rpc('expire_urgent_questions').maybeSingle()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: rows, error } = await supabase
    .from('urgent_questions')
    .select(`
      id, question_text, context_note, seconds_count, status, created_at, expires_at, topic_id,
      author:profiles!author_id(id, username, display_name, avatar_url, role, clout),
      addressed_to:profiles!addressed_to_id(id, username, display_name, avatar_url, role, clout),
      responses:urgent_question_responses(
        id, response_text, is_official, created_at,
        responder:profiles!responder_id(id, username, display_name, avatar_url, role, clout)
      ),
      supplementaries:urgent_question_supplementaries(
        id, supplementary, upvotes, created_at,
        author:profiles!author_id(id, username, display_name, avatar_url, role, clout)
      )
    `)
    .in('status', ['submitted', 'certified', 'answered'])
    .order('seconds_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Topic statements for linked topics
  const topicIds = (rows ?? []).filter((r: { topic_id: string | null }) => r.topic_id).map((r: { topic_id: string }) => r.topic_id)
  let topicMap: Record<string, string> = {}
  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement')
      .in('id', topicIds)
    if (topics) {
      topicMap = Object.fromEntries(topics.map((t: { id: string; statement: string }) => [t.id, t.statement]))
    }
  }

  // Check which questions the user has seconded
  let userSeconds: string[] = []
  let userAskedToday = false
  if (user) {
    const { data: secondsData } = await supabase
      .from('urgent_question_seconds')
      .select('question_id')
      .eq('user_id', user.id)
      .in('question_id', (rows ?? []).map((r: { id: string }) => r.id))
    userSeconds = (secondsData ?? []).map((s: { question_id: string }) => s.question_id)

    // Check if user already asked a question today
    const { count } = await supabase
      .from('urgent_questions')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', user.id)
      .gte('created_at', new Date(Date.now() - 86_400_000).toISOString())
    userAskedToday = (count ?? 0) > 0
  }

  const questions: UrgentQuestion[] = (rows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    question_text: r.question_text as string,
    context_note: r.context_note as string | null,
    seconds_count: r.seconds_count as number,
    status: r.status as UrgentQuestion['status'],
    created_at: r.created_at as string,
    expires_at: r.expires_at as string,
    topic_id: r.topic_id as string | null,
    author: r.author as UQAuthor,
    addressed_to: r.addressed_to as UQAuthor | null,
    responses: (r.responses as UQResponse[] | null) ?? [],
    supplementaries: (r.supplementaries as UQSupplementary[] | null) ?? [],
    user_has_seconded: userSeconds.includes(r.id as string),
    topic_statement: r.topic_id ? topicMap[r.topic_id as string] ?? null : null,
  }))

  return NextResponse.json({ questions, user_asked_today: userAskedToday })
}

// ── POST: submit a new urgent question ───────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { question_text, context_note, addressed_to_id, topic_id } = body

  if (!question_text || question_text.length < 20 || question_text.length > 300) {
    return NextResponse.json({ error: 'Question must be 20–300 characters' }, { status: 400 })
  }

  // 1 UQ per user per 24 h
  const { count } = await supabase
    .from('urgent_questions')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', user.id)
    .gte('created_at', new Date(Date.now() - 86_400_000).toISOString())

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'You may only submit one Urgent Question per day' }, { status: 429 })
  }

  const { data, error } = await supabase
    .from('urgent_questions')
    .insert({
      author_id: user.id,
      question_text: question_text.trim(),
      context_note: context_note?.trim() || null,
      addressed_to_id: addressed_to_id || null,
      topic_id: topic_id || null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

// ── PATCH: second a question / submit response / supplementary ────────────────

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action, question_id, response_text, supplementary, is_official } = body

  if (!question_id) return NextResponse.json({ error: 'question_id required' }, { status: 400 })

  if (action === 'second') {
    // Toggle second
    const { count } = await supabase
      .from('urgent_question_seconds')
      .select('question_id', { count: 'exact', head: true })
      .eq('question_id', question_id)
      .eq('user_id', user.id)

    if ((count ?? 0) > 0) {
      await supabase.from('urgent_question_seconds').delete()
        .eq('question_id', question_id).eq('user_id', user.id)
      await supabase.from('urgent_questions')
        .update({ seconds_count: supabase.rpc('greatest', { a: 0, b: -1 }) as unknown as number })
        .eq('id', question_id)
      // Use raw decrement
      await supabase.rpc('decrement_uq_seconds', { qid: question_id }).maybeSingle()
      return NextResponse.json({ seconded: false })
    } else {
      await supabase.from('urgent_question_seconds').insert({ question_id, user_id: user.id })
      // Increment seconds_count and potentially certify
      const { data: q } = await supabase
        .from('urgent_questions')
        .select('seconds_count, status')
        .eq('id', question_id)
        .single()
      const newCount = ((q?.seconds_count ?? 0) + 1)
      const updates: Record<string, unknown> = { seconds_count: newCount }
      if (newCount >= 5 && q?.status === 'submitted') updates.status = 'certified'
      await supabase.from('urgent_questions').update(updates).eq('id', question_id)
      return NextResponse.json({ seconded: true })
    }
  }

  if (action === 'respond') {
    if (!response_text || response_text.length < 20 || response_text.length > 1000) {
      return NextResponse.json({ error: 'Response must be 20–1000 characters' }, { status: 400 })
    }
    const { error } = await supabase.from('urgent_question_responses').insert({
      question_id,
      responder_id: user.id,
      response_text: response_text.trim(),
      is_official: is_official ?? false,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Mark question as answered
    await supabase.from('urgent_questions')
      .update({ status: 'answered' })
      .eq('id', question_id)
    return NextResponse.json({ ok: true })
  }

  if (action === 'supplementary') {
    if (!supplementary || supplementary.length < 10 || supplementary.length > 300) {
      return NextResponse.json({ error: 'Supplementary must be 10–300 characters' }, { status: 400 })
    }
    const { error } = await supabase.from('urgent_question_supplementaries').insert({
      question_id,
      author_id: user.id,
      supplementary: supplementary.trim(),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
