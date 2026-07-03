import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type GroundsType = 'unconstitutional' | 'ineffective' | 'harmful' | 'outdated' | 'procedural'
export type VetoStatus = 'open' | 'succeeded' | 'failed' | 'withdrawn'

export interface CivicVetoEntry {
  id: string
  title: string
  grounds: string
  grounds_type: GroundsType
  target_signatures: number
  signature_count: number
  pct_complete: number
  status: VetoStatus
  closes_at: string
  created_at: string
  resolved_at: string | null
  law: {
    id: string
    statement: string
    category: string | null
    established_at: string
    total_votes: number
    blue_pct: number
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

export interface CivicVetoesResponse {
  vetoes: CivicVetoEntry[]
  total: number
}

/**
 * GET /api/civic-vetoes
 *
 * Query params:
 *   status  — 'open' | 'succeeded' | 'failed' | 'withdrawn' | 'all'  (default: 'open')
 *   limit   — number (default 30, max 100)
 *   offset  — number (default 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const rawStatus = searchParams.get('status') ?? 'open'
  const limit = Math.min(Math.max(1, Number(searchParams.get('limit') ?? '30')), 100)
  const offset = Math.max(0, Number(searchParams.get('offset') ?? '0'))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase
    .from('civic_vetoes')
    .select(
      `
      id,
      title,
      grounds,
      grounds_type,
      target_signatures,
      signature_count,
      status,
      closes_at,
      created_at,
      resolved_at,
      law:law_id (
        id,
        statement,
        category,
        established_at,
        total_votes,
        blue_pct
      ),
      challenger:challenger_id (
        id,
        username,
        display_name,
        avatar_url,
        role
      )
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (rawStatus !== 'all') {
    query = query.eq('status', rawStatus)
  }

  const { data: rows, count, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let signedIds = new Set<string>()
  if (user && rows && rows.length > 0) {
    const ids = rows.map((r) => r.id)
    const { data: sigs } = await supabase
      .from('civic_veto_signatures')
      .select('veto_id')
      .eq('user_id', user.id)
      .in('veto_id', ids)
    if (sigs) signedIds = new Set(sigs.map((s) => s.veto_id))
  }

  const vetoes: CivicVetoEntry[] = (rows ?? []).map((row) => {
    const law = Array.isArray(row.law) ? row.law[0] ?? null : (row.law as CivicVetoEntry['law'] | null)
    const challenger = Array.isArray(row.challenger)
      ? row.challenger[0] ?? null
      : (row.challenger as CivicVetoEntry['challenger'] | null)
    return {
      id: row.id,
      title: row.title,
      grounds: row.grounds,
      grounds_type: row.grounds_type as GroundsType,
      target_signatures: row.target_signatures,
      signature_count: row.signature_count,
      pct_complete:
        row.target_signatures > 0
          ? Math.min(100, Math.round((row.signature_count / row.target_signatures) * 100))
          : 0,
      status: row.status as VetoStatus,
      closes_at: row.closes_at,
      created_at: row.created_at,
      resolved_at: row.resolved_at ?? null,
      law,
      challenger,
      user_has_signed: signedIds.has(row.id),
    }
  })

  return NextResponse.json({ vetoes, total: count ?? 0 } satisfies CivicVetoesResponse)
}

/**
 * POST /api/civic-vetoes
 *
 * Create a new civic veto. Requires auth.
 * Body: { law_id, title, grounds, grounds_type }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const law_id = typeof body.law_id === 'string' ? body.law_id.trim() : ''
  const title = String(body.title ?? '').trim()
  const grounds = String(body.grounds ?? '').trim()
  const grounds_type = String(body.grounds_type ?? 'ineffective')

  if (!law_id) return NextResponse.json({ error: 'law_id_required' }, { status: 400 })
  if (title.length < 10 || title.length > 150)
    return NextResponse.json({ error: 'title_length' }, { status: 400 })
  if (grounds.length < 30 || grounds.length > 2000)
    return NextResponse.json({ error: 'grounds_length' }, { status: 400 })
  if (!['unconstitutional', 'ineffective', 'harmful', 'outdated', 'procedural'].includes(grounds_type))
    return NextResponse.json({ error: 'invalid_grounds_type' }, { status: 400 })

  // Look up the law to calculate target_signatures (10% of voters, min 50)
  const { data: law } = await supabase
    .from('laws')
    .select('id, total_votes')
    .eq('id', law_id)
    .maybeSingle()

  if (!law) return NextResponse.json({ error: 'law_not_found' }, { status: 404 })

  const target_signatures = Math.max(50, Math.floor((law.total_votes ?? 0) * 0.1))

  const { data: veto, error } = await supabase
    .from('civic_vetoes')
    .insert({
      law_id,
      challenger_id: user.id,
      title,
      grounds,
      grounds_type,
      target_signatures,
      status: 'open',
    })
    .select('id, title, status, created_at, target_signatures')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ veto }, { status: 201 })
}
