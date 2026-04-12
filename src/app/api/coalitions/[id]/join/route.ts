import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: coalition, error: coalitionError } = await supabase
    .from('coalitions')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (coalitionError || !coalition) {
    return NextResponse.json(
      { error: 'Coalition not found' },
      { status: 404 }
    )
  }

  if (coalition.member_count >= coalition.max_members) {
    return NextResponse.json(
      { error: 'Coalition is full' },
      { status: 400 }
    )
  }

  const { data: existing } = await supabase
    .from('coalition_members')
    .select('id')
    .eq('coalition_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'Already a member of this coalition' },
      { status: 409 }
    )
  }

  const { error: insertError } = await supabase
    .from('coalition_members')
    .insert({
      coalition_id: params.id,
      user_id: user.id,
      role: 'member',
    })

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message ?? 'Failed to join coalition' },
      { status: 500 }
    )
  }

  const { data: updatedCoalition } = await supabase
    .from('coalitions')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  return NextResponse.json({ success: true, coalition: updatedCoalition })
}
