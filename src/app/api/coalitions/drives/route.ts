import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GlobalDrive {
  id: string
  coalition_id: string
  topic_id: string
  title: string
  description: string | null
  target_vote: 'for' | 'against'
  target_count: number
  participant_count: number
  status: 'active' | 'completed' | 'cancelled'
  ends_at: string | null
  created_at: string
  coalition: {
    id: string
    name: string
    member_count: number
    coalition_influence: number
  }
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  creator: {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
  } | null
}

export interface GlobalDrivesResponse {
  drives: GlobalDrive[]
  total: number
  platform_stats: {
    total_active: number
    total_completed: number
    total_participants: number
    coalitions_with_active_drives: number
  }
  filter: {
    target_vote: 'for' | 'against' | null
    status: 'active' | 'completed' | null
  }
}

// ─── GET /api/coalitions/drives ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const voteFilter = searchParams.get('target_vote') as 'for' | 'against' | null
  const statusFilter = (searchParams.get('status') ?? 'active') as 'active' | 'completed' | null
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '30', 10)))
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10))

  const supabase = await createClient()

  // Build drives query
  let query = supabase
    .from('coalition_drives')
    .select('*', { count: 'exact' })
    .order('participant_count', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }
  if (voteFilter) {
    query = query.eq('target_vote', voteFilter)
  }

  const { data: driveRows, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const drives = driveRows ?? []

  if (drives.length === 0) {
    const statsQuery = supabase.from('coalition_drives').select('id, status, participant_count, coalition_id')
    const { data: allDrives } = await statsQuery
    const allRows = allDrives ?? []
    const active = allRows.filter((d: { status: string }) => d.status === 'active')
    return NextResponse.json({
      drives: [],
      total: count ?? 0,
      platform_stats: {
        total_active: active.length,
        total_completed: allRows.filter((d: { status: string }) => d.status === 'completed').length,
        total_participants: allRows.reduce((s: number, d: { participant_count: number }) => s + (d.participant_count ?? 0), 0),
        coalitions_with_active_drives: new Set(active.map((d: { coalition_id: string }) => d.coalition_id)).size,
      },
      filter: { target_vote: voteFilter, status: statusFilter },
    } satisfies GlobalDrivesResponse)
  }

  // Fetch coalitions
  const coalitionIds = [...new Set(drives.map((d: { coalition_id: string }) => d.coalition_id))]
  const { data: coalitionRows } = await supabase
    .from('coalitions')
    .select('id, name, member_count, coalition_influence')
    .in('id', coalitionIds)
  const coalitionMap = new Map<string, GlobalDrive['coalition']>()
  for (const c of coalitionRows ?? []) {
    coalitionMap.set(c.id, c as GlobalDrive['coalition'])
  }

  // Fetch topics
  const topicIds = [...new Set(drives.map((d: { topic_id: string }) => d.topic_id))]
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('id', topicIds)
  const topicMap = new Map<string, GlobalDrive['topic']>()
  for (const t of topicRows ?? []) {
    topicMap.set(t.id, t as GlobalDrive['topic'])
  }

  // Fetch creators
  const creatorIds = [...new Set(drives.map((d: { created_by: string }) => d.created_by))]
  const { data: creatorRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', creatorIds)
  const creatorMap = new Map<string, GlobalDrive['creator']>()
  for (const c of creatorRows ?? []) {
    creatorMap.set(c.id, c as GlobalDrive['creator'])
  }

  // Platform-wide stats
  const { data: allDriveStats } = await supabase
    .from('coalition_drives')
    .select('id, status, participant_count, coalition_id')
  const allRows = allDriveStats ?? []
  const activeRows = allRows.filter((d: { status: string }) => d.status === 'active')

  const enriched: GlobalDrive[] = drives.map((d: {
    id: string
    coalition_id: string
    topic_id: string
    created_by: string
    title: string
    description: string | null
    target_vote: string
    target_count: number
    participant_count: number
    status: string
    ends_at: string | null
    created_at: string
  }) => ({
    id: d.id,
    coalition_id: d.coalition_id,
    topic_id: d.topic_id,
    title: d.title,
    description: d.description,
    target_vote: d.target_vote as 'for' | 'against',
    target_count: d.target_count,
    participant_count: d.participant_count,
    status: d.status as GlobalDrive['status'],
    ends_at: d.ends_at,
    created_at: d.created_at,
    coalition: coalitionMap.get(d.coalition_id) ?? {
      id: d.coalition_id,
      name: 'Unknown Coalition',
      member_count: 0,
      coalition_influence: 0,
    },
    topic: topicMap.get(d.topic_id) ?? {
      id: d.topic_id,
      statement: 'Unknown topic',
      category: null,
      status: 'active',
      blue_pct: 50,
      total_votes: 0,
    },
    creator: creatorMap.get(d.created_by) ?? null,
  }))

  return NextResponse.json({
    drives: enriched,
    total: count ?? 0,
    platform_stats: {
      total_active: activeRows.length,
      total_completed: allRows.filter((d: { status: string }) => d.status === 'completed').length,
      total_participants: allRows.reduce((s: number, d: { participant_count: number }) => s + (d.participant_count ?? 0), 0),
      coalitions_with_active_drives: new Set(activeRows.map((d: { coalition_id: string }) => d.coalition_id)).size,
    },
    filter: { target_vote: voteFilter, status: statusFilter },
  } satisfies GlobalDrivesResponse)
}
