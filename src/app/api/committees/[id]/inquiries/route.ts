import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface EvidenceEntry {
  id: string
  inquiry_id: string
  user_id: string
  argument_id: string | null
  topic_id: string | null
  summary: string
  position: 'for' | 'against' | 'neutral'
  upvote_count: number
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

export interface InquiryDetail {
  id: string
  committee_id: string
  title: string
  terms: string
  status: 'open' | 'closed' | 'reported'
  topic_id: string | null
  topic_statement: string | null
  evidence_count: number
  opened_at: string
  closed_at: string | null
  created_at: string
  evidence: EvidenceEntry[]
  user_has_submitted: boolean
}

// GET /api/committees/[id]/inquiries — list inquiries with evidence
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const inquiryId = searchParams.get('inquiry')

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Single inquiry detail with evidence
  if (inquiryId) {
    const { data: inq } = await supabase
      .from('committee_inquiries')
      .select(`id, committee_id, title, terms, status, topic_id, evidence_count, opened_at, closed_at, created_at, topic:topics(statement)`)
      .eq('id', inquiryId)
      .eq('committee_id', params.id)
      .maybeSingle()

    if (!inq) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: evidence } = await supabase
      .from('committee_evidence')
      .select(`id, inquiry_id, user_id, argument_id, topic_id, summary, position, upvote_count, created_at, author:profiles(id, username, display_name, avatar_url)`)
      .eq('inquiry_id', inquiryId)
      .order('upvote_count', { ascending: false })
      .limit(50)

    let user_has_submitted = false
    if (user) {
      const found = (evidence ?? []).find((e) => e.user_id === user.id)
      user_has_submitted = !!found
    }

    const result: InquiryDetail = {
      id: inq.id,
      committee_id: inq.committee_id,
      title: inq.title,
      terms: inq.terms,
      status: inq.status as InquiryDetail['status'],
      topic_id: inq.topic_id,
      topic_statement: (inq.topic as { statement: string } | null)?.statement ?? null,
      evidence_count: inq.evidence_count ?? 0,
      opened_at: inq.opened_at,
      closed_at: inq.closed_at,
      created_at: inq.created_at,
      evidence: (evidence ?? []).map((e) => ({
        id: e.id,
        inquiry_id: e.inquiry_id,
        user_id: e.user_id,
        argument_id: e.argument_id,
        topic_id: e.topic_id,
        summary: e.summary,
        position: e.position as EvidenceEntry['position'],
        upvote_count: e.upvote_count ?? 0,
        created_at: e.created_at,
        author: (e.author as EvidenceEntry['author'] | null),
      })),
      user_has_submitted,
    }

    return NextResponse.json(result)
  }

  // List all inquiries for this committee
  const { data: inquiries } = await supabase
    .from('committee_inquiries')
    .select(`id, committee_id, title, terms, status, topic_id, evidence_count, opened_at, closed_at, created_at, topic:topics(statement)`)
    .eq('committee_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ inquiries: inquiries ?? [] })
}

// POST — submit evidence to an inquiry
export async function POST(
  req: NextRequest,
  _ctx: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { inquiry_id, summary, position, argument_id, topic_id } = body as {
    inquiry_id: string
    summary: string
    position: string
    argument_id?: string | null
    topic_id?: string | null
  }

  if (!inquiry_id || !summary || summary.trim().length < 20) {
    return NextResponse.json({ error: 'inquiry_id and summary (min 20 chars) required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('committee_evidence')
    .insert({
      inquiry_id,
      user_id: user.id,
      summary: summary.trim(),
      position: position ?? 'neutral',
      argument_id: argument_id ?? null,
      topic_id: topic_id ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You have already submitted evidence to this inquiry' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ evidence: data })
}
