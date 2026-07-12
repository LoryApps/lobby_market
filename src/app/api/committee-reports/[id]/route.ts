import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── GET: fetch single report ─────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: report, error } = await supabase
    .from('civic_committee_reports')
    .select('*, profiles!civic_committee_reports_author_id_fkey(id, username, display_name, avatar_url, role)')
    .eq('id', params.id)
    .single()

  if (error || !report) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (report.status !== 'published' && report.author_id !== user?.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Increment view count (best-effort)
  await supabase
    .from('civic_committee_reports')
    .update({ view_count: report.view_count + 1 })
    .eq('id', params.id)

  // User endorsement status
  let userEndorsed = false
  if (user) {
    const { data: endorsement } = await supabase
      .from('civic_report_endorsements')
      .select('report_id')
      .eq('report_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()
    userEndorsed = !!endorsement
  }

  // Topic statement if linked
  let topicStatement: string | null = null
  if (report.topic_id) {
    const { data: topic } = await supabase
      .from('topics')
      .select('statement')
      .eq('id', report.topic_id)
      .single()
    topicStatement = topic?.statement ?? null
  }

  const profile = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles

  return NextResponse.json({
    ...report,
    author: profile ? {
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
    } : null,
    topic_statement: topicStatement,
    user_endorsed: userEndorsed,
  })
}
