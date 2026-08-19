import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface Params {
  params: { id: string }
}

export async function POST(req: Request, { params }: Params) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { content } = body

  if (!content || content.trim().length < 10) {
    return NextResponse.json({ error: 'Statement must be at least 10 characters' }, { status: 400 })
  }

  // Determine the role of this commenter
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  // Check if complainant
  const { data: caseData } = await supabase
    .from('ombudsman_cases')
    .select('complainant_id, officer_id')
    .eq('id', params.id)
    .maybeSingle()

  let role = 'observer'
  if (caseData?.complainant_id === user.id) role = 'complainant'
  else if (caseData?.officer_id === user.id || (profile?.role === 'admin' || profile?.role === 'moderator')) role = 'officer'

  const { data, error } = await supabase
    .from('ombudsman_statements')
    .insert({
      case_id: params.id,
      author_id: user.id,
      role,
      content: content.trim().slice(0, 1000),
    })
    .select(
      `id, role, content, created_at,
       author:profiles!ombudsman_statements_author_id_fkey(id, username, display_name, avatar_url, role)`
    )
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ statement: data }, { status: 201 })
}
