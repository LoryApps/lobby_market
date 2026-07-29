import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface CompareLaw {
  id: string
  statement: string
  category: string | null
  blue_pct: number | null
  total_votes: number | null
  established_at: string | null
  is_active: boolean
  body_markdown: string | null
  wiki_content: string | null
  wiki_updated_at: string | null
  amendment_count: number
  linked: boolean
}

export interface LawCompareResponse {
  primary: CompareLaw
  secondary: CompareLaw
  same_category: boolean
  vote_delta: number
  linked: boolean
}

interface Props {
  params: { id: string }
}

export async function GET(req: Request, { params }: Props) {
  const supabase = await createClient()

  const url = new URL(req.url)
  const secondaryId = url.searchParams.get('with')

  if (!secondaryId) {
    return NextResponse.json({ error: 'Missing ?with= parameter' }, { status: 400 })
  }

  if (secondaryId === params.id) {
    return NextResponse.json({ error: 'Cannot compare a law with itself' }, { status: 400 })
  }

  const [primaryRes, secondaryRes, amendmentsRes, linksRes] = await Promise.all([
    supabase
      .from('laws')
      .select(
        'id, statement, category, blue_pct, total_votes, established_at, is_active, body_markdown, wiki_content, wiki_updated_at',
      )
      .eq('id', params.id)
      .maybeSingle(),

    supabase
      .from('laws')
      .select(
        'id, statement, category, blue_pct, total_votes, established_at, is_active, body_markdown, wiki_content, wiki_updated_at',
      )
      .eq('id', secondaryId)
      .maybeSingle(),

    supabase
      .from('law_amendments')
      .select('law_id')
      .in('law_id', [params.id, secondaryId])
      .eq('status', 'approved'),

    supabase
      .from('law_links')
      .select('source_law_id, target_law_id')
      .or(
        `and(source_law_id.eq.${params.id},target_law_id.eq.${secondaryId}),` +
          `and(source_law_id.eq.${secondaryId},target_law_id.eq.${params.id})`,
      ),
  ])

  if (!primaryRes.data) {
    return NextResponse.json({ error: 'Primary law not found' }, { status: 404 })
  }
  if (!secondaryRes.data) {
    return NextResponse.json({ error: 'Secondary law not found' }, { status: 404 })
  }

  const amendmentsByLaw = (amendmentsRes.data ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.law_id] = (acc[row.law_id] ?? 0) + 1
    return acc
  }, {})

  const linked = (linksRes.data ?? []).length > 0

  const primary: CompareLaw = {
    ...primaryRes.data,
    amendment_count: amendmentsByLaw[params.id] ?? 0,
    linked,
  }

  const secondary: CompareLaw = {
    ...secondaryRes.data,
    amendment_count: amendmentsByLaw[secondaryId] ?? 0,
    linked,
  }

  const response: LawCompareResponse = {
    primary,
    secondary,
    same_category: primary.category !== null && primary.category === secondary.category,
    vote_delta: Math.abs((primary.blue_pct ?? 50) - (secondary.blue_pct ?? 50)),
    linked,
  }

  return NextResponse.json(response)
}
