import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface PublicManifestoRow {
  id: string
  user_id: string
  username: string
  display_name: string | null
  title: string
  archetype: string
  archetype_description: string
  declaration: string
  signoff: string
  sections: Array<{ title: string; body: string }>
  total_votes: number
  categories_covered: number
  for_pct: number
  laws_supported: number
  top_category: string | null
  published_at: string
}

export interface ManifestosResponse {
  manifestos: PublicManifestoRow[]
  total: number
  hasMore: boolean
  myManifestoId: string | null
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const archetype = searchParams.get('archetype') ?? null
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '24', 10), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Build query
  let query = supabase
    .from('public_manifestos')
    .select('*', { count: 'exact' })
    .eq('is_public', true)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (archetype) {
    query = query.ilike('archetype', `%${archetype}%`)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('Manifestos fetch error:', error)
    return NextResponse.json({ manifestos: [], total: 0, hasMore: false, myManifestoId: null })
  }

  // Check if the current user has published a manifesto
  let myManifestoId: string | null = null
  if (user) {
    const { data: myRow } = await supabase
      .from('public_manifestos')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    myManifestoId = myRow?.id ?? null
  }

  const total = count ?? 0
  return NextResponse.json({
    manifestos: (data as PublicManifestoRow[]) ?? [],
    total,
    hasMore: offset + limit < total,
    myManifestoId,
  } satisfies ManifestosResponse)
}
