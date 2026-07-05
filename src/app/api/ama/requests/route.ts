import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── Shared types ───────────────────────────────────────────────────────────────

export interface AMARequestAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface AMARequestItem {
  id: string
  author_id: string
  title: string
  description: string | null
  category: string | null
  topic_id: string | null
  topic_statement: string | null
  upvote_count: number
  fulfilled_session_id: string | null
  fulfilled_at: string | null
  created_at: string
  author: AMARequestAuthor | null
  user_voted: boolean
}

export interface AMARequestsResponse {
  requests: AMARequestItem[]
  total: number
}

// ── GET /api/ama/requests ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const url = req.nextUrl
    const category = url.searchParams.get('category')
    const status   = url.searchParams.get('status') ?? 'open'   // 'open' | 'fulfilled' | 'all'
    const sort     = url.searchParams.get('sort')   ?? 'top'     // 'top' | 'new'
    const limit    = Math.min(parseInt(url.searchParams.get('limit')  ?? '30', 10), 100)
    const offset   = parseInt(url.searchParams.get('offset') ?? '0', 10)

    let query = supabase
      .from('ama_requests')
      .select('*', { count: 'exact' })

    if (status === 'open') {
      query = query.is('fulfilled_session_id', null)
    } else if (status === 'fulfilled') {
      query = query.not('fulfilled_session_id', 'is', null)
    }

    if (category) {
      query = query.eq('category', category)
    }

    if (sort === 'top') {
      query = query.order('upvote_count', { ascending: false }).order('created_at', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data: rows, error, count } = await query

    if (error) throw error

    if (!rows || rows.length === 0) {
      return NextResponse.json({ requests: [], total: count ?? 0 } satisfies AMARequestsResponse)
    }

    // Fetch authors in one shot
    const authorIds = [...new Set(rows.map((r: { author_id: string }) => r.author_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', authorIds)

    const profileMap = new Map<string, AMARequestAuthor>()
    for (const p of profiles ?? []) {
      profileMap.set(p.id, p as AMARequestAuthor)
    }

    // Fetch linked topic statements
    const topicIds = rows
      .map((r: { topic_id: string | null }) => r.topic_id)
      .filter((id: string | null): id is string => id !== null)

    const topicMap = new Map<string, string>()
    if (topicIds.length > 0) {
      const { data: topics } = await supabase
        .from('topics')
        .select('id, statement')
        .in('id', topicIds)
      for (const t of topics ?? []) {
        topicMap.set(t.id, t.statement)
      }
    }

    // Fetch current user's votes
    const votedSet = new Set<string>()
    if (user && rows.length > 0) {
      const requestIds = rows.map((r: { id: string }) => r.id)
      const { data: userVotes } = await supabase
        .from('ama_request_votes')
        .select('request_id')
        .in('request_id', requestIds)
        .eq('user_id', user.id)
      for (const v of userVotes ?? []) {
        votedSet.add(v.request_id)
      }
    }

    const requests: AMARequestItem[] = rows.map((r: {
      id: string
      author_id: string
      title: string
      description: string | null
      category: string | null
      topic_id: string | null
      upvote_count: number
      fulfilled_session_id: string | null
      fulfilled_at: string | null
      created_at: string
    }) => ({
      id: r.id,
      author_id: r.author_id,
      title: r.title,
      description: r.description,
      category: r.category,
      topic_id: r.topic_id,
      topic_statement: r.topic_id ? (topicMap.get(r.topic_id) ?? null) : null,
      upvote_count: r.upvote_count,
      fulfilled_session_id: r.fulfilled_session_id,
      fulfilled_at: r.fulfilled_at,
      created_at: r.created_at,
      author: profileMap.get(r.author_id) ?? null,
      user_voted: votedSet.has(r.id),
    }))

    return NextResponse.json({ requests, total: count ?? rows.length } satisfies AMARequestsResponse)
  } catch (err) {
    console.error('[/api/ama/requests GET]', err)
    return NextResponse.json({ error: 'Failed to load requests' }, { status: 500 })
  }
}

// ── POST /api/ama/requests ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      title?: string
      description?: string
      category?: string
      topic_id?: string
    }

    const title = (body.title ?? '').trim()
    if (!title || title.length < 10 || title.length > 150) {
      return NextResponse.json({ error: 'Title must be 10–150 characters' }, { status: 400 })
    }

    const description = (body.description ?? '').trim() || null
    if (description && description.length > 500) {
      return NextResponse.json({ error: 'Description max 500 characters' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('ama_requests')
      .insert({
        author_id:   user.id,
        title,
        description,
        category:    body.category ?? null,
        topic_id:    body.topic_id ?? null,
      })
      .select('*')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'You already submitted this request' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ request: data }, { status: 201 })
  } catch (err) {
    console.error('[/api/ama/requests POST]', err)
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 })
  }
}
