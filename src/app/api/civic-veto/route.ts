import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VetoGrounds =
  | 'unconstitutional'
  | 'ineffective'
  | 'harmful'
  | 'outdated'
  | 'procedural'

export type VetoStatus = 'open' | 'succeeded' | 'failed' | 'withdrawn'

export interface VetoEntry {
  id: string
  law_id: string
  challenger_id: string | null
  title: string
  grounds: string
  grounds_type: VetoGrounds
  target_signatures: number
  signature_count: number
  status: VetoStatus
  closes_at: string
  created_at: string
  resolved_at: string | null
  law: {
    id: string
    statement: string
    category: string | null
    total_votes: number | null
    blue_pct: number | null
    established_at: string
  } | null
  challenger: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
  user_has_signed: boolean
}

export interface VetoListResponse {
  vetoes: VetoEntry[]
  total: number
}

// ─── GET ──────────────────────────────────────────────────────────────────────

/**
 * GET /api/civic-veto
 * Query params:
 *   status — 'open' | 'succeeded' | 'failed' | 'all'  (default: 'open')
 *   limit  — number (default 40, max 100)
 *   offset — number (default 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const rawStatus = searchParams.get('status') ?? 'open'
  const rawLimit = Math.min(Number(searchParams.get('limit') ?? '40'), 100)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 40
  const offset = Math.max(0, Number(searchParams.get('offset') ?? '0'))

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let query = supabase
    .from('civic_vetoes')
    .select(
      `
      id, law_id, challenger_id, title, grounds, grounds_type,
      target_signatures, signature_count, status,
      closes_at, created_at, resolved_at,
      laws!civic_vetoes_law_id_fkey (
        id, statement, category, total_votes, blue_pct, established_at
      ),
      profiles!civic_vetoes_challenger_id_fkey (
        id, username, display_name, avatar_url
      )
      `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (rawStatus !== 'all') {
    query = query.eq('status', rawStatus)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Determine which vetoes the current user has signed
  let signedSet = new Set<string>()
  if (user && data && data.length > 0) {
    const ids = (data as Record<string, unknown>[]).map((v) => v.id as string)
    const { data: sigs } = await supabase
      .from('civic_veto_signatures')
      .select('veto_id')
      .eq('user_id', user.id)
      .in('veto_id', ids)
    if (sigs) signedSet = new Set(sigs.map((s: { veto_id: string }) => s.veto_id))
  }

  const vetoes: VetoEntry[] = (
    (data as Record<string, unknown>[] | null) ?? []
  ).map((row) => ({
    id: row.id as string,
    law_id: row.law_id as string,
    challenger_id: row.challenger_id as string | null,
    title: row.title as string,
    grounds: row.grounds as string,
    grounds_type: row.grounds_type as VetoGrounds,
    target_signatures: row.target_signatures as number,
    signature_count: row.signature_count as number,
    status: row.status as VetoStatus,
    closes_at: row.closes_at as string,
    created_at: row.created_at as string,
    resolved_at: row.resolved_at as string | null,
    law: row.laws as VetoEntry['law'],
    challenger: row.profiles as VetoEntry['challenger'],
    user_has_signed: signedSet.has(row.id as string),
  }))

  return NextResponse.json({ vetoes, total: count ?? 0 } satisfies VetoListResponse)
}

// ─── POST — create a new veto ─────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    law_id?: string
    title?: string
    grounds?: string
    grounds_type?: VetoGrounds
  }

  const { law_id, title, grounds, grounds_type = 'ineffective' } = body

  if (!law_id || !title || !grounds) {
    return NextResponse.json(
      { error: 'law_id, title, and grounds are required' },
      { status: 400 }
    )
  }
  if (title.length < 10 || title.length > 150) {
    return NextResponse.json(
      { error: 'title must be 10–150 characters' },
      { status: 400 }
    )
  }
  if (grounds.length < 30 || grounds.length > 2000) {
    return NextResponse.json(
      { error: 'grounds must be 30–2000 characters' },
      { status: 400 }
    )
  }
  const VALID_GROUNDS: VetoGrounds[] = [
    'unconstitutional',
    'ineffective',
    'harmful',
    'outdated',
    'procedural',
  ]
  if (!VALID_GROUNDS.includes(grounds_type)) {
    return NextResponse.json({ error: 'Invalid grounds_type' }, { status: 400 })
  }

  // Verify the law exists and is active
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select('id, total_votes')
    .eq('id', law_id)
    .eq('is_active', true)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json(
      { error: 'Law not found or not active' },
      { status: 404 }
    )
  }

  // Prevent duplicate open vetoes on the same law by the same challenger
  const { data: existing } = await supabase
    .from('civic_vetoes')
    .select('id')
    .eq('law_id', law_id)
    .eq('challenger_id', user.id)
    .eq('status', 'open')
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'You already have an open veto challenge on this law' },
      { status: 409 }
    )
  }

  // Compute signature target: 10% of law's total votes, minimum 50
  const target = Math.max(50, Math.floor((law.total_votes ?? 0) * 0.1))

  const { data: veto, error: insertErr } = await supabase
    .from('civic_vetoes')
    .insert({
      law_id,
      challenger_id: user.id,
      title,
      grounds,
      grounds_type,
      target_signatures: target,
      signature_count: 0,
    })
    .select()
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ veto }, { status: 201 })
}

// ─── PATCH — sign or unsign a veto ────────────────────────────────────────────

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { veto_id?: string; action?: 'sign' | 'unsign' }
  const { veto_id, action = 'sign' } = body

  if (!veto_id) {
    return NextResponse.json({ error: 'veto_id is required' }, { status: 400 })
  }

  // Verify veto is open
  const { data: veto, error: vetoErr } = await supabase
    .from('civic_vetoes')
    .select('id, status, challenger_id')
    .eq('id', veto_id)
    .maybeSingle()

  if (vetoErr || !veto) {
    return NextResponse.json({ error: 'Veto not found' }, { status: 404 })
  }
  if (veto.status !== 'open') {
    return NextResponse.json(
      { error: 'This veto is no longer open for signatures' },
      { status: 400 }
    )
  }
  // Challenger cannot sign their own veto
  if (veto.challenger_id === user.id) {
    return NextResponse.json(
      { error: 'You cannot sign your own veto challenge' },
      { status: 400 }
    )
  }

  if (action === 'sign') {
    const { error: sigErr } = await supabase
      .from('civic_veto_signatures')
      .insert({ veto_id, user_id: user.id })

    if (sigErr) {
      if (sigErr.code === '23505') {
        return NextResponse.json({ error: 'Already signed' }, { status: 409 })
      }
      return NextResponse.json({ error: sigErr.message }, { status: 500 })
    }
    return NextResponse.json({ signed: true })
  }

  // unsign
  const { error: delErr } = await supabase
    .from('civic_veto_signatures')
    .delete()
    .eq('veto_id', veto_id)
    .eq('user_id', user.id)

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return NextResponse.json({ signed: false })
}
