import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/exchange/proposals/vote
// Body: { proposal_id: string, action: 'up' | 'remove' }
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { proposal_id, action } = await req.json()
    if (!proposal_id) {
      return NextResponse.json({ error: 'proposal_id required' }, { status: 400 })
    }

    if (action === 'remove') {
      await supabase
        .from('exchange_proposal_votes')
        .delete()
        .eq('proposal_id', proposal_id)
        .eq('user_id', user.id)
    } else {
      await supabase
        .from('exchange_proposal_votes')
        .upsert({ proposal_id, user_id: user.id }, { onConflict: 'proposal_id,user_id' })
    }

    // Return updated upvote count
    const { data } = await supabase
      .from('exchange_proposals')
      .select('upvotes')
      .eq('id', proposal_id)
      .single()

    return NextResponse.json({ upvotes: data?.upvotes ?? 0 })
  } catch (err) {
    console.error('[proposals/vote POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
