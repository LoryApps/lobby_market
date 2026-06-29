import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { fact_id?: string; vote?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.fact_id) return NextResponse.json({ error: 'fact_id required' }, { status: 400 })
  if (body.vote !== 1 && body.vote !== -1) {
    return NextResponse.json({ error: 'vote must be 1 or -1' }, { status: 400 })
  }

  const { error } = await supabase.rpc('cast_fact_vote', {
    p_fact_id: body.fact_id,
    p_vote:    body.vote,
  })

  if (error) {
    console.error('[fact-bank/vote]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return updated counts
  const { data: fact } = await supabase
    .from('civic_facts')
    .select('upvotes, downvotes, status')
    .eq('id', body.fact_id)
    .single()

  // Also return the user's current vote state
  const { data: voteRow } = await supabase
    .from('civic_fact_votes')
    .select('vote')
    .eq('fact_id', body.fact_id)
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    upvotes:   fact?.upvotes  ?? 0,
    downvotes: fact?.downvotes ?? 0,
    status:    fact?.status    ?? 'pending',
    user_vote: (voteRow?.vote ?? 0) as -1 | 0 | 1,
  })
}
