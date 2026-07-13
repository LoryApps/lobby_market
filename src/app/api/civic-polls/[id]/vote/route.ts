import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { option_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { option_id } = body

  if (!option_id) {
    return NextResponse.json({ error: 'option_id is required' }, { status: 400 })
  }

  // Load poll
  const { data: poll, error: pollError } = await supabase
    .from('civic_polls')
    .select('id, options, is_closed, expires_at, author_id')
    .eq('id', params.id)
    .single()

  if (pollError || !poll) {
    return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  }

  // Validate poll is still open
  const expired = new Date(poll.expires_at) < new Date()
  if (poll.is_closed || expired) {
    return NextResponse.json({ error: 'Poll is closed' }, { status: 400 })
  }

  // Validate option_id is valid
  const options = poll.options as Array<{ id: string; label: string }>
  if (!options.some((o) => o.id === option_id)) {
    return NextResponse.json({ error: 'Invalid option' }, { status: 400 })
  }

  // Insert (upsert not applicable: UNIQUE constraint prevents double-voting)
  const { error: voteError } = await supabase.from('civic_poll_votes').insert({
    poll_id: params.id,
    user_id: user.id,
    option_id,
  })

  if (voteError) {
    if (voteError.code === '23505') {
      return NextResponse.json({ error: 'Already voted' }, { status: 409 })
    }
    console.error('poll vote error:', voteError)
    return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
