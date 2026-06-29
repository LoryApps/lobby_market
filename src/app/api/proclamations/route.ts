import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface Proclamation {
  id: string
  decree_number: number
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
  proposer: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    clout: number
    role: string
    council_rank: number
  } | null
}

export interface ProclamationsResponse {
  proclamations: Proclamation[]
  total_passed: number
  total_active: number
}

const COUNCIL_SIZE = 20

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch all council motions (any effect) sorted chronologically
    const { data: motionsRaw, error: motionsErr } = await supabase
      .from('council_motions')
      .select(`
        id, title, description, effect, topic_id,
        votes_for, votes_against, status,
        created_at, closes_at, resolved_at,
        proposer_id
      `)
      .order('created_at', { ascending: true })
      .limit(200)

    if (motionsErr) throw motionsErr

    const allMotions = motionsRaw ?? []

    // Get topic statements for motions that reference a topic
    const topicIds = [...new Set(
      allMotions.filter((m) => m.topic_id).map((m) => m.topic_id as string)
    )]

    const topicMap = new Map<string, string>()
    if (topicIds.length > 0) {
      const { data: topics } = await supabase
        .from('topics')
        .select('id, statement')
        .in('id', topicIds)
      for (const t of topics ?? []) topicMap.set(t.id, t.statement)
    }

    // Fetch proposer profiles
    const proposerIds = [...new Set(allMotions.map((m) => m.proposer_id).filter(Boolean))]
    const profileMap = new Map<string, { id: string; username: string; display_name: string | null; avatar_url: string | null; clout: number; role: string }>()

    if (proposerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, clout, role')
        .in('id', proposerIds)
      for (const p of profiles ?? []) profileMap.set(p.id, p)
    }

    // Get council ranking for context
    const { data: topClout } = await supabase
      .from('profiles')
      .select('id')
      .order('clout', { ascending: false })
      .limit(COUNCIL_SIZE)

    const councilRankMap = new Map<string, number>()
    for (const [idx, p] of (topClout ?? []).entries()) {
      councilRankMap.set(p.id, idx + 1)
    }

    // Assign decree numbers (1-indexed, chronological order across all motions)
    let decreeCounter = 0
    const proclamations: Proclamation[] = allMotions.map((m) => {
      decreeCounter++
      const proposerProfile = m.proposer_id ? profileMap.get(m.proposer_id) : null
      return {
        id: m.id,
        decree_number: decreeCounter,
        title: m.title,
        description: m.description,
        effect: m.effect as Proclamation['effect'],
        topic_id: m.topic_id ?? null,
        topic_statement: m.topic_id ? (topicMap.get(m.topic_id) ?? null) : null,
        votes_for: m.votes_for,
        votes_against: m.votes_against,
        status: m.status as Proclamation['status'],
        created_at: m.created_at,
        closes_at: m.closes_at,
        resolved_at: m.resolved_at ?? null,
        proposer: proposerProfile
          ? {
              ...proposerProfile,
              clout: proposerProfile.clout ?? 0,
              council_rank: councilRankMap.get(proposerProfile.id) ?? 0,
            }
          : null,
      }
    })

    // Reverse so newest come first in the response
    proclamations.reverse()

    const total_passed = proclamations.filter((p) => p.status === 'passed').length
    const total_active = proclamations.filter((p) => p.status === 'active').length

    return NextResponse.json({
      proclamations,
      total_passed,
      total_active,
    } satisfies ProclamationsResponse)
  } catch (err) {
    console.error('[proclamations GET]', err)
    return NextResponse.json({ error: 'Failed to load proclamations' }, { status: 500 })
  }
}
