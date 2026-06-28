import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriveCreator {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

export interface DriveTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export interface DriveWithDetails {
  id: string
  coalition_id: string
  topic_id: string
  created_by: string
  title: string
  description: string | null
  target_vote: 'for' | 'against'
  target_count: number
  participant_count: number
  status: 'active' | 'completed' | 'cancelled'
  ends_at: string | null
  created_at: string
  topic: DriveTopic
  creator: DriveCreator | null
  is_participating: boolean
}

export interface DrivesResponse {
  coalition: {
    id: string
    name: string
  }
  currentUserRole: 'leader' | 'officer' | 'member' | null
  currentUserId: string | null
  active: DriveWithDetails[]
  completed: DriveWithDetails[]
}

// ─── GET /api/coalitions/[id]/drives ─────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const coalitionId = params.id

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Load coalition basics
  const { data: coalition } = await supabase
    .from('coalitions')
    .select('id, name')
    .eq('id', coalitionId)
    .maybeSingle()

  if (!coalition) {
    return NextResponse.json({ error: 'Coalition not found' }, { status: 404 })
  }

  // Current user's role
  let currentUserRole: 'leader' | 'officer' | 'member' | null = null
  if (user) {
    const { data: member } = await supabase
      .from('coalition_members')
      .select('role')
      .eq('coalition_id', coalitionId)
      .eq('user_id', user.id)
      .maybeSingle()
    currentUserRole = (member?.role as typeof currentUserRole) ?? null
  }

  // Load drives with topic data
  const { data: driveRows } = await supabase
    .from('coalition_drives')
    .select('*')
    .eq('coalition_id', coalitionId)
    .order('created_at', { ascending: false })

  const drives = driveRows ?? []

  if (drives.length === 0) {
    const result: DrivesResponse = {
      coalition: { id: coalition.id, name: coalition.name },
      currentUserRole,
      currentUserId: user?.id ?? null,
      active: [],
      completed: [],
    }
    return NextResponse.json(result)
  }

  // Fetch topics
  const topicIds = [...new Set(drives.map((d: { topic_id: string }) => d.topic_id))]
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('id', topicIds)
  const topicMap = new Map<string, DriveTopic>()
  for (const t of topicRows ?? []) topicMap.set(t.id, t as DriveTopic)

  // Fetch creators
  const creatorIds = [...new Set(drives.map((d: { created_by: string }) => d.created_by))]
  const { data: creatorRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', creatorIds)
  const creatorMap = new Map<string, DriveCreator>()
  for (const c of creatorRows ?? []) creatorMap.set(c.id, c as DriveCreator)

  // Fetch current user's participation
  const participatingSet = new Set<string>()
  if (user) {
    const driveIds = drives.map((d: { id: string }) => d.id)
    const { data: participations } = await supabase
      .from('coalition_drive_participants')
      .select('drive_id')
      .in('drive_id', driveIds)
      .eq('user_id', user.id)
    for (const p of participations ?? []) {
      participatingSet.add((p as { drive_id: string }).drive_id)
    }
  }

  // Build enriched drives
  const enriched: DriveWithDetails[] = drives.map((d: {
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
    created_by: d.created_by,
    title: d.title,
    description: d.description ?? null,
    target_vote: d.target_vote as 'for' | 'against',
    target_count: d.target_count,
    participant_count: d.participant_count,
    status: d.status as 'active' | 'completed' | 'cancelled',
    ends_at: d.ends_at ?? null,
    created_at: d.created_at,
    topic: topicMap.get(d.topic_id) ?? {
      id: d.topic_id,
      statement: 'Unknown topic',
      category: null,
      status: 'active',
      blue_pct: 50,
      total_votes: 0,
    },
    creator: creatorMap.get(d.created_by) ?? null,
    is_participating: participatingSet.has(d.id),
  }))

  const active = enriched.filter((d) => d.status === 'active')
  const completed = enriched.filter((d) => d.status !== 'active')

  const result: DrivesResponse = {
    coalition: { id: coalition.id, name: coalition.name },
    currentUserRole,
    currentUserId: user?.id ?? null,
    active,
    completed,
  }
  return NextResponse.json(result)
}

// ─── POST /api/coalitions/[id]/drives ────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const coalitionId = params.id

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify role
  const { data: member } = await supabase
    .from('coalition_members')
    .select('role')
    .eq('coalition_id', coalitionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member || !['leader', 'officer'].includes(member.role)) {
    return NextResponse.json({ error: 'Only leaders and officers can create drives' }, { status: 403 })
  }

  const body = await req.json()
  const { topic_id, title, description, target_vote, target_count, ends_at } = body

  if (!topic_id || !title?.trim() || !target_vote) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!['for', 'against'].includes(target_vote)) {
    return NextResponse.json({ error: 'target_vote must be "for" or "against"' }, { status: 400 })
  }

  // Verify topic exists
  const { data: topic } = await supabase
    .from('topics')
    .select('id, status')
    .eq('id', topic_id)
    .maybeSingle()
  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const { data: drive, error } = await supabase
    .from('coalition_drives')
    .insert({
      coalition_id: coalitionId,
      topic_id,
      created_by: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      target_vote,
      target_count: Math.max(1, Math.min(500, Number(target_count) || 10)),
      ends_at: ends_at ?? null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('coalition_drives insert error:', error)
    return NextResponse.json({ error: 'Failed to create drive' }, { status: 500 })
  }

  return NextResponse.json({ id: drive.id }, { status: 201 })
}

// ─── PATCH /api/coalitions/[id]/drives ───────────────────────────────────────
// Used to cancel/complete a drive (leaders/officers only)

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const coalitionId = params.id

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { drive_id, status } = await req.json()

  if (!drive_id || !['completed', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Verify drive belongs to coalition
  const { data: drive } = await supabase
    .from('coalition_drives')
    .select('id, coalition_id, created_by')
    .eq('id', drive_id)
    .eq('coalition_id', coalitionId)
    .maybeSingle()

  if (!drive) {
    return NextResponse.json({ error: 'Drive not found' }, { status: 404 })
  }

  // Only creator or coalition leaders/officers can update status
  const { data: member } = await supabase
    .from('coalition_members')
    .select('role')
    .eq('coalition_id', coalitionId)
    .eq('user_id', user.id)
    .maybeSingle()

  const isCreator = drive.created_by === user.id
  const isLeaderOrOfficer = member && ['leader', 'officer'].includes(member.role)

  if (!isCreator && !isLeaderOrOfficer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await supabase
    .from('coalition_drives')
    .update({ status })
    .eq('id', drive_id)

  return NextResponse.json({ ok: true })
}
