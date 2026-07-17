import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/exchange/ideas/vote
// body: { idea_id, direction: 'up' | 'down' | null }
// direction null = remove vote

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Use auth.uid() for RLS but profile id = auth.uid() for FK

    const { idea_id, direction } = await req.json()

    if (!idea_id) return NextResponse.json({ error: 'idea_id required' }, { status: 400 })

    if (direction === null) {
      // Remove vote
      await supabase
        .from('market_idea_votes')
        .delete()
        .eq('user_id', user.id)
        .eq('idea_id', idea_id)
    } else if (direction === 'up' || direction === 'down') {
      // Upsert vote
      await supabase
        .from('market_idea_votes')
        .upsert(
          { user_id: user.id, idea_id, direction },
          { onConflict: 'user_id,idea_id' }
        )
    } else {
      return NextResponse.json({ error: 'Invalid direction' }, { status: 400 })
    }

    // Return updated counts
    const { data: idea } = await supabase
      .from('market_ideas')
      .select('upvotes, downvotes')
      .eq('id', idea_id)
      .single()

    return NextResponse.json({
      upvotes:     idea?.upvotes ?? 0,
      downvotes:   idea?.downvotes ?? 0,
      viewer_vote: direction,
    })
  } catch (err) {
    console.error('[exchange/ideas/vote POST]', err)
    return NextResponse.json({ error: 'Failed to vote' }, { status: 500 })
  }
}
