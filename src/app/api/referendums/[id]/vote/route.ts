import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/referendums/[id]/vote
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const vote = body.vote as 'for' | 'against'

  if (vote !== 'for' && vote !== 'against') {
    return NextResponse.json({ error: 'vote must be "for" or "against"' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('cast_referendum_vote', {
    p_referendum_id: params.id,
    p_vote: vote,
  })

  if (error) {
    console.error('[referendum vote]', error)
    return NextResponse.json({ error: 'Failed to cast vote' }, { status: 500 })
  }

  const result = data as {
    ok?: boolean
    error?: string
    for_votes?: number
    against_votes?: number
    total?: number
    for_pct?: number
    user_vote?: string
  }

  if (result.error) {
    const statusMap: Record<string, number> = {
      not_authenticated: 401,
      not_found: 404,
      referendum_closed: 409,
      referendum_expired: 409,
    }
    return NextResponse.json(
      { error: result.error },
      { status: statusMap[result.error] ?? 400 }
    )
  }

  return NextResponse.json(result)
}

// DELETE /api/referendums/[id]/vote — retract vote
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check referendum is still open
  const { data: ref } = await supabase
    .from('civic_referendums')
    .select('status, for_votes, against_votes')
    .eq('id', params.id)
    .single()

  if (!ref) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (ref.status !== 'open') return NextResponse.json({ error: 'Referendum is closed' }, { status: 409 })

  // Get user's current vote to decrement correctly
  const { data: existing } = await supabase
    .from('referendum_votes')
    .select('vote')
    .eq('referendum_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'No vote to retract' }, { status: 404 })

  await supabase
    .from('referendum_votes')
    .delete()
    .eq('referendum_id', params.id)
    .eq('user_id', user.id)

  // Recount
  const { data: counts } = await supabase
    .from('referendum_votes')
    .select('vote')
    .eq('referendum_id', params.id)

  const forVotes = counts?.filter((v) => v.vote === 'for').length ?? 0
  const againstVotes = counts?.filter((v) => v.vote === 'against').length ?? 0

  await supabase
    .from('civic_referendums')
    .update({ for_votes: forVotes, against_votes: againstVotes })
    .eq('id', params.id)

  return NextResponse.json({ ok: true, for_votes: forVotes, against_votes: againstVotes })
}
