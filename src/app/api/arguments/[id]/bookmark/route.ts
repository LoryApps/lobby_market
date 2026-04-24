import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: { id: string }
}

// GET /api/arguments/[id]/bookmark — check if current user bookmarked this argument
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ bookmarked: false })
  }

  const { data } = await supabase
    .from('argument_bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('argument_id', params.id)
    .maybeSingle()

  return NextResponse.json({ bookmarked: !!data })
}

// POST /api/arguments/[id]/bookmark — toggle bookmark
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if already bookmarked
  const { data: existing } = await supabase
    .from('argument_bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('argument_id', params.id)
    .maybeSingle()

  if (existing) {
    // Remove bookmark
    await supabase
      .from('argument_bookmarks')
      .delete()
      .eq('id', existing.id)

    return NextResponse.json({ bookmarked: false })
  }

  // Verify argument exists
  const { data: argument } = await supabase
    .from('topic_arguments')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!argument) {
    return NextResponse.json({ error: 'Argument not found' }, { status: 404 })
  }

  // Add bookmark
  const { error } = await supabase
    .from('argument_bookmarks')
    .insert({ user_id: user.id, argument_id: params.id })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ bookmarked: true })
}
