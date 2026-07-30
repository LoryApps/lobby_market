import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VerdictOption = 'succeeded' | 'mostly_succeeded' | 'mixed' | 'mostly_failed' | 'failed'

export interface VerdictCount {
  verdict: VerdictOption
  count: number
}

export interface VerdictVoter {
  user_id: string
  verdict: VerdictOption
  reasoning: string | null
  created_at: string
  profile: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  } | null
}

export interface PrescientArg {
  id: string
  content: string
  side: 'for' | 'against'
  upvotes: number
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
}

export interface LawVerdictData {
  law_id: string
  law_statement: string
  law_category: string | null
  law_blue_pct: number
  law_total_votes: number
  law_established_at: string | null
  total_verdicts: number
  counts: VerdictCount[]
  user_verdict: VerdictOption | null
  user_reasoning: string | null
  recent_voters: VerdictVoter[]
  prescient_for: PrescientArg[]
  prescient_against: PrescientArg[]
}

// ─── Row shapes for the new untyped table ────────────────────────────────────

interface VerdictRow {
  id?: string
  law_id: string
  user_id: string
  verdict: string
  reasoning: string | null
  created_at: string
  updated_at?: string
}

// ─── GET /api/laws/[id]/verdict ───────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const lawId = params.id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: { user } } = await supabase.auth.getUser()

  // Fetch law info
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at')
    .eq('id', lawId)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // Fetch all verdict rows to build counts
  const { data: allRows } = await (db
    .from('law_verdict_votes')
    .select('user_id, verdict, reasoning, created_at')
    .eq('law_id', lawId)
    .order('created_at', { ascending: false }) as Promise<{ data: VerdictRow[] | null }>)

  const rows = allRows ?? []

  const countMap: Record<VerdictOption, number> = {
    succeeded: 0,
    mostly_succeeded: 0,
    mixed: 0,
    mostly_failed: 0,
    failed: 0,
  }
  for (const row of rows) {
    const v = row.verdict as VerdictOption
    if (v in countMap) countMap[v]++
  }
  const counts: VerdictCount[] = Object.entries(countMap).map(([verdict, count]) => ({
    verdict: verdict as VerdictOption,
    count,
  }))
  const totalVerdicts = Object.values(countMap).reduce((a, b) => a + b, 0)

  // User's own verdict
  let userVerdict: VerdictOption | null = null
  let userReasoning: string | null = null
  if (user) {
    const ownRow = rows.find((r) => r.user_id === user.id)
    if (ownRow) {
      userVerdict = ownRow.verdict as VerdictOption
      userReasoning = ownRow.reasoning
    }
  }

  // Recent 12 voters with profiles
  const recentRows = rows.slice(0, 12)
  const voterIds = Array.from(new Set(recentRows.map((r) => r.user_id)))

  const { data: profilesRaw } = voterIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, clout')
        .in('id', voterIds)
    : { data: [] }

  const profileMap = new Map((profilesRaw ?? []).map((p) => [p.id, p]))

  const recentVoters: VerdictVoter[] = recentRows.map((r) => {
    const prof = profileMap.get(r.user_id)
    return {
      user_id: r.user_id,
      verdict: r.verdict as VerdictOption,
      reasoning: r.reasoning,
      created_at: r.created_at,
      profile: prof
        ? {
            username: prof.username,
            display_name: prof.display_name ?? null,
            avatar_url: prof.avatar_url ?? null,
            role: prof.role,
            clout: prof.clout ?? 0,
          }
        : null,
    }
  })

  // Top arguments from the original topic debate (prescient picks)
  const { data: topicRow } = await supabase
    .from('topics')
    .select('id')
    .eq('law_id', lawId)
    .maybeSingle()

  const prescientFor: PrescientArg[] = []
  const prescientAgainst: PrescientArg[] = []

  if (topicRow) {
    const { data: argsRaw } = await supabase
      .from('arguments')
      .select('id, content, side, upvotes, author_id')
      .eq('topic_id', topicRow.id)
      .order('upvotes', { ascending: false })
      .limit(20)

    if (argsRaw && argsRaw.length > 0) {
      const authorIds = Array.from(
        new Set(argsRaw.map((a) => a.author_id).filter((id): id is string => !!id))
      )
      const { data: authorsRaw } = authorIds.length
        ? await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .in('id', authorIds)
        : { data: [] }
      const authorMap = new Map((authorsRaw ?? []).map((p) => [p.id, p]))

      for (const arg of argsRaw) {
        const author = arg.author_id ? authorMap.get(arg.author_id) : null
        const item: PrescientArg = {
          id: arg.id,
          content: arg.content,
          side: arg.side as 'for' | 'against',
          upvotes: arg.upvotes ?? 0,
          author_username: author?.username ?? null,
          author_display_name: author?.display_name ?? null,
          author_avatar_url: author?.avatar_url ?? null,
        }
        if (arg.side === 'for' && prescientFor.length < 3) prescientFor.push(item)
        else if (arg.side === 'against' && prescientAgainst.length < 3) prescientAgainst.push(item)
      }
    }
  }

  const result: LawVerdictData = {
    law_id: law.id,
    law_statement: law.statement ?? '',
    law_category: law.category ?? null,
    law_blue_pct: law.blue_pct ?? 50,
    law_total_votes: law.total_votes ?? 0,
    law_established_at: law.established_at ?? null,
    total_verdicts: totalVerdicts,
    counts,
    user_verdict: userVerdict,
    user_reasoning: userReasoning,
    recent_voters: recentVoters,
    prescient_for: prescientFor,
    prescient_against: prescientAgainst,
  }

  return NextResponse.json(result)
}

// ─── POST /api/laws/[id]/verdict ──────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { verdict: string; reasoning?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const validVerdicts: VerdictOption[] = [
    'succeeded', 'mostly_succeeded', 'mixed', 'mostly_failed', 'failed',
  ]
  if (!validVerdicts.includes(body.verdict as VerdictOption)) {
    return NextResponse.json({ error: 'Invalid verdict' }, { status: 400 })
  }

  const reasoning = (body.reasoning ?? '').trim().slice(0, 400) || null

  const { error } = await (db
    .from('law_verdict_votes')
    .upsert(
      {
        law_id: params.id,
        user_id: user.id,
        verdict: body.verdict,
        reasoning,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'law_id,user_id' }
    ) as Promise<{ error: { message: string } | null }>)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ─── DELETE /api/laws/[id]/verdict ───────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await (db
    .from('law_verdict_votes')
    .delete()
    .eq('law_id', params.id)
    .eq('user_id', user.id) as Promise<unknown>)

  return NextResponse.json({ ok: true })
}
