import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface StatementRow {
  id: string
  case_id: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  role: 'complainant' | 'officer' | 'observer'
  content: string
  created_at: string
}

export interface CaseDetailResponse {
  statements: StatementRow[]
  total: number
}

// ─── GET /api/ombudsman/[id] — statements for a case ─────────────────────────

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  try {
    const { data: rawStatements, count, error } = await supabase
      .from('ombudsman_statements')
      .select('*', { count: 'exact' })
      .eq('case_id', params.id)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ statements: [], total: 0 } satisfies CaseDetailResponse)
      }
      throw error
    }

    if (!rawStatements?.length) {
      return NextResponse.json({ statements: [], total: count ?? 0 } satisfies CaseDetailResponse)
    }

    const authorIds = [...new Set(rawStatements.map((s: { author_id: string }) => s.author_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', authorIds)

    const profileMap = new Map(
      (profiles ?? []).map((p: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }) => [p.id, p])
    )

    const statements: StatementRow[] = rawStatements.map((s: {
      id: string
      case_id: string
      author_id: string
      role: 'complainant' | 'officer' | 'observer'
      content: string
      created_at: string
    }) => {
      const author = profileMap.get(s.author_id) ?? null
      return {
        id: s.id,
        case_id: s.case_id,
        author: author ? {
          username: author.username,
          display_name: author.display_name,
          avatar_url: author.avatar_url,
          role: author.role,
        } : null,
        role: s.role,
        content: s.content,
        created_at: s.created_at,
      }
    })

    return NextResponse.json({ statements, total: count ?? 0 } satisfies CaseDetailResponse)
  } catch (err) {
    console.error('GET /api/ombudsman/[id]:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}

// ─── POST /api/ombudsman/[id] — add a statement ───────────────────────────────

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { content } = body

    if (!content || typeof content !== 'string' || content.length < 10 || content.length > 1000) {
      return NextResponse.json({ error: 'invalid_content' }, { status: 400 })
    }

    // Determine role
    const { data: caseData } = await supabase
      .from('ombudsman_cases')
      .select('complainant_id, officer_id, status')
      .eq('id', params.id)
      .single()

    if (!caseData) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    if (!['open', 'under_review'].includes(caseData.status)) {
      return NextResponse.json({ error: 'case_closed' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    let statementRole: 'complainant' | 'officer' | 'observer' = 'observer'
    if (caseData.complainant_id === user.id) statementRole = 'complainant'
    else if (caseData.officer_id === user.id || ['admin', 'moderator'].includes(profile?.role ?? '')) statementRole = 'officer'

    const { data: statement, error } = await supabase
      .from('ombudsman_statements')
      .insert({
        case_id: params.id,
        author_id: user.id,
        role: statementRole,
        content: content.trim(),
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: 'db_error' }, { status: 500 })
    }

    return NextResponse.json({ id: statement.id }, { status: 201 })
  } catch (err) {
    console.error('POST /api/ombudsman/[id]:', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
