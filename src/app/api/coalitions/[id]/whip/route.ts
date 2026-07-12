import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface WhipGuidance {
  id: string
  coalition_id: string
  topic_id: string
  issued_by: string
  direction: 'for' | 'against' | 'free'
  strength: 'advisory' | 'strong' | 'critical'
  message: string | null
  active: boolean
  created_at: string
  expires_at: string | null
  topic_statement: string
  topic_category: string | null
  topic_status: string
  topic_blue_pct: number
  issuer_username: string
  issuer_display_name: string | null
  issuer_avatar_url: string | null
  compliance_pct: number | null
  compliant_votes: number
  total_votes: number
}

export interface WhipStats {
  active_guidance_count: number
  overall_compliance_pct: number | null
  members_on_record: number
}

export interface WhipResponse {
  guidance: WhipGuidance[]
  stats: WhipStats
  user_role: 'leader' | 'officer' | 'member' | null
}

/**
 * GET /api/coalitions/[id]/whip
 * Returns all active whip guidance for a coalition with compliance rates.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch whip guidance with topic + issuer info
  const { data: rawGuidance, error } = await supabase
    .from('coalition_whip_guidance')
    .select(`
      id,
      coalition_id,
      topic_id,
      issued_by,
      direction,
      strength,
      message,
      active,
      created_at,
      expires_at,
      topics:topic_id ( statement, category, status, blue_pct ),
      issuer:issued_by ( username, display_name, avatar_url )
    `)
    .eq('coalition_id', params.id)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch compliance rates from view
  const topicIds = (rawGuidance ?? []).map((g) => g.topic_id)
  const complianceMap: Record<string, { compliance_pct: number | null; compliant_votes: number; total_votes: number }> = {}

  if (topicIds.length > 0) {
    const { data: rates } = await supabase
      .from('coalition_whip_compliance_rates')
      .select('guidance_id, compliance_pct, compliant_votes, total_votes')
      .eq('coalition_id', params.id)
      .in('topic_id', topicIds)

    for (const r of rates ?? []) {
      complianceMap[r.guidance_id] = {
        compliance_pct: r.compliance_pct,
        compliant_votes: r.compliant_votes ?? 0,
        total_votes: r.total_votes ?? 0,
      }
    }
  }

  const guidance: WhipGuidance[] = (rawGuidance ?? []).map((g) => {
    const topic = g.topics as { statement: string; category: string | null; status: string; blue_pct: number } | null
    const issuer = g.issuer as { username: string; display_name: string | null; avatar_url: string | null } | null
    const compliance = complianceMap[g.id] ?? { compliance_pct: null, compliant_votes: 0, total_votes: 0 }

    return {
      id: g.id,
      coalition_id: g.coalition_id,
      topic_id: g.topic_id,
      issued_by: g.issued_by,
      direction: g.direction as 'for' | 'against' | 'free',
      strength: g.strength as 'advisory' | 'strong' | 'critical',
      message: g.message,
      active: g.active,
      created_at: g.created_at,
      expires_at: g.expires_at,
      topic_statement: topic?.statement ?? '',
      topic_category: topic?.category ?? null,
      topic_status: topic?.status ?? 'active',
      topic_blue_pct: topic?.blue_pct ?? 50,
      issuer_username: issuer?.username ?? '',
      issuer_display_name: issuer?.display_name ?? null,
      issuer_avatar_url: issuer?.avatar_url ?? null,
      compliance_pct: compliance.compliance_pct,
      compliant_votes: compliance.compliant_votes,
      total_votes: compliance.total_votes,
    }
  })

  // Compute aggregate stats
  const activePcts = guidance.filter((g) => g.compliance_pct !== null).map((g) => g.compliance_pct!)
  const overallCompliancePct = activePcts.length > 0
    ? Math.round(activePcts.reduce((a, b) => a + b, 0) / activePcts.length)
    : null

  const stats: WhipStats = {
    active_guidance_count: guidance.length,
    overall_compliance_pct: overallCompliancePct,
    members_on_record: guidance.reduce((max, g) => Math.max(max, g.total_votes), 0),
  }

  // Determine caller's role
  let userRole: WhipResponse['user_role'] = null
  if (user) {
    const { data: membership } = await supabase
      .from('coalition_members')
      .select('role')
      .eq('coalition_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()
    userRole = (membership?.role as WhipResponse['user_role']) ?? null
  }

  return NextResponse.json({ guidance, stats, user_role: userRole } satisfies WhipResponse)
}

/**
 * POST /api/coalitions/[id]/whip
 * Issue new whip guidance on a topic.
 * Body: { topic_id, direction, strength?, message? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify officer or leader
  const { data: membership } = await supabase
    .from('coalition_members')
    .select('role')
    .eq('coalition_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['leader', 'officer'].includes(membership.role)) {
    return NextResponse.json({ error: 'Only coalition officers can issue whip guidance' }, { status: 403 })
  }

  const body = await req.json() as {
    topic_id?: string
    direction?: string
    strength?: string
    message?: string
    expires_at?: string
  }

  if (!body.topic_id) {
    return NextResponse.json({ error: 'topic_id is required' }, { status: 400 })
  }

  if (!body.direction || !['for', 'against', 'free'].includes(body.direction)) {
    return NextResponse.json({ error: 'direction must be for, against, or free' }, { status: 400 })
  }

  const strength = body.strength ?? 'advisory'
  if (!['advisory', 'strong', 'critical'].includes(strength)) {
    return NextResponse.json({ error: 'strength must be advisory, strong, or critical' }, { status: 400 })
  }

  // Upsert guidance (one per coalition+topic)
  const { data: guidance, error } = await supabase
    .from('coalition_whip_guidance')
    .upsert(
      {
        coalition_id: params.id,
        topic_id: body.topic_id,
        issued_by: user.id,
        direction: body.direction,
        strength,
        message: body.message ?? null,
        active: true,
        expires_at: body.expires_at ?? null,
      },
      { onConflict: 'coalition_id,topic_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ guidance }, { status: 201 })
}

/**
 * DELETE /api/coalitions/[id]/whip?topic_id=<uuid>
 * Withdraw whip guidance on a topic.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const topicId = req.nextUrl.searchParams.get('topic_id')
  if (!topicId) {
    return NextResponse.json({ error: 'topic_id is required' }, { status: 400 })
  }

  // Verify officer or leader
  const { data: membership } = await supabase
    .from('coalition_members')
    .select('role')
    .eq('coalition_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['leader', 'officer'].includes(membership.role)) {
    return NextResponse.json({ error: 'Only coalition officers can withdraw whip guidance' }, { status: 403 })
  }

  const { error } = await supabase
    .from('coalition_whip_guidance')
    .update({ active: false })
    .eq('coalition_id', params.id)
    .eq('topic_id', topicId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
