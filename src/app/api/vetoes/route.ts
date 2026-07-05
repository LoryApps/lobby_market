import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type VetoStatus = 'open' | 'succeeded' | 'failed' | 'withdrawn'
export type GroundsType = 'unconstitutional' | 'ineffective' | 'harmful' | 'outdated' | 'procedural'

export interface VetoEntry {
  id: string
  law_id: string
  challenger_id: string | null
  title: string
  grounds: string
  grounds_type: GroundsType
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
    role: string
  } | null
  user_has_signed: boolean
}

export interface VetoesResponse {
  vetoes: VetoEntry[]
  total: number
}

/**
 * GET /api/vetoes
 * Query params:
 *   status  — 'open' | 'succeeded' | 'failed' | 'withdrawn' | 'all'  (default: 'open')
 *   limit   — number (default 40, max 100)
 *   offset  — number (default 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const rawStatus = searchParams.get('status') ?? 'open'
  const rawLimit = Math.min(Number(searchParams.get('limit') ?? '40'), 100)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 40
  const offset = Math.max(0, Number(searchParams.get('offset') ?? '0'))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase
    .from('civic_vetoes')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const VALID_STATUSES: VetoStatus[] = ['open', 'succeeded', 'failed', 'withdrawn']
  if (rawStatus !== 'all' && VALID_STATUSES.includes(rawStatus as VetoStatus)) {
    query = query.eq('status', rawStatus)
  }

  const { data: rows, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ vetoes: [], total: count ?? 0 })
  }

  const lawIds = Array.from(new Set(rows.map((r) => r.law_id)))
  const challengerIds = Array.from(
    new Set(rows.map((r) => r.challenger_id).filter(Boolean))
  ) as string[]

  const [lawsRes, profilesRes, signaturesRes] = await Promise.all([
    supabase
      .from('laws')
      .select('id, statement, category, total_votes, blue_pct, established_at')
      .in('id', lawIds),
    challengerIds.length > 0
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .in('id', challengerIds)
      : Promise.resolve({ data: [], error: null }),
    user
      ? supabase
          .from('civic_veto_signatures')
          .select('veto_id')
          .in('veto_id', rows.map((r) => r.id))
          .eq('user_id', user.id)
      : Promise.resolve({ data: [], error: null }),
  ])

  const lawMap = new Map((lawsRes.data ?? []).map((l) => [l.id, l]))
  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]))
  const signedIds = new Set((signaturesRes.data ?? []).map((s) => s.veto_id))

  const vetoes: VetoEntry[] = rows.map((row) => ({
    id: row.id,
    law_id: row.law_id,
    challenger_id: row.challenger_id,
    title: row.title,
    grounds: row.grounds,
    grounds_type: row.grounds_type as GroundsType,
    target_signatures: row.target_signatures,
    signature_count: row.signature_count,
    status: row.status as VetoStatus,
    closes_at: row.closes_at,
    created_at: row.created_at,
    resolved_at: row.resolved_at ?? null,
    law: lawMap.get(row.law_id) ?? null,
    challenger: row.challenger_id ? (profileMap.get(row.challenger_id) ?? null) : null,
    user_has_signed: signedIds.has(row.id),
  }))

  return NextResponse.json({ vetoes, total: count ?? 0 })
}

/**
 * POST /api/vetoes
 * Body: { law_id, title, grounds, grounds_type }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { law_id, title, grounds, grounds_type } = body as Record<string, string>

  if (!law_id || !title || !grounds || !grounds_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const VALID_GROUNDS: GroundsType[] = [
    'unconstitutional', 'ineffective', 'harmful', 'outdated', 'procedural',
  ]
  if (!VALID_GROUNDS.includes(grounds_type as GroundsType)) {
    return NextResponse.json({ error: 'Invalid grounds_type' }, { status: 400 })
  }

  // Fetch law to compute target_signatures
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select('id, total_votes')
    .eq('id', law_id)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const target_signatures = Math.max(50, Math.floor((law.total_votes ?? 0) * 0.1))

  const { data: veto, error } = await supabase
    .from('civic_vetoes')
    .insert({
      law_id,
      challenger_id: user.id,
      title: title.trim(),
      grounds: grounds.trim(),
      grounds_type,
      target_signatures,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ veto }, { status: 201 })
}
