import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface TopicContributor {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  for_upvotes: number
  against_upvotes: number
  total_upvotes: number
  argument_count: number
  dominant_side: 'for' | 'against' | 'mixed'
}

export interface ContributorsResponse {
  contributors: TopicContributor[]
  total_arguments: number
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: args, error } = await supabase
    .from('topic_arguments')
    .select('user_id, side, upvotes')
    .eq('topic_id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!args || args.length === 0) {
    return NextResponse.json({ contributors: [], total_arguments: 0 })
  }

  // Aggregate per user
  const byUser = new Map<
    string,
    { for_upvotes: number; against_upvotes: number; argument_count: number }
  >()

  for (const arg of args) {
    const uid = arg.user_id as string
    const existing = byUser.get(uid) ?? {
      for_upvotes: 0,
      against_upvotes: 0,
      argument_count: 0,
    }
    if (arg.side === 'blue') {
      existing.for_upvotes += (arg.upvotes as number) ?? 0
    } else {
      existing.against_upvotes += (arg.upvotes as number) ?? 0
    }
    existing.argument_count += 1
    byUser.set(uid, existing)
  }

  // Sort by total upvotes descending, take top 8
  const sorted = Array.from(byUser.entries())
    .map(([uid, stats]) => ({
      user_id: uid,
      total_upvotes: stats.for_upvotes + stats.against_upvotes,
      ...stats,
    }))
    .sort((a, b) => b.total_upvotes - a.total_upvotes || b.argument_count - a.argument_count)
    .slice(0, 8)

  if (sorted.length === 0) {
    return NextResponse.json({ contributors: [], total_arguments: args.length })
  }

  // Batch-fetch profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', sorted.map((s) => s.user_id))

  const profileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null; role: string }>()
  for (const p of profiles ?? []) {
    profileMap.set(p.id, p)
  }

  const contributors: TopicContributor[] = sorted
    .map((s) => {
      const p = profileMap.get(s.user_id)
      if (!p) return null
      const dominant_side: 'for' | 'against' | 'mixed' =
        s.for_upvotes > s.against_upvotes
          ? 'for'
          : s.against_upvotes > s.for_upvotes
          ? 'against'
          : 'mixed'
      return {
        user_id: s.user_id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role,
        for_upvotes: s.for_upvotes,
        against_upvotes: s.against_upvotes,
        total_upvotes: s.total_upvotes,
        argument_count: s.argument_count,
        dominant_side,
      }
    })
    .filter((c): c is TopicContributor => c !== null)

  return NextResponse.json({ contributors, total_arguments: args.length })
}
