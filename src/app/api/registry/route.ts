import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegistryAssembly {
  id: string
  title: string
  question: string
  status: 'forming' | 'deliberating' | 'concluded'
  max_members: number
  member_count: number
  recommendation: string | null
  stance: string | null
  topic_statement: string | null
  topic_id: string | null
  created_at: string
}

export interface RegistryHearing {
  id: string
  title: string
  committee: string
  status: 'open' | 'closed' | 'archived'
  recommendation: 'for' | 'against' | 'hold' | 'neutral' | null
  testimony_count: number
  topic_statement: string | null
  topic_id: string | null
  created_at: string
  closed_at: string | null
}

export interface RegistryOmbudsmanCase {
  id: string
  case_number: string
  title: string
  category: string
  status: string
  support_count: number
  topic_statement: string | null
  topic_id: string | null
  created_at: string
}

export interface RegistryAppeal {
  id: string
  appeal_number: string
  appeal_type: string
  grounds: string
  status: string
  target_label: string | null
  created_at: string
}

export interface RegistryMotion {
  id: string
  title: string
  description: string
  effect: string
  votes_for: number
  votes_against: number
  status: string
  topic_statement: string | null
  topic_id: string | null
  closes_at: string
  created_at: string
}

export interface RegistryPetition {
  id: string
  title: string
  committee: string
  action_type: string
  signature_count: number
  target_signatures: number
  status: string
  topic_statement: string | null
  topic_id: string | null
  closes_at: string
  created_at: string
}

export interface RegistryStats {
  assemblies_active: number
  hearings_open: number
  ombudsman_open: number
  appeals_pending: number
  motions_active: number
  petitions_open: number
}

