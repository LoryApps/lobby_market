import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppealStatus = 'pending' | 'reviewing' | 'granted' | 'denied' | 'withdrawn'
export type AppealType   = 'ombudsman' | 'council' | 'moderation' | 'vote'
export type AppealGrounds = 'procedural_error' | 'new_evidence' | 'bias' | 'disproportionate' | 'other'

export interface AppealProfile {
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface CivicAppeal {
  id: string
  appeal_number: string
  appeal_type: AppealType
  target_type: string
  target_id: string | null
  target_label: string | null
  appellant: AppealProfile | null
  grounds: AppealGrounds
  statement: string
  votes_for: number
  votes_against: number
  votes_abstain: number
  status: AppealStatus
  panel_decision: string | null
  support_count: number
  user_supported: boolean
  created_at: string
  resolved_at: string | null
}

export interface AppealStats {
  total: number
  pending: number
  reviewing: number
  granted: number
  denied: number
}

export interface AppealListResponse {
  appeals: CivicAppeal[]
  total: number
  stats: AppealStats
}

// ─── GET /api/appeals ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status   = searchParams.get('status')   ?? 'all'
  const type     = searchParams.get('type')
  const sort     = searchParams.get('sort')     ?? 'newest'
  const limit    = Math.min(parseInt(searchParams.get('limit')  ?? '20', 10), 50)
  const offset   = parseInt(searchParams.get('offset') ?? '0', 10)

  const { data: { user } } = await supabase.auth.getUser()

  try {
    let query = supabase
      .from('civic_appeals')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)

    if (status !== 'all') query = query.eq('status', status)
    if (type)             query = query.eq('appeal_type', type)

    if (sort === 'supported') {
      query = query.order('support_count', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    const { data: raw, count, error } = await query

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({
          appeals: [], total: 0,
          stats: { total: 0, pending: 0, reviewing: 0, granted: 0, denied: 0 },
        } satisfies AppealListResponse)
      }
      throw error
    }

    // Aggregate stats
    const [pendingRes, reviewingRes, grantedRes, deniedRes, totalRes] = await Promise.all([
      supabase.from('civic_appeals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('civic_appeals').select('*', { count: 'exact', head: true }).eq('status', 'reviewing'),
      supabase.from('civic_appeals').select('*', { count: 'exact', head: true }).eq('status', 'granted'),
      supabase.from('civic_appeals').select('*', { count: 'exact', head: true }).eq('status', 'denied'),
      supabase.from('civic_appeals').select('*', { count: 'exact', head: true }),
    ])

    if (!raw?.length) {
      return NextResponse.json({
        appeals: [], total: count ?? 0,
        stats: {
          total:     totalRes.count    ?? 0,
          pending:   pendingRes.count  ?? 0,
          reviewing: reviewingRes.count ?? 0,
          granted:   grantedRes.count  ?? 0,
          denied:    deniedRes.count   ?? 0,
        },
      } satisfies AppealListResponse)
    }

    // Collect profile IDs for batch fetch
    const appellantIds = [...new Set(raw.map((a: { appellant_id: string }) => a.appellant_id).filter(Boolean))]

    const [profilesRes, supportRes] = await Promise.all([
      appellantIds.length
        ? supabase.from('profiles').select('id, username, display_name, avatar_url, role').in('id', appellantIds)
        : Promise.resolve({ data: [] }),
      user
        ? supabase.from('civic_appeal_support')
            .select('appeal_id')
            .eq('user_id', user.id)
            .in('appeal_id', raw.map((a: { id: string }) => a.id))
        : Promise.resolve({ data: [] }),
    ])

    const profileMap = new Map(
      (profilesRes.data ?? []).map((p: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }) => [p.id, p])
    )
    const supportedSet = new Set(
      (supportRes.data ?? []).map((s: { appeal_id: string }) => s.appeal_id)
    )

    const appeals: CivicAppeal[] = raw.map((a: {
      id: string
      appeal_number: string
      appeal_type: AppealType
      target_type: string
      target_id: string | null
      target_label: string | null
      appellant_id: string
      grounds: AppealGrounds
      statement: string
      votes_for: number
      votes_against: number
      votes_abstain: number
      status: AppealStatus
      panel_decision: string | null
      support_count: number
      created_at: string
      resolved_at: string | null
    }) => {
      const ap = profileMap.get(a.appellant_id)
      return {
        id:             a.id,
        appeal_number:  a.appeal_number,
        appeal_type:    a.appeal_type,
        target_type:    a.target_type,
        target_id:      a.target_id,
        target_label:   a.target_label,
        appellant:      ap ? { username: ap.username, display_name: ap.display_name, avatar_url: ap.avatar_url, role: ap.role } : null,
        grounds:        a.grounds,
        statement:      a.statement,
        votes_for:      a.votes_for,
        votes_against:  a.votes_against,
        votes_abstain:  a.votes_abstain,
        status:         a.status,
        panel_decision: a.panel_decision,
        support_count:  a.support_count,
        user_supported: supportedSet.has(a.id),
        created_at:     a.created_at,
        resolved_at:    a.resolved_at,
      }
    })

    return NextResponse.json({
      appeals,
      total: count ?? 0,
      stats: {
        total:     totalRes.count    ?? 0,
        pending:   pendingRes.count  ?? 0,
        reviewing: reviewingRes.count ?? 0,
        granted:   grantedRes.count  ?? 0,
        denied:    deniedRes.count   ?? 0,
      },
    } satisfies AppealListResponse)
  } catch (err) {
    console.error('GET /api/appeals:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}

// ─── POST /api/appeals — file a new appeal ────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { appeal_type, target_type, target_id, target_label, grounds, statement } = body

    const validTypes: AppealType[]   = ['ombudsman', 'council', 'moderation', 'vote']
    const validGrounds: AppealGrounds[] = ['procedural_error', 'new_evidence', 'bias', 'disproportionate', 'other']

    if (!validTypes.includes(appeal_type)) {
      return NextResponse.json({ error: 'invalid_appeal_type' }, { status: 400 })
    }
    if (!target_type || typeof target_type !== 'string' || target_type.length > 100) {
      return NextResponse.json({ error: 'invalid_target_type' }, { status: 400 })
    }
    if (!validGrounds.includes(grounds)) {
      return NextResponse.json({ error: 'invalid_grounds' }, { status: 400 })
    }
    if (!statement || typeof statement !== 'string' || statement.length < 80 || statement.length > 2000) {
      return NextResponse.json({ error: 'invalid_statement' }, { status: 400 })
    }

    // Prevent duplicate open/reviewing appeals by same user for same target
    if (target_id) {
      const { data: existing } = await supabase
        .from('civic_appeals')
        .select('id')
        .eq('appellant_id', user.id)
        .eq('target_id', target_id)
        .in('status', ['pending', 'reviewing'])
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ error: 'duplicate_appeal' }, { status: 409 })
      }
    }

    const { data: appealData, error } = await supabase
      .from('civic_appeals')
      .insert({
        appeal_number: '',   // trigger fills
        appeal_type,
        target_type,
        target_id:    target_id   ?? null,
        target_label: target_label ? String(target_label).slice(0, 300) : null,
        appellant_id: user.id,
        grounds,
        statement:    statement.trim(),
      })
      .select('id, appeal_number')
      .single()

    if (error) {
      console.error('POST /api/appeals:', error)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }

    return NextResponse.json({ id: appealData.id, appeal_number: appealData.appeal_number }, { status: 201 })
  } catch (err) {
    console.error('POST /api/appeals:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
