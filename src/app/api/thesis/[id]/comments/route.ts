import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ThesisComment {
  id: string
  thesis_id: string
  user_id: string
  body: string
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

interface RouteContext {
  params: { id: string }
}

// ─── GET /api/thesis/[id]/comments ──────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()

  // Verify thesis exists and is public (or owned by caller)
  const { data: { user } } = await supabase.auth.getUser()

  const { data: thesis, error: te } = await supabase
    .from('civic_theses')
    .select('id, is_public, user_id')
    .eq('id', params.id)
    .maybeSingle()

  if (te || !thesis) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!thesis.is_public && thesis.user_id !== user?.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: rows, error } = await supabase
    .from('thesis_comments')
    .select(
      `id, thesis_id, user_id, body, created_at,
       profiles!thesis_comments_user_id_fkey(id, username, display_name, avatar_url, role)`
    )
    .eq('thesis_id', params.id)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const comments: ThesisComment[] = (rows ?? []).map((r) => {
    const raw = r as typeof r & {
      profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string } | null
    }
    return {
      id: raw.id,
      thesis_id: raw.thesis_id,
      user_id: raw.user_id,
      body: raw.body,
      created_at: raw.created_at,
      author: raw.profiles ?? null,
    }
  })

  return NextResponse.json({ comments, total: comments.length })
}

// ─── POST /api/thesis/[id]/comments ─────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  // Verify thesis is accessible
  const { data: thesis } = await supabase
    .from('civic_theses')
    .select('id, is_public, user_id, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!thesis) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!thesis.is_public && thesis.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: string
  try {
    const json = await req.json()
    body = typeof json.body === 'string' ? json.body.trim() : ''
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body || body.length < 1) {
    return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 })
  }
  if (body.length > 1000) {
    return NextResponse.json({ error: 'Comment too long (max 1000 chars)' }, { status: 400 })
  }

  const { data: row, error } = await supabase
    .from('thesis_comments')
    .insert({ thesis_id: params.id, user_id: user.id, body })
    .select(
      `id, thesis_id, user_id, body, created_at,
       profiles!thesis_comments_user_id_fkey(id, username, display_name, avatar_url, role)`
    )
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const raw = row as typeof row & {
    profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string } | null
  }

  const comment: ThesisComment = {
    id: raw.id,
    thesis_id: raw.thesis_id,
    user_id: raw.user_id,
    body: raw.body,
    created_at: raw.created_at,
    author: raw.profiles ?? null,
  }

  return NextResponse.json({ comment }, { status: 201 })
}

// ─── DELETE /api/thesis/[id]/comments?commentId=... ─────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const commentId = req.nextUrl.searchParams.get('commentId')
  if (!commentId) return NextResponse.json({ error: 'commentId required' }, { status: 400 })

  const { error } = await supabase
    .from('thesis_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', user.id) // RLS also enforces this

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
