import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WatchdogAmendment {
  id: string
  law_id: string
  title: string
  body: string
  for_count: number
  against_count: number
  expires_at: string
  created_at: string
  support_pct: number
  law: {
    id: string
    statement: string
    category: string | null
    total_votes: number | null
    blue_pct: number | null
  } | null
  proposer: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface WatchdogPetition {
  id: string
  law_id: string
  case_for_repeal: string
  consent_count: number
  override_support_count: number
  total_original_voters: number
  expires_at: string
  created_at: string
  consent_pct: number
  law: {
    id: string
    statement: string
    category: string | null
    total_votes: number | null
    blue_pct: number | null
  } | null
  requester: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface ContestedLaw {
  id: string
  statement: string
  category: string | null
  total_votes: number
  blue_pct: number
  established_at: string
  topic_id: string | null
  margin_pct: number
  amendment_count: number
  petition_count: number
}

export interface WatchdogResponse {
  amendments: WatchdogAmendment[]
  petitions: WatchdogPetition[]
  contested: ContestedLaw[]
  stats: {
    active_amendments: number
    active_petitions: number
    contested_count: number
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // ── 1. Active amendments (pending + not expired + with most support) ──────
    const { data: amendmentsRaw } = await supabase
      .from('law_amendments')
      .select(`
        id, law_id, title, body, for_count, against_count,
        expires_at, created_at,
        law:laws(id, statement, category, total_votes, blue_pct),
        proposer:profiles!law_amendments_proposer_id_fkey(
          username, display_name, avatar_url, role
        )
      `)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('for_count', { ascending: false })
      .limit(10)

    const amendments: WatchdogAmendment[] = (amendmentsRaw ?? []).map((a) => {
      const total = (a.for_count ?? 0) + (a.against_count ?? 0)
      return {
        id: a.id,
        law_id: a.law_id,
        title: a.title,
        body: a.body,
        for_count: a.for_count ?? 0,
        against_count: a.against_count ?? 0,
        expires_at: a.expires_at,
        created_at: a.created_at,
        support_pct: total > 0 ? Math.round(((a.for_count ?? 0) / total) * 100) : 0,
        law: Array.isArray(a.law) ? (a.law[0] ?? null) : (a.law ?? null),
        proposer: Array.isArray(a.proposer) ? (a.proposer[0] ?? null) : (a.proposer ?? null),
      }
    })

    // ── 2. Active reopen petitions ─────────────────────────────────────────────
    const { data: petitionsRaw } = await supabase
      .from('law_reopen_petitions')
      .select(`
        id, law_id, case_for_repeal, consent_count, override_support_count,
        total_original_voters, expires_at, created_at,
        law:laws(id, statement, category, total_votes, blue_pct),
        requester:profiles!law_reopen_petitions_requester_id_fkey(
          username, display_name, avatar_url, role
        )
      `)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('consent_count', { ascending: false })
      .limit(10)

    const petitions: WatchdogPetition[] = (petitionsRaw ?? []).map((p) => {
      const originalVoters = p.total_original_voters ?? 1
      return {
        id: p.id,
        law_id: p.law_id,
        case_for_repeal: p.case_for_repeal,
        consent_count: p.consent_count ?? 0,
        override_support_count: p.override_support_count ?? 0,
        total_original_voters: originalVoters,
        expires_at: p.expires_at,
        created_at: p.created_at,
        consent_pct: Math.round(((p.consent_count ?? 0) / originalVoters) * 100),
        law: Array.isArray(p.law) ? (p.law[0] ?? null) : (p.law ?? null),
        requester: Array.isArray(p.requester)
          ? (p.requester[0] ?? null)
          : (p.requester ?? null),
      }
    })

    // ── 3. Contested laws (passed with narrow margin, 50-57%) ─────────────────
    const { data: contestedRaw } = await supabase
      .from('laws')
      .select('id, statement, category, total_votes, blue_pct, established_at, topic_id')
      .gte('blue_pct', 50)
      .lte('blue_pct', 57)
      .gte('total_votes', 20)
      .order('blue_pct', { ascending: true })
      .limit(12)

    // Count active amendments and petitions for each contested law
    const contestedIds = (contestedRaw ?? []).map((l) => l.id)
    const amendCountMap = new Map<string, number>()
    const petitionCountMap = new Map<string, number>()

    if (contestedIds.length > 0) {
      const { data: amendCounts } = await supabase
        .from('law_amendments')
        .select('law_id')
        .in('law_id', contestedIds)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())

      for (const row of amendCounts ?? []) {
        amendCountMap.set(row.law_id, (amendCountMap.get(row.law_id) ?? 0) + 1)
      }

      const { data: petCounts } = await supabase
        .from('law_reopen_petitions')
        .select('law_id')
        .in('law_id', contestedIds)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())

      for (const row of petCounts ?? []) {
        petitionCountMap.set(row.law_id, (petitionCountMap.get(row.law_id) ?? 0) + 1)
      }
    }

    const contested: ContestedLaw[] = (contestedRaw ?? []).map((l) => ({
      id: l.id,
      statement: l.statement,
      category: l.category,
      total_votes: l.total_votes ?? 0,
      blue_pct: l.blue_pct ?? 50,
      established_at: l.established_at,
      topic_id: l.topic_id ?? null,
      margin_pct: Math.round((l.blue_pct ?? 50) - 50),
      amendment_count: amendCountMap.get(l.id) ?? 0,
      petition_count: petitionCountMap.get(l.id) ?? 0,
    }))

    return NextResponse.json({
      amendments,
      petitions,
      contested,
      stats: {
        active_amendments: amendments.length,
        active_petitions: petitions.length,
        contested_count: contested.length,
      },
    } satisfies WatchdogResponse)
  } catch (err) {
    console.error('[watchdog]', err)
    return NextResponse.json(
      { amendments: [], petitions: [], contested: [], stats: { active_amendments: 0, active_petitions: 0, contested_count: 0 } },
      { status: 500 }
    )
  }
}
