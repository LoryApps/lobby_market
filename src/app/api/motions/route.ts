import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MotionAssembly {
  id: string
  title: string
  question: string
  status: 'forming' | 'deliberating' | 'concluded'
  max_members: number
  member_count: number
  deliberation_rounds: number
  convened_at: string
  concluded_at: string | null
  recommendation: string | null
  stance: string | null
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
}

export interface MotionCouncil {
  id: string
  title: string
  description: string
  effect: 'elevate_topic' | 'issue_statement' | 'call_assembly'
  status: 'active' | 'passed' | 'rejected' | 'withdrawn'
  votes_for: number
  votes_against: number
  created_at: string
  closes_at: string
  proposer_username: string | null
  proposer_display: string | null
  topic_id: string | null
  topic_statement: string | null
}

export interface MotionPetition {
  id: string
  title: string
  description: string
  committee: string
  action_type: 'hearing' | 'referendum' | 'assembly' | 'review'
  status: 'open' | 'fulfilled' | 'expired' | 'rejected'
  target_signatures: number
  signature_count: number
  closes_at: string
  created_at: string
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
}

export interface MotionReferendum {
  id: string
  question: string
  description: string | null
  category: string
  status: 'open' | 'passed' | 'failed' | 'vetoed'
  quorum_required: number
  for_votes: number
  against_votes: number
  closes_at: string
  created_at: string
}

export interface MotionVeto {
  id: string
  title: string
  grounds: string
  grounds_type: string
  status: 'open' | 'succeeded' | 'failed' | 'withdrawn'
  target_signatures: number
  signature_count: number
  closes_at: string
  created_at: string
  law_id: string
  law_statement: string | null
}

export interface MotionStats {
  total_active: number
  assemblies_active: number
  council_active: number
  petitions_active: number
  referendums_active: number
  vetoes_active: number
}

export interface MotionsResponse {
  stats: MotionStats
  assemblies: MotionAssembly[]
  council_motions: MotionCouncil[]
  petitions: MotionPetition[]
  referendums: MotionReferendum[]
  vetoes: MotionVeto[]
}

