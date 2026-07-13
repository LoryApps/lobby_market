import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MotionType = 'debate' | 'urgent_question' | 'censure' | 'division'
export type MotionStatus = 'tabled' | 'granted' | 'denied' | 'withdrawn'

export interface SupplyDayMotion {
  id: string
  title: string
  urgency_statement: string
  motion_type: MotionType
  status: MotionStatus
  endorsement_count: number
  endorsement_target: number
  government_response: string | null
  responded_at: string | null
  closes_at: string
  created_at: string
  coalition: {
    id: string
    name: string
    slug: string
    badge_color: string | null
    member_count: number
  } | null
  tabled_by: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  responded_by_profile: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
  user_endorsed: boolean
}

export interface SupplyDayStats {
  total_motions: number
  active_motions: number
  granted_motions: number
  total_endorsements: number
}

export interface SupplyDayResponse {
  motions: SupplyDayMotion[]
  stats: SupplyDayStats
  user_coalition_id: string | null
}

// ─── GET /api/supply-day ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status') ?? 'tabled,granted'
    const motionType = searchParams.get('type') ?? null
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '30'), 60)

    const statuses = statusFilter.split(',').map((s) => s.trim())

    // ── Fetch motions ──────────────────────────────────────────────────────────
    let query = supabase
      .from('supply_day_motions')
      .select(`
        id,
        title,
        urgency_statement,
        motion_type,
        status,
        endorsement_count,
        endorsement_target,
        government_response,
        responded_at,
        closes_at,
        created_at,
        coalition_id,
        topic_id,
        tabled_by,
        responded_by
      `)
      .in('status', statuses)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (motionType) {
      query = query.eq('motion_type', motionType)
    }

    const { data: rawMotions, error } = await query

    if (error) {
      console.error('supply_day GET error:', error.message)
      return NextResponse.json({ motions: [], stats: { total_motions: 0, active_motions: 0, granted_motions: 0, total_endorsements: 0 }, user_coalition_id: null })
    }

    const motions = rawMotions ?? []
    if (motions.length === 0) {
      return NextResponse.json({ motions: [], stats: { total_motions: 0, active_motions: 0, granted_motions: 0, total_endorsements: 0 }, user_coalition_id: null })
    }

    // ── Collect IDs for batch fetches ─────────────────────────────────────────
    const coalitionIds = [...new Set(motions.map((m) => m.coalition_id).filter(Boolean))]
    const profileIds = [...new Set([
      ...motions.map((m) => m.tabled_by),
      ...motions.map((m) => m.responded_by),
    ].filter(Boolean))]
    const topicIds = [...new Set(motions.map((m) => m.topic_id).filter(Boolean))]

    // ── Batch fetch coalitions ─────────────────────────────────────────────────
    const { data: coalitionRows } = coalitionIds.length > 0
      ? await supabase
          .from('coalitions')
          .select('id, name, slug, badge_color, member_count')
          .in('id', coalitionIds)
      : { data: [] }

    const coalitionMap = new Map((coalitionRows ?? []).map((c) => [c.id, c]))

    // ── Batch fetch profiles ───────────────────────────────────────────────────
    const { data: profileRows } = profileIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .in('id', profileIds)
      : { data: [] }

    const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]))

    // ── Batch fetch topics ─────────────────────────────────────────────────────
    const { data: topicRows } = topicIds.length > 0
      ? await supabase
          .from('topics')
          .select('id, statement, category, status, blue_pct, total_votes')
          .in('id', topicIds)
      : { data: [] }

    const topicMap = new Map((topicRows ?? []).map((t) => [t.id, t]))

    // ── Check user endorsements ────────────────────────────────────────────────
    const endorsedSet = new Set<string>()
    if (user) {
      const motionIds = motions.map((m) => m.id)
      const { data: endorsedRows } = await supabase
        .from('supply_day_endorsements')
        .select('motion_id')
        .eq('user_id', user.id)
        .in('motion_id', motionIds)

      for (const row of endorsedRows ?? []) {
        endorsedSet.add(row.motion_id)
      }
    }

    // ── Fetch user's coalition membership ─────────────────────────────────────
    let user_coalition_id: string | null = null
    if (user) {
      const { data: membership } = await supabase
        .from('coalition_members')
        .select('coalition_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
      user_coalition_id = membership?.coalition_id ?? null
    }

    // ── Assemble motions ───────────────────────────────────────────────────────
    const assembled: SupplyDayMotion[] = motions.map((m) => ({
      id: m.id,
      title: m.title,
      urgency_statement: m.urgency_statement,
      motion_type: m.motion_type as MotionType,
      status: m.status as MotionStatus,
      endorsement_count: m.endorsement_count,
      endorsement_target: m.endorsement_target,
      government_response: m.government_response ?? null,
      responded_at: m.responded_at ?? null,
      closes_at: m.closes_at,
      created_at: m.created_at,
      coalition: m.coalition_id ? (coalitionMap.get(m.coalition_id) ?? null) : null,
      tabled_by: m.tabled_by ? (profileMap.get(m.tabled_by) ?? null) : null,
      responded_by_profile: m.responded_by ? (profileMap.get(m.responded_by) ?? null) : null,
      topic: m.topic_id ? (topicMap.get(m.topic_id) ?? null) : null,
      user_endorsed: endorsedSet.has(m.id),
    }))

    // ── Stats ──────────────────────────────────────────────────────────────────
    const { data: statsRows } = await supabase
      .from('supply_day_motions')
      .select('status, endorsement_count')

    const stats: SupplyDayStats = {
      total_motions: statsRows?.length ?? 0,
      active_motions: statsRows?.filter((r) => r.status === 'tabled').length ?? 0,
      granted_motions: statsRows?.filter((r) => r.status === 'granted').length ?? 0,
      total_endorsements: statsRows?.reduce((sum, r) => sum + (r.endorsement_count ?? 0), 0) ?? 0,
    }

    return NextResponse.json({ motions: assembled, stats, user_coalition_id } satisfies SupplyDayResponse)
  } catch (err) {
    console.error('supply_day GET unexpected error:', err)
    return NextResponse.json({ motions: [], stats: { total_motions: 0, active_motions: 0, granted_motions: 0, total_endorsements: 0 }, user_coalition_id: null })
  }
}

