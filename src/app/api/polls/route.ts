import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface PollOption {
  id: string
  label: string
}

export interface PollWithResults {
  id: string
  question: string
  options: PollOption[]
  topic_id: string | null
  topic_statement: string | null
  category: string | null
  expires_at: string
  is_closed: boolean
  created_at: string
  author_id: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
  total_votes: number
  results: { option_id: string; count: number; pct: number }[]
  user_vote: string | null
}

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ── GET /api/polls — list active polls ────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const filter = (searchParams.get('filter') ?? 'active') as 'active' | 'all' | 'mine'
  const category = searchParams.get('category') ?? null
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)

  const { data: { user } } = await supabase.auth.getUser()

  try {
    let query = supabase
      .from('civic_polls')
      .select(`
        id, question, options, topic_id, category, expires_at, is_closed, created_at, author_id,
        author:profiles!civic_polls_author_id_fkey(username, display_name, avatar_url, role)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (filter === 'active') {
      query = query.eq('is_closed', false).gt('expires_at', new Date().toISOString())
    } else if (filter === 'mine' && user) {
      query = query.eq('author_id', user.id)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: polls, error } = await query

    if (error) {
      // Table not yet created — return empty list gracefully
      return NextResponse.json({ polls: [] })
    }

    if (!polls || polls.length === 0) {
      return NextResponse.json({ polls: [] })
    }

    // Fetch vote counts for all polls
    const pollIds = polls.map((p) => p.id)
    const { data: allVotes } = await supabase
      .from('civic_poll_votes')
      .select('poll_id, option_id, user_id')
      .in('poll_id', pollIds)

    // Fetch linked topic statements
    const topicIds = polls.map((p) => p.topic_id).filter(Boolean) as string[]
    let topicMap = new Map<string, string>()
    if (topicIds.length > 0) {
      const { data: topics } = await supabase
        .from('topics')
        .select('id, statement')
        .in('id', topicIds)
      topicMap = new Map((topics ?? []).map((t) => [t.id, t.statement]))
    }

    const votes = allVotes ?? []

    const result: PollWithResults[] = polls.map((p) => {
      const pollVotes = votes.filter((v) => v.poll_id === p.id)
      const total = pollVotes.length
      const userVote = user ? (pollVotes.find((v) => v.user_id === user.id)?.option_id ?? null) : null

      const options = (p.options as PollOption[]) ?? []
      const results = options.map((opt) => {
        const count = pollVotes.filter((v) => v.option_id === opt.id).length
        return { option_id: opt.id, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }
      })

      const author = Array.isArray(p.author) ? p.author[0] : p.author

      return {
        id: p.id,
        question: p.question,
        options,
        topic_id: p.topic_id,
        topic_statement: p.topic_id ? (topicMap.get(p.topic_id) ?? null) : null,
        category: p.category,
        expires_at: p.expires_at,
        is_closed: p.is_closed,
        created_at: p.created_at,
        author_id: p.author_id,
        author_username: author?.username ?? 'unknown',
        author_display_name: author?.display_name ?? null,
        author_avatar_url: author?.avatar_url ?? null,
        author_role: author?.role ?? 'voter',
        total_votes: total,
        results,
        user_vote: userVote,
      }
    })

    return NextResponse.json({ polls: result })
  } catch {
    return NextResponse.json({ polls: [] })
  }
}

// ── POST /api/polls — create a poll ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    question?: string
    options?: string[]
    topic_id?: string | null
    category?: string | null
    duration_hours?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const question = typeof body.question === 'string' ? body.question.trim() : ''
  if (question.length < 5 || question.length > 200) {
    return NextResponse.json({ error: 'Question must be 5–200 characters' }, { status: 422 })
  }

  const rawOptions = Array.isArray(body.options) ? body.options : []
  const cleanOptions = rawOptions
    .map((o) => (typeof o === 'string' ? o.trim() : ''))
    .filter((o) => o.length >= 1 && o.length <= 100)

  if (cleanOptions.length < 2 || cleanOptions.length > 4) {
    return NextResponse.json({ error: 'Need 2–4 options' }, { status: 422 })
  }

  const options: PollOption[] = cleanOptions.map((label, i) => ({
    id: `opt_${i}`,
    label,
  }))

  const durationHours = typeof body.duration_hours === 'number'
    ? Math.min(Math.max(body.duration_hours, 1), 168)
    : 24

  const expiresAt = new Date(Date.now() + durationHours * 3_600_000).toISOString()

  const category = typeof body.category === 'string' && CATEGORIES.includes(body.category)
    ? body.category
    : null

  const topicId = typeof body.topic_id === 'string' && body.topic_id.trim().length > 0
    ? body.topic_id.trim()
    : null

  try {
    const { data, error } = await supabase
      .from('civic_polls')
      .insert({
        author_id: user.id,
        question,
        options,
        topic_id: topicId,
        category,
        expires_at: expiresAt,
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to create poll. Table may not exist.' }, { status: 500 })
    }

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
