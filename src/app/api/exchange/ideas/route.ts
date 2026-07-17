import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IdeaAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

export interface MarketIdea {
  id: string
  user_id: string
  topic_id: string | null
  title: string
  body: string
  direction: 'for' | 'against' | 'neutral'
  target_price: number | null
  confidence: number
  upvotes: number
  downvotes: number
  is_featured: boolean
  created_at: string
  score: number
  author: IdeaAuthor
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number | null
  } | null
  viewer_vote: 'up' | 'down' | null
}

export interface IdeasResponse {
  ideas: MarketIdea[]
  total: number
  has_more: boolean
}

// ─── GET /api/exchange/ideas ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)

    const sort      = (searchParams.get('sort') ?? 'top') as 'top' | 'new'
    const direction = searchParams.get('direction') ?? null
    const topicId   = searchParams.get('topic_id') ?? null
    const limit     = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
    const offset    = parseInt(searchParams.get('offset') ?? '0', 10)

    const { data: { user } } = await supabase.auth.getUser()

    // ── Fetch ideas with author + topic joins ──────────────────────────────
    let query = supabase
      .from('market_ideas')
      .select(`
        id, user_id, topic_id, title, body, direction,
        target_price, confidence, upvotes, downvotes, is_featured, created_at,
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
      query = query.order('upvotes', { ascending: false }).order('created_at', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data: rawIdeas, count, error } = await query

    if (error) throw error

    const ideas = rawIdeas ?? []

    // ── Fetch viewer's votes for these ideas ───────────────────────────────
    const ideaIds = ideas.map((i) => i.id)
    const viewerVotes: Record<string, 'up' | 'down'> = {}

    if (user && ideaIds.length > 0) {
      const { data: voteRows } = await supabase
        .from('market_idea_votes')
        .select('idea_id, direction')
        .eq('user_id', user.id)
        .in('idea_id', ideaIds)

      for (const v of voteRows ?? []) {
        viewerVotes[v.idea_id] = v.direction as 'up' | 'down'
      }
    }

    // ── Shape response ─────────────────────────────────────────────────────
    const shaped: MarketIdea[] = ideas.map((idea) => {
      const author = Array.isArray(idea.author) ? idea.author[0] : idea.author
      const topic  = Array.isArray(idea.topic)  ? idea.topic[0]  : idea.topic

      return {
        id:           idea.id,
        user_id:      idea.user_id,
        topic_id:     idea.topic_id,
        title:        idea.title,
        body:         idea.body,
        direction:    idea.direction as 'for' | 'against' | 'neutral',
        target_price: idea.target_price,
        confidence:   idea.confidence,
        upvotes:      idea.upvotes,
        downvotes:    idea.downvotes,
        is_featured:  idea.is_featured,
        created_at:   idea.created_at,
        score:        (idea.upvotes ?? 0) - (idea.downvotes ?? 0),
        author:       author as IdeaAuthor,
        topic:        (topic as MarketIdea['topic']) ?? null,
        viewer_vote:  viewerVotes[idea.id] ?? null,
      }
    })

    return NextResponse.json({
      ideas: shaped,
      total: count ?? 0,
      has_more: offset + limit < (count ?? 0),
    } satisfies IdeasResponse)
  } catch (err) {
    console.error('[exchange/ideas GET]', err)
    return NextResponse.json({ error: 'Failed to load ideas' }, { status: 500 })
  }
}

// ─── POST /api/exchange/ideas ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { title, body: ideaBody, direction, target_price, confidence, topic_id } = body

    // Basic validation
    if (!title || typeof title !== 'string' || title.length < 5 || title.length > 120) {
      return NextResponse.json({ error: 'Title must be 5–120 characters' }, { status: 400 })
    }
    if (!ideaBody || typeof ideaBody !== 'string' || ideaBody.length < 20 || ideaBody.length > 500) {
      return NextResponse.json({ error: 'Body must be 20–500 characters' }, { status: 400 })
    }
    if (!['for', 'against', 'neutral'].includes(direction)) {
      return NextResponse.json({ error: 'Invalid direction' }, { status: 400 })
    }

    const confidenceNum = parseInt(confidence ?? '3', 10)
    const targetNum     = target_price ? parseInt(target_price, 10) : null

    const { data: idea, error } = await supabase
      .from('market_ideas')
      .insert({
        user_id:      user.id,
        topic_id:     topic_id ?? null,
        title:        title.trim(),
        body:         ideaBody.trim(),
        direction,
        target_price: (targetNum && targetNum >= 1 && targetNum <= 99) ? targetNum : null,
        confidence:   Math.min(5, Math.max(1, confidenceNum)),
      })
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ id: idea.id }, { status: 201 })
  } catch (err) {
    console.error('[exchange/ideas POST]', err)
    return NextResponse.json({ error: 'Failed to create idea' }, { status: 500 })
  }
}
