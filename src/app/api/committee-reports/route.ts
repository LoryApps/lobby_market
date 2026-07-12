import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ReportAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface CommitteeReport {
  id: string
  author_id: string
  hearing_id: string | null
  topic_id: string | null
  title: string
  summary: string
  content: string
  category: string
  recommendation: 'for' | 'against' | 'neutral' | 'hold'
  status: 'draft' | 'published' | 'archived'
  endorsement_count: number
  view_count: number
  tags: string[]
  created_at: string
  published_at: string | null
  author: ReportAuthor | null
  topic_statement: string | null
  user_endorsed: boolean
}

export interface ReportsResponse {
  reports: CommitteeReport[]
  total: number
}

// ─── GET: list committee reports ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const category = searchParams.get('category') ?? null
  const sort = searchParams.get('sort') ?? 'recent'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch reports
  let query = supabase
    .from('civic_committee_reports')
    .select('*, profiles!civic_committee_reports_author_id_fkey(id, username, display_name, avatar_url, role)')
    .eq('status', 'published')

  if (category) query = query.eq('category', category)

  if (sort === 'top') {
    query = query.order('endorsement_count', { ascending: false }).order('published_at', { ascending: false })
  } else {
    query = query.order('published_at', { ascending: false })
  }

  query = query.range(offset, offset + limit - 1)

  const { data: rawReports, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch user endorsements if authenticated
  let endorsedSet = new Set<string>()
  if (user && rawReports && rawReports.length > 0) {
    const ids = rawReports.map((r) => r.id)
    const { data: endorsements } = await supabase
      .from('civic_report_endorsements')
      .select('report_id')
      .eq('user_id', user.id)
      .in('report_id', ids)
    if (endorsements) endorsedSet = new Set(endorsements.map((e) => e.report_id))
  }

  // Fetch topic statements for reports that reference topics
  const topicIds = [...new Set((rawReports ?? []).map((r) => r.topic_id).filter(Boolean))]
  const topicMap: Record<string, string> = {}
  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement')
      .in('id', topicIds)
    if (topics) topics.forEach((t) => { topicMap[t.id] = t.statement })
  }

  const reports: CommitteeReport[] = (rawReports ?? []).map((r) => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
    return {
      id: r.id,
      author_id: r.author_id,
      hearing_id: r.hearing_id,
      topic_id: r.topic_id,
      title: r.title,
      summary: r.summary,
      content: r.content,
      category: r.category,
      recommendation: r.recommendation,
      status: r.status,
      endorsement_count: r.endorsement_count,
      view_count: r.view_count,
      tags: r.tags ?? [],
      created_at: r.created_at,
      published_at: r.published_at,
      author: profile ? {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
      } : null,
      topic_statement: r.topic_id ? (topicMap[r.topic_id] ?? null) : null,
      user_endorsed: endorsedSet.has(r.id),
    }
  })

  return NextResponse.json({ reports, total: reports.length } as ReportsResponse)
}

// ─── POST: create a report ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, summary, content, category, recommendation, topic_id, tags } = body

  if (!title || !summary || !content || !category || !recommendation) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!['for', 'against', 'neutral', 'hold'].includes(recommendation)) {
    return NextResponse.json({ error: 'Invalid recommendation' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('civic_committee_reports')
    .insert({
      author_id: user.id,
      title: title.trim(),
      summary: summary.trim(),
      content: content.trim(),
      category,
      recommendation,
      topic_id: topic_id ?? null,
      tags: Array.isArray(tags) ? tags.slice(0, 5) : [],
      status: 'published',
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
