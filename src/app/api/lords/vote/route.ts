import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const LORDS_THRESHOLD = 50

export async function POST(req: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  // Verify the user is a Lord
  const { data: profile } = await supabase
    .from('profiles')
    .select('clout')
    .eq('id', user.id)
    .single()

  if (!profile || profile.clout < LORDS_THRESHOLD) {
    return NextResponse.json(
      { error: 'Insufficient clout to sit in the House of Lords' },
      { status: 403 }
    )
  }

  const body = await req.json()
  const { law_id, verdict, amendment_note } = body as {
    law_id: string
    verdict: string
    amendment_note?: string
  }

  if (!law_id || !verdict) {
    return NextResponse.json({ error: 'Missing law_id or verdict' }, { status: 400 })
  }

  if (!['ratify', 'send_back', 'abstain'].includes(verdict)) {
    return NextResponse.json({ error: 'Invalid verdict' }, { status: 400 })
  }

  // Upsert the review
  const { error } = await supabase.from('lords_reviews').upsert(
    {
      law_id,
      user_id: user.id,
      verdict,
      amendment_note: amendment_note ?? null,
    },
    { onConflict: 'law_id,user_id' }
  )

  if (error) {
    console.error('lords_reviews upsert error:', error)
    return NextResponse.json({ error: 'Failed to record review' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
