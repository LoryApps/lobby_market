import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface CommunityPredictor {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  predicted_law: boolean
  confidence: number
  reasoning: string
  correct: boolean | null
  created_at: string
}

export interface CommunityPredictionsResponse {
  predictors: CommunityPredictor[]
  total: number
}

/**
 * GET /api/topics/[id]/predict/community
 *
 * Returns the top predictions (with reasoning) for a topic, ordered by
 * confidence descending.  Only returns predictions that include a reasoning
 * note, so every returned row is informative.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: rows, count } = await supabase
    .from('topic_predictions')
    .select(
      `
      user_id,
      predicted_law,
      confidence,
      reasoning,
      correct,
      created_at,
      profiles!topic_predictions_user_id_fkey (
        username,
        display_name,
        avatar_url,
        role
      )
      `,
      { count: 'exact' }
    )
    .eq('topic_id', params.id)
    .not('reasoning', 'is', null)
    .order('confidence', { ascending: false })
    .limit(10)

  if (!rows) {
    return NextResponse.json({ predictors: [], total: 0 } satisfies CommunityPredictionsResponse)
  }

  const predictors: CommunityPredictor[] = rows
    .map((r) => {
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      if (!profile) return null
      return {
        user_id: r.user_id,
        username: (profile as { username: string }).username,
        display_name: (profile as { display_name: string | null }).display_name,
        avatar_url: (profile as { avatar_url: string | null }).avatar_url,
        role: (profile as { role: string }).role,
        predicted_law: r.predicted_law,
        confidence: r.confidence,
        reasoning: r.reasoning as string,
        correct: r.correct,
        created_at: r.created_at,
      }
    })
    .filter((x): x is CommunityPredictor => x !== null)

  return NextResponse.json({
    predictors,
    total: count ?? 0,
  } satisfies CommunityPredictionsResponse)
}
