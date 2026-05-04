import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/debates/live-count
 *
 * Lightweight endpoint that returns the number of currently-live debates.
 * Used by BottomNav to show a badge on the Debates tab.
 *
 * Response: { count: number }
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const { count, error } = await supabase
      .from('debates')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'live')

    if (error) {
      return NextResponse.json({ count: 0 })
    }

    return NextResponse.json({ count: count ?? 0 }, {
      headers: {
        // Allow CDN / browser to cache for up to 30 s
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
      },
    })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
