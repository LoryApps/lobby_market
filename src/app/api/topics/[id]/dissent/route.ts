import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DissentArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvote_count: number
  reply_count: number
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    reputation_score: number
  } | null
}

export interface DissentProfile {
  role: string
  role_label: string
  count: number
  pct: number
}

export interface DissentData {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    scope: string | null
  }
  minority_side: 'for' | 'against'
  minority_pct: number
  minority_count: number
  majority_side: 'for' | 'against'
  majority_pct: number
  majority_count: number
  top_arguments: DissentArgument[]
  total_dissent_arguments: number
  minority_voices: number
  is_deadlock: boolean
  insight: string
}

// ─── Deadlock insight generator ───────────────────────────────────────────────

function getInsight(
  statement: string,
  minoritySide: 'for' | 'against',
  minorityPct: number,
  totalVotes: number,
  status: string
): string {
  if (minorityPct >= 45) {
    return `This debate is in deadlock territory — ${minorityPct}% ${minoritySide === 'for' ? 'FOR' : 'AGAINST'} means neither side has established dominance. A single persuasive argument could tip the balance.`
  }
  if (minorityPct >= 35) {
    return `${minorityPct}% of voters hold the minority view — a substantial loyal opposition. Their arguments deserve scrutiny; close calls like this often have genuine uncertainty underlying them.`
  }
  if (minorityPct >= 20) {
    return `${minorityPct}% represent a significant dissenting minority. In a democracy, a 1-in-5 voice carries moral weight even without majority support.`
  }
  if (minorityPct >= 10) {
    return `${minorityPct}% hold the minority view — a vocal but outnumbered opposition. Their strongest arguments often reveal blind spots in the consensus position.`
  }
  if (status === 'law') {
    return `Even as an established law, ${minorityPct}% voted against this becoming part of the Codex. The dissenting record preserved here captures the case that lost.`
  }
  return `Only ${minorityPct}% hold the minority view — a near-consensus exists. Yet even here, the dissenting arguments may identify risks or edge cases the majority overlooked.`
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // Fetch topic
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const bluePct = Math.round(topic.blue_pct ?? 50)
  const redPct = 100 - bluePct
  const totalVotes = topic.total_votes ?? 0

  // Determine which side is the minority
  const minoritySide: 'for' | 'against' = bluePct <= redPct ? 'for' : 'against'
  const minoritySideDb: 'blue' | 'red' = minoritySide === 'for' ? 'blue' : 'red'
  const majoritySide: 'for' | 'against' = minoritySide === 'for' ? 'against' : 'for'
  const minorityPct = minoritySide === 'for' ? bluePct : redPct
  const majorityPct = 100 - minorityPct
  const minorityCount = Math.round((minorityPct / 100) * totalVotes)
  const majorityCount = totalVotes - minorityCount
  const isDeadlock = minorityPct >= 45

  // Fetch top arguments from the minority side
  const { data: rawArgs } = await supabase
    .from('arguments')
    .select(`
      id,
      content,
      side,
      upvote_count,
      reply_count,
      ai_score,
      ai_grade,
      created_at,
      author_id
    `)
    .eq('topic_id', params.id)
    .eq('side', minoritySideDb)
    .order('upvote_count', { ascending: false })
    .limit(15)

  const args = rawArgs ?? []

  // Fetch author profiles for these arguments
  const authorIds = [...new Set(args.map((a) => a.author_id).filter(Boolean))]
  const { data: profiles } = authorIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, clout, reputation_score')
        .in('id', authorIds)
    : { data: [] }

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p])
  )

  // Count distinct voters on minority side
  const { count: voterCount } = await supabase
    .from('votes')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', params.id)
    .eq('side', minoritySideDb)

  const topArguments: DissentArgument[] = args.slice(0, 8).map((a) => {
    const profile = profileMap.get(a.author_id)
    return {
      id: a.id,
      content: a.content,
      side: a.side as 'blue' | 'red',
      upvote_count: a.upvote_count ?? 0,
      reply_count: a.reply_count ?? 0,
      ai_score: a.ai_score,
      ai_grade: a.ai_grade,
      created_at: a.created_at,
      author: profile
        ? {
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            role: profile.role,
            clout: profile.clout ?? 0,
            reputation_score: profile.reputation_score ?? 0,
          }
        : null,
    }
  })

  const insight = getInsight(
    topic.statement,
    minoritySide,
    minorityPct,
    totalVotes,
    topic.status
  )

  const result: DissentData = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct ?? 50,
      total_votes: totalVotes,
      scope: (topic as { scope?: string | null }).scope ?? null,
    },
    minority_side: minoritySide,
    minority_pct: minorityPct,
    minority_count: minorityCount,
    majority_side: majoritySide,
    majority_pct: majorityPct,
    majority_count: majorityCount,
    top_arguments: topArguments,
    total_dissent_arguments: args.length,
    minority_voices: voterCount ?? 0,
    is_deadlock: isDeadlock,
    insight,
  }

  return NextResponse.json(result)
}
