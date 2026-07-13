import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface IntegritySignal {
  id: string
  signal_type: 'vote_cluster' | 'coordinated_swing' | 'sock_puppet' | 'topic_spam' | 'argument_flood'
  severity: 'low' | 'medium' | 'high' | 'critical'
  topic_id: string | null
  user_id: string | null
  details: Record<string, unknown>
  resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

export interface IntegritySnapshot {
  id: string
  snapshot_date: string
  total_votes: number
  unique_voters: number
  flagged_votes: number
  new_topics: number
  rejected_topics: number
  new_users: number
  active_signals: number
  health_score: number
  created_at: string
}

export interface IntegrityResponse {
  snapshots: IntegritySnapshot[]
  signals: IntegritySignal[]
  latestHealth: number
  activeSignalCount: number
}

export async function GET(request: Request) {
  const supabase = await createClient()

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') ?? 'active' // active | resolved | all

  const [snapshotsRes, signalsRes] = await Promise.all([
    supabase
      .from('integrity_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: true })
      .limit(30),

    supabase
      .from('integrity_signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const snapshots = (snapshotsRes.data ?? []) as IntegritySnapshot[]
  const allSignals = (signalsRes.data ?? []) as IntegritySignal[]

  const signals =
    filter === 'active'
      ? allSignals.filter((s) => !s.resolved)
      : filter === 'resolved'
        ? allSignals.filter((s) => s.resolved)
        : allSignals

  const latestHealth = snapshots.length > 0
    ? snapshots[snapshots.length - 1].health_score
    : 100

  const activeSignalCount = allSignals.filter((s) => !s.resolved).length

  return NextResponse.json({
    snapshots,
    signals,
    latestHealth,
    activeSignalCount,
  } satisfies IntegrityResponse)
}

// PATCH /api/civic-integrity-monitor — resolve a signal (admin only)
export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only admins/moderators can resolve signals
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['admin', 'moderator'].includes(profile.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { signalId } = body as { signalId?: string }

  if (!signalId) {
    return NextResponse.json({ error: 'signalId required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('integrity_signals')
    .update({ resolved: true, resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq('id', signalId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
