import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ElectionNominee {
  id: string
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  total_votes: number
  total_arguments: number
  statement: string
  vote_count: number
  created_at: string
  is_winner: boolean
}

export interface Election {
  id: string
  slug: string
  title: string
  description: string
  role: string
  seats: number
  starts_at: string
  ends_at: string
  status: string
  nominees: ElectionNominee[]
  total_votes: number
  user_vote_nominee_id: string | null
  user_nominated: boolean
}

export interface ElectionsResponse {
  active: Election[]
  completed: Election[]
  upcoming: Election[]
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: electionRows } = await supabase
    .from('elections')
    .select('*')
    .order('ends_at', { ascending: false })
    .limit(20)

  if (!electionRows || electionRows.length === 0) {
    return NextResponse.json({ active: [], completed: [], upcoming: [] } satisfies ElectionsResponse)
  }

  const electionIds = electionRows.map((e) => e.id)

  // Load all nominees with profile data
  const { data: nomineeRows } = await supabase
    .from('election_nominees')
    .select('id, election_id, user_id, statement, vote_count, created_at')
    .in('election_id', electionIds)
    .order('vote_count', { ascending: false })

  // Load profile data for nominees
  const nomineeUserIds = [...new Set((nomineeRows ?? []).map((n) => n.user_id))]
  const profileMap: Record<string, {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    total_votes: number
    total_arguments: number
  }> = {}

  if (nomineeUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, total_votes, total_arguments')
      .in('id', nomineeUserIds)

    for (const p of profiles ?? []) {
      profileMap[p.id] = p
    }
  }

  // Load user's votes
  const userVoteMap: Record<string, string> = {}
  const userNominatedSet: Set<string> = new Set()

  if (user) {
    const { data: voteRows } = await supabase
      .from('election_votes')
      .select('election_id, nominee_id')
      .eq('voter_id', user.id)
      .in('election_id', electionIds)

    for (const v of voteRows ?? []) {
      userVoteMap[v.election_id] = v.nominee_id
    }

    const { data: selfNoms } = await supabase
      .from('election_nominees')
      .select('election_id')
      .eq('user_id', user.id)
      .in('election_id', electionIds)

    for (const n of selfNoms ?? []) {
      userNominatedSet.add(n.election_id)
    }
  }

  // Build election objects
  const nomineesByElection: Record<string, ElectionNominee[]> = {}
  for (const n of nomineeRows ?? []) {
    const profile = profileMap[n.user_id]
    if (!profile) continue
    if (!nomineesByElection[n.election_id]) nomineesByElection[n.election_id] = []
    nomineesByElection[n.election_id].push({
      id: n.id,
      user_id: n.user_id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout,
      total_votes: profile.total_votes,
      total_arguments: profile.total_arguments,
      statement: n.statement,
      vote_count: n.vote_count,
      created_at: n.created_at,
      is_winner: false,
    })
  }

  // Mark winners in completed elections
  for (const election of electionRows) {
    if (election.status !== 'completed') continue
    const noms = nomineesByElection[election.id] ?? []
    const sorted = [...noms].sort((a, b) => b.vote_count - a.vote_count)
    for (let i = 0; i < Math.min(election.seats, sorted.length); i++) {
      const winner = nomineesByElection[election.id]?.find((n) => n.id === sorted[i].id)
      if (winner) winner.is_winner = true
    }
  }

  const elections: Election[] = electionRows.map((e) => {
    const nominees = nomineesByElection[e.id] ?? []
    const total_votes = nominees.reduce((sum, n) => sum + n.vote_count, 0)
    return {
      id: e.id,
      slug: e.slug,
      title: e.title,
      description: e.description,
      role: e.role,
      seats: e.seats,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      status: e.status,
      nominees,
      total_votes,
      user_vote_nominee_id: userVoteMap[e.id] ?? null,
      user_nominated: userNominatedSet.has(e.id),
    }
  })

  return NextResponse.json({
    active: elections.filter((e) => e.status === 'active'),
    completed: elections.filter((e) => e.status === 'completed'),
    upcoming: elections.filter((e) => e.status === 'upcoming'),
  } satisfies ElectionsResponse)
}

// ─── POST — Self-nominate ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { election_id, statement } = body as { election_id?: string; statement?: string }

  if (!election_id || typeof election_id !== 'string') {
    return NextResponse.json({ error: 'election_id is required' }, { status: 400 })
  }
  if (!statement || typeof statement !== 'string' || statement.trim().length < 10) {
    return NextResponse.json({ error: 'statement must be at least 10 characters' }, { status: 400 })
  }
  if (statement.length > 500) {
    return NextResponse.json({ error: 'statement must be under 500 characters' }, { status: 400 })
  }

  // Verify election is active
  const { data: election } = await supabase
    .from('elections')
    .select('id, status, ends_at')
    .eq('id', election_id)
    .maybeSingle()

  if (!election) return NextResponse.json({ error: 'Election not found' }, { status: 404 })
  if (election.status !== 'active') {
    return NextResponse.json({ error: 'Election is not accepting nominations' }, { status: 409 })
  }
  if (new Date(election.ends_at) < new Date()) {
    return NextResponse.json({ error: 'Election has ended' }, { status: 409 })
  }

  const { error } = await supabase
    .from('election_nominees')
    .insert({ election_id, user_id: user.id, statement: statement.trim() })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You are already nominated in this election' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
