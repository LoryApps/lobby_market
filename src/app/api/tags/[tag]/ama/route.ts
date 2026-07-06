import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface TagAMAResponse {
  sessions: {
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
    host: {
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
      clout: number
    } | null
    user_rsvped: boolean
  }[]
  total: number
  categories: string[]
}

export async function GET(
  req: NextRequest,
  { params }: { params: { tag: string } },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const tag = decodeURIComponent(params.tag).toLowerCase()

    const limit  = Math.min(parseInt(req.nextUrl.searchParams.get('limit')  ?? '20', 10), 50)
    const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10)
    const status = req.nextUrl.searchParams.get('status') ?? 'all'

    // Find top categories for topics that carry this tag
    const { data: taggedTopics } = await supabase
      .from('topics')
      .select('category')
      .contains('tags', [tag])
      .limit(500)

    const catCounts = new Map<string, number>()
    for (const topic of taggedTopics ?? []) {
      if (topic.category) {
        catCounts.set(topic.category, (catCounts.get(topic.category) ?? 0) + 1)
      }
    }

    const topCategories = Array.from(catCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat)

    if (topCategories.length === 0) {
      return NextResponse.json({ sessions: [], total: 0, categories: [] })
    }

    // Fetch AMA sessions in those categories
    let query = supabase
      .from('ama_sessions')
      .select('*', { count: 'exact' })
      .in('category', topCategories)
      .order('scheduled_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    } else {
      query = query.in('status', ['upcoming', 'live', 'ended'])
    }

    query = query.range(offset, offset + limit - 1)

    const { data: rows, count, error } = await query
    if (error) throw error

    if (!rows || rows.length === 0) {
      return NextResponse.json({ sessions: [], total: count ?? 0, categories: topCategories })
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

    const sessions = rows.map((row) => ({
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

    return NextResponse.json({ sessions, total: count ?? 0, categories: topCategories })
  } catch (err) {
    console.error('Tag AMA error:', err)
    return NextResponse.json({ error: 'Failed to load AMA sessions' }, { status: 500 })
  }
}
