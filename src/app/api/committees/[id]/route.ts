import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CommitteeChair } from '../route'

export const dynamic = 'force-dynamic'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CommitteeInquiry {
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
}

export interface CommitteeDetail {
  id: string
  slug: string
  name: string
  policy_area: string
  description: string
  remit: string
  icon: string
  colour: string
  chair_id: string | null
  member_count: number
  inquiry_count: number
  created_at: string
  chair: CommitteeChair | null
  inquiries: CommitteeInquiry[]
  recent_reports: Array<{
    id: string
    title: string
    recommendation: string
    created_at: string
  }>
  user_is_member: boolean
}

// ── GET /api/committees/[id] ──────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { id } = params

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch committee by id OR slug
  const isUUID = /^[0-9a-f-]{36}$/.test(id)
  const { data: committee, error } = await supabase
    .from('civic_committees')
    .select(`
      *,
      chair:profiles!civic_committees_chair_id_fkey(
        id, username, display_name, avatar_url, role, reputation_score
      )
    `)
    [isUUID ? 'eq' : 'eq'](isUUID ? 'id' : 'slug', id)
    .maybeSingle()

  if (error || !committee) {
    return NextResponse.json({ error: 'Committee not found' }, { status: 404 })
  }

  // Fetch inquiries with linked topic title
  const { data: inquiries } = await supabase
    .from('committee_inquiries')
    .select(`
      id, committee_id, title, terms, status, topic_id,
      evidence_count, opened_at, closed_at, created_at,
      topic:topics(statement)
    `)
    .eq('committee_id', committee.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Fetch recent related committee reports for this policy area
  const { data: reports } = await supabase
    .from('civic_committee_reports')
    .select('id, title, recommendation, created_at')
    .eq('category', committee.policy_area)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(5)

  // Check membership
  let user_is_member = false
  if (user) {
    const { data: membership } = await supabase
      .from('committee_members')
      .select('committee_id')
      .eq('committee_id', committee.id)
      .eq('user_id', user.id)
      .maybeSingle()
    user_is_member = !!membership
  }

  const result: CommitteeDetail = {
    id: committee.id,
    slug: committee.slug,
    name: committee.name,
    policy_area: committee.policy_area,
    description: committee.description,
    remit: committee.remit,
    icon: committee.icon,
    colour: committee.colour,
    chair_id: committee.chair_id,
    member_count: committee.member_count ?? 0,
    inquiry_count: committee.inquiry_count ?? 0,
    created_at: committee.created_at,
    chair: (committee.chair as CommitteeChair | null),
    inquiries: (inquiries ?? []).map((inq) => ({
      id: inq.id,
      committee_id: inq.committee_id,
      title: inq.title,
      terms: inq.terms,
      status: inq.status as CommitteeInquiry['status'],
      topic_id: inq.topic_id,
      topic_statement: (inq.topic as { statement: string } | null)?.statement ?? null,
      evidence_count: inq.evidence_count ?? 0,
      opened_at: inq.opened_at,
      closed_at: inq.closed_at,
      created_at: inq.created_at,
    })),
    recent_reports: (reports ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      recommendation: r.recommendation,
      created_at: r.created_at,
    })),
    user_is_member,
  }

  return NextResponse.json(result)
}
