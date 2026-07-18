import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommentaryAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

export interface MarketCommentary {
  id: string
  user_id: string
  topic_id: string | null
  content: string
  direction: 'for' | 'against' | 'neutral' | null
  likes: number
  created_at: string
  author: CommentaryAuthor
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number | null
  } | null
  viewer_liked: boolean
}

export interface CommentaryResponse {
  notes: MarketCommentary[]
  total: number
  has_more: boolean
}

// ─── GET /api/exchange/commentary ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)

    const sort      = (searchParams.get('sort') ?? 'new') as 'new' | 'top'
    const direction = searchParams.get('direction') ?? null
    const topicId   = searchParams.get('topic_id') ?? null
    const limit     = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
    const offset    = parseInt(searchParams.get('offset') ?? '0', 10)

    const { data: { user } } = await supabase.auth.getUser()

    let query = supabase
      .from('market_commentary')
      .select(`
        id, user_id, topic_id, content, direction, likes, created_at,
        author:profiles!user_id(
          id, username, display_name, avatar_url, role, clout
        ),
        topic:topics(
          id, statement, category, status, blue_pct
        )
      `, { count: 'exact' })

    if (direction) query = query.eq('direction', direction)
    if (topicId)   query = query.eq('topic_id', topicId)

    if (sort === 'top') {
      query = query.order('likes', { ascending: false }).order('created_at', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data: rawNotes, count, error } = await query
    if (error) throw error

    const notes = rawNotes ?? []

    // Fetch viewer's likes
    const noteIds = notes.map((n) => n.id)
    const likedSet = new Set<string>()

    if (user && noteIds.length > 0) {
      const { data: likeRows } = await supabase
        .from('market_commentary_likes')
        .select('commentary_id')
        .eq('user_id', user.id)
        .in('commentary_id', noteIds)
      likeRows?.forEach((r) => likedSet.add(r.commentary_id))
    }

    const result: MarketCommentary[] = notes.map((n) => ({
      id: n.id,
      user_id: n.user_id,
      topic_id: n.topic_id,
      content: n.content,
      direction: n.direction,
      likes: n.likes,
      created_at: n.created_at,
      author: Array.isArray(n.author) ? n.author[0] : n.author,
      topic: n.topic ? (Array.isArray(n.topic) ? n.topic[0] : n.topic) : null,
      viewer_liked: likedSet.has(n.id),
    }))

    return NextResponse.json({
      notes: result,
      total: count ?? 0,
      has_more: offset + limit < (count ?? 0),
    } satisfies CommentaryResponse)
  } catch (err) {
    console.error('[exchange/commentary GET]', err)
    return NextResponse.json({ error: 'Failed to fetch commentary' }, { status: 500 })
  }
}

// ─── POST /api/exchange/commentary ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const content   = (body.content ?? '').trim()
    const direction = body.direction ?? null
    const topicId   = body.topic_id ?? null

    if (!content || content.length > 280) {
      return NextResponse.json({ error: 'Content must be 1–280 characters' }, { status: 400 })
    }
    if (direction && !['for', 'against', 'neutral'].includes(direction)) {
      return NextResponse.json({ error: 'Invalid direction' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('market_commentary')
      .insert({ user_id: user.id, topic_id: topicId, content, direction })
      .select(`
        id, user_id, topic_id, content, direction, likes, created_at,
        author:profiles!user_id(id, username, display_name, avatar_url, role, clout),
        topic:topics(id, statement, category, status, blue_pct)
      `)
      .single()

    if (error) throw error

    return NextResponse.json({
      ...data,
      author: Array.isArray(data.author) ? data.author[0] : data.author,
      topic: data.topic ? (Array.isArray(data.topic) ? data.topic[0] : data.topic) : null,
      viewer_liked: false,
    } satisfies MarketCommentary, { status: 201 })
  } catch (err) {
    console.error('[exchange/commentary POST]', err)
    return NextResponse.json({ error: 'Failed to post commentary' }, { status: 500 })
  }
}

// ─── DELETE /api/exchange/commentary ──────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { error } = await supabase
      .from('market_commentary')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[exchange/commentary DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
