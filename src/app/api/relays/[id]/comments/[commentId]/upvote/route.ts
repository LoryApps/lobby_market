import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── POST — upvote a relay comment ───────────────────────────────────────────
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase
      .from('relay_comment_upvotes')
      .insert({ comment_id: params.commentId, user_id: user.id })

    if (error?.code === '23505') {
      return NextResponse.json({ error: 'Already upvoted' }, { status: 409 })
    }
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to upvote' }, { status: 500 })
  }
}

// ─── DELETE — remove upvote ───────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await supabase
      .from('relay_comment_upvotes')
      .delete()
      .eq('comment_id', params.commentId)
      .eq('user_id', user.id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to remove upvote' }, { status: 500 })
  }
}
