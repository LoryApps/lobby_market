import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: existing } = await supabase
      .from('ama_rsvps')
      .select('user_id')
      .eq('session_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('ama_rsvps')
        .delete()
        .eq('session_id', params.id)
        .eq('user_id', user.id)
      return NextResponse.json({ rsvped: false })
    }

    await supabase
      .from('ama_rsvps')
      .insert({ session_id: params.id, user_id: user.id })

    return NextResponse.json({ rsvped: true })
  } catch (err) {
    console.error('AMA RSVP error:', err)
    return NextResponse.json({ error: 'Failed to RSVP' }, { status: 500 })
  }
}
