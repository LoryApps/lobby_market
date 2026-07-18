import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/exchange/commentary/like
// Toggle like on a commentary note. Returns updated likes count + viewer_liked.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { commentary_id } = await req.json()
    if (!commentary_id) return NextResponse.json({ error: 'Missing commentary_id' }, { status: 400 })

    // Check existing like
    const { data: existing } = await supabase
      .from('market_commentary_likes')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('commentary_id', commentary_id)
      .maybeSingle()

    if (existing) {
      // Unlike
      await supabase
        .from('market_commentary_likes')
        .delete()
        .eq('user_id', user.id)
        .eq('commentary_id', commentary_id)
    } else {
      // Like
      await supabase
        .from('market_commentary_likes')
        .insert({ user_id: user.id, commentary_id })
    }

    const { data: updated } = await supabase
      .from('market_commentary')
      .select('likes')
      .eq('id', commentary_id)
      .single()

    return NextResponse.json({
      likes: updated?.likes ?? 0,
      viewer_liked: !existing,
    })
  } catch (err) {
    console.error('[exchange/commentary/like POST]', err)
    return NextResponse.json({ error: 'Failed to toggle like' }, { status: 500 })
  }
}
