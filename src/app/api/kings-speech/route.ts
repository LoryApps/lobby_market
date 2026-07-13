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

  // Current user clout
  let userClout = 0
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('clout')
      .eq('id', user.id)
      .single()
    userClout = profile?.clout ?? 0
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
  }

  return NextResponse.json(result)
}

// ─── POST — React to a speech ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { speech_id, reaction } = body as { speech_id: string; reaction: string }

  if (!speech_id || !['hear_hear', 'shame'].includes(reaction)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // Upsert reaction
  const { error } = await supabase
    .from('kings_speech_reactions')
    .upsert(
      { speech_id, user_id: user.id, reaction },
      { onConflict: 'speech_id,user_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
