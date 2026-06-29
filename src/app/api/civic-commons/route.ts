import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommonsMotion {
  id: string
  title: string
  description: string
  effect: 'elevate_topic' | 'issue_statement' | 'call_assembly'
  votes_for: number
  votes_against: number
  status: 'active' | 'passed' | 'rejected' | 'withdrawn'
  closes_at: string
  created_at: string
  proposer_username: string | null
  proposer_display_name: string | null
  proposer_avatar_url: string | null
}

export interface CommonsAssembly {
  id: string
  title: string
  question: string
  status: 'forming' | 'deliberating' | 'concluded'
  max_members: number
  member_count: number
  topic_statement: string | null
  created_at: string
  concluded_at: string | null
}

export interface CommonsReferendum {
  id: string
  question: string
  category: string
  status: 'open' | 'passed' | 'failed' | 'vetoed'
  for_votes: number
  against_votes: number
  quorum_required: number
  closes_at: string
  created_at: string
  proposer_username: string | null
}

export interface CommonsTribunalCase {
  id: string
  status: 'open' | 'deliberating' | 'closed'
  verdict: string | null
  challenge_count: number
  opened_at: string
  argument_preview: string | null
  argument_topic: string | null
}

export interface CommonsElection {
  id: string
  title: string
  role: string
  seats: number
  status: 'upcoming' | 'active' | 'completed'
  starts_at: string
  ends_at: string
  nominee_count: number
}

export interface CivicCommonsStats {
  active_motions: number
  total_passed_proclamations: number
  active_assemblies: number
  open_referendums: number
  open_tribunal_cases: number
  active_elections: number
}

export interface CivicCommonsData {
  stats: CivicCommonsStats
  motions: CommonsMotion[]
  assemblies: CommonsAssembly[]
  referendums: CommonsReferendum[]
  tribunal_cases: CommonsTribunalCase[]
  elections: CommonsElection[]
}

