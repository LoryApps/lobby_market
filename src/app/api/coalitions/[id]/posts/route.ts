import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CoalitionPost, CoalitionPostWithAuthor, Profile } from '@/lib/supabase/types'

const MAX_CONTENT_LENGTH = 1000
const MIN_CONTENT_LENGTH = 1
const MAX_POSTS_RETURNED = 30

// ─── GET /api/coalitions/[id]/posts ──────────────────────────────────────────
// Returns up to 30 posts for this coalition, pinned first then newest.
// Enriched with author profile.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const coalitionId = params.id

  if (!coalitionId) {
    return NextResponse.json({ error: 'Missing coalition id' }, { status: 400 })
  }

  // Verify coalition exists
  const { data: coalition } = await supabase
    .from('coalitions')
    .select('id, is_public')
    .eq('id', coalitionId)
    .maybeSingle()

  if (!coalition) {
    return NextResponse.json({ error: 'Coalition not found' }, { status: 404 })
  }

  // Fetch posts
  const { data: posts, error } = await supabase
    .from('coalition_posts')
    .select('*')
    .eq('coalition_id', coalitionId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(MAX_POSTS_RETURNED)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }

  const rawPosts = (posts ?? []) as CoalitionPost[]

  if (rawPosts.length === 0) {
    return NextResponse.json({ posts: [] })
  }

  // Enrich with author profiles
  const authorIds = Array.from(new Set(rawPosts.map((p) => p.author_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', authorIds)

  const profileMap = new Map<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>>()
  for (const p of profiles ?? []) profileMap.set(p.id, p)

  const enriched: CoalitionPostWithAuthor[] = rawPosts.map((p) => ({
    ...p,
    author: profileMap.get(p.author_id) ?? null,
  }))

  return NextResponse.json({ posts: enriched })
}

// ─── POST /api/coalitions/[id]/posts ─────────────────────────────────────────
// Create a new bulletin-board post. Only leaders / officers may post.
// Body: { content: string }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const coalitionId = params.id

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate body
  let body: { content?: string }
  try {
    body = (await req.json()) as { content?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''

  if (content.length < MIN_CONTENT_LENGTH) {
    return NextResponse.json({ error: 'Content cannot be empty' }, { status: 422 })
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Content must be ${MAX_CONTENT_LENGTH} characters or fewer` },
      { status: 422 }
    )
  }

  // Check membership and role
  const { data: member } = await supabase
    .from('coalition_members')
    .select('role')
    .eq('coalition_id', coalitionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['leader', 'officer'].includes(member.role)) {
    return NextResponse.json(
      { error: 'Only coalition leaders and officers can post' },
      { status: 403 }
    )
  }

  const { data: post, error } = await supabase
    .from('coalition_posts')
    .insert({
      coalition_id: coalitionId,
      author_id: user.id,
      content,
    })
    .select('*')
    .single()

  if (error || !post) {
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }

  // Enrich with author profile for immediate client use
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .eq('id', user.id)
    .maybeSingle()

  const enriched: CoalitionPostWithAuthor = {
    ...(post as CoalitionPost),
    author: profile ?? null,
  }

  return NextResponse.json({ post: enriched }, { status: 201 })
}

// ─── DELETE /api/coalitions/[id]/posts ───────────────────────────────────────
// Delete a specific post. Body: { post_id: string }
// Allowed for: post author OR coalition leader.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const coalitionId = params.id

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { post_id?: string }
  try {
    body = (await req.json()) as { post_id?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const postId = body.post_id
  if (!postId) {
    return NextResponse.json({ error: 'Missing post_id' }, { status: 400 })
  }

  // Fetch the post to verify ownership / coalition
  const { data: existingPost } = await supabase
    .from('coalition_posts')
    .select('id, author_id, coalition_id')
    .eq('id', postId)
    .eq('coalition_id', coalitionId)
    .maybeSingle()

  if (!existingPost) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  // Check permission: author or leader
  const isAuthor = existingPost.author_id === user.id
  if (!isAuthor) {
    const { data: member } = await supabase
      .from('coalition_members')
      .select('role')
      .eq('coalition_id', coalitionId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!member || member.role !== 'leader') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { error } = await supabase
    .from('coalition_posts')
    .delete()
    .eq('id', postId)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// ─── PATCH /api/coalitions/[id]/posts ────────────────────────────────────────
// Toggle is_pinned on a post. Body: { post_id: string, is_pinned: boolean }
// Only coalition leaders may pin posts.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const coalitionId = params.id

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { post_id?: string; is_pinned?: boolean }
  try {
    body = (await req.json()) as { post_id?: string; is_pinned?: boolean }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { post_id: postId, is_pinned: isPinned } = body

  if (!postId || typeof isPinned !== 'boolean') {
    return NextResponse.json(
      { error: 'Missing post_id or is_pinned' },
      { status: 400 }
    )
  }

  // Only leaders may pin
  const { data: member } = await supabase
    .from('coalition_members')
    .select('role')
    .eq('coalition_id', coalitionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || member.role !== 'leader') {
    return NextResponse.json(
      { error: 'Only coalition leaders can pin posts' },
      { status: 403 }
    )
  }

  const { data: updated, error } = await supabase
    .from('coalition_posts')
    .update({ is_pinned: isPinned })
    .eq('id', postId)
    .eq('coalition_id', coalitionId)
    .select('*')
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }

  return NextResponse.json({ post: updated })
}
