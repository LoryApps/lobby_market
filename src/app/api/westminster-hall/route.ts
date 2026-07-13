import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface WHSession {
  id: string
  title: string
  motion: string
  status: string
  scheduled_at: string | null
  duration_mins: number
  started_at: string | null
  concluded_at: string | null
  support_count: number
  support_threshold: number
  speech_count: number
  category: string | null
  created_at: string
  requester: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  }
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
  } | null
  user_supported: boolean
}

export interface WHListResponse {
  sessions: WHSession[]
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const past = url.searchParams.get('past') === '1'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const base = supabase
    .from('westminster_hall_sessions')
    .select(`
      id, title, motion, status, scheduled_at, duration_mins,
      started_at, concluded_at, support_count, support_threshold,
      speech_count, category, created_at,
      requester:profiles!westminster_hall_sessions_requester_id_fkey(
        id, username, display_name, avatar_url, role
      ),
      topic:topics!westminster_hall_sessions_topic_id_fkey(
        id, statement, category, status, blue_pct
      )
    `)
    .limit(50)

  const { data: rows, error } = past
    ? await base
        .in('status', ['concluded', 'withdrawn'])
        .order('concluded_at', { ascending: false, nullsFirst: false })
    : await base
        .in('status', ['live', 'scheduled', 'approved', 'requested'])
        .order('status')
        .order('scheduled_at', { ascending: true, nullsFirst: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get user's supported sessions
  let supportedIds = new Set<string>()
  if (user) {
    const { data: supportRows } = await supabase
      .from('westminster_hall_supporters')
      .select('session_id')
      .eq('user_id', user.id)
    supportedIds = new Set((supportRows ?? []).map((r: { session_id: string }) => r.session_id))
  }

  const sessions: WHSession[] = (rows ?? []).map((row) => ({
    ...row,
    requester: Array.isArray(row.requester) ? row.requester[0] : row.requester,
    topic: Array.isArray(row.topic) ? (row.topic[0] ?? null) : row.topic,
    user_supported: supportedIds.has(row.id),
  })) as WHSession[]

  return NextResponse.json({ sessions })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    title: string
    motion: string
    topic_id?: string
    category?: string
    duration_mins?: number
  }

  const { title, motion, topic_id, category, duration_mins } = body
  if (!title?.trim() || !motion?.trim()) {
    return NextResponse.json({ error: 'Title and motion are required' }, { status: 400 })
  }
  if (title.length < 5 || title.length > 200) {
    return NextResponse.json({ error: 'Title must be 5–200 characters' }, { status: 400 })
  }
  if (motion.length < 10 || motion.length > 500) {
    return NextResponse.json({ error: 'Motion must be 10–500 characters' }, { status: 400 })
  }

  const validDurations = [30, 60, 90]
  const dur = duration_mins ?? 30
  if (!validDurations.includes(dur)) {
    return NextResponse.json({ error: 'Duration must be 30, 60, or 90 minutes' }, { status: 400 })
  }

  const { data: session, error } = await supabase
    .from('westminster_hall_sessions')
    .insert({
      requester_id: user.id,
      title: title.trim(),
      motion: motion.trim(),
      topic_id: topic_id ?? null,
      category: category ?? null,
      duration_mins: dur,
      status: 'requested',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: session.id }, { status: 201 })
}
