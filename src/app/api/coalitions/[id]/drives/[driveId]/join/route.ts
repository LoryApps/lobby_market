import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── POST /api/coalitions/[id]/drives/[driveId]/join ─────────────────────────
// Toggle participation: join if not participating, leave if already joined.

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; driveId: string } },
) {
  const supabase = await createClient()
  const { id: coalitionId, driveId } = params

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is a coalition member
  const { data: member } = await supabase
    .from('coalition_members')
    .select('id')
    .eq('coalition_id', coalitionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'You must be a coalition member to join a drive' }, { status: 403 })
  }

  // Verify drive is active and belongs to this coalition
  const { data: drive } = await supabase
    .from('coalition_drives')
    .select('id, status')
    .eq('id', driveId)
    .eq('coalition_id', coalitionId)
    .maybeSingle()

  if (!drive || drive.status !== 'active') {
    return NextResponse.json({ error: 'Drive not found or not active' }, { status: 404 })
  }

  // Toggle participation
  const { data: existing } = await supabase
    .from('coalition_drive_participants')
    .select('drive_id')
    .eq('drive_id', driveId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('coalition_drive_participants')
      .delete()
      .eq('drive_id', driveId)
      .eq('user_id', user.id)
    return NextResponse.json({ participating: false })
  } else {
    await supabase
      .from('coalition_drive_participants')
      .insert({ drive_id: driveId, user_id: user.id })
    return NextResponse.json({ participating: true })
  }
}
