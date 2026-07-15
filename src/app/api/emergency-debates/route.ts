import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmergencyDebateStatus = 'proposed' | 'granted' | 'denied' | 'expired' | 'concluded'

export interface EmergencyDebate {
  id: string
  title: string
  urgency_statement: string
  status: EmergencyDebateStatus
  endorsement_count: number
  endorsement_target: number
  speaker_decision: string | null
  proposed_at: string
  expires_at: string
  debate_id: string | null
  user_endorsed: boolean
  proposer: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  }
  topic: {
    id: string
    statement: string
    status: string
    category: string | null
    blue_pct: number
  } | null
}

export interface EmergencyDebatesResponse {
  debates: EmergencyDebate[]
  userProposalToday: boolean
}

// ─── GET — list emergency debates ─────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    const now = new Date().toISOString()

    // Fetch active + recently concluded emergency debates
    const { data: rows, error } = await supabase
      .from('emergency_debates')
      .select(`
        id,
        title,
        urgency_statement,
        status,
        endorsement_count,
        endorsement_target,
        speaker_decision,
        proposed_at,
        expires_at,
        debate_id,
        proposer:profiles!emergency_debates_proposer_id_fkey (
          id, username, display_name, avatar_url, role
        ),
        topic:topics (
          id, statement, status, category, blue_pct
        )
      `)
      .or(`status.eq.proposed,status.eq.granted,status.eq.concluded`)
      .order('endorsement_count', { ascending: false })
      .order('proposed_at', { ascending: false })
      .limit(30)

    if (error) throw error

    // If logged in, check which the user has endorsed
    let endorsedIds = new Set<string>()
    let userProposalToday = false

    if (user) {
      const debateIds = (rows ?? []).map((r) => r.id)

      const [endorseRes, proposalRes] = await Promise.all([
        debateIds.length > 0
          ? supabase
              .from('emergency_debate_endorsements')
              .select('debate_id')
              .eq('user_id', user.id)
              .in('debate_id', debateIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from('emergency_debates')
          .select('id')
          .eq('proposer_id', user.id)
          .gte('proposed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1),
      ])

      endorsedIds = new Set((endorseRes.data ?? []).map((e: { debate_id: string }) => e.debate_id))
      userProposalToday = (proposalRes.data ?? []).length > 0
    }

    const debates: EmergencyDebate[] = (rows ?? []).map((r) => {
      const proposer = Array.isArray(r.proposer) ? r.proposer[0] : r.proposer
      const topic = Array.isArray(r.topic) ? r.topic[0] : r.topic

      // Auto-expire check (if DB function hasn't run)
      let status = r.status as EmergencyDebateStatus
      if (status === 'proposed' && new Date(r.expires_at) < new Date(now)) {
        status = 'expired'
      }

      return {
        id: r.id,
        title: r.title,
        urgency_statement: r.urgency_statement,
        status,
        endorsement_count: r.endorsement_count ?? 0,
        endorsement_target: r.endorsement_target ?? 10,
        speaker_decision: r.speaker_decision ?? null,
        proposed_at: r.proposed_at,
        expires_at: r.expires_at,
        debate_id: r.debate_id ?? null,
        user_endorsed: endorsedIds.has(r.id),
        proposer: proposer ?? { id: '', username: 'unknown', display_name: null, avatar_url: null, role: 'person' },
        topic: topic ?? null,
      }
    })

    return NextResponse.json({ debates, userProposalToday } satisfies EmergencyDebatesResponse)
  } catch (err) {
    console.error('[emergency-debates GET]', err)
    return NextResponse.json({ error: 'Failed to load emergency debates' }, { status: 500 })
  }
}

// ─── POST — propose a new emergency debate ────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { title, urgency_statement, topic_id } = body as {
      title?: string
      urgency_statement?: string
      topic_id?: string | null
    }

    if (!title?.trim() || title.trim().length < 10) {
      return NextResponse.json({ error: 'Title must be at least 10 characters' }, { status: 400 })
    }
    if (!urgency_statement?.trim() || urgency_statement.trim().length < 50) {
      return NextResponse.json({ error: 'Urgency statement must be at least 50 characters' }, { status: 400 })
    }

    // 1-per-24h limit
    const { data: existing } = await supabase
      .from('emergency_debates')
      .select('id')
      .eq('proposer_id', user.id)
      .gte('proposed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'You may only propose one emergency debate per 24 hours' },
        { status: 429 }
      )
    }

    const { data: proposal, error } = await supabase
      .from('emergency_debates')
      .insert({
        proposer_id: user.id,
        title: title.trim().slice(0, 200),
        urgency_statement: urgency_statement.trim().slice(0, 1000),
        topic_id: topic_id ?? null,
      })
      .select('id, title, status, expires_at')
      .single()

    if (error) throw error

    return NextResponse.json({ proposal }, { status: 201 })
  } catch (err) {
    console.error('[emergency-debates POST]', err)
    return NextResponse.json({ error: 'Failed to propose emergency debate' }, { status: 500 })
  }
}
