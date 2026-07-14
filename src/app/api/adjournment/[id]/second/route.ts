import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/adjournment/[id]/second
// Body: { action: 'second' | 'unsecond' }

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let action: 'second' | 'unsecond' = 'second'
  try {
    const body = await req.json()
    action = body.action ?? 'second'
  } catch { /* default to second */ }

  // Verify application exists and is still pending
  const { data: app } = await supabase
    .from('adjournment_applications')
    .select('id, status, applicant_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  if (app.status !== 'pending') {
    return NextResponse.json({ error: 'Can only second pending applications' }, { status: 409 })
  }
  if (app.applicant_id === user.id) {
    return NextResponse.json({ error: 'You cannot second your own application' }, { status: 409 })
  }

  if (action === 'unsecond') {
    await supabase
      .from('adjournment_seconds')
      .delete()
      .eq('application_id', params.id)
      .eq('user_id', user.id)
  } else {
    const { error } = await supabase
      .from('adjournment_seconds')
      .upsert(
        { application_id: params.id, user_id: user.id },
        { onConflict: 'application_id,user_id', ignoreDuplicates: true }
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return updated count
  const { data: updated } = await supabase
    .from('adjournment_applications')
    .select('seconds_count')
    .eq('id', params.id)
    .single()

  return NextResponse.json({ seconds_count: updated?.seconds_count ?? 0 })
}