// ─── GET /api/civic-commons ───────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch all in parallel
    const [
      motionsRes,
      assembliesRes,
      referendumsRes,
      tribunalRes,
      electionsRes,
    ] = await Promise.all([
      supabase
        .from('council_motions')
        .select('id, title, description, effect, votes_for, votes_against, status, closes_at, created_at, proposer_id')
        .in('status', ['active'])
        .order('created_at', { ascending: false })
        .limit(10),

      supabase
        .from('citizens_assemblies')
        .select('id, title, question, status, max_members, topic_id, created_at, concluded_at')
        .in('status', ['forming', 'deliberating'])
        .order('created_at', { ascending: false })
        .limit(10),

      supabase
        .from('civic_referendums')
        .select('id, question, category, status, for_votes, against_votes, quorum_required, closes_at, created_at, proposer_id')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10),

      supabase
        .from('tribunal_cases')
        .select('id, status, verdict, challenge_count, opened_at, argument_id')
        .in('status', ['open', 'deliberating'])
        .order('opened_at', { ascending: false })
        .limit(10),

      supabase
        .from('elections')
        .select('id, title, role, seats, status, starts_at, ends_at')
        .in('status', ['upcoming', 'active'])
        .order('starts_at', { ascending: true })
        .limit(5),
    ])

    const motionsRaw = motionsRes.data ?? []
    const assembliesRaw = assembliesRes.data ?? []
    const referendumsRaw = referendumsRes.data ?? []
    const tribunalRaw = tribunalRes.data ?? []
    const electionsRaw = electionsRes.data ?? []

    // Resolve proposer profiles for motions
    const motionProposerIds = [...new Set(motionsRaw.map((m) => m.proposer_id).filter(Boolean))]
    const refProposerIds = [...new Set(referendumsRaw.map((r) => r.proposer_id).filter(Boolean))]
    const allProfileIds = [...new Set([...motionProposerIds, ...refProposerIds])]

    const profileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>()
    if (allProfileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', allProfileIds)
      for (const p of profiles ?? []) profileMap.set(p.id, p)
    }

    // Resolve topic statements for assemblies
    const assemblyTopicIds = [...new Set(assembliesRaw.map((a) => a.topic_id).filter(Boolean))]
    const topicMap = new Map<string, string>()
    if (assemblyTopicIds.length > 0) {
      const { data: topics } = await supabase
        .from('topics')
        .select('id, statement')
        .in('id', assemblyTopicIds)
      for (const t of topics ?? []) topicMap.set(t.id, t.statement)
    }

    // Resolve assembly member counts
    const assemblyIds = assembliesRaw.map((a) => a.id)
    const memberCountMap = new Map<string, number>()
    if (assemblyIds.length > 0) {
      const { data: members } = await supabase
        .from('assembly_members')
        .select('assembly_id')
        .in('assembly_id', assemblyIds)
      for (const m of members ?? []) {
        memberCountMap.set(m.assembly_id, (memberCountMap.get(m.assembly_id) ?? 0) + 1)
      }
    }

    // Resolve argument previews for tribunal cases
    const argIds = tribunalRaw.map((c) => c.argument_id).filter(Boolean)
    const argMap = new Map<string, { content: string; topic_statement: string | null }>()
    if (argIds.length > 0) {
      const { data: args } = await supabase
        .from('topic_arguments')
        .select('id, content, topic_id')
        .in('id', argIds)

      const argTopicIds = [...new Set((args ?? []).map((a) => a.topic_id).filter(Boolean))]
      const argTopicMap = new Map<string, string>()
      if (argTopicIds.length > 0) {
        const { data: argTopics } = await supabase
          .from('topics')
          .select('id, statement')
          .in('id', argTopicIds)
        for (const t of argTopics ?? []) argTopicMap.set(t.id, t.statement)
      }

      for (const a of args ?? []) {
        argMap.set(a.id, {
          content: a.content.slice(0, 120),
          topic_statement: a.topic_id ? (argTopicMap.get(a.topic_id) ?? null) : null,
        })
      }
    }

    // Resolve election nominee counts
    const electionIds = electionsRaw.map((e) => e.id)
    const nomineeCountMap = new Map<string, number>()
    if (electionIds.length > 0) {
      const { data: nominees } = await supabase
        .from('election_nominees')
        .select('election_id')
        .in('election_id', electionIds)
      for (const n of nominees ?? []) {
        nomineeCountMap.set(n.election_id, (nomineeCountMap.get(n.election_id) ?? 0) + 1)
      }
    }

    // Fetch stats (active + historical counts)
    const [
      { count: totalPassedProclamations },
      { count: totalActiveMotions },
      { count: totalActiveAssemblies },
      { count: totalOpenReferendums },
      { count: totalOpenTribunalCases },
      { count: totalActiveElections },
    ] = await Promise.all([
      supabase.from('council_motions').select('id', { count: 'exact', head: true }).eq('status', 'passed'),
      supabase.from('council_motions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('citizens_assemblies').select('id', { count: 'exact', head: true }).in('status', ['forming', 'deliberating']),
      supabase.from('civic_referendums').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('tribunal_cases').select('id', { count: 'exact', head: true }).in('status', ['open', 'deliberating']),
      supabase.from('elections').select('id', { count: 'exact', head: true }).in('status', ['upcoming', 'active']),
    ])

    // Assemble response
    const motions: CommonsMotion[] = motionsRaw.map((m) => {
      const p = m.proposer_id ? profileMap.get(m.proposer_id) : null
      return {
        id: m.id,
        title: m.title,
        description: m.description,
        effect: m.effect as CommonsMotion['effect'],
        votes_for: m.votes_for,
        votes_against: m.votes_against,
        status: m.status as CommonsMotion['status'],
        closes_at: m.closes_at,
        created_at: m.created_at,
        proposer_username: p?.username ?? null,
        proposer_display_name: p?.display_name ?? null,
        proposer_avatar_url: p?.avatar_url ?? null,
      }
    })

    const assemblies: CommonsAssembly[] = assembliesRaw.map((a) => ({
      id: a.id,
      title: a.title,
      question: a.question,
      status: a.status as CommonsAssembly['status'],
      max_members: a.max_members,
      member_count: memberCountMap.get(a.id) ?? 0,
      topic_statement: a.topic_id ? (topicMap.get(a.topic_id) ?? null) : null,
      created_at: a.created_at,
      concluded_at: a.concluded_at ?? null,
    }))

    const referendums: CommonsReferendum[] = referendumsRaw.map((r) => {
      const p = r.proposer_id ? profileMap.get(r.proposer_id) : null
      return {
        id: r.id,
        question: r.question,
        category: r.category,
        status: r.status as CommonsReferendum['status'],
        for_votes: r.for_votes,
        against_votes: r.against_votes,
        quorum_required: r.quorum_required,
        closes_at: r.closes_at,
        created_at: r.created_at,
        proposer_username: p?.username ?? null,
      }
    })

    const tribunal_cases: CommonsTribunalCase[] = tribunalRaw.map((c) => {
      const arg = c.argument_id ? argMap.get(c.argument_id) : null
      return {
        id: c.id,
        status: c.status as CommonsTribunalCase['status'],
        verdict: c.verdict ?? null,
        challenge_count: c.challenge_count,
        opened_at: c.opened_at,
        argument_preview: arg?.content ?? null,
        argument_topic: arg?.topic_statement ?? null,
      }
    })

    const elections: CommonsElection[] = electionsRaw.map((e) => ({
      id: e.id,
      title: e.title,
      role: e.role,
      seats: e.seats,
      status: e.status as CommonsElection['status'],
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      nominee_count: nomineeCountMap.get(e.id) ?? 0,
    }))

    const stats: CivicCommonsStats = {
      active_motions: totalActiveMotions ?? 0,
      total_passed_proclamations: totalPassedProclamations ?? 0,
      active_assemblies: totalActiveAssemblies ?? 0,
      open_referendums: totalOpenReferendums ?? 0,
      open_tribunal_cases: totalOpenTribunalCases ?? 0,
      active_elections: totalActiveElections ?? 0,
    }

    const data: CivicCommonsData = {
      stats,
      motions,
      assemblies,
      referendums,
      tribunal_cases,
      elections,
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[civic-commons GET]', err)
    return NextResponse.json({ error: 'Failed to load civic commons' }, { status: 500 })
  }
}
