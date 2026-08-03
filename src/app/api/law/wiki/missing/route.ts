import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MissingWikiLaw {
  id: string
  statement: string
  category: string | null
  established_at: string
  blue_pct: number | null
  total_votes: number | null
  topic_id: string | null
}

export interface MissingWikiResponse {
  laws: MissingWikiLaw[]
  total: number
  has_more: boolean
}

// ─── GET /api/law/wiki/missing ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)
  const category = searchParams.get('category')
  const sort = (searchParams.get('sort') ?? 'votes') as 'votes' | 'newest' | 'oldest'

  try {
    const supabase = await createClient()

    let query = supabase
      .from('laws')
      .select(
        'id, statement, category, established_at, blue_pct, total_votes, topic_id',
        { count: 'exact' }
      )
      .eq('is_active', true)
      .or('wiki_content.is.null,wiki_content.eq.')

    if (category && category !== 'All') {
      query = query.eq('category', category)
    }

    if (sort === 'votes') {
      query = query.order('total_votes', { ascending: false })
    } else if (sort === 'newest') {
      query = query.order('established_at', { ascending: false })
    } else {
      query = query.order('established_at', { ascending: true })
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const laws: MissingWikiLaw[] = (data ?? []).map((l) => ({
      id: l.id,
      statement: l.statement as string,
      category: l.category as string | null,
      established_at: l.established_at as string,
      blue_pct: l.blue_pct as number | null,
      total_votes: l.total_votes as number | null,
      topic_id: l.topic_id as string | null,
    }))

    const total = count ?? 0

    return NextResponse.json({
      laws,
      total,
      has_more: offset + laws.length < total,
    } satisfies MissingWikiResponse)
  } catch (err) {
    console.error('[GET /api/law/wiki/missing]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
