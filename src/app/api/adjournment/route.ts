import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdjournmentApplicant {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

export interface AdjournmentSpeech {
  id: string
  speech_type: 'opening' | 'floor' | 'response'
  content: string
  created_at: string
  speaker: AdjournmentApplicant | null
}

export interface AdjournmentApplication {
  id: string
  title: string
  issue: string
  category: string
  status: string
  seconds_count: number
  selected_for: string | null
  debate_opens_at: string | null
  debate_closes_at: string | null
  topic_id: string | null
  created_at: string
  applicant: AdjournmentApplicant | null
  speeches: AdjournmentSpeech[]
  user_has_seconded: boolean
  user_has_spoken: boolean
}

export interface AdjournmentStats {
  pending_count: number
  open_count: number
  total_today: number
}

export interface AdjournmentListResponse {
  applications: AdjournmentApplication[]
  stats: AdjournmentStats
  today: AdjournmentApplication | null
}

// ─── GET /api/adjournment ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'all'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const { data: { user } } = await supabase.auth.getUser()

  // Build main query
  let query = supabase
    .from('adjournment_applications')
    .select(`
      id, title, issue, category, status,
      seconds_count, selected_for, debate_opens_at, debate_closes_at,
      topic_id, created_at,
      applicant:profiles!adjournment_applications_applicant_id_fkey(
        id, username, display_name, avatar_url, role, clout
      )
    `)
    .order('seconds_count', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status !== 'all') {
    query = query.eq('status', status)
  } else {
    query = query.neq('status', 'withdrawn')
  }

  const { data: rows, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const appIds = (rows ?? []).map((r: { id: string }) => r.id)

  // Fetch speeches for these applications
  let speechRows: Array<{
    id: string; application_id: string; speech_type: 'opening' | 'floor' | 'response'
    content: string; created_at: string; speaker: AdjournmentApplicant | null
  }> = []

  if (appIds.length > 0) {
    const { data } = await supabase
      .from('adjournment_speeches')
      .select(`
        id, application_id, speech_type, content, created_at,
        speaker:profiles!adjournment_speeches_speaker_id_fkey(
          id, username, display_name, avatar_url, role, clout
        )
      `)
      .in('application_id', appIds)
      .order('created_at', { ascending: true })
    speechRows = (data ?? []) as typeof speechRows
  }

  // Fetch seconds for current user
  let secondedSet = new Set<string>()
  let spokenSet = new Set<string>()
  if (user && appIds.length > 0) {
    const { data: secondsData } = await supabase
      .from('adjournment_seconds')
      .select('application_id')
      .eq('user_id', user.id)
      .in('application_id', appIds)
    secondedSet = new Set((secondsData ?? []).map((s: { application_id: string }) => s.application_id))

    const { data: speechData } = await supabase
      .from('adjournment_speeches')
      .select('application_id')
      .eq('speaker_id', user.id)
      .in('application_id', appIds)
    spokenSet = new Set((speechData ?? []).map((s: { application_id: string }) => s.application_id))
  }

  // Group speeches by application
  const speechesByApp: Record<string, AdjournmentSpeech[]> = {}
  for (const sp of speechRows) {
    if (!speechesByApp[sp.application_id]) speechesByApp[sp.application_id] = []
    speechesByApp[sp.application_id].push({
      id: sp.id,
      speech_type: sp.speech_type,
      content: sp.content,
      created_at: sp.created_at,
      speaker: sp.speaker,
    })
  }

  const applications: AdjournmentApplication[] = (rows ?? []).map((r: {
    id: string
    title: string
    issue: string
    category: string
    status: string
    seconds_count: number
    selected_for: string | null
    debate_opens_at: string | null
    debate_closes_at: string | null
    topic_id: string | null
    created_at: string
    applicant: AdjournmentApplicant | null
  }) => ({
    id: r.id,
    title: r.title,
    issue: r.issue,
    category: r.category,
    status: r.status,
    seconds_count: r.seconds_count,
    selected_for: r.selected_for,
    debate_opens_at: r.debate_opens_at,
    debate_closes_at: r.debate_closes_at,
    topic_id: r.topic_id,
    created_at: r.created_at,
    applicant: r.applicant,
    speeches: speechesByApp[r.id] ?? [],
    user_has_seconded: secondedSet.has(r.id),
    user_has_spoken: spokenSet.has(r.id),
  }))

  // Today's open/selected debate
  const today = applications.find(a => a.status === 'open' || a.status === 'selected') ?? null

  // Stats
  const { data: statsRow } = await supabase
    .from('adjournment_applications')
    .select('status')
    .neq('status', 'withdrawn')

  const stats: AdjournmentStats = {
    pending_count: (statsRow ?? []).filter((r: { status: string }) => r.status === 'pending').length,
    open_count: (statsRow ?? []).filter((r: { status: string }) => r.status === 'open').length,
    total_today: (statsRow ?? []).filter((r: { status: string }) => ['open', 'selected'].includes(r.status)).length,
  }

  return NextResponse.json({ applications, stats, today } satisfies AdjournmentListResponse)
}

// ─── POST /api/adjournment ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { title?: string; issue?: string; category?: string; topic_id?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, issue, category = 'Politics', topic_id } = body

  if (!title || title.trim().length < 10 || title.trim().length > 120) {
    return NextResponse.json({ error: 'Title must be 10–120 characters' }, { status: 422 })
  }
  if (!issue || issue.trim().length < 50 || issue.trim().length > 1000) {
    return NextResponse.json({ error: 'Issue statement must be 50–1000 characters' }, { status: 422 })
  }

  // Limit: 1 pending application per user
  const { count } = await supabase
    .from('adjournment_applications')
    .select('id', { count: 'exact', head: true })
    .eq('applicant_id', user.id)
    .eq('status', 'pending')

  if ((count ?? 0) >= 1) {
    return NextResponse.json(
      { error: 'You already have a pending application. Wait for it to be selected or close it first.' },
      { status: 409 }
    )
  }

  const { data: app, error } = await supabase
    .from('adjournment_applications')
    .insert({
      applicant_id: user.id,
      title: title.trim(),
      issue: issue.trim(),
      category,
      topic_id: topic_id ?? null,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: app.id }, { status: 201 })
}
