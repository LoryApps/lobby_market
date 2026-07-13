import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface WHSpeech {
  id: string
  session_id: string
  content: string
  hear_count: number
  order_num: number
  created_at: string
  speaker: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  }
  user_heard: boolean
}

export interface WHSessionDetail {
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
    total_votes: number
  } | null
  speeches: WHSpeech[]
  user_supported: boolean
}

interface RouteParams {
  params: { id: string }
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: row, error } = await supabase
    .from('westminster_hall_sessions')
    .select(`
      id, title, motion, status, scheduled_at, duration_mins,
      started_at, concluded_at, support_count, support_threshold,
      speech_count, category, created_at,
      requester:profiles!westminster_hall_sessions_requester_id_fkey(
        id, username, display_name, avatar_url, role
      ),
      topic:topics!westminster_hall_sessions_topic_id_fkey(
        id, statement, category, status, blue_pct, total_votes
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !row) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Speeches
  const { data: speechRows } = await supabase
    .from('westminster_hall_speeches')
    .select(`
      id, session_id, content, hear_count, order_num, created_at,
      speaker:profiles!westminster_hall_speeches_speaker_id_fkey(
        id, username, display_name, avatar_url, role, clout
      )
    `)
    .eq('session_id', params.id)
    .order('created_at', { ascending: true })
    .limit(100)

  // User's hear votes
  let heardIds = new Set<string>()
  let userSupported = false
  if (user) {
    const [hearRes, supportRes] = await Promise.all([
      supabase
        .from('westminster_hall_hear_votes')
        .select('speech_id')
        .eq('user_id', user.id),
      supabase
        .from('westminster_hall_supporters')
        .select('session_id')
        .eq('user_id', user.id)
        .eq('session_id', params.id)
        .maybeSingle(),
    ])
    heardIds = new Set((hearRes.data ?? []).map((r: { speech_id: string }) => r.speech_id))
    userSupported = !!supportRes.data
  }

  const speeches: WHSpeech[] = (speechRows ?? []).map((s) => ({
    ...s,
    speaker: Array.isArray(s.speaker) ? s.speaker[0] : s.speaker,
    user_heard: heardIds.has(s.id),
  })) as WHSpeech[]

  const session: WHSessionDetail = {
    ...(row as Omit<WHSessionDetail, 'speeches' | 'user_supported' | 'requester' | 'topic'>),
    requester: Array.isArray(row.requester) ? row.requester[0] : row.requester,
    topic: Array.isArray(row.topic) ? (row.topic[0] ?? null) : row.topic,
    speeches,
    user_supported: userSupported,
  } as WHSessionDetail

  return NextResponse.json(session)
}

// POST /api/westminster-hall/sessions/[id] — add a speech or toggle support
export async function POST(req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { action: string; content?: string; speech_id?: string }
  const { action } = body

  if (action === 'support') {
    // Toggle support for session
    const { data: existing } = await supabase
      .from('westminster_hall_supporters')
      .select('session_id')
      .eq('session_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('westminster_hall_supporters')
        .delete()
        .eq('session_id', params.id)
        .eq('user_id', user.id)
      return NextResponse.json({ supported: false })
    } else {
      const { error } = await supabase
        .from('westminster_hall_supporters')
        .insert({ session_id: params.id, user_id: user.id })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ supported: true })
    }
  }

  if (action === 'speech') {
    const content = body.content?.trim()
    if (!content || content.length < 5 || content.length > 500) {
      return NextResponse.json({ error: 'Speech must be 5–500 characters' }, { status: 400 })
    }

    const { data: session } = await supabase
      .from('westminster_hall_sessions')
      .select('status')
      .eq('id', params.id)
      .single()

    if (session?.status !== 'live') {
      return NextResponse.json({ error: 'Session is not live' }, { status: 400 })
    }

    const { data: speech, error } = await supabase
      .from('westminster_hall_speeches')
      .insert({
        session_id: params.id,
        speaker_id: user.id,
        content,
        order_num: Date.now(),
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id: speech.id }, { status: 201 })
  }

  if (action === 'hear') {
    const speechId = body.speech_id
    if (!speechId) return NextResponse.json({ error: 'speech_id required' }, { status: 400 })

    const { data: existing } = await supabase
      .from('westminster_hall_hear_votes')
      .select('speech_id')
      .eq('speech_id', speechId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('westminster_hall_hear_votes')
        .delete()
        .eq('speech_id', speechId)
        .eq('user_id', user.id)
      return NextResponse.json({ heard: false })
    } else {
      const { error } = await supabase
        .from('westminster_hall_hear_votes')
        .insert({ speech_id: speechId, user_id: user.id })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ heard: true })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
