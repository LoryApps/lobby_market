import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CaseStatus = 'open' | 'under_review' | 'upheld' | 'dismissed' | 'referred' | 'withdrawn'
export type CaseCategory = 'process_fairness' | 'decision_appeal' | 'bias_report' | 'norm_breach' | 'transparency' | 'other'

export interface CaseProfile {
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface OmbudsmanCase {
  id: string
  case_number: string
  category: CaseCategory
  title: string
  description: string
  complainant: CaseProfile | null
  respondent_type: string | null
  topic_id: string | null
  topic_statement: string | null
  status: CaseStatus
  finding: string | null
  officer: CaseProfile | null
  support_count: number
  user_supported: boolean
  created_at: string
  resolved_at: string | null
}

export interface OmbudsmanResponse {
  cases: OmbudsmanCase[]
  total: number
  open_count: number
  stats: {
    upheld: number
    dismissed: number
    under_review: number
  }
}

// ─── GET /api/ombudsman ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'open'
  const category = searchParams.get('category')
  const sort = searchParams.get('sort') ?? 'newest'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const { data: { user } } = await supabase.auth.getUser()

  try {
    let query = supabase
      .from('ombudsman_cases')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)

    if (status !== 'all') query = query.eq('status', status)
    if (category) query = query.eq('category', category)

    if (sort === 'supported') {
      query = query.order('support_count', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    const { data: rawCases, count, error } = await query

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({
          cases: [], total: 0, open_count: 0,
          stats: { upheld: 0, dismissed: 0, under_review: 0 },
        } satisfies OmbudsmanResponse)
      }
      throw error
    }

    // Open count + stats
    const [openRes, upheldRes, dismissedRes, reviewRes] = await Promise.all([
      supabase.from('ombudsman_cases').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('ombudsman_cases').select('*', { count: 'exact', head: true }).eq('status', 'upheld'),
      supabase.from('ombudsman_cases').select('*', { count: 'exact', head: true }).eq('status', 'dismissed'),
      supabase.from('ombudsman_cases').select('*', { count: 'exact', head: true }).eq('status', 'under_review'),
    ])

    if (!rawCases?.length) {
      return NextResponse.json({
        cases: [], total: count ?? 0, open_count: openRes.count ?? 0,
        stats: { upheld: upheldRes.count ?? 0, dismissed: dismissedRes.count ?? 0, under_review: reviewRes.count ?? 0 },
      } satisfies OmbudsmanResponse)
    }

    // Collect IDs for joins
    const complainantIds = [...new Set(rawCases.map((c: { complainant_id: string | null }) => c.complainant_id).filter(Boolean))]
    const officerIds = [...new Set(rawCases.map((c: { officer_id: string | null }) => c.officer_id).filter(Boolean))]
    const allProfileIds = [...new Set([...complainantIds, ...officerIds])]
    const topicIds = [...new Set(rawCases.map((c: { topic_id: string | null }) => c.topic_id).filter(Boolean))]

    const [profilesRes, topicsRes, supportRes] = await Promise.all([
      allProfileIds.length
        ? supabase.from('profiles').select('id, username, display_name, avatar_url, role').in('id', allProfileIds)
        : Promise.resolve({ data: [] }),
      topicIds.length
        ? supabase.from('topics').select('id, statement').in('id', topicIds)
        : Promise.resolve({ data: [] }),
      user
        ? supabase.from('ombudsman_case_support')
            .select('case_id')
            .eq('user_id', user.id)
            .in('case_id', rawCases.map((c: { id: string }) => c.id))
        : Promise.resolve({ data: [] }),
    ])

    const profileMap = new Map(
      (profilesRes.data ?? []).map((p: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }) => [p.id, p])
    )
    const topicMap = new Map(
      (topicsRes.data ?? []).map((t: { id: string; statement: string }) => [t.id, t.statement])
    )
    const supportedSet = new Set(
      (supportRes.data ?? []).map((s: { case_id: string }) => s.case_id)
    )

    const cases: OmbudsmanCase[] = rawCases.map((c: {
      id: string
      case_number: string
      category: CaseCategory
      title: string
      description: string
      complainant_id: string | null
      respondent_type: string | null
      topic_id: string | null
      status: CaseStatus
      finding: string | null
      officer_id: string | null
      support_count: number
      created_at: string
      resolved_at: string | null
    }) => {
      const complainant = c.complainant_id ? profileMap.get(c.complainant_id) ?? null : null
      const officer = c.officer_id ? profileMap.get(c.officer_id) ?? null : null
      return {
        id: c.id,
        case_number: c.case_number,
        category: c.category,
        title: c.title,
        description: c.description,
        complainant: complainant ? {
          username: complainant.username,
          display_name: complainant.display_name,
          avatar_url: complainant.avatar_url,
          role: complainant.role,
        } : null,
        respondent_type: c.respondent_type,
        topic_id: c.topic_id,
        topic_statement: c.topic_id ? topicMap.get(c.topic_id) ?? null : null,
        status: c.status,
        finding: c.finding,
        officer: officer ? {
          username: officer.username,
          display_name: officer.display_name,
          avatar_url: officer.avatar_url,
          role: officer.role,
        } : null,
        support_count: c.support_count,
        user_supported: supportedSet.has(c.id),
        created_at: c.created_at,
        resolved_at: c.resolved_at,
      }
    })

    return NextResponse.json({
      cases,
      total: count ?? 0,
      open_count: openRes.count ?? 0,
      stats: {
        upheld: upheldRes.count ?? 0,
        dismissed: dismissedRes.count ?? 0,
        under_review: reviewRes.count ?? 0,
      },
    } satisfies OmbudsmanResponse)
  } catch (err) {
    console.error('GET /api/ombudsman:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}

// ─── POST /api/ombudsman — file a new case ────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { title, description, category, respondent_type, topic_id } = body

    if (!title || typeof title !== 'string' || title.length < 10 || title.length > 200) {
      return NextResponse.json({ error: 'invalid_title' }, { status: 400 })
    }
    if (!description || typeof description !== 'string' || description.length < 50 || description.length > 3000) {
      return NextResponse.json({ error: 'invalid_description' }, { status: 400 })
    }
    const validCategories: CaseCategory[] = ['process_fairness', 'decision_appeal', 'bias_report', 'norm_breach', 'transparency', 'other']
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: 'invalid_category' }, { status: 400 })
    }

    const { data: caseData, error } = await supabase
      .from('ombudsman_cases')
      .insert({
        title: title.trim(),
        description: description.trim(),
        category,
        complainant_id: user.id,
        respondent_type: respondent_type ?? null,
        topic_id: topic_id ?? null,
        case_number: '',  // trigger fills this
      })
      .select('id, case_number')
      .single()

    if (error) {
      console.error('POST /api/ombudsman:', error)
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }

    return NextResponse.json({ id: caseData.id, case_number: caseData.case_number }, { status: 201 })
  } catch (err) {
    console.error('POST /api/ombudsman:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
