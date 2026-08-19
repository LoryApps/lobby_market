import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ThesisAuthor } from '@/lib/types/thesis'

export const dynamic = 'force-dynamic'

export interface ThesisSearchResult {
  id: string
  statement: string
  category: string
  status: string
  agree_count: number
  disagree_count: number
  resolution_date: string | null
  author: ThesisAuthor | null
}

export interface ThesisSearchResponse {
  results: ThesisSearchResult[]
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = req.nextUrl

  const q = (searchParams.get('q') ?? '').trim()
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 20)

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] } satisfies ThesisSearchResponse)
  }

  const { data: rows } = await supabase
    .from('civic_theses')
    .select(`
      id, statement, category, status,
      agree_count, disagree_count, resolution_date,
      profiles!civic_theses_user_id_fkey(
        id, username, display_name, avatar_url, role
      )
    `)
    .eq('is_public', true)
    .ilike('statement', `%${q}%`)
    .order('agree_count', { ascending: false })
    .limit(limit)

  const results: ThesisSearchResult[] = (rows ?? []).map((row) => {
    const authorRaw = row.profiles as Record<string, unknown> | null
    return {
      id: row.id as string,
      statement: row.statement as string,
      category: row.category as string,
      status: row.status as string,
      agree_count: (row.agree_count as number) ?? 0,
      disagree_count: (row.disagree_count as number) ?? 0,
      resolution_date: (row.resolution_date as string | null) ?? null,
      author: authorRaw
        ? {
            id: authorRaw.id as string,
            username: authorRaw.username as string,
            display_name: (authorRaw.display_name as string | null) ?? null,
            avatar_url: (authorRaw.avatar_url as string | null) ?? null,
            role: (authorRaw.role as string) ?? 'citizen',
          }
        : null,
    }
  })

  return NextResponse.json({ results } satisfies ThesisSearchResponse)
}
