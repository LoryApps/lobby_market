import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { PinnedArgumentEntry } from '@/app/api/profile/pinned-arguments/route'

export const dynamic = 'force-dynamic'
export const revalidate = 60

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username')?.trim()

  if (!username) {
    return NextResponse.json({ error: 'username required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Resolve username → user_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (!profile) return NextResponse.json({ pins: [] })

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
    .eq('user_id', profile.id)
    .order('position', { ascending: true })

  if (error) return NextResponse.json({ pins: [] })

  return NextResponse.json({ pins: (data ?? []) as PinnedArgumentEntry[] })
}
