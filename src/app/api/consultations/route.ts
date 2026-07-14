import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type ConsultationStatus = 'draft' | 'open' | 'closed' | 'published' | 'withdrawn'
export type PaperType = 'green_paper' | 'white_paper' | 'call_for_evidence'

export interface ConsultationSummary {
  id: string
  title: string
  summary: string
  paper_type: PaperType
  status: ConsultationStatus
  department: string
  category: string
  opens_at: string
  closes_at: string
  published_at: string | null
  response_count: number
  view_count: number
  sponsor: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

export interface ConsultationsResponse {
  consultations: ConsultationSummary[]
  total: number
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') ?? 'open'
  const department = searchParams.get('department') ?? ''
  const paperType = searchParams.get('type') ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = 20

  let query = supabase
    .from('civic_consultations')
    .select(
      `
      id,
      title,
      summary,
      paper_type,
      status,
      department,
      category,
      opens_at,
      closes_at,
      published_at,
      response_count,
      view_count,
      sponsor:profiles!sponsor_id(id, username, display_name, avatar_url)
    `,
      { count: 'exact' }
    )
    .order('closes_at', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  if (department) {
    query = query.eq('department', department)
  }
  if (paperType) {
    query = query.eq('paper_type', paperType)
  }

  const { data, count, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const consultations: ConsultationSummary[] = (data ?? []).map((r) => {
    const sponsor = r.sponsor as unknown as ConsultationSummary['sponsor']
    return {
      id: r.id as string,
      title: r.title as string,
      summary: r.summary as string,
      paper_type: r.paper_type as PaperType,
      status: r.status as ConsultationStatus,
      department: r.department as string,
      category: r.category as string,
      opens_at: r.opens_at as string,
      closes_at: r.closes_at as string,
      published_at: r.published_at as string | null,
      response_count: r.response_count as number,
      view_count: r.view_count as number,
      sponsor: sponsor ?? null,
    }
  })

  return NextResponse.json({ consultations, total: count ?? 0 } satisfies ConsultationsResponse)
}
