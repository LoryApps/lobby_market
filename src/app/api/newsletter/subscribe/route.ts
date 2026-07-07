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

  // If user is authenticated, update their profile preference instead
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { error } = await supabase
      .from('profiles')
      .update({ newsletter_opt_in: true })
      .eq('id', user.id)
    if (error) {
      return NextResponse.json({ error: 'Could not update preference.' }, { status: 500 })
    }
    return NextResponse.json({ success: true, mode: 'profile' })
  }

  // Anonymous: upsert into newsletter_subscribers
  const { error } = await supabase
    .from('newsletter_subscribers')
    .upsert({ email, confirmed: false }, { onConflict: 'email' })

  if (error) {
    return NextResponse.json({ error: 'Could not subscribe. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, mode: 'subscriber' })
}
