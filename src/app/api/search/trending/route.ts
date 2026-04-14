import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/search/trending
 *
 * Returns data for the search discovery panel shown before the user types:
 *  - trending: top 6 active/voting topics by feed_score
 *  - categories: distinct categories with topic counts
 *  - laws: the 4 most recently established laws
 *
 * No authentication required. Cached on the CDN for 60 s.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()

  const [trendingRes, categoriesRes, recentLawsRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['active', 'voting'])
      .order('feed_score', { ascending: false })
      .limit(6),

    supabase
      .from('topics')
      .select('category')
      .in('status', ['proposed', 'active', 'voting', 'law'])
      .not('category', 'is', null),

    supabase
      .from('laws')
      .select('id, statement, category, established_at')
      .order('established_at', { ascending: false })
      .limit(4),
  ])

  // Aggregate category counts from raw rows
  const categoryMap: Record<string, number> = {}
  for (const row of categoriesRes.data ?? []) {
    const cat = row.category as string
    categoryMap[cat] = (categoryMap[cat] ?? 0) + 1
  }
  const categories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  return NextResponse.json(
    {
      trending: trendingRes.data ?? [],
      categories,
      recentLaws: recentLawsRes.data ?? [],
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    }
  )
}
