import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: { id: string }
}

/**
 * GET /api/topics/[id]/bookmark
 * Returns { bookmarked: boolean } for the current user.
 */
export async function GET(
  _req: NextRequest,
  { params }: RouteContext
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ bookmarked: false })
  }

  const { data } = await supabase
    .from('topic_bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('topic_id', params.id)
    .maybeSingle()

  return NextResponse.json({ bookmarked: !!data })
}

/**
 * POST /api/topics/[id]/bookmark
 * Toggles the bookmark for the current user.
 * Returns { bookmarked: boolean }
 */
export async function POST(
  _req: NextRequest,
  { params }: RouteContext
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if bookmark already exists
  const { data: existing } = await supabase
    .from('topic_bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('topic_id', params.id)
    .maybeSingle()

  if (existing) {
    // Remove bookmark
    await supabase
      .from('topic_bookmarks')
      .delete()
      .eq('user_id', user.id)
      .eq('topic_id', params.id)

    return NextResponse.json({ bookmarked: false })
  } else {
    // Add bookmark — verify topic exists first
    const { data: topic } = await supabase
      .from('topics')
      .select('id')
      .eq('id', params.id)
      .maybeSingle()

    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('topic_bookmarks')
      .insert({ user_id: user.id, topic_id: params.id })

    if (error) {
      return NextResponse.json({ error: 'Failed to bookmark' }, { status: 500 })
    }

    return NextResponse.json({ bookmarked: true })
  }
}
