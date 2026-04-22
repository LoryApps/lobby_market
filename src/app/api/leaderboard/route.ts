import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Profile, Topic, Vote } from '@/lib/supabase/types'

const VALID_CATEGORIES = [
  'overall',
  'votes',
  'authors',
  'active',
  'rising',
  'troll_catchers',
  'debaters',
] as const
type Category = (typeof VALID_CATEGORIES)[number]

function isCategory(value: string): value is Category {
  return (VALID_CATEGORIES as readonly string[]).includes(value)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const rawCategory = searchParams.get('category') ?? 'overall'
  const rawLimit = Number.parseInt(searchParams.get('limit') ?? '100', 10)
  const limit = Math.min(Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 100), 200)

  if (!isCategory(rawCategory)) {
    return NextResponse.json(
      { error: 'Invalid category' },
      { status: 400 }
    )
  }
  const category: Category = rawCategory

  switch (category) {
    case 'overall': {
      const { data } = (await supabase
        .from('profiles')
        .select('*')
        .order('reputation_score', { ascending: false })
        .limit(limit)) as { data: Profile[] | null }
      return NextResponse.json({
        category,
        rows: (data ?? []).map((p, idx) => ({
          rank: idx + 1,
          profile: p,
          metric: Math.round(p.reputation_score),
        })),
      })
    }
    case 'votes': {
      const { data } = (await supabase
        .from('profiles')
        .select('*')
        .order('total_votes', { ascending: false })
        .limit(limit)) as { data: Profile[] | null }
      return NextResponse.json({
        category,
        rows: (data ?? []).map((p, idx) => ({
          rank: idx + 1,
          profile: p,
          metric: p.total_votes,
        })),
      })
    }
    case 'rising': {
      const { data } = (await supabase
        .from('profiles')
        .select('*')
        .gt('total_votes', 0)
        .order('created_at', { ascending: false })
        .limit(limit)) as { data: Profile[] | null }
      return NextResponse.json({
        category,
        rows: (data ?? []).map((p, idx) => {
          const days = Math.max(
            1,
            (Date.now() - new Date(p.created_at).getTime()) /
              (1000 * 60 * 60 * 24)
          )
          return {
            rank: idx + 1,
            profile: p,
            metric: Math.round(p.reputation_score / days),
          }
        }),
      })
    }
    case 'troll_catchers': {
      const { data } = (await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'troll_catcher')
        .order('reputation_score', { ascending: false })
        .limit(limit)) as { data: Profile[] | null }
      return NextResponse.json({
        category,
        rows: (data ?? []).map((p, idx) => ({
          rank: idx + 1,
          profile: p,
          metric: Math.round(p.reputation_score),
        })),
      })
    }
    case 'authors': {
      const { data: lawTopics } = (await supabase
        .from('topics')
        .select('id, author_id, status')
        .eq('status', 'law')) as {
        data: Pick<Topic, 'id' | 'author_id' | 'status'>[] | null
      }
      const counts: Record<string, number> = {}
      for (const topic of lawTopics ?? []) {
        counts[topic.author_id] = (counts[topic.author_id] ?? 0) + 1
      }
      const sortedIds = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
      if (sortedIds.length === 0) {
        return NextResponse.json({ category, rows: [] })
      }
      const { data: profiles } = (await supabase
        .from('profiles')
        .select('*')
        .in(
          'id',
          sortedIds.map(([id]) => id)
        )) as { data: Profile[] | null }
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
      const rows = sortedIds
        .map(([id, metric], idx) => {
          const profile = profileMap.get(id)
          if (!profile) return null
          return { rank: idx + 1, profile, metric }
        })
        .filter(Boolean)
      return NextResponse.json({ category, rows })
    }
    case 'active': {
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      ).toISOString()
      const { data: recent } = (await supabase
        .from('votes')
        .select('user_id, created_at')
        .gte('created_at', sevenDaysAgo)
        .limit(5000)) as {
        data: Pick<Vote, 'user_id' | 'created_at'>[] | null
      }
      const counts: Record<string, number> = {}
      for (const vote of recent ?? []) {
        counts[vote.user_id] = (counts[vote.user_id] ?? 0) + 1
      }
      const sortedIds = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
      if (sortedIds.length === 0) {
        return NextResponse.json({ category, rows: [] })
      }
      const { data: profiles } = (await supabase
        .from('profiles')
        .select('*')
        .in(
          'id',
          sortedIds.map(([id]) => id)
        )) as { data: Profile[] | null }
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
      const rows = sortedIds
        .map(([id, metric], idx) => {
          const profile = profileMap.get(id)
          if (!profile) return null
          return { rank: idx + 1, profile, metric }
        })
        .filter(Boolean)
      return NextResponse.json({ category, rows })
    }
    case 'debaters': {
      const { data: argRows } = (await supabase
        .from('topic_arguments')
        .select('user_id, upvotes')
        .gt('upvotes', 0)
        .limit(5000)) as { data: { user_id: string; upvotes: number }[] | null }
      const upvoteAgg: Record<string, number> = {}
      for (const row of argRows ?? []) {
        upvoteAgg[row.user_id] = (upvoteAgg[row.user_id] ?? 0) + row.upvotes
      }
      const sortedIds = Object.entries(upvoteAgg)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
      if (sortedIds.length === 0) {
        return NextResponse.json({ category, rows: [] })
      }
      const { data: profiles } = (await supabase
        .from('profiles')
        .select('*')
        .in('id', sortedIds.map(([id]) => id))) as { data: Profile[] | null }
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
      const rows = sortedIds
        .map(([id, metric], idx) => {
          const profile = profileMap.get(id)
          if (!profile) return null
          return { rank: idx + 1, profile, metric }
        })
        .filter(Boolean)
      return NextResponse.json({ category, rows })
    }
  }
}
