// /api/coalitions/[id]/treaties — coalition-scoped treaty operations
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface Ctx { params: { id: string } }

export interface CoalitionTreaty {
  id: string
  treaty_type: 'alliance' | 'non_aggression' | 'research_exchange'
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'broken'
  title: string
  terms: string | null
  duration_days: number
  proposed_at: string
  accepted_at: string | null
  expires_at: string | null
  is_proposer: boolean
  partner: { id: string; name: string; member_count: number; coalition_influence: number }
}

export interface CoalitionTreatiesResponse {
  coalition: { id: string; name: string } | null
  currentUserRole: 'leader' | 'officer' | 'member' | null
  currentUserId: string | null
  treaties: CoalitionTreaty[]
}

// GET — list treaties for this coalition + coalition meta + user role
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const supabase = await createClient()
    const coalitionId = params.id
    const { data: { user } } = await supabase.auth.getUser()

    const [treatiesResult, coalitionResult, membershipResult] = await Promise.all([
      supabase
        .from('coalition_treaties')
        .select(`
          id, treaty_type, status, title, terms, duration_days,
          proposer_id, recipient_id,
          proposed_at, accepted_at, expires_at,
          proposer:coalitions!coalition_treaties_proposer_id_fkey(id, name, member_count, coalition_influence),
          recipient:coalitions!coalition_treaties_recipient_id_fkey(id, name, member_count, coalition_influence)
        `)
        .or(`proposer_id.eq.${coalitionId},recipient_id.eq.${coalitionId}`)
        .order('proposed_at', { ascending: false })
        .limit(50),
      supabase.from('coalitions').select('id, name').eq('id', coalitionId).maybeSingle(),
      user
        ? supabase
            .from('coalition_members')
            .select('role')
            .eq('coalition_id', coalitionId)
            .eq('user_id', user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    if (treatiesResult.error) throw treatiesResult.error

    const rows = (treatiesResult.data ?? []) as unknown as Array<{
      id: string; treaty_type: string; status: string; title: string; terms: string | null
      duration_days: number; proposer_id: string; recipient_id: string
      proposed_at: string; accepted_at: string | null; expires_at: string | null
      proposer: { id: string; name: string; member_count: number; coalition_influence: number }
      recipient: { id: string; name: string; member_count: number; coalition_influence: number }
    }>

    const treaties: CoalitionTreaty[] = rows.map((row) => ({
      id: row.id,
      treaty_type: row.treaty_type as CoalitionTreaty['treaty_type'],
      status: row.status as CoalitionTreaty['status'],
      title: row.title,
      terms: row.terms,
      duration_days: row.duration_days,
      proposed_at: row.proposed_at,
      accepted_at: row.accepted_at,
      expires_at: row.expires_at,
      is_proposer: row.proposer_id === coalitionId,
      partner: row.proposer_id === coalitionId ? row.recipient : row.proposer,
    }))

    return NextResponse.json({
      coalition: coalitionResult.data ?? null,
      currentUserId: user?.id ?? null,
      currentUserRole: (membershipResult.data?.role ?? null) as CoalitionTreatiesResponse['currentUserRole'],
      treaties,
    } satisfies CoalitionTreatiesResponse)
  } catch (err) {
    console.error('[GET /api/coalitions/[id]/treaties]', err)
    return NextResponse.json({ coalition: null, currentUserId: null, currentUserRole: null, treaties: [] })
  }
}

// POST — propose a new treaty or respond to one (action: propose | accept | reject | break)
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const coalitionId = params.id
    const body = await req.json() as {
      action: 'propose' | 'accept' | 'reject' | 'break'
      treaty_id?: string
      recipient_id?: string
      treaty_type?: string
      title?: string
      terms?: string
      duration_days?: number
      broken_reason?: string
    }

    // Verify user is a leader/officer of this coalition
    const { data: membership } = await supabase
      .from('coalition_members')
      .select('role')
      .eq('coalition_id', coalitionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership || !['leader', 'officer'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only leaders and officers can manage treaties' }, { status: 403 })
    }

    if (body.action === 'propose') {
      const { recipient_id, treaty_type, title, terms, duration_days } = body
      if (!recipient_id || !treaty_type || !title) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      const { data: treaty, error } = await supabase
        .from('coalition_treaties')
        .insert({
          proposer_id: coalitionId,
          recipient_id,
          proposed_by: user.id,
          treaty_type,
          title,
          terms: terms ?? null,
          duration_days: duration_days ?? 14,
          status: 'pending',
        })
        .select('id')
        .single()

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ error: 'An active treaty already exists with this coalition' }, { status: 409 })
        }
        throw error
      }

      return NextResponse.json({ treaty_id: treaty.id })
    }

    if (body.action === 'accept') {
      const { treaty_id } = body
      if (!treaty_id) return NextResponse.json({ error: 'Missing treaty_id' }, { status: 400 })

      const now = new Date()
      const { data: treaty } = await supabase
        .from('coalition_treaties')
        .select('duration_days, recipient_id')
        .eq('id', treaty_id)
        .eq('status', 'pending')
        .single()

      if (!treaty) return NextResponse.json({ error: 'Treaty not found or not pending' }, { status: 404 })
      if (treaty.recipient_id !== coalitionId) {
        return NextResponse.json({ error: 'Only the recipient can accept a treaty' }, { status: 403 })
      }

      const expiresAt = new Date(now)
      expiresAt.setDate(expiresAt.getDate() + treaty.duration_days)

      const { error } = await supabase
        .from('coalition_treaties')
        .update({
          status: 'accepted',
          accepted_by: user.id,
          accepted_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        })
        .eq('id', treaty_id)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'reject') {
      const { treaty_id } = body
      if (!treaty_id) return NextResponse.json({ error: 'Missing treaty_id' }, { status: 400 })

      const { data: treaty } = await supabase
        .from('coalition_treaties')
        .select('recipient_id')
        .eq('id', treaty_id)
        .eq('status', 'pending')
        .single()

      if (!treaty) return NextResponse.json({ error: 'Treaty not found' }, { status: 404 })
      if (treaty.recipient_id !== coalitionId) {
        return NextResponse.json({ error: 'Only the recipient can reject a treaty' }, { status: 403 })
      }

      const { error } = await supabase
        .from('coalition_treaties')
        .update({ status: 'rejected' })
        .eq('id', treaty_id)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'break') {
      const { treaty_id, broken_reason } = body
      if (!treaty_id) return NextResponse.json({ error: 'Missing treaty_id' }, { status: 400 })

      const { data: treaty } = await supabase
        .from('coalition_treaties')
        .select('proposer_id, recipient_id')
        .eq('id', treaty_id)
        .eq('status', 'accepted')
        .single()

      if (!treaty) return NextResponse.json({ error: 'Active treaty not found' }, { status: 404 })
      if (treaty.proposer_id !== coalitionId && treaty.recipient_id !== coalitionId) {
        return NextResponse.json({ error: 'Not a party to this treaty' }, { status: 403 })
      }

      const { error } = await supabase
        .from('coalition_treaties')
        .update({
          status: 'broken',
          broken_at: new Date().toISOString(),
          broken_reason: broken_reason ?? null,
        })
        .eq('id', treaty_id)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[POST /api/coalitions/[id]/treaties]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
