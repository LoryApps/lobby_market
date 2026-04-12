import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type {
  Debate,
  DebateStatus,
  DebateType,
  DebateWithTopic,
  Profile,
  Topic,
} from '@/lib/supabase/types'

const VALID_TYPES: DebateType[] = ['quick', 'grand', 'tribunal']
const VALID_STATUSES: DebateStatus[] = [
  'scheduled',
  'live',
  'ended',
  'cancelled',
]

const MIN_LEAD_MS = 10 * 60 * 1000 // 10 minutes in the future

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') as DebateStatus | null

  let query = supabase
    .from('debates')
    .select('*')
    .order('scheduled_at', { ascending: true })

  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load debates' },
      { status: 500 }
    )
  }

  const baseDebates = (data ?? []) as Debate[]
  const topicIds = Array.from(new Set(baseDebates.map((d) => d.topic_id)))
  const creatorIds = Array.from(new Set(baseDebates.map((d) => d.creator_id)))

  const [topicsRes, creatorsRes] = await Promise.all([
    topicIds.length
      ? supabase
          .from('topics')
          .select('id, statement, category')
          .in('id', topicIds)
      : Promise.resolve({
          data: [] as Pick<Topic, 'id' | 'statement' | 'category'>[],
        }),
    creatorIds.length
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .in('id', creatorIds)
      : Promise.resolve({
          data: [] as Pick<
            Profile,
            'id' | 'username' | 'display_name' | 'avatar_url' | 'role'
          >[],
        }),
  ])

  const topicMap = new Map(
    (topicsRes.data ?? []).map((t) => [t.id, t] as const)
  )
  const creatorMap = new Map(
    (creatorsRes.data ?? []).map((c) => [c.id, c] as const)
  )

  const debates: DebateWithTopic[] = baseDebates.map((d) => ({
    ...d,
    topic: topicMap.get(d.topic_id) ?? null,
    creator: creatorMap.get(d.creator_id) ?? null,
  }))

  return NextResponse.json({ debates })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  }

  if (!['debator', 'troll_catcher', 'elder'].includes(profile.role)) {
    return NextResponse.json(
      { error: 'Only Debators and above can schedule debates' },
      { status: 403 }
    )
  }

  let body: {
    topic_id?: string
    type?: DebateType
    title?: string
    description?: string
    scheduled_at?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { topic_id, type, title, description, scheduled_at } = body

  if (!topic_id || typeof topic_id !== 'string') {
    return NextResponse.json({ error: 'topic_id is required' }, { status: 400 })
  }

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: 'type must be quick, grand, or tribunal' },
      { status: 400 }
    )
  }

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  if (title.length > 200) {
    return NextResponse.json(
      { error: 'title must be 200 characters or fewer' },
      { status: 400 }
    )
  }

  if (!scheduled_at || typeof scheduled_at !== 'string') {
    return NextResponse.json(
      { error: 'scheduled_at is required' },
      { status: 400 }
    )
  }

  const scheduledDate = new Date(scheduled_at)
  if (Number.isNaN(scheduledDate.getTime())) {
    return NextResponse.json(
      { error: 'scheduled_at must be a valid ISO timestamp' },
      { status: 400 }
    )
  }

  if (scheduledDate.getTime() - Date.now() < MIN_LEAD_MS) {
    return NextResponse.json(
      { error: 'Debate must be scheduled at least 10 minutes in the future' },
      { status: 400 }
    )
  }

  // Verify topic exists
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('id, status')
    .eq('id', topic_id)
    .single()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Insert debate
  const { data: debate, error: debateError } = await supabase
    .from('debates')
    .insert({
      topic_id,
      creator_id: user.id,
      type,
      status: 'scheduled',
      phase: 'opening',
      title: title.trim(),
      description: description?.trim() || null,
      scheduled_at: scheduledDate.toISOString(),
    })
    .select()
    .single()

  if (debateError || !debate) {
    return NextResponse.json(
      { error: 'Failed to create debate' },
      { status: 500 }
    )
  }

  return NextResponse.json(debate, { status: 201 })
}
