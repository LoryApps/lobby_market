import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Minimum clout to grant Royal Assent (Elder tier)
const ELDER_THRESHOLD = 750

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssentGranter {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  clout: number
  title: string
}

export interface AwaitingAssentLaw {
  id: string
  topic_id: string
  statement: string
  full_statement: string | null
  category: string | null
  blue_pct: number | null
  total_votes: number | null
  established_at: string
  // Lords ratification summary (from lords_ratification_summary view)
  ratify_count: number
  send_back_count: number
  total_lords_reviews: number
}

export interface AssentRecord {
  id: string
  law_id: string
  statement: string
  full_statement: string | null
  category: string | null
  blue_pct: number | null
  total_votes: number | null
  established_at: string
  topic_id: string
  assent_id: string
  proclamation: string | null
  granted_at: string
  granter_username: string
  granter_display_name: string | null
  granter_avatar_url: string | null
  granter_clout: number
}

export interface RoyalAssentData {
  // Current user state
  is_elder: boolean
  user_clout: number
  elder_threshold: number
  // Laws awaiting assent (established, lords reviewed, no assent yet)
  awaiting: AwaitingAssentLaw[]
  // Recently granted Royal Assents
  recent: AssentRecord[]
  // All-time Elders who have granted assent
  granters: AssentGranter[]
  // Total count of laws with assent
  total_assented: number
}

// ─── Elder title helper ───────────────────────────────────────────────────────

function elderTitle(clout: number): string {
  if (clout >= 2000) return 'Sovereign'
  if (clout >= 1500) return 'Grand Elder'
  if (clout >= 1000) return 'High Elder'
  if (clout >= 750)  return 'Elder'
  return 'Citizen'
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // ── Current user clout ───────────────────────────────────────────────────────
  let userClout = 0
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('clout')
      .eq('id', user.id)
      .single()
    userClout = profile?.clout ?? 0
  }
  const isElder = userClout >= ELDER_THRESHOLD

  // ── Laws awaiting assent (established laws with no assent yet) ──────────────
  // First get the set of already-assented law IDs
  const { data: assentedIds } = await supabase
    .from('royal_assent')
    .select('law_id')

  const excludedIds = (assentedIds ?? []).map((r: { law_id: string }) => r.law_id)

  const lawSelectFields = `
    id,
    topic_id,
    statement,
    full_statement,
    category,
    blue_pct,
    total_votes,
    established_at
  `

  const { data: awaitingRows } = excludedIds.length > 0
    ? await supabase
        .from('laws')
        .select(lawSelectFields)
        .not('id', 'in', `(${excludedIds.join(',')})`)
        .order('established_at', { ascending: false })
        .limit(20)
    : await supabase
        .from('laws')
        .select(lawSelectFields)
        .order('established_at', { ascending: false })
        .limit(20)

  // Enrich with lords review counts
  const awaitingWithReviews: AwaitingAssentLaw[] = []
  for (const law of (awaitingRows ?? [])) {
    const { data: reviewSummary } = await supabase
      .from('lords_ratification_summary')
      .select('ratify_count, send_back_count, total_reviews')
      .eq('law_id', law.id)
      .maybeSingle()

    awaitingWithReviews.push({
      ...law,
      ratify_count: reviewSummary?.ratify_count ?? 0,
      send_back_count: reviewSummary?.send_back_count ?? 0,
      total_lords_reviews: reviewSummary?.total_reviews ?? 0,
    })
  }

  // ── Recent Royal Assents ──────────────────────────────────────────────────────
  const { data: recentRows } = await supabase
    .from('royal_assent')
    .select(`
      id,
      law_id,
      proclamation,
      granted_at,
      profiles!granted_by (
        username,
        display_name,
        avatar_url,
        clout
      ),
      laws!law_id (
        statement,
        full_statement,
        category,
        blue_pct,
        total_votes,
        established_at,
        topic_id
      )
    `)
    .order('granted_at', { ascending: false })
    .limit(30)

  const recent: AssentRecord[] = (recentRows ?? []).map((row: Record<string, unknown>) => {
    const granter = (row.profiles as Record<string, unknown>) ?? {}
    const law = (row.laws as Record<string, unknown>) ?? {}
    return {
      id: row.id as string,
      law_id: row.law_id as string,
      statement: (law.statement as string) ?? '',
      full_statement: (law.full_statement as string | null) ?? null,
      category: (law.category as string | null) ?? null,
      blue_pct: (law.blue_pct as number | null) ?? null,
      total_votes: (law.total_votes as number | null) ?? null,
      established_at: (law.established_at as string) ?? '',
      topic_id: (law.topic_id as string) ?? '',
      assent_id: row.id as string,
      proclamation: (row.proclamation as string | null) ?? null,
      granted_at: row.granted_at as string,
      granter_username: (granter.username as string) ?? '',
      granter_display_name: (granter.display_name as string | null) ?? null,
      granter_avatar_url: (granter.avatar_url as string | null) ?? null,
      granter_clout: (granter.clout as number) ?? 0,
    }
  })

  // ── Total count ───────────────────────────────────────────────────────────────
  const { count: totalAssented } = await supabase
    .from('royal_assent')
    .select('id', { count: 'exact', head: true })

  // ── Granters (Elders who have given assent) ───────────────────────────────────
  const { data: granterRows } = await supabase
    .from('royal_assent')
    .select(`
      granted_by,
      profiles!granted_by (
        username,
        display_name,
        avatar_url,
        clout
      )
    `)

  const granterMap = new Map<string, AssentGranter>()
  for (const row of (granterRows ?? []) as Record<string, unknown>[]) {
    const userId = row.granted_by as string
    if (!granterMap.has(userId)) {
      const p = (row.profiles as Record<string, unknown>) ?? {}
      granterMap.set(userId, {
        user_id: userId,
        username: (p.username as string) ?? '',
        display_name: (p.display_name as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
        clout: (p.clout as number) ?? 0,
        title: elderTitle((p.clout as number) ?? 0),
      })
    }
  }
  const granters = Array.from(granterMap.values())
    .sort((a, b) => b.clout - a.clout)

  return NextResponse.json({
    is_elder: isElder,
    user_clout: userClout,
    elder_threshold: ELDER_THRESHOLD,
    awaiting: awaitingWithReviews,
    recent,
    granters,
    total_assented: totalAssented ?? 0,
  } satisfies RoyalAssentData)
}

// ─── POST — Grant Royal Assent ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Check clout
  const { data: profile } = await supabase
    .from('profiles')
    .select('clout')
    .eq('id', user.id)
    .single()

  const clout = profile?.clout ?? 0
  if (clout < ELDER_THRESHOLD) {
    return NextResponse.json(
      { error: `You need at least ${ELDER_THRESHOLD} clout to grant Royal Assent. You have ${clout}.` },
      { status: 403 }
    )
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const lawId = typeof body.law_id === 'string' ? body.law_id.trim() : ''
  const proclamation = typeof body.proclamation === 'string'
    ? body.proclamation.trim().slice(0, 400)
    : null

  if (!lawId) {
    return NextResponse.json({ error: 'law_id is required' }, { status: 400 })
  }

  // Verify the law exists
  const { data: law } = await supabase
    .from('laws')
    .select('id, statement')
    .eq('id', lawId)
    .single()

  if (!law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // Insert — will fail on unique constraint if already assented
  const { error } = await supabase.from('royal_assent').insert({
    law_id: lawId,
    granted_by: user.id,
    proclamation: proclamation || null,
  })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This law has already received Royal Assent' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
