import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface AmbientLaw {
  id: string
  statement: string
  category: string | null
  total_votes: number
  blue_pct: number
  established_at: string | null
}

export interface AmbientResponse {
  laws: AmbientLaw[]
}

/**
 * GET /api/ambient
 *
 * Returns the 10 most recently established laws for the ambient ticker.
 * Used exclusively by the /ambient fullscreen display.
 */
export async function GET() {
  const supabase = await createClient()

  const { data: laws } = await supabase
    .from('topics')
    .select('id, statement, category, total_votes, blue_pct, updated_at')
    .eq('status', 'law')
    .order('updated_at', { ascending: false })
    .limit(10)

  const mapped: AmbientLaw[] = (laws ?? []).map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category ?? null,
    total_votes: t.total_votes ?? 0,
    blue_pct: t.blue_pct ?? 50,
    established_at: t.updated_at ?? null,
  }))

  return NextResponse.json({ laws: mapped })
}
