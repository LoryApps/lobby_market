import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── POST — Cast a vote ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { election_id, nominee_id } = body as { election_id?: string; nominee_id?: string }

  if (!election_id || !nominee_id) {
    return NextResponse.json({ error: 'election_id and nominee_id are required' }, { status: 400 })
  }

  // Verify election is active
  const { data: election } = await supabase
    .from('elections')
    .select('id, status, ends_at')
    .eq('id', election_id)
    .maybeSingle()

  if (!election) return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  if (election.status !== 'active') {
    return NextResponse.json({ error: 'Election is not active' }, { status: 409 })
  }
  if (new Date(election.ends_at) < new Date()) {
    return NextResponse.json({ error: 'Election has ended' }, { status: 409 })
  }

  // Verify nominee belongs to this election
  const { data: nominee } = await supabase
    .from('election_nominees')
    .select('id')
    .eq('id', nominee_id)
    .eq('election_id', election_id)
    .maybeSingle()

  if (!nominee) return NextResponse.json({ error: 'Nominee not found in this election' }, { status: 404 })

  // Cannot vote for yourself
  const { data: selfCheck } = await supabase
    .from('election_nominees')
    .select('user_id')
    .eq('id', nominee_id)
    .maybeSingle()

  if (selfCheck?.user_id === user.id) {
    return NextResponse.json({ error: 'You cannot vote for yourself' }, { status: 409 })
  }

  const { error } = await supabase
    .from('election_votes')
    .insert({ election_id, voter_id: user.id, nominee_id })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You have already voted in this election' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return fresh vote count for the nominee
  const { data: updated } = await supabase
    .from('election_nominees')
    .select('vote_count')
    .eq('id', nominee_id)
    .maybeSingle()

  return NextResponse.json({ ok: true, vote_count: updated?.vote_count ?? 1 })
}
