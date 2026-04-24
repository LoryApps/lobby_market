import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type PetitionStatus = 'pending' | 'approved' | 'rejected' | 'expired'

export interface PetitionEntry {
  id: string
  law_id: string
  topic_id: string
  requester_id: string
  case_for_repeal: string
  total_original_voters: number
  consent_count: number
  override_support_count: number
  status: PetitionStatus
  expires_at: string
  created_at: string
  law: {
    id: string
    statement: string
    category: string | null
    total_votes: number | null
    blue_pct: number | null
    established_at: string
  } | null
  requester: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  user_has_consented: boolean
  user_can_consent: boolean
}

export interface PetitionsResponse {
  petitions: PetitionEntry[]
  total: number
}

/**
 * GET /api/petitions
 *
 * Returns law repeal petitions.
 * Query params:
 *   status — 'pending' | 'approved' | 'expired' | 'all'  (default: 'pending')
 *   limit  — number (default 40, max 100)
 *   offset — number (default 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const rawStatus = searchParams.get('status') ?? 'pending'
  const rawLimit = Math.min(Number(searchParams.get('limit') ?? '40'), 100)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 40
  const offset = Math.max(0, Number(searchParams.get('offset') ?? '0'))

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Fetch petitions ──────────────────────────────────────────────────────────
  let query = supabase
    .from('law_reopen_requests')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const VALID_STATUSES: PetitionStatus[] = ['pending', 'approved', 'rejected', 'expired']
  const statusFilter = rawStatus as PetitionStatus
  if (rawStatus !== 'all' && VALID_STATUSES.includes(statusFilter)) {
    query = query.eq('status', statusFilter)
  }

  const { data: rows, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ petitions: [], total: count ?? 0 })
  }

  // ── Enrich with law and requester data ────────────────────────────────────────
  const lawIds = Array.from(new Set(rows.map((r) => r.law_id)))
  const requesterIds = Array.from(new Set(rows.map((r) => r.requester_id)))
  const topicIds = Array.from(new Set(rows.map((r) => r.topic_id)))

  const [lawsRes, profilesRes, consentsRes, voterCheckRes] = await Promise.all([
    supabase
      .from('laws')
      .select('id, statement, category, total_votes, blue_pct, established_at')
      .in('id', lawIds),
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', requesterIds),
    // Which petitions has the current user already consented to?
    user
      ? supabase
          .from('law_reopen_consents')
          .select('request_id')
          .eq('user_id', user.id)
          .in(
            'request_id',
            rows.map((r) => r.id)
          )
      : Promise.resolve({ data: [] as { request_id: string }[] }),
    // Which original topics did the user vote on? (determines eligibility to consent)
    user
      ? supabase
          .from('votes')
          .select('topic_id')
          .eq('user_id', user.id)
          .in('topic_id', topicIds)
      : Promise.resolve({ data: [] as { topic_id: string }[] }),
  ])

  const lawMap = new Map<string, NonNullable<PetitionEntry['law']>>()
  for (const law of lawsRes.data ?? []) {
    lawMap.set(law.id, law)
  }

  const profileMap = new Map<string, NonNullable<PetitionEntry['requester']>>()
  for (const p of profilesRes.data ?? []) {
    profileMap.set(p.id, p)
  }

  const consentedIds = new Set(
    (consentsRes.data ?? []).map((c: { request_id: string }) => c.request_id)
  )

  const votedTopicIds = new Set(
    (voterCheckRes.data ?? []).map((v: { topic_id: string }) => v.topic_id)
  )

  const petitions: PetitionEntry[] = rows.map((row) => ({
    ...row,
    law: lawMap.get(row.law_id) ?? null,
    requester: profileMap.get(row.requester_id) ?? null,
    user_has_consented: consentedIds.has(row.id),
    user_can_consent: votedTopicIds.has(row.topic_id),
  }))

  return NextResponse.json({ petitions, total: count ?? 0 })
}
