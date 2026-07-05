import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface AMAHost {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

export interface AMASession {
  id: string
  host_id: string
  title: string
  description: string | null
  category: string | null
  scheduled_at: string
  started_at: string | null
  ended_at: string | null
  status: 'upcoming' | 'live' | 'ended' | 'cancelled'
  question_count: number
  answer_count: number
  rsvp_count: number
  created_at: string
  host: AMAHost | null
  user_rsvped: boolean
}

export interface AMAListResponse {
  sessions: AMASession[]
  total: number
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const url = req.nextUrl
    const status = url.searchParams.get('status') ?? 'all'
    const category = url.searchParams.get('category')
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50)
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)

    let query = supabase
      .from('ama_sessions')
      .select('*', { count: 'exact' })
      .order('scheduled_at', { ascending: true })

    if (status !== 'all') {
      query = query.eq('status', status)
    } else {
      query = query.in('status', ['upcoming', 'live', 'ended'])
    }

    if (category) {
      query = query.eq('category', category)
    }

    query = query.range(offset, offset + limit - 1)

    const { data: rows, count, error } = await query

    if (error) throw error

    if (!rows || rows.length === 0) {
      return NextResponse.json({ sessions: [], total: count ?? 0 })
    }

    // Fetch host profiles
    const hostIds = [...new Set(rows.map((r) => r.host_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', hostIds)

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

    // Fetch user RSVPs
    let rsvpedIds = new Set<string>()
    if (user) {
      const sessionIds = rows.map((r) => r.id)
      const { data: rsvps } = await supabase
        .from('ama_rsvps')
        .select('session_id')
        .eq('user_id', user.id)
        .in('session_id', sessionIds)
      rsvpedIds = new Set((rsvps ?? []).map((r) => r.session_id))
    }

    const sessions: AMASession[] = rows.map((row) => ({
      id: row.id,
      host_id: row.host_id,
      title: row.title,
      description: row.description,
      category: row.category,
      scheduled_at: row.scheduled_at,
      started_at: row.started_at,
      ended_at: row.ended_at,
      status: row.status,
      question_count: row.question_count ?? 0,
      answer_count: row.answer_count ?? 0,
      rsvp_count: row.rsvp_count ?? 0,
      created_at: row.created_at,
      host: profileMap.get(row.host_id) ?? null,
      user_rsvped: rsvpedIds.has(row.id),
    }))

    return NextResponse.json({ sessions, total: count ?? 0 })
  } catch (err) {
    console.error('AMA list error:', err)
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as {
      title?: string
      description?: string
      category?: string
      scheduled_at?: string
    }

    const { title, description, category, scheduled_at } = body

    if (!title || title.trim().length < 5) {
      return NextResponse.json({ error: 'Title must be at least 5 characters' }, { status: 400 })
    }
    if (!scheduled_at) {
      return NextResponse.json({ error: 'scheduled_at is required' }, { status: 400 })
    }

    const scheduledDate = new Date(scheduled_at)
    if (isNaN(scheduledDate.getTime()) || scheduledDate < new Date()) {
      return NextResponse.json({ error: 'scheduled_at must be a future date' }, { status: 400 })
    }

    const { data: session, error } = await supabase
      .from('ama_sessions')
      .insert({
        host_id: user.id,
        title: title.trim().slice(0, 120),
        description: description?.trim().slice(0, 600) ?? null,
        category: category ?? null,
        scheduled_at,
        status: 'upcoming',
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ session }, { status: 201 })
  } catch (err) {
    console.error('AMA create error:', err)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
