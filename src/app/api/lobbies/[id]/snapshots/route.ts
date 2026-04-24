import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface LobbySnapshot {
  member_count: number
  influence_score: number
  recorded_at: string
}

export interface LobbySnapshotsResponse {
  snapshots: LobbySnapshot[]
  /** True when there are at least 2 data points to draw a meaningful trend */
  hasEnoughData: boolean
}

/**
 * GET /api/lobbies/[id]/snapshots
 *
 * Returns the last 30 snapshots for a lobby, oldest-first, so callers can
 * draw a left-to-right sparkline without reversing the array.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: lobbyId } = params
  if (!lobbyId) {
    return NextResponse.json({ error: 'Missing lobby id' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('lobby_snapshots')
    .select('member_count, influence_score, recorded_at')
    .eq('lobby_id', lobbyId)
    .order('recorded_at', { ascending: false })
    .limit(30)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 })
  }

  // Reverse so oldest → newest (left → right on a sparkline)
  const snapshots: LobbySnapshot[] = (data ?? []).reverse()

  return NextResponse.json({
    snapshots,
    hasEnoughData: snapshots.length >= 2,
  } satisfies LobbySnapshotsResponse)
}
