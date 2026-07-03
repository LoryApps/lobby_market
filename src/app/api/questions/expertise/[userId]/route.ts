import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ExpertiseTier {
  category: string
  accepted_count: number
  tier: 'contributor' | 'expert' | 'sage'
}

export interface ExpertiseResponse {
  expertise: ExpertiseTier[]
}

// GET /api/questions/expertise/[userId]
// Returns per-category Q&A expertise for the given user, ordered by tier then count.
export async function GET(
  _req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('qa_user_expertise')
      .select('category, accepted_count, tier')
      .eq('user_id', params.userId)
      .order('accepted_count', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ expertise: data ?? [] } satisfies ExpertiseResponse)
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
