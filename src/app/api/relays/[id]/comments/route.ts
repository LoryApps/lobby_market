import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface RelayComment {
  id: string
  relay_id: string
  content: string
  leg_number: number | null
  upvote_count: number
  created_at: string
  edited_at: string | null
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  }
  user_upvoted: boolean
}

export interface RelayCommentsResponse {
  comments: RelayComment[]
  total: number
}

// ─── GET /api/relays/[id]/comments ───────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error, count } = await supabase
      .from('relay_comments')
      .select(`
        id, relay_id, content, leg_number, upvote_count, created_at, edited_at,
        author:profiles!relay_comments_author_id_fkey (
          id, username, display_name, avatar_url, role
        )
      `, { count: 'exact' })
      .eq('relay_id', params.id)
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) throw error

    let upvotedIds = new Set<string>()
    if (user && data && data.length > 0) {
      const ids = data.map((c: { id: string }) => c.id)
      const { data: uvData } = await supabase
        .from('relay_comment_upvotes')
        .select('comment_id')
        .eq('user_id', user.id)
        .in('comment_id', ids)
      upvotedIds = new Set((uvData ?? []).map((r: { comment_id: string }) => r.comment_id))
    }

    const comments: RelayComment[] = (data ?? []).map((c: {
      id: string
      relay_id: string
      content: string
      leg_number: number | null
      upvote_count: number
      created_at: string
      edited_at: string | null
      author: {
        id: string
        username: string
        display_name: string | null
        avatar_url: string | null
        role: string
      }
    }) => ({
      ...c,
      author: c.author,
      user_upvoted: upvotedIds.has(c.id),
    }))

    return NextResponse.json({ comments, total: count ?? 0 } satisfies RelayCommentsResponse)
  } catch {
    return NextResponse.json({ comments: [], total: 0 }, { status: 200 })
  }
}

// ─── POST /api/relays/[id]/comments ──────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { content?: string; leg_number?: number | null }
    const content = (body.content ?? '').trim()
    if (!content || content.length > 500) {
      return NextResponse.json({ error: 'Content must be 1–500 characters' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('relay_comments')
      .insert({
        relay_id: params.id,
        author_id: user.id,
        content,
        leg_number: body.leg_number ?? null,
      })
      .select(`
        id, relay_id, content, leg_number, upvote_count, created_at, edited_at,
        author:profiles!relay_comments_author_id_fkey (
          id, username, display_name, avatar_url, role
        )
      `)
      .single()

    if (error) throw error

    return NextResponse.json({ comment: { ...(data as RelayComment), user_upvoted: false } })
  } catch {
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 })
  }
}
