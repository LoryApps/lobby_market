import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LordMember {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  clout: number
  title: string   // Duke/Earl/Lord based on clout
}

export interface LordReview {
  law_id: string
  user_id: string
  verdict: 'ratify' | 'send_back' | 'abstain'
  amendment_note: string | null
}

export interface LawUnderReview {
  id: string
  statement: string
  category: string | null
  established_at: string
  blue_pct: number | null
  total_votes: number | null
  topic_id: string
  ratify_count: number
  send_back_count: number
  abstain_count: number
  total_reviews: number
  ratify_pct: number
  user_review: LordReview | null
}

export interface LordsData {
  lords: LordMember[]
  laws_under_review: LawUnderReview[]
  recent_decisions: {
    law_id: string
    statement: string
    category: string | null
    established_at: string
    ratify_pct: number
    outcome: 'ratified' | 'sent_back' | 'pending'
  }[]
  is_lord: boolean
  user_clout: number
  lords_threshold: number
}

// ─── Lord title helper ────────────────────────────────────────────────────────

function lordTitle(clout: number): string {
  if (clout >= 500) return 'Duke'
  if (clout >= 250) return 'Earl'
  if (clout >= 100) return 'Lord'
  return 'Lord'
}

// ─── GET /api/lords ───────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── 1. Lords: top 50 users by clout (minimum 50 clout to qualify) ──────────
  const LORDS_THRESHOLD = 50
  const { data: lordsRaw } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, clout')
    .gte('clout', LORDS_THRESHOLD)
    .order('clout', { ascending: false })
    .limit(50)

  const lords: LordMember[] = (lordsRaw ?? []).map((p) => ({
    user_id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    clout: p.clout,
    title: lordTitle(p.clout),
  }))

  // ── 2. User clout + lord status ────────────────────────────────────────────
  let userClout = 0
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('clout')
      .eq('id', user.id)
      .single()
    userClout = profile?.clout ?? 0
  }
  const isLord = userClout >= LORDS_THRESHOLD

  // ── 3. Laws under review (established in last 30 days) ────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: recentLaws } = await supabase
    .from('laws')
    .select('id, topic_id, statement, category, established_at, blue_pct, total_votes')
    .gte('established_at', thirtyDaysAgo)
    .order('established_at', { ascending: false })
    .limit(12)

  // ── 4. Review counts for these laws ───────────────────────────────────────
  const lawIds = (recentLaws ?? []).map((l) => l.id)

  const { data: reviewCounts } = lawIds.length
    ? await supabase
        .from('lords_ratification_summary')
        .select('law_id, ratify_count, send_back_count, abstain_count, total_reviews, ratify_pct')
        .in('law_id', lawIds)
    : { data: [] }

  const countMap = new Map<string, (typeof reviewCounts extends null ? never : NonNullable<typeof reviewCounts>[number])>()
  for (const row of reviewCounts ?? []) countMap.set(row.law_id, row)

  // ── 5. User's existing reviews ─────────────────────────────────────────────
  const { data: userReviews } = user && lawIds.length
    ? await supabase
        .from('lords_reviews')
        .select('law_id, user_id, verdict, amendment_note')
        .eq('user_id', user.id)
        .in('law_id', lawIds)
    : { data: [] }

  const userReviewMap = new Map<string, LordReview>()
  for (const r of userReviews ?? []) {
    userReviewMap.set(r.law_id, r as LordReview)
  }

  const lawsUnderReview: LawUnderReview[] = (recentLaws ?? []).map((law) => {
    const counts = countMap.get(law.id)
    return {
      id: law.id,
      statement: law.statement,
      category: law.category,
      established_at: law.established_at,
      blue_pct: law.blue_pct,
      total_votes: law.total_votes,
      topic_id: law.topic_id,
      ratify_count: counts?.ratify_count ?? 0,
      send_back_count: counts?.send_back_count ?? 0,
      abstain_count: counts?.abstain_count ?? 0,
      total_reviews: counts?.total_reviews ?? 0,
      ratify_pct: counts?.ratify_pct ?? 0,
      user_review: userReviewMap.get(law.id) ?? null,
    }
  })

  // ── 6. Recent decisions (laws older than 30 days with reviews) ─────────────
  const { data: olderLaws } = await supabase
    .from('laws')
    .select('id, statement, category, established_at')
    .lt('established_at', thirtyDaysAgo)
    .order('established_at', { ascending: false })
    .limit(10)

  const olderIds = (olderLaws ?? []).map((l) => l.id)
  const { data: olderCounts } = olderIds.length
    ? await supabase
        .from('lords_ratification_summary')
        .select('law_id, ratify_pct, send_back_count, total_reviews')
        .in('law_id', olderIds)
        .gt('total_reviews', 0)
    : { data: [] }

  const olderCountMap = new Map<string, { ratify_pct: number; send_back_count: number }>()
  for (const row of olderCounts ?? []) olderCountMap.set(row.law_id, row)

  const recentDecisions = (olderLaws ?? [])
    .filter((l) => olderCountMap.has(l.id))
    .slice(0, 6)
    .map((law) => {
      const c = olderCountMap.get(law.id)!
      const outcome: 'ratified' | 'sent_back' | 'pending' =
        c.ratify_pct >= 60 ? 'ratified' : c.send_back_count > 0 ? 'sent_back' : 'pending'
      return {
        law_id: law.id,
        statement: law.statement,
        category: law.category,
        established_at: law.established_at,
        ratify_pct: c.ratify_pct,
        outcome,
      }
    })

  const data: LordsData = {
    lords,
    laws_under_review: lawsUnderReview,
    recent_decisions: recentDecisions,
    is_lord: isLord,
    user_clout: userClout,
    lords_threshold: LORDS_THRESHOLD,
  }

  return NextResponse.json(data)
}
