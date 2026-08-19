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
  const category = (searchParams.get('category') ?? '').trim().toLowerCase()
  const status = (searchParams.get('status') ?? '').trim().toLowerCase()
  const sort = (searchParams.get('sort') ?? 'popular').trim()
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)

  let query = supabase
    .from('civic_theses')
    .select(`
      id, statement, category, status,
      agree_count, disagree_count, resolution_date,
      profiles!civic_theses_user_id_fkey(
        id, username, display_name, avatar_url, role
      )
    `)
    .eq('is_public', true)

  if (q && q.length >= 2) {
    query = query.ilike('statement', `%${q}%`)
  }

  if (category && category !== 'all') {
    query = query.eq('category', category)
  }

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  switch (sort) {
    case 'newest':
      query = query.order('created_at', { ascending: false })
      break
    case 'contested':
      query = query.order('disagree_count', { ascending: false })
      break
    case 'resolving_soon':
      query = query
        .not('resolution_date', 'is', null)
        .order('resolution_date', { ascending: true })
      break
    default:
      query = query.order('agree_count', { ascending: false })
  }

  const { data: rows } = await query.limit(limit)

  if (!q || q.length < 2) {
    if (!category && !status) {
      return NextResponse.json({ results: [] } satisfies ThesisSearchResponse)
    }
  }

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
