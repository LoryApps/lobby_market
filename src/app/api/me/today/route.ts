import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface TodayDigest {
  authenticated: boolean
  streak: number
  votesToday: number
  dailyLimit: number
  clout: number
  username: string | null
  suggestedTopic: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    status: string
  } | null
}

/**
 * GET /api/me/today
 *
 * Lightweight personal daily digest endpoint. Returns:
 *   - vote streak + today's vote count + daily limit
 *   - clout balance
 *   - one suggested unvoted topic from the user's most-active category
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json<TodayDigest>({
        authenticated: false,
        streak: 0,
        votesToday: 0,
        dailyLimit: 5,
        clout: 0,
        username: null,
        suggestedTopic: null,
      })
    }

    // ── 1. Profile fields ────────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, vote_streak, clout, daily_votes_used')
      .eq('id', user.id)
      .maybeSingle()

    const streak = profile?.vote_streak ?? 0
    const votesToday = profile?.daily_votes_used ?? 0
    const clout = profile?.clout ?? 0
    const username = profile?.username ?? null

    // ── 2. Daily vote limit from the daily_quorum table (if it exists) ───────
    // Fall back to 5 if the table / row doesn't exist.
    const { data: quorumRow } = await supabase
      .from('daily_quorum')
      .select('vote_limit')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const dailyLimit = (quorumRow as { vote_limit?: number } | null)?.vote_limit ?? 5

    // ── 3. Find a good suggested topic ──────────────────────────────────────
    // Pick an active/voting topic the user hasn't voted on yet.
    // Prefer topics from the user's most-voted category.

    // Get the user's top category
    const { data: catRows } = await supabase
      .from('votes')
      .select('topic_id, topics!inner(category)')
      .eq('user_id', user.id)
      .limit(200)

    const catCount: Record<string, number> = {}
    for (const row of catRows ?? []) {
      const cat = (row as unknown as { topics: { category: string | null } }).topics?.category
      if (cat) catCount[cat] = (catCount[cat] ?? 0) + 1
    }
    const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    // Get topics the user has already voted on (avoid suggestions)
    const { data: votedRows } = await supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', user.id)

    const votedIds = new Set((votedRows ?? []).map((r) => r.topic_id))

    // Query for a fresh topic in their top category
    let suggestedTopic: TodayDigest['suggestedTopic'] = null

    const buildQuery = (cat: string | null) => {
      let q = supabase
        .from('topics')
        .select('id, statement, category, blue_pct, total_votes, status')
        .in('status', ['active', 'voting'])
        .order('feed_score', { ascending: false })
        .limit(20)
      if (cat) q = q.eq('category', cat)
      return q
    }

    const { data: candidates } = await buildQuery(topCat)
    const fresh = (candidates ?? []).find((t) => !votedIds.has(t.id))

    if (fresh) {
      suggestedTopic = {
        id: fresh.id,
        statement: fresh.statement,
        category: fresh.category,
        blue_pct: fresh.blue_pct ?? 50,
        total_votes: fresh.total_votes ?? 0,
        status: fresh.status,
      }
    } else if (topCat) {
      // Broaden to any category if nothing found in top cat
      const { data: fallback } = await buildQuery(null)
      const fallbackFresh = (fallback ?? []).find((t) => !votedIds.has(t.id))
      if (fallbackFresh) {
        suggestedTopic = {
          id: fallbackFresh.id,
          statement: fallbackFresh.statement,
          category: fallbackFresh.category,
          blue_pct: fallbackFresh.blue_pct ?? 50,
          total_votes: fallbackFresh.total_votes ?? 0,
          status: fallbackFresh.status,
        }
      }
    }

    return NextResponse.json<TodayDigest>({
      authenticated: true,
      streak,
      votesToday,
      dailyLimit,
      clout,
      username,
      suggestedTopic,
    })
  } catch {
    return NextResponse.json<TodayDigest>({
      authenticated: false,
      streak: 0,
      votesToday: 0,
      dailyLimit: 5,
      clout: 0,
      username: null,
      suggestedTopic: null,
    })
  }
}
