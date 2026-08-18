import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface Params {
  params: { id: string }
}

// ─── GET /api/ombudsman/[id] ──────────────────────────────────────────────────

export async function GET(_req: Request, { params }: Params) {
  const supabase = await createClient()

  const { data: caseData, error } = await supabase
    .from('ombudsman_cases')
    .select(
      `id, case_number, category, title, description, status, finding,
       support_count, created_at, resolved_at, respondent_type, topic_id,
       complainant:profiles!ombudsman_cases_complainant_id_fkey(id, username, display_name, avatar_url, role),
       officer:profiles!ombudsman_cases_officer_id_fkey(id, username, display_name, avatar_url),
       topic:topics(id, statement, status, blue_pct)`
    )
    .eq('id', params.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!caseData) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: statements } = await supabase
    .from('ombudsman_statements')
    .select(
      `id, role, content, created_at,
       author:profiles!ombudsman_statements_author_id_fkey(id, username, display_name, avatar_url, role)`
    )
    .eq('case_id', params.id)
    .order('created_at', { ascending: true })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let supported = false
  if (user) {
    const { data: support } = await supabase
      .from('ombudsman_case_support')
      .select('case_id')
      .eq('case_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()
    supported = !!support
  }

  return NextResponse.json({
    case: caseData,
    statements: statements ?? [],
    supported,
    isComplainant: user ? (caseData as unknown as { complainant?: { id: string } | null }).complainant?.id === user.id : false,
  })
}
