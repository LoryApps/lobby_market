import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Contributor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  argument_count: number
  total_upvotes: number
  side: 'blue' | 'red' | 'both'
  top_argument: string | null
}

export interface ContributorsResponse {
  law: {
    id: string
    statement: string
    category: string | null
    established_at: string
    total_votes: number
    blue_pct: number
  }
  proposer: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  for_contributors: Contributor[]
  against_contributors: Contributor[]
  stats: {
    total_arguers: number
    total_for_args: number
    total_against_args: number
    total_upvotes: number
  }
}

// ─── GET /api/laws/[id]/contributors ─────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // 1. Fetch the law
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select('id, statement, category, established_at, total_votes, blue_pct, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // 2. Fetch the proposer via source topic
  let proposer: ContributorsResponse['proposer'] = null
  const topicId: string | null = law.topic_id ?? null

  if (topicId) {
    const { data: topicRow } = await supabase
      .from('topics')
      .select('author_id')
      .eq('id', topicId)
      .maybeSingle()

    if (topicRow?.author_id) {
      const { data: p } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .eq('id', topicRow.author_id)
        .maybeSingle()
      if (p) {
        proposer = {
          id: p.id,
          username: p.username,
          display_name: p.display_name ?? null,
          avatar_url: p.avatar_url ?? null,
          role: p.role ?? 'person',
        }
      }
    }
  }

  // 3. Fetch all arguments for the source topic
  let allArgs: Array<{
    id: string
    content: string
    side: string
    upvotes: number
    user_id: string
    profiles: {
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
    } | null
  }> = []

  if (topicId) {
    const { data: argsData } = await supabase
      .from('topic_arguments')
      .select(`
        id,
        content,
        side,
        upvotes,
        user_id,
        profiles:user_id (
          id,
          username,
          display_name,
          avatar_url,
          role
        )
      `)
      .eq('topic_id', topicId)
      .order('upvotes', { ascending: false })
      .limit(500)

    if (argsData) {
      allArgs = argsData.map((a) => ({
        ...a,
        profiles: Array.isArray(a.profiles) ? (a.profiles[0] ?? null) : (a.profiles ?? null),
      }))
    }
  }

  // 4. Group arguments by user
  const userMap = new Map<string, {
    profile: ContributorsResponse['proposer']
    for_count: number
    against_count: number
    total_upvotes: number
    top_for_arg: string | null
    top_against_arg: string | null
    top_for_upvotes: number
    top_against_upvotes: number
  }>()

  for (const arg of allArgs) {
    if (!arg.profiles) continue
    const key = arg.user_id
    const existing = userMap.get(key)
    const upvotes = arg.upvotes ?? 0
    const isFor = arg.side === 'blue'
    const isAgainst = arg.side === 'red'

    if (!existing) {
      userMap.set(key, {
        profile: {
          id: arg.profiles.id,
          username: arg.profiles.username,
          display_name: arg.profiles.display_name,
          avatar_url: arg.profiles.avatar_url,
          role: arg.profiles.role ?? 'person',
        },
        for_count: isFor ? 1 : 0,
        against_count: isAgainst ? 1 : 0,
        total_upvotes: upvotes,
        top_for_arg: isFor ? arg.content : null,
        top_against_arg: isAgainst ? arg.content : null,
        top_for_upvotes: isFor ? upvotes : -1,
        top_against_upvotes: isAgainst ? upvotes : -1,
      })
    } else {
      if (isFor) {
        existing.for_count++
        if (upvotes > existing.top_for_upvotes) {
          existing.top_for_arg = arg.content
          existing.top_for_upvotes = upvotes
        }
      } else if (isAgainst) {
        existing.against_count++
        if (upvotes > existing.top_against_upvotes) {
          existing.top_against_arg = arg.content
          existing.top_against_upvotes = upvotes
        }
      }
      existing.total_upvotes += upvotes
    }
  }

  // 5. Build contributor lists by dominant side
  const allContributors: Contributor[] = []
  for (const [, entry] of userMap) {
    const { profile, for_count, against_count, total_upvotes, top_for_arg, top_against_arg } = entry
    const dominantSide: Contributor['side'] =
      for_count > against_count ? 'blue' : against_count > for_count ? 'red' : 'both'
    allContributors.push({
      id: profile!.id,
      username: profile!.username,
      display_name: profile!.display_name,
      avatar_url: profile!.avatar_url,
      role: profile!.role,
      argument_count: for_count + against_count,
      total_upvotes,
      side: dominantSide,
      top_argument: dominantSide === 'red' ? top_against_arg : top_for_arg,
    })
  }

  // Sort by upvotes, take top 10 per side
  const forContributors = allContributors
    .filter((c) => c.side === 'blue' || c.side === 'both')
    .sort((a, b) => b.total_upvotes - a.total_upvotes)
    .slice(0, 10)

  const againstContributors = allContributors
    .filter((c) => c.side === 'red')
    .sort((a, b) => b.total_upvotes - a.total_upvotes)
    .slice(0, 10)

  const totalForArgs = allArgs.filter((a) => a.side === 'blue').length
  const totalAgainstArgs = allArgs.filter((a) => a.side === 'red').length
  const totalUpvotes = allArgs.reduce((sum, a) => sum + (a.upvotes ?? 0), 0)

  const response: ContributorsResponse = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category ?? null,
      established_at: law.established_at ?? new Date().toISOString(),
      total_votes: law.total_votes ?? 0,
      blue_pct: law.blue_pct ?? 50,
    },
    proposer,
    for_contributors: forContributors,
    against_contributors: againstContributors,
    stats: {
      total_arguers: userMap.size,
      total_for_args: totalForArgs,
      total_against_args: totalAgainstArgs,
      total_upvotes: totalUpvotes,
    },
  }

  return NextResponse.json(response)
}