export interface RegistryResponse {
  stats: RegistryStats
  assemblies: RegistryAssembly[]
  hearings: RegistryHearing[]
  ombudsman_cases: RegistryOmbudsmanCase[]
  appeals: RegistryAppeal[]
  motions: RegistryMotion[]
  petitions: RegistryPetition[]
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch all institution data in parallel
    const [
      assembliesRes,
      hearingsRes,
      ombudsmanRes,
      appealsRes,
      motionsRes,
      petitionsRes,
    ] = await Promise.all([
      // Citizens' Assemblies (forming or deliberating)
      supabase
        .from('citizens_assemblies')
        .select(`
          id, title, question, status, max_members,
          recommendation, stance, topic_id,
          created_at,
          topics:topic_id ( statement )
        `)
        .in('status', ['forming', 'deliberating'])
        .order('created_at', { ascending: false })
        .limit(10),

      // Civic Hearings (open)
      supabase
        .from('civic_hearings')
        .select(`
          id, title, committee, status, recommendation,
          testimony_count, topic_id, created_at, closed_at,
          topics:topic_id ( statement )
        `)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10),

      // Ombudsman Cases (open or under_review)
      supabase
        .from('ombudsman_cases')
        .select(`
          id, case_number, title, category, status,
          support_count, topic_id, created_at,
          topics:topic_id ( statement )
        `)
        .in('status', ['open', 'under_review'])
        .order('created_at', { ascending: false })
        .limit(10),

      // Civic Appeals (pending or reviewing)
      supabase
        .from('civic_appeals')
        .select('id, appeal_number, appeal_type, grounds, status, target_label, created_at')
        .in('status', ['pending', 'reviewing'])
        .order('created_at', { ascending: false })
        .limit(10),

      // Grand Council Motions (active)
      supabase
        .from('council_motions')
        .select(`
          id, title, description, effect,
          votes_for, votes_against, status,
          topic_id, closes_at, created_at,
          topics:topic_id ( statement )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(10),

      // Civic Petitions (open)
      supabase
        .from('civic_petitions')
        .select(`
          id, title, committee, action_type,
          signature_count, target_signatures, status,
          topic_id, closes_at, created_at,
          topics:topic_id ( statement )
        `)
        .eq('status', 'open')
        .order('signature_count', { ascending: false })
        .limit(10),
    ])

    // Count assembly members for each assembly
    const assemblyIds = (assembliesRes.data ?? []).map((a) => a.id)
    const memberCounts: Record<string, number> = {}
    if (assemblyIds.length > 0) {
      const { data: members } = await supabase
        .from('assembly_members')
        .select('assembly_id')
        .in('assembly_id', assemblyIds)
      if (members) {
        for (const m of members) {
          memberCounts[m.assembly_id] = (memberCounts[m.assembly_id] ?? 0) + 1
        }
      }
    }

    // Shape assemblies
    const assemblies: RegistryAssembly[] = (assembliesRes.data ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      question: a.question,
      status: a.status as RegistryAssembly['status'],
      max_members: a.max_members,
      member_count: memberCounts[a.id] ?? 0,
      recommendation: a.recommendation,
      stance: a.stance,
      topic_id: a.topic_id,
      topic_statement: (a.topics as { statement: string } | null)?.statement ?? null,
      created_at: a.created_at,
    }))

    // Shape hearings
    const hearings: RegistryHearing[] = (hearingsRes.data ?? []).map((h) => ({
      id: h.id,
      title: h.title,
      committee: h.committee,
      status: h.status as RegistryHearing['status'],
      recommendation: h.recommendation as RegistryHearing['recommendation'],
      testimony_count: h.testimony_count,
      topic_id: h.topic_id,
      topic_statement: (h.topics as { statement: string } | null)?.statement ?? null,
      created_at: h.created_at,
      closed_at: h.closed_at,
    }))

    // Shape ombudsman cases
    const ombudsman_cases: RegistryOmbudsmanCase[] = (ombudsmanRes.data ?? []).map((c) => ({
      id: c.id,
      case_number: c.case_number,
      title: c.title,
      category: c.category,
      status: c.status,
      support_count: c.support_count,
      topic_id: c.topic_id,
      topic_statement: (c.topics as { statement: string } | null)?.statement ?? null,
      created_at: c.created_at,
    }))

    // Shape appeals
    const appeals: RegistryAppeal[] = (appealsRes.data ?? []).map((a) => ({
      id: a.id,
      appeal_number: a.appeal_number,
      appeal_type: a.appeal_type,
      grounds: a.grounds,
      status: a.status,
      target_label: a.target_label,
      created_at: a.created_at,
    }))

    // Shape motions
    const motions: RegistryMotion[] = (motionsRes.data ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      effect: m.effect,
      votes_for: m.votes_for,
      votes_against: m.votes_against,
      status: m.status,
      topic_id: m.topic_id,
      topic_statement: (m.topics as { statement: string } | null)?.statement ?? null,
      closes_at: m.closes_at,
      created_at: m.created_at,
    }))

    // Shape petitions
    const petitions: RegistryPetition[] = (petitionsRes.data ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      committee: p.committee,
      action_type: p.action_type,
      signature_count: p.signature_count,
      target_signatures: p.target_signatures,
      status: p.status,
      topic_id: p.topic_id,
      topic_statement: (p.topics as { statement: string } | null)?.statement ?? null,
      closes_at: p.closes_at,
      created_at: p.created_at,
    }))

    const stats: RegistryStats = {
      assemblies_active: assemblies.length,
      hearings_open: hearings.length,
      ombudsman_open: ombudsman_cases.length,
      appeals_pending: appeals.length,
      motions_active: motions.length,
      petitions_open: petitions.length,
    }

    const response: RegistryResponse = {
      stats,
      assemblies,
      hearings,
      ombudsman_cases,
      appeals,
      motions,
      petitions,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[registry]', err)
    return NextResponse.json(
      {
        stats: { assemblies_active: 0, hearings_open: 0, ombudsman_open: 0, appeals_pending: 0, motions_active: 0, petitions_open: 0 },
        assemblies: [],
        hearings: [],
        ombudsman_cases: [],
        appeals: [],
        motions: [],
        petitions: [],
      },
      { status: 200 }
    )
  }
}
