import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST { changemaker_id } — toggle upvote (insert or delete)
export async function POST(
  req: NextRequest,
  _ctx: { params: { id: string } }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const changemaker_id: string = body?.changemaker_id ?? ''
  if (!changemaker_id) {
    return NextResponse.json({ error: 'changemaker_id required' }, { status: 400 })
  }

  // Check if already upvoted
  const { data: existing } = await supabase
    .from('changemaker_upvotes')
    .select('changemaker_id')
    .eq('changemaker_id', changemaker_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    // Remove upvote
    await supabase
      .from('changemaker_upvotes')
      .delete()
      .eq('changemaker_id', changemaker_id)
      .eq('user_id', user.id)

    await supabase.rpc('decrement_changemaker_upvotes', { cid: changemaker_id })
    return NextResponse.json({ upvoted: false })
  } else {
    // Add upvote
    await supabase
      .from('changemaker_upvotes')
      .insert({ changemaker_id, user_id: user.id })

    await supabase.rpc('increment_changemaker_upvotes', { cid: changemaker_id })
    return NextResponse.json({ upvoted: true })
  }
}
