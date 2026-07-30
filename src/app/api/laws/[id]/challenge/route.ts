import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChallengeGrounds =
  | 'constitutional'
  | 'procedural'
  | 'factual'
  | 'ethical'
  | 'practical'

export interface ChallengeItem {
  id: string
  grounds: ChallengeGrounds
  title: string
  description: string
  status: 'open' | 'upheld' | 'dismissed'
  support_count: number
  oppose_count: number
  created_at: string
  user_vote: 'support' | 'oppose' | null
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  } | null
}

export interface LawChallengeData {
  law_id: string
  law_statement: string
  law_category: string | null
  law_blue_pct: number
  law_total_votes: number
  law_established_at: string | null
  total_challenges: number
  challenges: ChallengeItem[]
  user_challenge_ids: string[]
}

interface ChallengeRow {
  id: string
  grounds: string
  title: string
  description: string
  status: string
  support_count: number
  oppose_count: number
  created_at: string
  user_id: string
}

interface VoteRow {
  challenge_id: string
  vote: string
}

// ─── GET /api/laws/[id]/challenge ────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const lawId = params.id

  const grounds = req.nextUrl.searchParams.get('grounds') // filter
  const sort    = req.nextUrl.searchParams.get('sort') ?? 'support' // support | recent

  const { data: { user } } = await supabase.auth.getUser()

  // Law info
  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at')
    .eq('id', lawId)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // Challenges
  let query = db
    .from('law_challenges')
    .select('id, grounds, title, description, status, support_count, oppose_count, created_at, user_id')
    .eq('law_id', lawId)

  if (grounds && grounds !== 'all') {
    query = query.eq('grounds', grounds)
  }

  if (sort === 'recent') {
    query = query.order('created_at', { ascending: false })
  } else {
    query = query.order('support_count', { ascending: false }).order('created_at', { ascending: false })
  }

  query = query.limit(50)

  const { data: challengeRows } = await query as { data: ChallengeRow[] | null }

  const challenges: ChallengeItem[] = []
  const userChallengeIds: string[] = []

  if (challengeRows && challengeRows.length > 0) {
    const authorIds = [...new Set(challengeRows.map((c) => c.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', authorIds)

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p])
    )

    // User's votes on these challenges
    let userVoteMap: Map<string, string> = new Map()
    if (user) {
      const challengeIds = challengeRows.map((c) => c.id)
      const { data: userVotes } = await db
        .from('law_challenge_votes')
        .select('challenge_id, vote')
        .eq('user_id', user.id)
        .in('challenge_id', challengeIds) as { data: VoteRow[] | null }

      if (userVotes) {
        userVoteMap = new Map(userVotes.map((v) => [v.challenge_id, v.vote]))
      }
      userChallengeIds.push(
        ...challengeRows
          .filter((c) => c.user_id === user.id)
          .map((c) => c.id)
      )
    }

    for (const row of challengeRows) {
      const profile = profileMap.get(row.user_id) ?? null
      challenges.push({
        id: row.id,
        grounds: row.grounds as ChallengeGrounds,
        title: row.title,
        description: row.description,
        status: row.status as ChallengeItem['status'],
        support_count: row.support_count,
        oppose_count: row.oppose_count,
        created_at: row.created_at,
        user_vote: (userVoteMap.get(row.id) ?? null) as ChallengeItem['user_vote'],
        author: profile
          ? {
              id: profile.id,
              username: profile.username,
              display_name: profile.display_name,
              avatar_url: profile.avatar_url,
              role: profile.role,
              clout: profile.clout,
            }
          : null,
      })
    }
  }

  const total = challengeRows?.length ?? 0

  const data: LawChallengeData = {
    law_id: lawId,
    law_statement: law.statement ?? '',
    law_category: law.category ?? null,
    law_blue_pct: law.blue_pct ?? 50,
    law_total_votes: law.total_votes ?? 0,
    law_established_at: law.established_at ?? null,
    total_challenges: total,
    challenges,
    user_challenge_ids: userChallengeIds,
  }

  return NextResponse.json(data)
}

// ─── POST /api/laws/[id]/challenge — file a new challenge ─────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const lawId = params.id

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as {
    grounds: ChallengeGrounds
    title: string
    description: string
  }

  const validGrounds = ['constitutional', 'procedural', 'factual', 'ethical', 'practical']
  if (!validGrounds.includes(body.grounds)) {
    return NextResponse.json({ error: 'Invalid grounds' }, { status: 400 })
  }
  if (!body.title || body.title.length < 10 || body.title.length > 120) {
    return NextResponse.json({ error: 'Title must be 10–120 chars' }, { status: 400 })
  }
  if (!body.description || body.description.length < 30 || body.description.length > 1200) {
    return NextResponse.json({ error: 'Description must be 30–1200 chars' }, { status: 400 })
  }

  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', lawId)
    .maybeSingle()
  if (!law) return NextResponse.json({ error: 'Law not found' }, { status: 404 })

  const { data: challenge, error } = await db
    .from('law_challenges')
    .insert({
      law_id: lawId,
      user_id: user.id,
      grounds: body.grounds,
      title: body.title.trim(),
      description: body.description.trim(),
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: challenge.id })
}

// ─── PATCH /api/laws/[id]/challenge — vote on a challenge ─────────────────────

export async function PATCH(
  req: NextRequest,
  _ctx: { params: { id: string } }
) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as {
    challenge_id: string
    vote: 'support' | 'oppose' | null
  }

  if (!body.challenge_id) {
    return NextResponse.json({ error: 'challenge_id required' }, { status: 400 })
  }

  if (body.vote === null) {
    // Withdraw vote
    await db
      .from('law_challenge_votes')
      .delete()
      .eq('challenge_id', body.challenge_id)
      .eq('user_id', user.id)
    return NextResponse.json({ ok: true })
  }

  if (body.vote !== 'support' && body.vote !== 'oppose') {
    return NextResponse.json({ error: 'vote must be support or oppose' }, { status: 400 })
  }

  // Upsert
  const { error } = await db
    .from('law_challenge_votes')
    .upsert(
      { challenge_id: body.challenge_id, user_id: user.id, vote: body.vote },
      { onConflict: 'challenge_id,user_id' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
