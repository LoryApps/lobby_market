import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CouncilMember {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  clout: number
  civic_score: number | null
  rank: number
  is_current_user: boolean
}

export interface CouncilMotionVote {
  voter_id: string
  vote: 'for' | 'against'
}

export interface CouncilMotion {
  id: string
  title: string
  description: string
  effect: 'elevate_topic' | 'issue_statement' | 'call_assembly'
  status: 'active' | 'passed' | 'rejected' | 'withdrawn'
  votes_for: number
  votes_against: number
  created_at: string
  closes_at: string
  resolved_at: string | null
  proposer: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
  } | null
  user_vote: 'for' | 'against' | null
}

export interface CouncilResponse {
  members: CouncilMember[]
  motions: CouncilMotion[]
  council_size: number
  user_is_council: boolean
  user_rank: number | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COUNCIL_SIZE = 20

// ─── GET /api/council ─────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // ── 1. Top COUNCIL_SIZE users by clout ────────────────────────────────────
    const { data: members, error: membersErr } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, clout, civic_score')
      .order('clout', { ascending: false })
      .limit(COUNCIL_SIZE)

    if (membersErr) throw membersErr

    const councilMembers: CouncilMember[] = (members ?? []).map((m, i) => ({
      id: m.id,
      username: m.username ?? '',
      display_name: m.display_name,
      avatar_url: m.avatar_url,
      clout: m.clout ?? 0,
      civic_score: (m as { civic_score?: number | null }).civic_score ?? null,
      rank: i + 1,
      is_current_user: user?.id === m.id,
    }))

    const councilIds = new Set(councilMembers.map((m) => m.id))
    const userIsCouncil = user ? councilIds.has(user.id) : false
    const userRank = user
      ? (councilMembers.find((m) => m.id === user.id)?.rank ?? null)
      : null

    // ── 2. Recent motions ─────────────────────────────────────────────────────
    const { data: rawMotions, error: motionsErr } = await supabase
      .from('council_motions')
      .select(
        `
        id,
        title,
        description,
        effect,
        status,
        votes_for,
        votes_against,
        created_at,
        closes_at,
        resolved_at,
        proposer_id,
        topic_id,
        proposer:profiles!council_motions_proposer_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        ),
        topic:topics!council_motions_topic_id_fkey (
          id,
          statement,
          category
        )
      `
      )
      .order('created_at', { ascending: false })
      .limit(30)

    if (motionsErr) throw motionsErr

    // ── 3. Current user's votes on motions ───────────────────────────────────
    const userVoteMap = new Map<string, 'for' | 'against'>()
    if (user && rawMotions && rawMotions.length > 0) {
      const motionIds = rawMotions.map((m) => m.id)
      const { data: myVotes } = await supabase
        .from('council_motion_votes')
        .select('motion_id, vote')
        .eq('voter_id', user.id)
        .in('motion_id', motionIds)

      if (myVotes) {
        for (const v of myVotes) {
          userVoteMap.set(v.motion_id, v.vote as 'for' | 'against')
        }
      }
    }

    // ── 4. Shape motions ──────────────────────────────────────────────────────
    type ProposerRow = { id: string; username: string | null; display_name: string | null; avatar_url: string | null }
    type TopicRow = { id: string; statement: string; category: string | null }

    const motions: CouncilMotion[] = (rawMotions ?? []).map((m) => {
      const proposerRaw = Array.isArray(m.proposer) ? m.proposer[0] : m.proposer
      const topicRaw = Array.isArray(m.topic) ? m.topic[0] : m.topic

      const proposer = proposerRaw
        ? {
            id: (proposerRaw as ProposerRow).id ?? '',
            username: (proposerRaw as ProposerRow).username ?? '',
            display_name: (proposerRaw as ProposerRow).display_name ?? null,
            avatar_url: (proposerRaw as ProposerRow).avatar_url ?? null,
          }
        : null

      const topic = topicRaw
        ? {
            id: (topicRaw as TopicRow).id ?? '',
            statement: (topicRaw as TopicRow).statement ?? '',
            category: (topicRaw as TopicRow).category ?? null,
          }
        : null

      return {
        id: m.id,
        title: m.title,
        description: m.description,
        effect: m.effect as CouncilMotion['effect'],
        status: m.status as CouncilMotion['status'],
        votes_for: m.votes_for ?? 0,
        votes_against: m.votes_against ?? 0,
        created_at: m.created_at,
        closes_at: m.closes_at,
        resolved_at: m.resolved_at ?? null,
        proposer,
        topic,
        user_vote: userVoteMap.get(m.id) ?? null,
      }
    })

    const response: CouncilResponse = {
      members: councilMembers,
      motions,
      council_size: COUNCIL_SIZE,
      user_is_council: userIsCouncil,
      user_rank: userRank,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[/api/council]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
