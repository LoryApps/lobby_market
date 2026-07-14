import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WhipGuidance {
  id: string
  coalition_id: string
  topic_id: string
  direction: 'for' | 'against' | 'free'
  strength: 'advisory' | 'strong' | 'critical'
  message: string | null
  active: boolean
  created_at: string
  expires_at: string | null
  coalition: { id: string; name: string; slug: string; avatar_url: string | null } | null
  topic: { id: string; statement: string; category: string | null; status: string } | null
  issuer: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null
  compliance_pct: number | null
  total_votes: number
  compliant_votes: number
}

export interface WhipsResponse {
  whips: WhipGuidance[]
  my_coalition: {
    id: string
    name: string
    slug: string
    avatar_url: string | null
    role: string
  } | null
  stats: {
    active_total: number
    coalitions_issuing: number
    avg_compliance: number | null
  }
}

// ─── GET /api/whips ───────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const coalitionId = searchParams.get('coalition_id')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30'), 60)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Build guidance query
  let query = supabase
    .from('coalition_whip_guidance')
    .select(`
      id, coalition_id, topic_id, direction, strength, message,
      active, created_at, expires_at,
      coalition:coalitions!coalition_whip_guidance_coalition_id_fkey(
        id, name, slug, avatar_url
      ),
      topic:topics!coalition_whip_guidance_topic_id_fkey(
        id, statement, category, status
      ),
      issuer:profiles!coalition_whip_guidance_issued_by_fkey(
        id, username, display_name, avatar_url
      )
    `)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (coalitionId) {
    query = query.eq('coalition_id', coalitionId)
  }

  const { data: rawWhips } = await query

  // Fetch compliance rates for the found guidance ids
  const complianceMap: Map<string, { total: number; compliant: number; pct: number | null }> = new Map()

  if (rawWhips && rawWhips.length > 0) {
    const ids = rawWhips.map((w) => w.id)
    const { data: rates } = await supabase
      .from('coalition_whip_compliance_rates')
      .select('guidance_id, total_votes, compliant_votes, compliance_pct')
      .in('guidance_id', ids)

    if (rates) {
      for (const r of rates) {
        complianceMap.set(r.guidance_id, {
          total: r.total_votes ?? 0,
          compliant: r.compliant_votes ?? 0,
          pct: r.compliance_pct ?? null,
        })
      }
    }
  }

  const whips: WhipGuidance[] = (rawWhips ?? []).map((w) => {
    const compliance = complianceMap.get(w.id)
    const coalition = Array.isArray(w.coalition) ? w.coalition[0] ?? null : w.coalition
    const topic = Array.isArray(w.topic) ? w.topic[0] ?? null : w.topic
    const issuer = Array.isArray(w.issuer) ? w.issuer[0] ?? null : w.issuer
    return {
      ...w,
      coalition,
      topic,
      issuer,
      compliance_pct: compliance?.pct ?? null,
      total_votes: compliance?.total ?? 0,
      compliant_votes: compliance?.compliant ?? 0,
    }
  })

  // Resolve user's coalition membership + role
  let myCoalition: WhipsResponse['my_coalition'] = null
  if (user) {
    const { data: membership } = await supabase
      .from('coalition_members')
      .select(`
        role,
        coalition:coalitions!coalition_members_coalition_id_fkey(
          id, name, slug, avatar_url
        )
      `)
      .eq('user_id', user.id)
      .in('role', ['leader', 'officer'])
      .limit(1)
      .single()

    if (membership) {
      const c = Array.isArray(membership.coalition)
        ? membership.coalition[0] ?? null
        : membership.coalition
      if (c) {
        myCoalition = { ...c, role: membership.role }
      }
    }
  }

  // Stats
  const { count: activeTotal } = await supabase
    .from('coalition_whip_guidance')
    .select('id', { count: 'exact', head: true })
    .eq('active', true)

  const { data: issuing } = await supabase
    .from('coalition_whip_guidance')
    .select('coalition_id')
    .eq('active', true)

  const coalitionsIssuing = new Set(issuing?.map((r) => r.coalition_id) ?? []).size

  const { data: avgRow } = await supabase
    .from('coalition_whip_compliance_rates')
    .select('compliance_pct')

  const avgCompliance = avgRow && avgRow.length > 0
    ? avgRow.reduce((sum, r) => sum + (r.compliance_pct ?? 0), 0) / avgRow.length
    : null

  return NextResponse.json({
    whips,
    my_coalition: myCoalition,
    stats: {
      active_total: activeTotal ?? 0,
      coalitions_issuing: coalitionsIssuing,
      avg_compliance: avgCompliance !== null ? Math.round(avgCompliance * 10) / 10 : null,
    },
  } satisfies WhipsResponse)
}

// ─── POST /api/whips — issue guidance ────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    coalition_id: string
    topic_id: string
    direction: string
    strength: string
    message?: string
    expires_at?: string
  }

  const { coalition_id, topic_id, direction, strength, message, expires_at } = body

  if (!coalition_id || !topic_id || !direction || !strength) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!['for', 'against', 'free'].includes(direction)) {
    return NextResponse.json({ error: 'Invalid direction' }, { status: 400 })
  }

  if (!['advisory', 'strong', 'critical'].includes(strength)) {
    return NextResponse.json({ error: 'Invalid strength' }, { status: 400 })
  }

  // Check the caller is a leader/officer of this coalition
  const { data: membership } = await supabase
    .from('coalition_members')
    .select('role')
    .eq('coalition_id', coalition_id)
    .eq('user_id', user.id)
    .in('role', ['leader', 'officer'])
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Only coalition leaders and officers can issue whip guidance' }, { status: 403 })
  }

  // Get profile id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Upsert — one active guidance per coalition/topic
  const { data: guidance, error } = await supabase
    .from('coalition_whip_guidance')
    .upsert(
      {
        coalition_id,
        topic_id,
        issued_by: profile.id,
        direction,
        strength,
        message: message?.trim() || null,
        expires_at: expires_at || null,
        active: true,
      },
      { onConflict: 'coalition_id,topic_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, guidance })
}
