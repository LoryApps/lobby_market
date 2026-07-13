import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProgrammeBill {
  topic_id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number | null
  total_votes: number | null
  priority_label: 'flagship' | 'priority' | 'secondary'
  note: string | null
}

export interface SpeechCoalition {
  id: string
  name: string
  color: string | null
  member_count: number
  leader_username: string | null
  leader_display_name: string | null
  leader_avatar_url: string | null
}

export interface SpeechResponse {
  id: string
  response_type: 'gracious_address' | 'opposition' | 'amendment'
  content: string
  created_at: string
  coalition_name: string | null
  coalition_color: string | null
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
}

export interface KingsSpeech {
  id: string
  session_name: string
  preamble: string
  delivered_at: string
  coalition: SpeechCoalition | null
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
  bills: ProgrammeBill[]
  hear_hear_count: number
  shame_count: number
  response_count: number
  responses: SpeechResponse[]
  user_reaction: 'hear_hear' | 'shame' | null
}

export interface KingsSpeechData {
  latest: KingsSpeech | null
  archive: Array<{
    id: string
    session_name: string
    delivered_at: string
    coalition_name: string | null
    bill_count: number
    hear_hear_count: number
  }>
  // Platform stats for preamble when no speech exists
  fallback: {
    top_coalition: SpeechCoalition | null
    active_topic_count: number
    law_count: number
    citizen_count: number
    hot_topics: ProgrammeBill[]
  }
  is_authenticated: boolean
  user_clout: number
  // Permissions
  can_deliver: boolean
  can_respond: boolean
  user_coalition_id: string | null
  user_coalition_name: string | null
  // Candidate topics for bill picker
  candidate_topics: ProgrammeBill[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TopicRow = {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number | null
  total_votes: number | null
}

function topicToBill(
  t: TopicRow,
  priority: 'flagship' | 'priority' | 'secondary',
  note?: string | null
): ProgrammeBill {
  return {
    topic_id: t.id,
    statement: t.statement,
    category: t.category,
    status: t.status,
    blue_pct: t.blue_pct,
    total_votes: t.total_votes,
    priority_label: priority,
    note: note ?? null,
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Current user clout + coalition role
  let userClout = 0
  let userCoalitionId: string | null = null
  let userCoalitionName: string | null = null
  let userCoalitionRole: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('clout')
      .eq('id', user.id)
      .single()
    userClout = profile?.clout ?? 0

    // Check coalition leadership
    const { data: memberRow } = await supabase
      .from('coalition_members')
      .select('coalition_id, role, coalition:coalitions(name)')
      .eq('user_id', user.id)
      .in('role', ['leader', 'officer'])
      .order('role')
      .limit(1)
      .single()
    if (memberRow) {
      userCoalitionId = memberRow.coalition_id
      userCoalitionRole = memberRow.role
      const c = Array.isArray(memberRow.coalition) ? memberRow.coalition[0] : memberRow.coalition
      userCoalitionName = c?.name ?? null
    }
  }

  // ── Latest speech ───────────────────────────────────────────────────────────

  const { data: speechRows } = await supabase
    .from('kings_speeches')
    .select(`
      id, session_name, preamble, legislative_programme, delivered_at, coalition_id, authored_by,
      author:profiles!kings_speeches_authored_by_fkey(username, display_name, avatar_url),
      coalition:coalitions!kings_speeches_coalition_id_fkey(id, name, color, member_count)
    `)
    .order('delivered_at', { ascending: false })
    .limit(5)

  const latestRow = speechRows?.[0] ?? null
  let latest: KingsSpeech | null = null

  if (latestRow) {
    const programme: Array<{ topic_id: string; priority_label?: string; note?: string }> =
      Array.isArray(latestRow.legislative_programme) ? latestRow.legislative_programme : []

    const topicIds = programme.map((p) => p.topic_id).filter(Boolean)

    const topicsMap: Record<string, TopicRow> = {}
    if (topicIds.length > 0) {
      const { data: topicRows } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes')
        .in('id', topicIds)
      for (const t of topicRows ?? []) topicsMap[t.id] = t
    }

    const bills: ProgrammeBill[] = programme
      .map((p) => {
        const t = topicsMap[p.topic_id]
        if (!t) return null
        return topicToBill(
          t,
          (p.priority_label as 'flagship' | 'priority' | 'secondary') ?? 'secondary',
          p.note
        )
      })
      .filter((b): b is ProgrammeBill => b !== null)

    // Reaction counts
    const { data: rxRows } = await supabase
      .from('kings_speech_reactions')
      .select('reaction')
      .eq('speech_id', latestRow.id)

    const hearHear = (rxRows ?? []).filter((r: { reaction: string }) => r.reaction === 'hear_hear').length
    const shame = (rxRows ?? []).filter((r: { reaction: string }) => r.reaction === 'shame').length

    let userReaction: 'hear_hear' | 'shame' | null = null
    if (user) {
      const { data: myRx } = await supabase
        .from('kings_speech_reactions')
        .select('reaction')
        .eq('speech_id', latestRow.id)
        .eq('user_id', user.id)
        .single()
      userReaction = (myRx?.reaction as 'hear_hear' | 'shame') ?? null
    }

    // Responses
    const { data: responseRows } = await supabase
      .from('kings_speech_responses')
      .select(`
        id, response_type, content, created_at, coalition_id,
        author:profiles!kings_speech_responses_authored_by_fkey(username, display_name, avatar_url),
        coalition:coalitions!kings_speech_responses_coalition_id_fkey(name, color)
      `)
      .eq('speech_id', latestRow.id)
      .order('created_at')
      .limit(20)

    const responses: SpeechResponse[] = (responseRows ?? []).map((r) => {
      const author = Array.isArray(r.author) ? r.author[0] : r.author
      const coalition = Array.isArray(r.coalition) ? r.coalition[0] : r.coalition
      return {
        id: r.id,
        response_type: r.response_type as SpeechResponse['response_type'],
        content: r.content,
        created_at: r.created_at,
        coalition_name: coalition?.name ?? null,
        coalition_color: coalition?.color ?? null,
        author_username: author?.username ?? 'unknown',
        author_display_name: author?.display_name ?? null,
        author_avatar_url: author?.avatar_url ?? null,
      }
    })

    const coalitionRaw = Array.isArray(latestRow.coalition)
      ? latestRow.coalition[0]
      : latestRow.coalition
    const authorRaw = Array.isArray(latestRow.author)
      ? latestRow.author[0]
      : latestRow.author

    // Coalition leader
    let leaderUsername: string | null = null
    let leaderDisplayName: string | null = null
    let leaderAvatarUrl: string | null = null
    if (coalitionRaw?.id) {
      const { data: leaderRow } = await supabase
        .from('coalition_members')
        .select('profile:profiles(username, display_name, avatar_url)')
        .eq('coalition_id', coalitionRaw.id)
        .eq('role', 'leader')
        .single()
      const profile = leaderRow
        ? (Array.isArray(leaderRow.profile) ? leaderRow.profile[0] : leaderRow.profile)
        : null
      leaderUsername = profile?.username ?? null
      leaderDisplayName = profile?.display_name ?? null
      leaderAvatarUrl = profile?.avatar_url ?? null
    }

    latest = {
      id: latestRow.id,
      session_name: latestRow.session_name,
      preamble: latestRow.preamble,
      delivered_at: latestRow.delivered_at,
      coalition: coalitionRaw
        ? {
            id: coalitionRaw.id,
            name: coalitionRaw.name,
            color: coalitionRaw.color ?? null,
            member_count: coalitionRaw.member_count ?? 0,
            leader_username: leaderUsername,
            leader_display_name: leaderDisplayName,
            leader_avatar_url: leaderAvatarUrl,
          }
        : null,
      author_username: authorRaw?.username ?? null,
      author_display_name: authorRaw?.display_name ?? null,
      author_avatar_url: authorRaw?.avatar_url ?? null,
      bills,
      hear_hear_count: hearHear,
      shame_count: shame,
      response_count: responses.length,
      responses,
      user_reaction: userReaction,
    }
  }

  // ── Archive ─────────────────────────────────────────────────────────────────

  const archive = await Promise.all(
    (speechRows?.slice(1) ?? []).map(async (row) => {
      const { count } = await supabase
        .from('kings_speech_reactions')
        .select('id', { count: 'exact', head: true })
        .eq('speech_id', row.id)
        .eq('reaction', 'hear_hear')

      const prog = Array.isArray(row.legislative_programme) ? row.legislative_programme : []
      const coalition = Array.isArray(row.coalition) ? row.coalition[0] : row.coalition

      return {
        id: row.id,
        session_name: row.session_name,
        delivered_at: row.delivered_at,
        coalition_name: coalition?.name ?? null,
        bill_count: prog.length,
        hear_hear_count: count ?? 0,
      }
    })
  )

  // ── Fallback data (when no speech exists) ───────────────────────────────────

  // Top coalition by member count
  const { data: topCoalitionRows } = await supabase
    .from('coalitions')
    .select('id, name, color, member_count')
    .order('member_count', { ascending: false })
    .limit(1)

  const topCoalitionRaw = topCoalitionRows?.[0]
  let topCoalition: SpeechCoalition | null = null
  if (topCoalitionRaw) {
    const { data: leaderRow } = await supabase
      .from('coalition_members')
      .select('profile:profiles(username, display_name, avatar_url)')
      .eq('coalition_id', topCoalitionRaw.id)
      .eq('role', 'leader')
      .single()
    const profile = leaderRow
      ? (Array.isArray(leaderRow.profile) ? leaderRow.profile[0] : leaderRow.profile)
      : null
    topCoalition = {
      id: topCoalitionRaw.id,
      name: topCoalitionRaw.name,
      color: topCoalitionRaw.color ?? null,
      member_count: topCoalitionRaw.member_count ?? 0,
      leader_username: profile?.username ?? null,
      leader_display_name: profile?.display_name ?? null,
      leader_avatar_url: profile?.avatar_url ?? null,
    }
  }

  // Hot topics for fallback programme
  const { data: hotTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['active', 'voting'])
    .order('total_votes', { ascending: false })
    .limit(8)

  const hotBills: ProgrammeBill[] = (hotTopics ?? []).map((t, i) =>
    topicToBill(
      t,
      i === 0 ? 'flagship' : i < 3 ? 'priority' : 'secondary',
      null
    )
  )

  const { count: activeCount } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .in('status', ['active', 'voting'])

  const { count: lawCount } = await supabase
    .from('laws')
    .select('id', { count: 'exact', head: true })

  const { count: citizenCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  // Determine if user can deliver a new speech:
  // - must be leader of the top coalition by member_count
  // - no speech delivered in the last 30 days
  const topCoalitionId = topCoalitionRaw?.id ?? null
  const recentCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count: recentSpeechCount } = await supabase
    .from('kings_speeches')
    .select('id', { count: 'exact', head: true })
    .gte('delivered_at', recentCutoff)

  const isGoverningLeader =
    !!user &&
    !!userCoalitionId &&
    userCoalitionRole === 'leader' &&
    userCoalitionId === topCoalitionId

  const canDeliver = isGoverningLeader && (recentSpeechCount ?? 0) === 0

  // Can respond: leader or officer of any coalition that hasn't already responded
  let canRespond = false
  if (user && latest && userCoalitionId && userCoalitionId !== latest.coalition?.id) {
    const { count: existingResponse } = await supabase
      .from('kings_speech_responses')
      .select('id', { count: 'exact', head: true })
      .eq('speech_id', latest.id)
      .eq('coalition_id', userCoalitionId)
    canRespond = (existingResponse ?? 0) === 0
  }

  // Candidate topics for the bill picker (active + voting, not already in latest speech)
  const existingBillIds = new Set(latest?.bills.map((b) => b.topic_id) ?? [])
  const { data: candidateRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['active', 'voting', 'proposed'])
    .order('total_votes', { ascending: false })
    .limit(30)

  const candidateTopics: ProgrammeBill[] = (candidateRows ?? [])
    .filter((t) => !existingBillIds.has(t.id))
    .map((t) => topicToBill(t, 'secondary', null))

  const result: KingsSpeechData = {
    latest,
    archive,
    fallback: {
      top_coalition: topCoalition,
      active_topic_count: activeCount ?? 0,
      law_count: lawCount ?? 0,
      citizen_count: citizenCount ?? 0,
      hot_topics: hotBills,
    },
    is_authenticated: !!user,
    user_clout: userClout,
    can_deliver: canDeliver,
    can_respond: canRespond,
    user_coalition_id: userCoalitionId,
    user_coalition_name: userCoalitionName,
    candidate_topics: candidateTopics,
  }

  return NextResponse.json(result)
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { action } = body as { action?: string }

  // ── React to a speech ──────────────────────────────────────────────────────
  if (!action || action === 'react') {
    const { speech_id, reaction } = body as { speech_id: string; reaction: string }
    if (!speech_id || !['hear_hear', 'shame'].includes(reaction)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const { error } = await supabase
      .from('kings_speech_reactions')
      .upsert(
        { speech_id, user_id: user.id, reaction },
        { onConflict: 'speech_id,user_id' }
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── Deliver a new speech ───────────────────────────────────────────────────
  if (action === 'deliver') {
    const { session_name, preamble, bills } = body as {
      session_name: string
      preamble: string
      bills: Array<{ topic_id: string; priority_label: string; note?: string }>
    }

    if (!session_name?.trim() || !preamble?.trim() || !Array.isArray(bills)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    if (preamble.length < 50 || preamble.length > 2000) {
      return NextResponse.json({ error: 'Preamble must be 50–2000 characters' }, { status: 400 })
    }

    // Must be leader of the top coalition by member count
    const { data: topCoalitionRows } = await supabase
      .from('coalitions')
      .select('id')
      .order('member_count', { ascending: false })
      .limit(1)
    const topCoalitionId = topCoalitionRows?.[0]?.id ?? null

    const { data: memberRow } = await supabase
      .from('coalition_members')
      .select('coalition_id, role')
      .eq('user_id', user.id)
      .eq('role', 'leader')
      .single()

    if (!memberRow || memberRow.coalition_id !== topCoalitionId) {
      return NextResponse.json({ error: 'Only the governing coalition leader can deliver a speech' }, { status: 403 })
    }

    // No speech in the last 30 days
    const recentCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { count: recentCount } = await supabase
      .from('kings_speeches')
      .select('id', { count: 'exact', head: true })
      .gte('delivered_at', recentCutoff)
    if ((recentCount ?? 0) > 0) {
      return NextResponse.json({ error: 'A speech has already been delivered in the last 30 days' }, { status: 409 })
    }

    const legislative_programme = bills.map((b) => ({
      topic_id: b.topic_id,
      priority_label: b.priority_label,
      note: b.note ?? null,
    }))

    const { data: newSpeech, error } = await supabase
      .from('kings_speeches')
      .insert({
        session_name: session_name.trim(),
        preamble: preamble.trim(),
        legislative_programme,
        coalition_id: memberRow.coalition_id,
        authored_by: user.id,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: newSpeech.id })
  }

  // ── Submit an opposition response ──────────────────────────────────────────
  if (action === 'respond') {
    const { speech_id, response_type, content } = body as {
      speech_id: string
      response_type: string
      content: string
    }

    if (!speech_id || !content?.trim()) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    if (!['gracious_address', 'opposition', 'amendment'].includes(response_type)) {
      return NextResponse.json({ error: 'Invalid response_type' }, { status: 400 })
    }
    if (content.length < 20 || content.length > 1000) {
      return NextResponse.json({ error: 'Response must be 20–1000 characters' }, { status: 400 })
    }

    // Must be leader or officer of a coalition
    const { data: memberRow } = await supabase
      .from('coalition_members')
      .select('coalition_id, role')
      .eq('user_id', user.id)
      .in('role', ['leader', 'officer'])
      .order('role')
      .limit(1)
      .single()

    if (!memberRow) {
      return NextResponse.json({ error: 'Only coalition leaders or officers can respond' }, { status: 403 })
    }

    // Verify the speech exists and the coalition isn't the governing one
    const { data: speechRow } = await supabase
      .from('kings_speeches')
      .select('id, coalition_id')
      .eq('id', speech_id)
      .single()
    if (!speechRow) return NextResponse.json({ error: 'Speech not found' }, { status: 404 })
    if (speechRow.coalition_id === memberRow.coalition_id) {
      return NextResponse.json({ error: 'The governing coalition cannot respond to its own speech' }, { status: 403 })
    }

    // Only one response per coalition per speech
    const { count: existing } = await supabase
      .from('kings_speech_responses')
      .select('id', { count: 'exact', head: true })
      .eq('speech_id', speech_id)
      .eq('coalition_id', memberRow.coalition_id)
    if ((existing ?? 0) > 0) {
      return NextResponse.json({ error: 'Your coalition has already responded to this speech' }, { status: 409 })
    }

    const { error } = await supabase
      .from('kings_speech_responses')
      .insert({
        speech_id,
        coalition_id: memberRow.coalition_id,
        authored_by: user.id,
        response_type,
        content: content.trim(),
      })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
