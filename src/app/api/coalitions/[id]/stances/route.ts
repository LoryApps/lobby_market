import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/coalitions/[id]/stances
 * Returns all stances this coalition has declared, with topic info.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('coalition_stances')
    .select(`
      id,
      coalition_id,
      topic_id,
      stance,
      statement,
      declared_by,
      created_at,
      updated_at,
      topic:topics (
        id,
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `)
    .eq('coalition_id', params.id)
    .order('created_at', { ascending: false })

  if (error) {
    // Table may not exist yet — return empty gracefully
    return NextResponse.json({ stances: [] })
  }

  return NextResponse.json({ stances: data ?? [] })
}
