import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST — toggle endorsement
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if already endorsed
  const { data: existing } = await supabase
    .from('civic_report_endorsements')
    .select('report_id')
    .eq('report_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    // Remove endorsement
    await supabase
      .from('civic_report_endorsements')
      .delete()
      .eq('report_id', params.id)
      .eq('user_id', user.id)
    return NextResponse.json({ endorsed: false })
  } else {
    // Add endorsement
    const { error } = await supabase
      .from('civic_report_endorsements')
      .insert({ report_id: params.id, user_id: user.id })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ endorsed: true })
  }
}
