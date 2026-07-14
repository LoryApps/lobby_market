import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 60

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BillSponsor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface Bill {
  id: string
  short_title: string
  long_title: string
  category: string
  bill_type: string
  stage: string
  status: string
  votes_for: number
  votes_against: number
  first_reading_at: string
  second_reading_at: string | null
  committee_at: string | null
  report_at: string | null
  third_reading_at: string | null
  lords_at: string | null
  royal_assent_at: string | null
  defeated_at: string | null
  debate_closes_at: string | null
  view_count: number
  created_at: string
  sponsor: BillSponsor | null
  user_vote: string | null
}

export interface BillsStats {
  total: number
  progressing: number
  enacted: number
  defeated: number
}

export interface BillsResponse {
  bills: Bill[]
  stats: BillsStats
}

// ─── GET /api/bills ───────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const stage = searchParams.get('stage')
  const category = searchParams.get('category')
  const billType = searchParams.get('bill_type')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Build bills query
  let query = supabase
    .from('civic_bills')
    .select(`
      id, short_title, long_title, category, bill_type, stage, status,
      votes_for, votes_against,
      first_reading_at, second_reading_at, committee_at, report_at,
      third_reading_at, lords_at, royal_assent_at, defeated_at,
      debate_closes_at, view_count, created_at,
      sponsor:profiles!civic_bills_sponsor_id_fkey(
        id, username, display_name, avatar_url, role
      )
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (stage) query = query.eq('stage', stage)
  if (category) query = query.eq('category', category)
  if (billType) query = query.eq('bill_type', billType)

  const { data: bills, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch user's votes if authenticated
  const userVotes: Record<string, string> = {}
  if (user && bills && bills.length > 0) {
    const billIds = bills.map((b) => b.id)
    const { data: votes } = await supabase
      .from('bill_reading_votes')
      .select('bill_id, position')
      .eq('user_id', user.id)
      .in('bill_id', billIds)

    if (votes) {
      for (const v of votes) {
        userVotes[v.bill_id] = v.position
      }
    }
  }

  // Aggregate stats
  const { data: statsData } = await supabase
    .from('civic_bills')
    .select('status')

  const stats: BillsStats = {
    total: statsData?.length ?? 0,
    progressing: statsData?.filter((b) => b.status === 'progressing' || b.status === 'introduced').length ?? 0,
    enacted: statsData?.filter((b) => b.status === 'enacted').length ?? 0,
    defeated: statsData?.filter((b) => b.status === 'defeated').length ?? 0,
  }

  const enriched = (bills ?? []).map((b) => ({
    ...b,
    sponsor: Array.isArray(b.sponsor) ? b.sponsor[0] ?? null : b.sponsor,
    user_vote: userVotes[b.id] ?? null,
  }))

  return NextResponse.json({ bills: enriched, stats } satisfies BillsResponse)
}
