import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface CouncilMember {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  clout: number
  reputation_score: number
  role: string
  rank: number
}

export interface CouncilMotion {
  id: string
  title: string
  description: string
  effect: 'elevate_topic' | 'issue_statement' | 'call_assembly'
  topic_id: string | null
  topic_statement: string | null
  votes_for: number
  votes_against: number
  status: 'active' | 'passed' | 'rejected' | 'withdrawn'
  created_at: string
  closes_at: string
  resolved_at: string | null
  proposer: CouncilMember | null
  user_vote: 'for' | 'against' | null
  pass_threshold: number
  total_council_size: number
}

export interface GrandCouncilResponse {
  members: CouncilMember[]
  motions: CouncilMotion[]
  is_member: boolean
  current_user_id: string | null
}

const COUNCIL_SIZE = 20
const PASS_PCT = 0.6

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // ── 1. Top 20 by clout ──────────────────────────────────────────────────
    const { data: members, error: membersErr } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, clout, reputation_score, role')
      .order('clout', { ascending: false })
      .limit(COUNCIL_SIZE)

    if (membersErr) throw membersErr

    const rankedMembers: CouncilMember[] = (members ?? []).map((m, idx) => ({
      ...m,
      reputation_score: m.reputation_score ?? 0,
      clout: m.clout ?? 0,
      rank: idx + 1,
    }))

    const memberIds = new Set(rankedMembers.map((m) => m.id))
    const is_member = user ? memberIds.has(user.id) : false

    // ── 2. Motions ──────────────────────────────────────────────────────────
    const { data: motionsRaw, error: motionsErr } = await supabase
      .from('council_motions')
      .select(`
        id, title, description, effect, topic_id,
        votes_for, votes_against, status,
        created_at, closes_at, resolved_at,
        proposer_id
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (motionsErr) throw motionsErr

    // Fetch topic statements for motions that reference a topic
    const topicIds = [...new Set(
      (motionsRaw ?? []).filter((m) => m.topic_id).map((m) => m.topic_id as string)
    )]

    const topicMap: Map<string, string> = new Map()
    if (topicIds.length > 0) {
      const { data: topics } = await supabase
        .from('topics')
        .select('id, statement')
        .in('id', topicIds)
      for (const t of topics ?? []) topicMap.set(t.id, t.statement)
    }

    // Build proposer map from council members (fast path)
    const memberMap = new Map(rankedMembers.map((m) => [m.id, m]))

    // Get non-member proposer profiles if needed
    const nonMemberProposerIds = [...new Set(
      (motionsRaw ?? [])
        .map((m) => m.proposer_id)
        .filter((id): id is string => !!id && !memberMap.has(id))
    )]

    if (nonMemberProposerIds.length > 0) {
      const { data: extraProfiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, clout, reputation_score, role')
        .in('id', nonMemberProposerIds)
      for (const p of extraProfiles ?? []) {
        memberMap.set(p.id, {
          ...p,
          clout: p.clout ?? 0,
          reputation_score: p.reputation_score ?? 0,
          rank: 0,
        })
      }
    }

    // Get user's votes on motions
    const userVoteMap: Map<string, 'for' | 'against'> = new Map()
    if (user) {
      const motionIds = (motionsRaw ?? []).map((m) => m.id)
      if (motionIds.length > 0) {
        const { data: votes } = await supabase
          .from('council_motion_votes')
          .select('motion_id, vote')
          .eq('voter_id', user.id)
          .in('motion_id', motionIds)
        for (const v of votes ?? []) {
          userVoteMap.set(v.motion_id, v.vote as 'for' | 'against')
        }
      }
    }

    const motions: CouncilMotion[] = (motionsRaw ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      effect: m.effect as CouncilMotion['effect'],
      topic_id: m.topic_id ?? null,
      topic_statement: m.topic_id ? (topicMap.get(m.topic_id) ?? null) : null,
      votes_for: m.votes_for,
      votes_against: m.votes_against,
      status: m.status as CouncilMotion['status'],
      created_at: m.created_at,
      closes_at: m.closes_at,
      resolved_at: m.resolved_at ?? null,
      proposer: m.proposer_id ? (memberMap.get(m.proposer_id) ?? null) : null,
      user_vote: userVoteMap.get(m.id) ?? null,
      pass_threshold: PASS_PCT,
      total_council_size: COUNCIL_SIZE,
    }))

    return NextResponse.json({
      members: rankedMembers,
      motions,
      is_member,
      current_user_id: user?.id ?? null,
    } satisfies GrandCouncilResponse)
  } catch (err) {
    console.error('[grand-council GET]', err)
    return NextResponse.json({ error: 'Failed to load Grand Council' }, { status: 500 })
  }
}
