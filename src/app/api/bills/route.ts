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

// ─── POST /api/bills — introduce a new bill ───────────────────────────────────

interface IntroduceBillBody {
  short_title: string
  long_title: string
  category: string
  bill_type: string
  topic_id?: string | null
}

export interface IntroduceBillResponse {
  id: string
  short_title: string
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to introduce a bill' }, { status: 401 })
  }

  let body: IntroduceBillBody
  try {
    body = await request.json() as IntroduceBillBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { short_title, long_title, category, bill_type, topic_id } = body

  if (!short_title || short_title.trim().length < 5 || short_title.trim().length > 80) {
    return NextResponse.json({ error: 'Short title must be between 5 and 80 characters' }, { status: 400 })
  }

  if (!long_title || long_title.trim().length < 10 || long_title.trim().length > 300) {
    return NextResponse.json({ error: 'Long title must be between 10 and 300 characters' }, { status: 400 })
  }

  const validCategories = ['Politics', 'Economics', 'Technology', 'Science', 'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education', 'Law', 'Other']
  if (!validCategories.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  const validBillTypes = ['government', 'private_members', 'opposition', 'lords']
  if (!validBillTypes.includes(bill_type)) {
    return NextResponse.json({ error: 'Invalid bill type' }, { status: 400 })
  }

  // Validate topic_id if provided
  if (topic_id) {
    const { data: topic } = await supabase
      .from('topics')
      .select('id')
      .eq('id', topic_id)
      .maybeSingle()
    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 400 })
    }
  }

  const { data: bill, error } = await supabase
    .from('civic_bills')
    .insert({
      short_title: short_title.trim(),
      long_title: long_title.trim(),
      category,
      bill_type,
      sponsor_id: user.id,
      topic_id: topic_id ?? null,
      stage: 'first_reading',
      status: 'introduced',
      first_reading_at: new Date().toISOString(),
    })
    .select('id, short_title')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(bill satisfies IntroduceBillResponse, { status: 201 })
}
