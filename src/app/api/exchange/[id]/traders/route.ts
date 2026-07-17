import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TraderEntry {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  is_influencer: boolean
  side: 'for' | 'against'
  voted_at: string
}

export interface RecentTrade {
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  side: 'for' | 'against'
  voted_at: string
}

export interface TradersData {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    price: number
    total_votes: number
    blue_votes: number
    red_votes: number
  }
  forTraders: TraderEntry[]
  againstTraders: TraderEntry[]
  recentTrades: RecentTrade[]
  metrics: {
    for_count: number
    against_count: number
    influencer_for: number
    influencer_against: number
    avg_clout_for: number
    avg_clout_against: number
    elder_for: number
    elder_against: number
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Topic ──────────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, blue_votes, red_votes, total_votes')
    .eq('id', id)
    .maybeSingle()

  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ── 2. Top FOR voters by clout ────────────────────────────────────────────
  const { data: forVotes } = await supabase
    .from('votes')
    .select(`
      user_id,
      side,
      created_at,
      profiles:user_id (
        username,
        display_name,
        avatar_url,
        role,
        clout,
        reputation_score,
        is_influencer
      )
    `)
    .eq('topic_id', id)
    .eq('side', 'for')
    .order('created_at', { ascending: false })
    .limit(200)

  // ── 3. Top AGAINST voters by clout ────────────────────────────────────────
  const { data: againstVotes } = await supabase
    .from('votes')
    .select(`
      user_id,
      side,
      created_at,
      profiles:user_id (
        username,
        display_name,
        avatar_url,
        role,
        clout,
        reputation_score,
        is_influencer
      )
    `)
    .eq('topic_id', id)
    .eq('side', 'against')
    .order('created_at', { ascending: false })
    .limit(200)

  // ── 4. Recent votes (all sides, last 30) ──────────────────────────────────
  const { data: recentRaw } = await supabase
    .from('votes')
    .select(`
      user_id,
      side,
      created_at,
      profiles:user_id (
        username,
        display_name,
        avatar_url,
        role,
        clout
      )
    `)
    .eq('topic_id', id)
    .order('created_at', { ascending: false })
    .limit(30)

  // ── 5. Process trader lists ────────────────────────────────────────────────

  interface RawVote {
    user_id: string
    side: string
    created_at: string
    profiles: {
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
      clout: number
      reputation_score: number
      is_influencer: boolean
    } | null
  }

  function toTrader(v: RawVote, side: 'for' | 'against'): TraderEntry | null {
    if (!v.profiles) return null
    return {
      user_id: v.user_id,
      username: v.profiles.username,
      display_name: v.profiles.display_name,
      avatar_url: v.profiles.avatar_url,
      role: v.profiles.role,
      clout: v.profiles.clout,
      reputation_score: v.profiles.reputation_score,
      is_influencer: v.profiles.is_influencer,
      side,
      voted_at: v.created_at,
    }
  }

  const forList = (forVotes ?? [])
    .map((v) => toTrader(v as RawVote, 'for'))
    .filter((t): t is TraderEntry => t !== null)
    .sort((a, b) => b.clout - a.clout)
    .slice(0, 25)

  const againstList = (againstVotes ?? [])
    .map((v) => toTrader(v as RawVote, 'against'))
    .filter((t): t is TraderEntry => t !== null)
    .sort((a, b) => b.clout - a.clout)
    .slice(0, 25)

  // ── 6. Recent trades ──────────────────────────────────────────────────────

  interface RawRecentVote {
    user_id: string
    side: string
    created_at: string
    profiles: {
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
      clout: number
    } | null
  }

  const recentTrades: RecentTrade[] = (recentRaw ?? [])
    .map((v) => {
      const rv = v as RawRecentVote
      if (!rv.profiles) return null
      return {
        username: rv.profiles.username,
        display_name: rv.profiles.display_name,
        avatar_url: rv.profiles.avatar_url,
        role: rv.profiles.role,
        clout: rv.profiles.clout,
        side: rv.side as 'for' | 'against',
        voted_at: rv.created_at,
      }
    })
    .filter((t): t is RecentTrade => t !== null)

  // ── 7. Metrics ────────────────────────────────────────────────────────────
  const allFor = (forVotes ?? [])
    .map((v) => (v as RawVote).profiles)
    .filter(Boolean) as Array<{ clout: number; role: string; is_influencer: boolean }>

  const allAgainst = (againstVotes ?? [])
    .map((v) => (v as RawVote).profiles)
    .filter(Boolean) as Array<{ clout: number; role: string; is_influencer: boolean }>

  const avgClout = (arr: typeof allFor) =>
    arr.length > 0 ? Math.round(arr.reduce((s, p) => s + p.clout, 0) / arr.length) : 0

  const metrics = {
    for_count: topic.blue_votes ?? 0,
    against_count: topic.red_votes ?? 0,
    influencer_for: allFor.filter((p) => p.is_influencer).length,
    influencer_against: allAgainst.filter((p) => p.is_influencer).length,
    avg_clout_for: avgClout(allFor),
    avg_clout_against: avgClout(allAgainst),
    elder_for: allFor.filter((p) => p.role === 'elder').length,
    elder_against: allAgainst.filter((p) => p.role === 'elder').length,
  }

  const data: TradersData = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      price: Math.round(topic.blue_pct ?? 50),
      total_votes: topic.total_votes ?? 0,
      blue_votes: topic.blue_votes ?? 0,
      red_votes: topic.red_votes ?? 0,
    },
    forTraders: forList,
    againstTraders: againstList,
    recentTrades,
    metrics,
  }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  })
}
