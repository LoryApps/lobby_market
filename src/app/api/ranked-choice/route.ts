import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RCOption {
  id: string
  text: string
  position: number
}

export interface RCPoll {
  id: string
  created_by: string
  title: string
  description: string | null
  category: string
  status: 'open' | 'closed' | 'archived'
  closes_at: string
  created_at: string
  options: RCOption[]
  voter_count: number
  user_voted?: boolean
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

export interface RCPollListResponse {
  polls: RCPoll[]
  total: number
}

export interface RCCreateRequest {
  title: string
  description?: string
  category?: string
  options: string[]         // 3–8 option texts
  closes_in_days?: number   // 1–30, default 7
}

// ── GET /api/ranked-choice ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const sp = req.nextUrl.searchParams

  const category = sp.get('category') ?? null
  const status   = sp.get('status') ?? 'open'
  const limit    = Math.min(Number(sp.get('limit') ?? 20), 50)
  const offset   = Number(sp.get('offset') ?? 0)

  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase
    .from('ranked_choice_polls')
    .select(`
      *,
      author:profiles!created_by(username, display_name, avatar_url),
      options:ranked_choice_options(id, text, position)
    `, { count: 'exact' })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (category) query = query.eq('category', category)

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch voter counts for each poll
  const polls = await Promise.all(
    (data ?? []).map(async (poll) => {
      const { count: vCount } = await supabase
        .from('ranked_choice_votes')
        .select('*', { count: 'exact', head: true })
        .eq('poll_id', poll.id)

      let user_voted = false
      if (user) {
        const { data: myVote } = await supabase
          .from('ranked_choice_votes')
          .select('poll_id')
          .eq('poll_id', poll.id)
          .eq('user_id', user.id)
          .maybeSingle()
        user_voted = !!myVote
      }

      const sortedOptions = (poll.options ?? []).sort(
        (a: RCOption, b: RCOption) => a.position - b.position
      )

      return {
        ...poll,
        options: sortedOptions,
        voter_count: vCount ?? 0,
        user_voted,
      } as RCPoll
    })
  )

  return NextResponse.json({ polls, total: count ?? 0 } satisfies RCPollListResponse)
}

// ── POST /api/ranked-choice ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  let body: RCCreateRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, description, category = 'Politics', options, closes_in_days = 7 } = body

  if (!title || title.length < 10 || title.length > 160) {
    return NextResponse.json({ error: 'Title must be 10–160 characters' }, { status: 400 })
  }
  if (!Array.isArray(options) || options.length < 3 || options.length > 8) {
    return NextResponse.json({ error: 'Provide 3–8 options' }, { status: 400 })
  }
  for (const opt of options) {
    if (!opt || opt.trim().length < 2 || opt.trim().length > 120) {
      return NextResponse.json({ error: 'Each option must be 2–120 characters' }, { status: 400 })
    }
  }

  const daysNum = Math.max(1, Math.min(30, closes_in_days))

  const { data: poll, error: pollErr } = await supabase
    .from('ranked_choice_polls')
    .insert({
      created_by: user.id,
      title: title.trim(),
      description: description?.trim() ?? null,
      category,
      status: 'open',
      closes_at: new Date(Date.now() + daysNum * 86_400_000).toISOString(),
    })
    .select()
    .single()

  if (pollErr || !poll) {
    return NextResponse.json({ error: pollErr?.message ?? 'Insert failed' }, { status: 500 })
  }

  const optionRows = options.map((text, i) => ({
    poll_id: poll.id,
    text: text.trim(),
    position: i,
  }))

  const { error: optErr } = await supabase
    .from('ranked_choice_options')
    .insert(optionRows)

  if (optErr) {
    await supabase.from('ranked_choice_polls').delete().eq('id', poll.id)
    return NextResponse.json({ error: optErr.message }, { status: 500 })
  }

  return NextResponse.json({ poll_id: poll.id }, { status: 201 })
}
