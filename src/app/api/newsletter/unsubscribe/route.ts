import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
  }

  const supabase = await createClient()

  // If authenticated, flip their profile opt-in off
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { error } = await supabase
      .from('profiles')
      .update({ newsletter_opt_in: false })
      .eq('id', user.id)
    if (error) {
      return NextResponse.json({ error: 'Could not update preference.' }, { status: 500 })
    }
    // Also stamp unsubscribed_at if they have a subscriber row
    await supabase.rpc('newsletter_unsubscribe', { p_email: email })
    return NextResponse.json({ success: true, mode: 'profile' })
  }

  // Anonymous: call SECURITY DEFINER RPC to stamp unsubscribed_at
  const { data, error } = await supabase.rpc('newsletter_unsubscribe', { p_email: email })

  if (error) {
    return NextResponse.json({ error: 'Could not process unsubscribe.' }, { status: 500 })
  }

  // data is boolean — true means a row was found and updated
  return NextResponse.json({ success: true, found: data })
}
