import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface TopicPreview {
  id: string
  statement: string
  status: string
  category: string | null
  scope: string
  blue_pct: number
  total_votes: number
  description: string | null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topics')
    .select('id, statement, status, category, scope, blue_pct, total_votes, description')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(
    { topic: data as TopicPreview },
    {
      headers: {
        // Cache at the edge for 30 s — topic previews don't need to be real-time
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    }
  )
}
