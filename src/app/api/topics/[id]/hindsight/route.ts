import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type HindsightVerdict = 'right' | 'wrong'

export interface HindsightEntry {
  id: string
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  verdict: HindsightVerdict
  note: string | null
  created_at: string
}

export interface HindsightStats {
  total: number
  right_count: number
  wrong_count: number
  right_pct: number
  wisdom_score: number
}

export interface HindsightResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  stats: HindsightStats
  entries: HindsightEntry[]
  viewer_vote: HindsightEntry | null
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (topic.status !== 'law' && topic.status !== 'failed') {
    return NextResponse.json({ error: 'Topic not resolved yet' }, { status: 400 })
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Aggregate stats
  const { data: rawVotes } = await supabase
    .from('topic_hindsight_votes')
    .select('verdict')
    .eq('topic_id', params.id)

  const total = rawVotes?.length ?? 0
  const right_count = rawVotes?.filter((v) => v.verdict === 'right').length ?? 0
  const wrong_count = total - right_count
  const right_pct = total > 0 ? Math.round((right_count / total) * 100) : 0
  // Wisdom score: 100 = unanimous "right", 0 = unanimous "wrong", 50 = split
  const wisdom_score = right_pct

  // Recent entries with profile join
  const { data: entries } = await supabase
    .from('topic_hindsight_votes')
    .select(`
      id,
      user_id,
      verdict,
      note,
      created_at,
      profiles:user_id (
        username,
        display_name,
        avatar_url,
        role
      )
    `)
    .eq('topic_id', params.id)
    .order('created_at', { ascending: false })
    .limit(30)

  const mapped: HindsightEntry[] = (entries ?? []).map((e) => {
    const p = Array.isArray(e.profiles) ? e.profiles[0] : (e.profiles as Record<string, string | null> | null)
    return {
      id: e.id,
      user_id: e.user_id,
      username: p?.username ?? 'unknown',
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
      role: p?.role ?? 'person',
      verdict: e.verdict as HindsightVerdict,
      note: e.note ?? null,
      created_at: e.created_at,
    }
  })

  // Viewer's own vote
  let viewer_vote: HindsightEntry | null = null
  if (user) {
    const mine = mapped.find((e) => e.user_id === user.id)
    viewer_vote = mine ?? null
  }

  const response: HindsightResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
    },
    stats: { total, right_count, wrong_count, right_pct, wisdom_score },
    entries: mapped,
    viewer_vote,
  }

  return NextResponse.json(response)
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const verdict = body.verdict as string
  const note: string | null = body.note ?? null

  if (verdict !== 'right' && verdict !== 'wrong') {
    return NextResponse.json({ error: 'Invalid verdict' }, { status: 400 })
  }
  if (note !== null && (note.length < 1 || note.length > 200)) {
    return NextResponse.json({ error: 'Note must be 1-200 characters' }, { status: 400 })
  }

  const { data: topic } = await supabase
    .from('topics')
    .select('status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic || (topic.status !== 'law' && topic.status !== 'failed')) {
    return NextResponse.json({ error: 'Topic not resolved yet' }, { status: 400 })
  }

  const { error } = await supabase
    .from('topic_hindsight_votes')
    .upsert({
      topic_id: params.id,
      user_id: user.id,
      verdict,
      note,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'topic_id,user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('topic_hindsight_votes')
    .delete()
    .eq('topic_id', params.id)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
