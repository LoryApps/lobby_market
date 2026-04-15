import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ArgumentReply, ArgumentReplyWithAuthor, Profile } from '@/lib/supabase/types'

interface RouteContext {
  params: { id: string; argId: string }
}

// ── GET /api/topics/[id]/arguments/[argId]/replies ────────────────────────────
// Returns all replies for a single argument, enriched with author info.

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('argument_replies')
    .select('*')
    .eq('argument_id', params.argId)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch replies' }, { status: 500 })
  }

  const rawReplies = (data ?? []) as ArgumentReply[]

  if (rawReplies.length === 0) {
    return NextResponse.json({ replies: [] })
  }

  // Enrich with author profiles
  const userIds = Array.from(new Set(rawReplies.map((r) => r.user_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', userIds)

  const profileMap = new Map<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>>()
  for (const p of (profiles ?? [])) {
    profileMap.set(p.id, p)
  }

  const replies: ArgumentReplyWithAuthor[] = rawReplies.map((r) => ({
    ...r,
    author: profileMap.get(r.user_id) ?? null,
  }))

  return NextResponse.json({ replies })
}

// ── POST /api/topics/[id]/arguments/[argId]/replies ──────────────────────
// Creates a new reply to an argument.

export async function POST(
  req: NextRequest,
  { params }: RouteContext
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { content?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const content = (body.content ?? '').trim()
  if (!content || content.length < 1) {
    return NextResponse.json({ error: 'Reply cannot be empty' }, { status: 400 })
  }
  if (content.length > 300) {
    return NextResponse.json({ error: 'Reply too long (max 300 chars)' }, { status: 400 })
  }

  // Verify the argument exists and belongs to this topic
  const { data: arg, error: argError } = await supabase
    .from('topic_arguments')
    .select('id, topic_id')
    .eq('id', params.argId)
    .eq('topic_id', params.id)
    .maybeSingle()

  if (argError || !arg) {
    return NextResponse.json({ error: 'Argument not found' }, { status: 404 })
  }

  const { data: reply, error: insertError } = await supabase
    .from('argument_replies')
    .insert({
      argument_id: params.argId,
      topic_id: params.id,
      user_id: user.id,
      content,
    })
    .select('*')
    .single()

  if (insertError || !reply) {
    return NextResponse.json({ error: 'Failed to post reply' }, { status: 500 })
  }

  // Fetch author info to return the enriched reply
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .eq('id', user.id)
    .maybeSingle()

  const enrichedReply: ArgumentReplyWithAuthor = {
    ...(reply as ArgumentReply),
    author: profile ?? null,
  }

  return NextResponse.json({ reply: enrichedReply }, { status: 201 })
}

// ── DELETE /api/topics/[id]/arguments/[argId]/replies ────────────────────
// Deletes a reply (only the author can delete their own).
// Expects ?replyId=<uuid> in the query string.

export async function DELETE(
  req: NextRequest,
  { params }: RouteContext
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const replyId = req.nextUrl.searchParams.get('replyId')
  if (!replyId) {
    return NextResponse.json({ error: 'replyId is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('argument_replies')
    .delete()
    .eq('id', replyId)
    .eq('argument_id', params.argId)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete reply' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
