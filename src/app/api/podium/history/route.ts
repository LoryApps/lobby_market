import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface PodiumHistoryEntry {
  week_start: string
  category: string
  rank: 1 | 2 | 3
  score: number
  weekly_votes: number
  weekly_arguments: number
  weekly_upvotes: number
}

export interface PodiumHistoryResponse {
  username: string
  display_name: string | null
  avatar_url: string | null
  entries: PodiumHistoryEntry[]
  gold_count: number
  silver_count: number
  bronze_count: number
  total_podiums: number
  categories_won: string[]
  best_score: number
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const username = searchParams.get('username')?.trim()

  if (!username) {
    return NextResponse.json({ error: 'username required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('username', username)
    .maybeSingle()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: rows } = await supabase
    .from('podium_snapshots')
    .select('week_start, category, rank, score, weekly_votes, weekly_arguments, weekly_upvotes')
    .eq('user_id', profile.id)
    .order('week_start', { ascending: false })
    .limit(200)

  const entries: PodiumHistoryEntry[] = (rows ?? []).map((r) => ({
    week_start: r.week_start,
    category: r.category,
    rank: r.rank as 1 | 2 | 3,
    score: r.score,
    weekly_votes: r.weekly_votes,
    weekly_arguments: r.weekly_arguments,
    weekly_upvotes: r.weekly_upvotes,
  }))

  const gold = entries.filter((e) => e.rank === 1).length
  const silver = entries.filter((e) => e.rank === 2).length
  const bronze = entries.filter((e) => e.rank === 3).length
  const categoriesWon = [...new Set(entries.filter((e) => e.rank === 1).map((e) => e.category))]
  const bestScore = entries.reduce((max, e) => Math.max(max, e.score), 0)

  const response: PodiumHistoryResponse = {
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    entries,
    gold_count: gold,
    silver_count: silver,
    bronze_count: bronze,
    total_podiums: entries.length,
    categories_won: categoriesWon,
    best_score: bestScore,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' },
  })
}
