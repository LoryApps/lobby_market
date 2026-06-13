import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DebateArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  ai_score: number | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface LawDebateRecord {
  law: {
    id: string
    statement: string
    category: string | null
    established_at: string
    total_votes: number
    blue_pct: number
  }
  topic: {
    id: string
    statement: string
    created_at: string
    total_votes: number
    blue_pct: number
  } | null
  arguments: {
    for: DebateArgument[]
    against: DebateArgument[]
    total: number
  }
  stats: {
    total_arguments: number
    for_arguments: number
    against_arguments: number
    debate_duration_days: number | null
    top_for_upvotes: number
    top_against_upvotes: number
  }
}

// ─── GET /api/laws/[id]/debate ────────────────────────────────────────────────

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

  // 2. Fetch source topic (if available)
  let topic: LawDebateRecord['topic'] = null
  if (law.topic_id) {
    const { data: topicData } = await supabase
      .from('topics')
      .select('id, statement, created_at, total_votes, blue_pct')
      .eq('id', law.topic_id)
      .maybeSingle()

    if (topicData) {
      topic = {
        id: topicData.id,
        statement: topicData.statement,
        created_at: topicData.created_at,
        total_votes: topicData.total_votes ?? 0,
        blue_pct: topicData.blue_pct ?? 50,
      }
    }
  }

  // 3. Fetch top arguments for the source topic
  let forArgs: DebateArgument[] = []
  let againstArgs: DebateArgument[] = []
  let totalArgs = 0

  if (law.topic_id) {
    const { data: rawArgs } = await supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, ai_score, created_at, user_id')
      .eq('topic_id', law.topic_id)
      .order('upvotes', { ascending: false })
      .limit(100)

    const args = rawArgs ?? []
    totalArgs = args.length

    // Fetch author profiles in batch
    const userIds = [...new Set(args.map((a) => a.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', userIds)

    const profileMap = new Map<string, DebateArgument['author']>()
    for (const p of profiles ?? []) profileMap.set(p.id, p)

    const enriched: DebateArgument[] = args.map((a) => ({
      id: a.id,
      content: a.content,
      side: a.side as 'blue' | 'red',
      upvotes: a.upvotes ?? 0,
      ai_score: a.ai_score ?? null,
      created_at: a.created_at,
      author: profileMap.get(a.user_id) ?? null,
    }))

    forArgs = enriched.filter((a) => a.side === 'blue').slice(0, 10)
    againstArgs = enriched.filter((a) => a.side === 'red').slice(0, 10)
  }

  // 4. Calculate debate duration
  let debateDurationDays: number | null = null
  if (topic?.created_at && law.established_at) {
    const start = new Date(topic.created_at).getTime()
    const end = new Date(law.established_at).getTime()
    debateDurationDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)))
  }

  const response: LawDebateRecord = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      established_at: law.established_at,
      total_votes: law.total_votes ?? 0,
      blue_pct: law.blue_pct ?? 50,
    },
    topic,
    arguments: {
      for: forArgs,
      against: againstArgs,
      total: totalArgs,
    },
    stats: {
      total_arguments: totalArgs,
      for_arguments: forArgs.length,
      against_arguments: againstArgs.length,
      debate_duration_days: debateDurationDays,
      top_for_upvotes: forArgs[0]?.upvotes ?? 0,
      top_against_upvotes: againstArgs[0]?.upvotes ?? 0,
    },
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