// ─── POST /api/supply-day ─────────────────────────────────────────────────────
// Actions: 'table' | 'endorse' | 'withdraw_endorsement' | 'respond' | 'withdraw_motion'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json() as Record<string, unknown>
    const action = body.action as string

    // ── Table a new motion ────────────────────────────────────────────────────
    if (action === 'table') {
      const { coalition_id, topic_id, title, urgency_statement, motion_type } = body as {
        coalition_id: string
        topic_id: string | null
        title: string
        urgency_statement: string
        motion_type: MotionType
      }

      if (!coalition_id || !title || !urgency_statement || !motion_type) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      // Verify user is a member of the coalition
      const { data: membership } = await supabase
        .from('coalition_members')
        .select('id')
        .eq('coalition_id', coalition_id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (!membership) {
        return NextResponse.json({ error: 'You must be a coalition member to table a motion' }, { status: 403 })
      }

      const { data: motion, error } = await supabase
        .from('supply_day_motions')
        .insert({
          coalition_id,
          topic_id: topic_id ?? null,
          tabled_by: user.id,
          title: String(title).trim(),
          urgency_statement: String(urgency_statement).trim(),
          motion_type,
        })
        .select('id')
        .single()

      if (error) {
        console.error('table motion error:', error.message)
        return NextResponse.json({ error: 'Failed to table motion' }, { status: 500 })
      }

      // Auto-endorse by the tabling user
      await supabase
        .from('supply_day_endorsements')
        .insert({ motion_id: motion.id, user_id: user.id })
        .select()

      return NextResponse.json({ success: true, motion_id: motion.id })
    }

    // ── Endorse a motion ──────────────────────────────────────────────────────
    if (action === 'endorse') {
      const { motion_id } = body as { motion_id: string }

      if (!motion_id) {
        return NextResponse.json({ error: 'motion_id required' }, { status: 400 })
      }

      // Check motion is still open
      const { data: motion } = await supabase
        .from('supply_day_motions')
        .select('status, closes_at')
        .eq('id', motion_id)
        .maybeSingle()

      if (!motion || motion.status === 'withdrawn' || motion.status === 'denied') {
        return NextResponse.json({ error: 'Motion is no longer open for endorsement' }, { status: 400 })
      }

      const { error } = await supabase
        .from('supply_day_endorsements')
        .insert({ motion_id, user_id: user.id })

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ error: 'Already endorsed' }, { status: 409 })
        }
        return NextResponse.json({ error: 'Failed to endorse' }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    // ── Withdraw endorsement ──────────────────────────────────────────────────
    if (action === 'withdraw_endorsement') {
      const { motion_id } = body as { motion_id: string }

      if (!motion_id) {
        return NextResponse.json({ error: 'motion_id required' }, { status: 400 })
      }

      await supabase
        .from('supply_day_endorsements')
        .delete()
        .eq('motion_id', motion_id)
        .eq('user_id', user.id)

      return NextResponse.json({ success: true })
    }

    // ── Withdraw a motion (only by the tabling user) ──────────────────────────
    if (action === 'withdraw_motion') {
      const { motion_id } = body as { motion_id: string }

      const { error } = await supabase
        .from('supply_day_motions')
        .update({ status: 'withdrawn' })
        .eq('id', motion_id)
        .eq('tabled_by', user.id)
        .eq('status', 'tabled')

      if (error) {
        return NextResponse.json({ error: 'Failed to withdraw motion' }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('supply_day POST unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
