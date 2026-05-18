import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TribunalCase {
  id: string
  argument_id: string
  status: 'open' | 'deliberating' | 'closed'
  verdict: 'sustained' | 'dismissed' | null
  challenge_count: number
  created_at: string
  closed_at: string | null
  // joined
  argument: {
    id: string
    content: string
    side: 'blue' | 'red'
    upvotes: number
    ai_grade: string | null
    topic_id: string
    topic_statement: string
    topic_category: string | null
    author_username: string
    author_display_name: string | null
    author_avatar_url: string | null
  }
  challenges: Array<{
    reason: string
    note: string | null
    challenger_username: string
  }>
  juror_votes: Array<{
    juror_id: string
    juror_username: string
    juror_display_name: string | null
    juror_avatar_url: string | null
    vote: 'sustained' | 'dismissed' | null
    voted_at: string | null
  }>
  my_vote: 'sustained' | 'dismissed' | null
  can_serve: boolean
  has_challenged: boolean
}

export interface TribunalStats {
  open: number
  deliberating: number
  closed: number
  sustained: number
  dismissed: number
}

export interface TribunalResponse {
  cases: TribunalCase[]
  stats: TribunalStats
  my_service_count: number
}

// ─── GET /api/tribunal ────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? 'open'
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)

    // Fetch cases
    const query = supabase
      .from('tribunal_cases')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status !== 'all') {
      query.eq('status', status)
    }

    const { data: rawCases } = await query

    if (!rawCases || rawCases.length === 0) {
      const { data: statsRows } = await supabase
        .from('tribunal_cases')
        .select('status, verdict')

      const stats: TribunalStats = { open: 0, deliberating: 0, closed: 0, sustained: 0, dismissed: 0 }
      for (const row of statsRows ?? []) {
        if (row.status === 'open') stats.open++
        if (row.status === 'deliberating') stats.deliberating++
        if (row.status === 'closed') stats.closed++
        if (row.verdict === 'sustained') stats.sustained++
        if (row.verdict === 'dismissed') stats.dismissed++
      }

      const resp: TribunalResponse = { cases: [], stats, my_service_count: 0 }
      return NextResponse.json(resp)
    }

    const caseIds = rawCases.map((c) => c.id)
    const argumentIds = rawCases.map((c) => c.argument_id)

    // Fetch arguments with authors and topics
    const { data: argsData } = await supabase
      .from('topic_arguments')
      .select(`
        id, content, side, upvotes, ai_grade, topic_id,
        profiles!topic_arguments_user_id_fkey(username, display_name, avatar_url),
        topics!topic_arguments_topic_id_fkey(statement, category)
      `)
      .in('id', argumentIds)

    const argMap = new Map<string, typeof argsData extends (infer T)[] | null ? T : never>()
    for (const a of argsData ?? []) {
      argMap.set(a.id, a)
    }

    // Fetch challenges
    const { data: challengesData } = await supabase
      .from('tribunal_challenges')
      .select(`
        argument_id, reason, note,
        profiles!tribunal_challenges_challenger_id_fkey(username)
      `)
      .in('argument_id', argumentIds)

    const challengeMap = new Map<string, typeof challengesData>()
    for (const c of challengesData ?? []) {
      const arr = challengeMap.get(c.argument_id) ?? []
      arr.push(c)
      challengeMap.set(c.argument_id, arr)
    }

    // Fetch juror votes
    const { data: votesData } = await supabase
      .from('tribunal_juror_votes')
      .select(`
        case_id, juror_id, vote, voted_at,
        profiles!tribunal_juror_votes_juror_id_fkey(username, display_name, avatar_url)
      `)
      .in('case_id', caseIds)

    const voteMap = new Map<string, typeof votesData>()
    for (const v of votesData ?? []) {
      const arr = voteMap.get(v.case_id) ?? []
      arr.push(v)
      voteMap.set(v.case_id, arr)
    }

    // Current user info
    let userRole = ''
    const userChallenges = new Set<string>()
    const userVotes = new Map<string, string>()
    let myServiceCount = 0

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      userRole = profile?.role ?? 'person'

      const { data: myChallenges } = await supabase
        .from('tribunal_challenges')
        .select('argument_id')
        .eq('challenger_id', user.id)
        .in('argument_id', argumentIds)

      for (const ch of myChallenges ?? []) {
        userChallenges.add(ch.argument_id)
      }

      const { data: myVotes } = await supabase
        .from('tribunal_juror_votes')
        .select('case_id, vote')
        .eq('juror_id', user.id)
        .in('case_id', caseIds)

      for (const v of myVotes ?? []) {
        if (v.vote) userVotes.set(v.case_id, v.vote)
      }

      const { count } = await supabase
        .from('tribunal_juror_votes')
        .select('*', { count: 'exact', head: true })
        .eq('juror_id', user.id)
        .not('vote', 'is', null)

      myServiceCount = count ?? 0
    }

    const JUROR_ROLES = ['debator', 'senator', 'elder', 'lawmaker', 'troll_catcher']
    const canServe = JUROR_ROLES.includes(userRole)

    // Assemble cases
    const cases: TribunalCase[] = rawCases.map((c) => {
      const arg = argMap.get(c.argument_id)
      const prof = (arg as { profiles?: { username: string; display_name: string | null; avatar_url: string | null } | null })?.profiles
      const topic = (arg as { topics?: { statement: string; category: string | null } | null })?.topics

      const votes = voteMap.get(c.id) ?? []
      const challenges = challengeMap.get(c.argument_id) ?? []

      return {
        id: c.id,
        argument_id: c.argument_id,
        status: c.status,
        verdict: c.verdict,
        challenge_count: c.challenge_count,
        created_at: c.created_at,
        closed_at: c.closed_at,
        argument: {
          id: c.argument_id,
          content: arg?.content ?? '',
          side: (arg?.side ?? 'blue') as 'blue' | 'red',
          upvotes: arg?.upvotes ?? 0,
          ai_grade: arg?.ai_grade ?? null,
          topic_id: arg?.topic_id ?? '',
          topic_statement: topic?.statement ?? 'Unknown topic',
          topic_category: topic?.category ?? null,
          author_username: prof?.username ?? 'unknown',
          author_display_name: prof?.display_name ?? null,
          author_avatar_url: prof?.avatar_url ?? null,
        },
        challenges: (challenges ?? []).map((ch) => ({
          reason: ch.reason,
          note: ch.note,
          challenger_username: (ch as { profiles?: { username: string } | null })?.profiles?.username ?? 'unknown',
        })),
        juror_votes: votes.map((v) => {
          const jp = (v as { profiles?: { username: string; display_name: string | null; avatar_url: string | null } | null })?.profiles
          return {
            juror_id: v.juror_id,
            juror_username: jp?.username ?? 'unknown',
            juror_display_name: jp?.display_name ?? null,
            juror_avatar_url: jp?.avatar_url ?? null,
            vote: v.vote as 'sustained' | 'dismissed' | null,
            voted_at: v.voted_at,
          }
        }),
        my_vote: userVotes.get(c.id) as 'sustained' | 'dismissed' | null ?? null,
        can_serve: canServe && !userVotes.has(c.id) && c.status !== 'closed',
        has_challenged: userChallenges.has(c.argument_id),
      }
    })

    // Stats
    const { data: allCases } = await supabase
      .from('tribunal_cases')
      .select('status, verdict')

    const stats: TribunalStats = { open: 0, deliberating: 0, closed: 0, sustained: 0, dismissed: 0 }
    for (const row of allCases ?? []) {
      if (row.status === 'open') stats.open++
      if (row.status === 'deliberating') stats.deliberating++
      if (row.status === 'closed') stats.closed++
      if (row.verdict === 'sustained') stats.sustained++
      if (row.verdict === 'dismissed') stats.dismissed++
    }

    const resp: TribunalResponse = { cases, stats, my_service_count: myServiceCount }
    return NextResponse.json(resp)
  } catch (err) {
    console.error('[tribunal] GET error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ─── POST /api/tribunal — challenge an argument ───────────────────────────────

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { argument_id, reason, note } = body as {
      argument_id: string
      reason: string
      note?: string
    }

    if (!argument_id || !['misleading', 'fallacious', 'irrelevant', 'spam'].includes(reason)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // Verify argument exists
    const { data: arg } = await supabase
      .from('topic_arguments')
      .select('id, user_id')
      .eq('id', argument_id)
      .single()

    if (!arg) return NextResponse.json({ error: 'Argument not found' }, { status: 404 })
    if (arg.user_id === user.id) return NextResponse.json({ error: 'Cannot challenge your own argument' }, { status: 400 })

    // Insert challenge (upsert to be idempotent)
    const { error: challengeError } = await supabase
      .from('tribunal_challenges')
      .insert({ argument_id, challenger_id: user.id, reason, note: note?.slice(0, 280) ?? null })

    if (challengeError) {
      if (challengeError.code === '23505') {
        return NextResponse.json({ error: 'Already challenged' }, { status: 409 })
      }
      throw challengeError
    }

    // Count total challenges
    const { count } = await supabase
      .from('tribunal_challenges')
      .select('*', { count: 'exact', head: true })
      .eq('argument_id', argument_id)

    const total = count ?? 1

    // If threshold reached (3+), create/update tribunal case
    if (total >= 3) {
      const { data: existing } = await supabase
        .from('tribunal_cases')
        .select('id, challenge_count')
        .eq('argument_id', argument_id)
        .single()

      if (existing) {
        await supabase
          .from('tribunal_cases')
          .update({ challenge_count: total })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('tribunal_cases')
          .insert({ argument_id, challenge_count: total, status: 'open' })
      }
    }

    return NextResponse.json({ ok: true, total_challenges: total, case_opened: total >= 3 })
  } catch (err) {
    console.error('[tribunal] POST error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
