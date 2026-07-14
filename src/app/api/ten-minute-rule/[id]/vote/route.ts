import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = params.id
  const body = await req.json()
  const { side } = body as { side?: 'for' | 'against' }
  if (!side || !['for', 'against'].includes(side)) {
    return NextResponse.json({ error: 'side must be "for" or "against"' }, { status: 400 })
  }

  // Ensure proposal is in voting status
  const { data: proposal } = await supabase
    .from('civic_tmr_proposals')
    .select('status, author_id')
    .eq('id', id)
    .maybeSingle()

  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if ((proposal as { status: string }).status !== 'voting') {
    return NextResponse.json({ error: 'Proposal is not currently open for voting.' }, { status: 409 })
  }
  if ((proposal as { author_id: string }).author_id === user.id) {
    return NextResponse.json({ error: 'Authors cannot vote on their own proposal.' }, { status: 403 })
  }

  const { error } = await supabase
    .from('civic_tmr_votes')
    .upsert({ proposal_id: id, user_id: user.id, side }, { onConflict: 'proposal_id,user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('civic_tmr_votes')
    .delete()
    .eq('proposal_id', params.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
