import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST — Speaker grants or denies an emergency debate (elder/admin only)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Must be elder or admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['elder', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Only Elders can rule on emergency debate proposals' }, { status: 403 })
    }

    const { id } = params
    const body = await req.json()
    const { action, decision } = body as { action: 'grant' | 'deny'; decision?: string }

    if (!['grant', 'deny'].includes(action)) {
      return NextResponse.json({ error: 'Action must be "grant" or "deny"' }, { status: 400 })
    }

    const { data: debate } = await supabase
      .from('emergency_debates')
      .select('id, status')
      .eq('id', id)
      .single()

    if (!debate) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (debate.status !== 'proposed') {
      return NextResponse.json({ error: 'Proposal is not in a pending state' }, { status: 400 })
    }

    const newStatus = action === 'grant' ? 'granted' : 'denied'

    await supabase
      .from('emergency_debates')
      .update({
        status: newStatus,
        speaker_id: user.id,
        speaker_decision: (decision ?? (action === 'grant' ? 'Granted by the Speaker.' : 'Denied by the Speaker.')).slice(0, 500),
        decided_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({ status: newStatus })
  } catch (err) {
    console.error('[emergency-debates grant POST]', err)
    return NextResponse.json({ error: 'Failed to rule on emergency debate' }, { status: 500 })
  }
}
