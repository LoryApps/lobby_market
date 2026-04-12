import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/follow?target_id=<uuid>
 * Returns { isFollowing: boolean, followersCount: number }
 */
export async function GET(req: NextRequest) {
  const targetId = req.nextUrl.searchParams.get('target_id')
  if (!targetId) {
    return NextResponse.json({ isFollowing: false, followersCount: 0 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Always return follower count even for guests
  const { data: profile } = await supabase
    .from('profiles')
    .select('followers_count')
    .eq('id', targetId)
    .maybeSingle()

  const followersCount = profile?.followers_count ?? 0

  if (!user) {
    return NextResponse.json({ isFollowing: false, followersCount })
  }

  const { data: row } = await supabase
    .from('user_follows')
    .select('id')
    .eq('follower_id', user.id)
    .eq('following_id', targetId)
    .maybeSingle()

  return NextResponse.json({ isFollowing: !!row, followersCount })
}

/**
 * POST /api/follow
 * Body: { target_id: string }
 * Follow a user. Idempotent.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { target_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const targetId = body.target_id
  if (!targetId) {
    return NextResponse.json({ error: 'target_id is required' }, { status: 400 })
  }
  if (targetId === user.id) {
    return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
  }

  // Verify target exists
  const { data: target } = await supabase
    .from('profiles')
    .select('id, followers_count')
    .eq('id', targetId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('user_follows')
    .insert({ follower_id: user.id, following_id: targetId })

  if (error && error.code !== '23505') {
    // 23505 = unique violation (already following) — treat as success
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Refetch updated count (trigger may have already fired)
  const { data: updated } = await supabase
    .from('profiles')
    .select('followers_count')
    .eq('id', targetId)
    .maybeSingle()

  return NextResponse.json({
    isFollowing: true,
    followersCount: updated?.followers_count ?? target.followers_count,
  })
}

/**
 * DELETE /api/follow
 * Body: { target_id: string }
 * Unfollow a user. Idempotent.
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { target_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const targetId = body.target_id
  if (!targetId) {
    return NextResponse.json({ error: 'target_id is required' }, { status: 400 })
  }

  await supabase
    .from('user_follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', targetId)

  const { data: updated } = await supabase
    .from('profiles')
    .select('followers_count')
    .eq('id', targetId)
    .maybeSingle()

  return NextResponse.json({
    isFollowing: false,
    followersCount: updated?.followers_count ?? 0,
  })
}
