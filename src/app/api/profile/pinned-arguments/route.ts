import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface PinnedArgumentEntry {
  id: string
  argument_id: string
  position: number
  pinned_at: string
  argument: {
    id: string
    content: string
    side: 'blue' | 'red'
    upvotes: number
    ai_score: number | null
    ai_grade: string | null
    created_at: string
    topic: {
      id: string
      statement: string
      category: string | null
      status: string
    } | null
  }
}

export interface PinnedArgumentsResponse {
  pins: PinnedArgumentEntry[]
}

// GET — fetch own pinned arguments
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('profile_pinned_arguments')
    .select(`
      id,
      argument_id,
      position,
      pinned_at,
      argument:topic_arguments!argument_id (
        id,
        content,
        side,
        upvotes,
        ai_score,
        ai_grade,
        created_at,
        topic:topics!topic_id (
          id,
          statement,
          category,
          status
        )
      )
    `)
    .eq('user_id', user.id)
    .order('position', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ pins: data ?? [] })
}

// POST — pin or unpin an argument
// Body: { argument_id: string, action: 'pin' | 'unpin' }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { argument_id?: string; action?: string }
  const { argument_id, action } = body

  if (!argument_id || !action) {
    return NextResponse.json({ error: 'argument_id and action required' }, { status: 400 })
  }

  if (action === 'unpin') {
    const { error } = await supabase
      .from('profile_pinned_arguments')
      .delete()
      .eq('user_id', user.id)
      .eq('argument_id', argument_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, action: 'unpinned' })
  }

  if (action === 'pin') {
    // Verify the argument belongs to this user
    const { data: arg } = await supabase
      .from('topic_arguments')
      .select('id, user_id')
      .eq('id', argument_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!arg) {
      return NextResponse.json({ error: 'Argument not found or not yours' }, { status: 404 })
    }

    // Count current pins
    const { count } = await supabase
      .from('profile_pinned_arguments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((count ?? 0) >= 3) {
      return NextResponse.json({ error: 'Maximum 3 pinned arguments' }, { status: 400 })
    }

    // Find next available position (1, 2, or 3)
    const { data: existing } = await supabase
      .from('profile_pinned_arguments')
      .select('position')
      .eq('user_id', user.id)
      .order('position')

    const taken = new Set((existing ?? []).map((r) => r.position))
    let position = 1
    while (taken.has(position)) position++

    const { error } = await supabase
      .from('profile_pinned_arguments')
      .insert({ user_id: user.id, argument_id, position })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Already pinned' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, action: 'pinned', position })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
