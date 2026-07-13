import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PollOption {
  id: string
  label: string
}

export interface CivicPollRow {
  id: string
  question: string
  options: PollOption[]
  category: string | null
  topic_id: string | null
  topic_statement: string | null
  expires_at: string
  is_closed: boolean
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  vote_counts: Record<string, number>
  total_votes: number
  user_vote: string | null   // option_id the current user picked, or null
}

export interface CivicPollsResponse {
  polls: CivicPollRow[]
  total: number
}

// ─── GET /api/civic-polls ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') ?? 'active'  // active | closed | mine
  const category = searchParams.get('category') ?? null
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const offset = Number(searchParams.get('offset') ?? '0')

  // ── Base query ──────────────────────────────────────────────────────────────
  let query = supabase
    .from('civic_polls')
    .select(`
      id,
      question,
      options,
      category,
      topic_id,
      expires_at,
      is_closed,
      created_at,
      author:profiles!author_id (
        id, username, display_name, avatar_url, role
      ),
      topic:topics!topic_id (
        statement
      )
    `, { count: 'exact' })

  if (filter === 'active') {
    query = query.eq('is_closed', false).gt('expires_at', new Date().toISOString())
  } else if (filter === 'closed') {
    query = query.or(`is_closed.eq.true,expires_at.lt.${new Date().toISOString()}`)
  } else if (filter === 'mine' && user) {
    query = query.eq('author_id', user.id)
  }

  if (category) {
    query = query.eq('category', category)
  }

  const { data: polls, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('civic-polls GET error:', error)
    return NextResponse.json({ error: 'Failed to load polls' }, { status: 500 })
  }

  if (!polls || polls.length === 0) {
    return NextResponse.json({ polls: [], total: count ?? 0 } satisfies CivicPollsResponse)
  }

  // ── Fetch vote counts for all polls ────────────────────────────────────────
  const pollIds = polls.map((p) => p.id)

  const { data: allVotes } = await supabase
    .from('civic_poll_votes')
    .select('poll_id, option_id')
    .in('poll_id', pollIds)

  // ── Fetch user's own votes ──────────────────────────────────────────────────
  let userVotesMap: Record<string, string> = {}
  if (user) {
    const { data: myVotes } = await supabase
      .from('civic_poll_votes')
      .select('poll_id, option_id')
      .in('poll_id', pollIds)
      .eq('user_id', user.id)

    userVotesMap = Object.fromEntries(
      (myVotes ?? []).map((v) => [v.poll_id, v.option_id])
    )
  }

  // ── Assemble tallies ────────────────────────────────────────────────────────
  const tallies: Record<string, Record<string, number>> = {}
  for (const v of allVotes ?? []) {
    if (!tallies[v.poll_id]) tallies[v.poll_id] = {}
    tallies[v.poll_id][v.option_id] = (tallies[v.poll_id][v.option_id] ?? 0) + 1
  }

  // ── Shape response ──────────────────────────────────────────────────────────
  const shaped: CivicPollRow[] = polls.map((p) => {
    const voteCounts = tallies[p.id] ?? {}
    const total = Object.values(voteCounts).reduce((a, b) => a + b, 0)
    const author = Array.isArray(p.author) ? p.author[0] : p.author
    const topic = Array.isArray(p.topic) ? p.topic[0] : p.topic

    return {
      id: p.id,
      question: p.question,
      options: p.options as PollOption[],
      category: p.category,
      topic_id: p.topic_id,
      topic_statement: (topic as { statement?: string } | null)?.statement ?? null,
      expires_at: p.expires_at,
      is_closed: p.is_closed,
      created_at: p.created_at,
      author: author
        ? {
            id: (author as { id: string }).id,
            username: (author as { username: string }).username,
            display_name: (author as { display_name: string | null }).display_name,
            avatar_url: (author as { avatar_url: string | null }).avatar_url,
            role: (author as { role: string }).role,
          }
        : null,
      vote_counts: voteCounts,
      total_votes: total,
      user_vote: userVotesMap[p.id] ?? null,
    }
  })

  return NextResponse.json({ polls: shaped, total: count ?? 0 } satisfies CivicPollsResponse)
}

// ─── POST /api/civic-polls ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    question?: string
    options?: Array<{ label: string }>
    category?: string
    topic_id?: string
    duration_hours?: number
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { question, options, category, topic_id, duration_hours = 48 } = body

  if (!question || question.trim().length < 5 || question.trim().length > 200) {
    return NextResponse.json(
      { error: 'Question must be 5–200 characters' },
      { status: 400 }
    )
  }

  if (!options || options.length < 2 || options.length > 4) {
    return NextResponse.json(
      { error: 'Polls must have 2–4 options' },
      { status: 400 }
    )
  }

  for (const opt of options) {
    if (!opt.label || opt.label.trim().length < 1 || opt.label.trim().length > 80) {
      return NextResponse.json(
        { error: 'Each option must be 1–80 characters' },
        { status: 400 }
      )
    }
  }

  const shapedOptions: PollOption[] = options.map((o, i) => ({
    id: `opt_${i + 1}`,
    label: o.label.trim(),
  }))

  const expiresAt = new Date(Date.now() + (duration_hours ?? 48) * 3_600_000).toISOString()

  const { data: poll, error } = await supabase
    .from('civic_polls')
    .insert({
      author_id: user.id,
      question: question.trim(),
      options: shapedOptions,
      category: category ?? null,
      topic_id: topic_id ?? null,
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (error || !poll) {
    console.error('civic-polls POST error:', error)
    return NextResponse.json({ error: 'Failed to create poll' }, { status: 500 })
  }

  return NextResponse.json({ id: poll.id }, { status: 201 })
}
