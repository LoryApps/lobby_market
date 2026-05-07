import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/tags/follow?tag=climate  → { following: boolean, follower_count: number }
export async function GET(request: NextRequest) {
  const tag = request.nextUrl.searchParams.get('tag')?.toLowerCase().trim()
  if (!tag) return NextResponse.json({ error: 'tag required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [countRes, followRes] = await Promise.all([
    supabase
      .from('user_tag_follows')
      .select('user_id', { count: 'exact', head: true })
      .eq('tag', tag),
    user
      ? supabase
          .from('user_tag_follows')
          .select('user_id')
          .eq('user_id', user.id)
          .eq('tag', tag)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return NextResponse.json({
    following: !!followRes.data,
    follower_count: countRes.count ?? 0,
  })
}

// POST /api/tags/follow  body: { tag }  → follow a tag
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const tag = (body.tag as string | undefined)?.toLowerCase().trim()
  if (!tag) return NextResponse.json({ error: 'tag required' }, { status: 400 })

  const { error } = await supabase
    .from('user_tag_follows')
    .upsert({ user_id: user.id, tag }, { onConflict: 'user_id,tag' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { count } = await supabase
    .from('user_tag_follows')
    .select('user_id', { count: 'exact', head: true })
    .eq('tag', tag)

  return NextResponse.json({ following: true, follower_count: count ?? 0 })
}

// DELETE /api/tags/follow?tag=climate  → unfollow a tag
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tag = request.nextUrl.searchParams.get('tag')?.toLowerCase().trim()
  if (!tag) return NextResponse.json({ error: 'tag required' }, { status: 400 })

  const { error } = await supabase
    .from('user_tag_follows')
    .delete()
    .eq('user_id', user.id)
    .eq('tag', tag)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { count } = await supabase
    .from('user_tag_follows')
    .select('user_id', { count: 'exact', head: true })
    .eq('tag', tag)

  return NextResponse.json({ following: false, follower_count: count ?? 0 })
}
