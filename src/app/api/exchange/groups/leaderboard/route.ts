import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface GroupLeaderboardEntry {
  id: string
  name: string
  description: string | null
  emoji: string
  item_count: number
  created_at: string
  updated_at: string
  owner_username: string | null
  owner_display_name: string | null
  // Computed stats
  market_count: number
  law_count: number
  failed_count: number
  live_count: number
  settled_count: number
  avg_price: number
  total_volume: number
  law_rate: number    // 0–100
  score: number       // composite ranking score
}

export interface GroupLeaderboardResponse {
  groups: GroupLeaderboardEntry[]
  sort: string
  total: number
}

type SortParam = 'volume' | 'law_rate' | 'size' | 'recent'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const sort = (req.nextUrl.searchParams.get('sort') ?? 'volume') as SortParam
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 100)

    // Fetch all public groups with owner profile
    const { data: groups, error: groupErr } = await supabase
      .from('exchange_groups')
      .select(`
        id, name, description, emoji, item_count, created_at, updated_at,
        profiles:user_id ( username, display_name )
      `)
      .eq('is_public', true)
      .gt('item_count', 0)
      .order('updated_at', { ascending: false })
      .limit(200)

    if (groupErr) throw groupErr

    if (!groups || groups.length === 0) {
      return NextResponse.json<GroupLeaderboardResponse>({ groups: [], sort, total: 0 })
    }

    const groupIds = groups.map((g) => g.id)

    // Fetch all group items with their topic stats
    const { data: items, error: itemErr } = await supabase
      .from('exchange_group_items')
      .select(`
        group_id,
        topics ( id, status, blue_pct, total_votes )
      `)
      .in('group_id', groupIds)

    if (itemErr) throw itemErr

    // Aggregate stats per group
    const statsMap = new Map<string, {
      market_count: number
      law_count: number
      failed_count: number
      live_count: number
      settled_count: number
      price_sum: number
      price_count: number
      total_volume: number
    }>()

    for (const gid of groupIds) {
      statsMap.set(gid, {
        market_count: 0, law_count: 0, failed_count: 0,
        live_count: 0, settled_count: 0,
        price_sum: 0, price_count: 0, total_volume: 0,
      })
    }

    for (const item of (items ?? [])) {
      const s = statsMap.get(item.group_id)
      if (!s) continue
      const t = item.topics as { status: string; blue_pct: number; total_votes: number } | null
      if (!t) continue

      s.market_count++
      s.total_volume += t.total_votes ?? 0
      if (t.blue_pct !== null) {
        s.price_sum += t.blue_pct
        s.price_count++
      }

      if (t.status === 'law') { s.law_count++; s.settled_count++ }
      else if (t.status === 'failed') { s.failed_count++; s.settled_count++ }
      else if (t.status === 'active' || t.status === 'voting') s.live_count++
    }

    // Build leaderboard entries
    const entries: GroupLeaderboardEntry[] = groups.map((g) => {
      const s = statsMap.get(g.id)!
      const profile = (g as Record<string, unknown>).profiles as { username?: string; display_name?: string } | null
      const law_rate = s.settled_count > 0 ? Math.round((s.law_count / s.settled_count) * 100) : 0
      const avg_price = s.price_count > 0 ? Math.round(s.price_sum / s.price_count) : 50

      // Composite score: weight volume (big signal), law rate, and market count
      const volumeScore = Math.log10(Math.max(s.total_volume + 1, 1)) * 30
      const lawScore = law_rate * 0.4
      const sizeScore = Math.min(s.market_count, 20) * 2
      const score = volumeScore + lawScore + sizeScore

      return {
        id: g.id,
        name: g.name,
        description: g.description,
        emoji: g.emoji,
        item_count: g.item_count,
        created_at: g.created_at,
        updated_at: g.updated_at,
        owner_username: profile?.username ?? null,
        owner_display_name: profile?.display_name ?? null,
        market_count: s.market_count,
        law_count: s.law_count,
        failed_count: s.failed_count,
        live_count: s.live_count,
        settled_count: s.settled_count,
        avg_price,
        total_volume: s.total_volume,
        law_rate,
        score,
      }
    })

    // Sort
    let sorted: GroupLeaderboardEntry[]
    switch (sort) {
      case 'law_rate':
        sorted = entries
          .filter((e) => e.settled_count >= 2)
          .sort((a, b) => b.law_rate - a.law_rate || b.total_volume - a.total_volume)
        break
      case 'size':
        sorted = entries.sort((a, b) => b.market_count - a.market_count || b.total_volume - a.total_volume)
        break
      case 'recent':
        sorted = entries.sort((a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
        break
      default:
        sorted = entries.sort((a, b) => b.score - a.score || b.total_volume - a.total_volume)
    }

    return NextResponse.json<GroupLeaderboardResponse>({
      groups: sorted.slice(0, limit),
      sort,
      total: sorted.length,
    })
  } catch (err) {
    console.error('[exchange/groups/leaderboard]', err)
    return NextResponse.json<GroupLeaderboardResponse>({ groups: [], sort: 'volume', total: 0 })
  }
}
