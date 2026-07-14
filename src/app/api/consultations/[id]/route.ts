import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ConsultationStatus, PaperType } from '../route'

export const dynamic = 'force-dynamic'

export interface ConsultationResponse {
  id: string
  consultation_id: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  }
  response_text: string
  stance: 'strongly_support' | 'support' | 'neutral' | 'oppose' | 'strongly_oppose'
  upvotes: number
  is_featured: boolean
  user_upvoted: boolean
  created_at: string
}

export interface ConsultationDetail {
  id: string
  title: string
  summary: string
  full_text: string | null
  paper_type: PaperType
  status: ConsultationStatus
  department: string
  category: string
  opens_at: string
  closes_at: string
  published_at: string | null
  response_count: number
  view_count: number
  gov_response: string | null
  sponsor: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
  responses: ConsultationResponse[]
  user_response: ConsultationResponse | null
  stance_breakdown: Record<string, number>
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = await createClient()
  const { id } = params

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch consultation
  const { data: consultation, error } = await supabase
    .from('civic_consultations')
    .select(
      `
      id, title, summary, full_text, paper_type, status,
      department, category, opens_at, closes_at, published_at,
      response_count, view_count, gov_response,
      sponsor:profiles!sponsor_id(id, username, display_name, avatar_url)
    `
    )
    .eq('id', id)
    .single()

  if (error || !consultation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch responses
  const { data: responseRows } = await supabase
    .from('civic_consultation_responses')
    .select(
      `
      id, consultation_id, response_text, stance, upvotes, is_featured, created_at,
      author:profiles!author_id(id, username, display_name, avatar_url)
    `
    )
    .eq('consultation_id', id)
    .order('is_featured', { ascending: false })
    .order('upvotes', { ascending: false })
    .limit(50)

  // Fetch user upvotes
  let upvotedIds = new Set<string>()
  if (user) {
    const responseIds = (responseRows ?? []).map((r) => r.id as string)
    if (responseIds.length > 0) {
      const { data: uvRows } = await supabase
        .from('civic_consultation_response_upvotes')
        .select('response_id')
        .eq('user_id', user.id)
        .in('response_id', responseIds)
      upvotedIds = new Set((uvRows ?? []).map((r) => r.response_id as string))
    }
  }

  const responses: ConsultationResponse[] = (responseRows ?? []).map((r) => {
    const author = r.author as unknown as ConsultationResponse['author']
    return {
      id: r.id as string,
      consultation_id: r.consultation_id as string,
      author: author ?? { id: '', username: 'unknown', display_name: null, avatar_url: null },
      response_text: r.response_text as string,
      stance: r.stance as ConsultationResponse['stance'],
      upvotes: r.upvotes as number,
      is_featured: r.is_featured as boolean,
      user_upvoted: upvotedIds.has(r.id as string),
      created_at: r.created_at as string,
    }
  })

  // Stance breakdown
  const stanceBreakdown: Record<string, number> = {}
  for (const resp of responses) {
    stanceBreakdown[resp.stance] = (stanceBreakdown[resp.stance] ?? 0) + 1
  }

  const userResponse = user
    ? responses.find((r) => r.author.id === user.id) ?? null
    : null

  // Bump view count (fire-and-forget, no await)
  supabase
    .from('civic_consultations')
    .update({ view_count: (consultation.view_count as number) + 1 })
    .eq('id', id)
    .then(() => {})

  const sponsor = consultation.sponsor as unknown as ConsultationDetail['sponsor']

  const result: ConsultationDetail = {
    id: consultation.id as string,
    title: consultation.title as string,
    summary: consultation.summary as string,
    full_text: consultation.full_text as string | null,
    paper_type: consultation.paper_type as PaperType,
    status: consultation.status as ConsultationStatus,
    department: consultation.department as string,
    category: consultation.category as string,
    opens_at: consultation.opens_at as string,
    closes_at: consultation.closes_at as string,
    published_at: consultation.published_at as string | null,
    response_count: consultation.response_count as number,
    view_count: consultation.view_count as number,
    gov_response: consultation.gov_response as string | null,
    sponsor: sponsor ?? null,
    responses,
    user_response: userResponse,
    stance_breakdown: stanceBreakdown,
  }

  return NextResponse.json(result)
}