// ─── GET /api/motions ─────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const [assembliesRes, councilRes, petitionsRes, referendumsRes, vetoesRes] =
      await Promise.all([
        // Citizens' Assemblies — forming or deliberating
        supabase
          .from('citizens_assemblies')
          .select(
            `id, title, question, status, max_members, deliberation_rounds,
             convened_at, concluded_at, recommendation, stance,
             topic_id,
             topics:topic_id (statement, category)`,
          )
          .in('status', ['forming', 'deliberating'])
          .order('convened_at', { ascending: false })
          .limit(10),

        // Grand Council Motions — active only
        supabase
          .from('council_motions')
          .select(
            `id, title, description, effect, status,
             votes_for, votes_against, created_at, closes_at,
             topic_id,
             proposer:proposer_id (username, display_name),
             topics:topic_id (statement)`,
          )
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(10),

        // Civic Petitions — open only
        supabase
          .from('civic_petitions')
          .select(
            `id, title, description, committee, action_type, status,
             target_signatures, signature_count, closes_at, created_at,
             topic_id,
             topics:topic_id (statement, category)`,
          )
          .eq('status', 'open')
          .order('signature_count', { ascending: false })
          .limit(10),

        // Civic Referendums — open only
        supabase
          .from('civic_referendums')
          .select(
            `id, question, description, category, status,
             quorum_required, for_votes, against_votes,
             closes_at, created_at`,
          )
          .eq('status', 'open')
          .order('for_votes', { ascending: false })
          .limit(10),

        // Civic Vetoes — open only, join laws for statement
        supabase
          .from('civic_vetoes')
          .select(
            `id, title, grounds, grounds_type, status,
             target_signatures, signature_count, closes_at, created_at,
             law_id,
             laws:law_id (topic_id, topics:topic_id(statement))`,
          )
          .eq('status', 'open')
          .order('signature_count', { ascending: false })
          .limit(10),
      ])

    // ── Normalise assemblies ──────────────────────────────────────────────────
    type AssemblyRow = {
      id: string
      title: string
      question: string
      status: 'forming' | 'deliberating' | 'concluded'
      max_members: number
      deliberation_rounds: number
      convened_at: string
      concluded_at: string | null
      recommendation: string | null
      stance: string | null
      topic_id: string | null
      topics: { statement: string; category: string } | null
    }

    const assemblies: MotionAssembly[] = ((assembliesRes.data ?? []) as AssemblyRow[]).map(
      (a) => ({
        id: a.id,
        title: a.title,
        question: a.question,
        status: a.status,
        max_members: a.max_members,
        member_count: 0, // populated below if needed
        deliberation_rounds: a.deliberation_rounds,
        convened_at: a.convened_at,
        concluded_at: a.concluded_at,
        recommendation: a.recommendation,
        stance: a.stance,
        topic_id: a.topic_id,
        topic_statement: a.topics?.statement ?? null,
        topic_category: a.topics?.category ?? null,
      }),
    )

    // ── Normalise council motions ─────────────────────────────────────────────
    type CouncilRow = {
      id: string
      title: string
      description: string
      effect: 'elevate_topic' | 'issue_statement' | 'call_assembly'
      status: 'active' | 'passed' | 'rejected' | 'withdrawn'
      votes_for: number
      votes_against: number
      created_at: string
      closes_at: string
      topic_id: string | null
      proposer: { username: string; display_name: string | null } | null
      topics: { statement: string } | null
    }

    const council_motions: MotionCouncil[] = ((councilRes.data ?? []) as CouncilRow[]).map(
      (m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        effect: m.effect,
        status: m.status,
        votes_for: m.votes_for,
        votes_against: m.votes_against,
        created_at: m.created_at,
        closes_at: m.closes_at,
        proposer_username: m.proposer?.username ?? null,
        proposer_display: m.proposer?.display_name ?? null,
        topic_id: m.topic_id,
        topic_statement: m.topics?.statement ?? null,
      }),
    )

    // ── Normalise petitions ───────────────────────────────────────────────────
    type PetitionRow = {
      id: string
      title: string
      description: string
      committee: string
      action_type: 'hearing' | 'referendum' | 'assembly' | 'review'
      status: 'open' | 'fulfilled' | 'expired' | 'rejected'
      target_signatures: number
      signature_count: number
      closes_at: string
      created_at: string
      topic_id: string | null
      topics: { statement: string; category: string } | null
    }

    const petitions: MotionPetition[] = ((petitionsRes.data ?? []) as PetitionRow[]).map(
      (p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        committee: p.committee,
        action_type: p.action_type,
        status: p.status,
        target_signatures: p.target_signatures,
        signature_count: p.signature_count,
        closes_at: p.closes_at,
        created_at: p.created_at,
        topic_id: p.topic_id,
        topic_statement: p.topics?.statement ?? null,
        topic_category: p.topics?.category ?? null,
      }),
    )

    // ── Normalise referendums ─────────────────────────────────────────────────
    type RefRow = {
      id: string
      question: string
      description: string | null
      category: string
      status: 'open' | 'passed' | 'failed' | 'vetoed'
      quorum_required: number
      for_votes: number
      against_votes: number
      closes_at: string
      created_at: string
    }

    const referendums: MotionReferendum[] = ((referendumsRes.data ?? []) as RefRow[]).map(
      (r) => ({
        id: r.id,
        question: r.question,
        description: r.description,
        category: r.category,
        status: r.status,
        quorum_required: r.quorum_required,
        for_votes: r.for_votes,
        against_votes: r.against_votes,
        closes_at: r.closes_at,
        created_at: r.created_at,
      }),
    )

    // ── Normalise vetoes ──────────────────────────────────────────────────────
    type VetoRow = {
      id: string
      title: string
      grounds: string
      grounds_type: string
      status: 'open' | 'succeeded' | 'failed' | 'withdrawn'
      target_signatures: number
      signature_count: number
      closes_at: string
      created_at: string
      law_id: string
      laws: { topic_id: string | null; topics: { statement: string } | null } | null
    }

    const vetoes: MotionVeto[] = ((vetoesRes.data ?? []) as VetoRow[]).map((v) => ({
      id: v.id,
      title: v.title,
      grounds: v.grounds,
      grounds_type: v.grounds_type,
      status: v.status,
      target_signatures: v.target_signatures,
      signature_count: v.signature_count,
      closes_at: v.closes_at,
      created_at: v.created_at,
      law_id: v.law_id,
      law_statement: v.laws?.topics?.statement ?? null,
    }))

    // ── Stats ─────────────────────────────────────────────────────────────────
    const stats: MotionStats = {
      assemblies_active: assemblies.length,
      council_active: council_motions.length,
      petitions_active: petitions.length,
      referendums_active: referendums.length,
      vetoes_active: vetoes.length,
      total_active:
        assemblies.length +
        council_motions.length +
        petitions.length +
        referendums.length +
        vetoes.length,
    }

    const response: MotionsResponse = {
      stats,
      assemblies,
      council_motions,
      petitions,
      referendums,
      vetoes,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[/api/motions]', err)
    return NextResponse.json({ error: 'Failed to load motions' }, { status: 500 })
  }
}
