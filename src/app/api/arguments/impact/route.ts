import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImpactArgument {
  id: string
  topic_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  created_at: string
  reply_count: number
  topic_statement: string
  topic_category: string | null
  topic_status: string
  ai_score: number | null
  ai_grade: string | null
}

export interface CategoryImpact {
  category: string
  total: number
  lawCount: number
  upvotes: number
  replies: number
}

export interface ImpactResponse {
  arguments: ImpactArgument[]
  totalArguments: number
  lawArguments: ImpactArgument[]      // args whose topics became law
  lawCount: number
  totalUpvotes: number
  totalReplies: number
  impactScore: number                 // composite score
  reachEstimate: number               // unique people engaged
  categoryImpact: CategoryImpact[]
  topReplyArgs: ImpactArgument[]      // top 5 by reply count
  topUpvotedLaw: ImpactArgument[]     // top 5 law-status args by upvotes
  milestones: ImpactMilestone[]
}

export interface ImpactMilestone {
  label: string
  value: string
  achieved: boolean
  icon: string
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch all arguments by this user
  const { data: rawArgs, error } = await supabase
    .from('topic_arguments')
    .select('id, topic_id, side, content, upvotes, created_at, ai_score, ai_grade')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch arguments' }, { status: 500 })
  }

  const args = rawArgs ?? []

  if (args.length === 0) {
    return NextResponse.json({
      arguments: [],
      totalArguments: 0,
      lawArguments: [],
      lawCount: 0,
      totalUpvotes: 0,
      totalReplies: 0,
      impactScore: 0,
      reachEstimate: 0,
      categoryImpact: [],
      topReplyArgs: [],
      topUpvotedLaw: [],
      milestones: buildMilestones(0, 0, 0, 0, 0),
    } satisfies ImpactResponse)
  }

  // 2. Fetch topic metadata
  const topicIds = Array.from(new Set(args.map((a) => a.topic_id)))
  const { data: topicsRaw } = await supabase
    .from('topics')
    .select('id, statement, category, status')
    .in('id', topicIds)
  const topicMap = new Map<string, { statement: string; category: string | null; status: string }>()
  for (const t of topicsRaw ?? []) {
    topicMap.set(t.id, { statement: t.statement, category: t.category, status: t.status })
  }

  // 3. Fetch reply counts per argument
  const argIds = args.map((a) => a.id)
  const { data: repliesRaw } = await supabase
    .from('argument_replies')
    .select('argument_id')
    .in('argument_id', argIds)
  const replyCountMap = new Map<string, number>()
  for (const r of repliesRaw ?? []) {
    replyCountMap.set(r.argument_id, (replyCountMap.get(r.argument_id) ?? 0) + 1)
  }

  // 4. Assemble enriched args
  const enriched: ImpactArgument[] = args.map((a) => {
    const topic = topicMap.get(a.topic_id)
    return {
      id: a.id,
      topic_id: a.topic_id,
      side: a.side as 'blue' | 'red',
      content: a.content,
      upvotes: a.upvotes,
      created_at: a.created_at,
      reply_count: replyCountMap.get(a.id) ?? 0,
      topic_statement: topic?.statement ?? 'Unknown topic',
      topic_category: topic?.category ?? null,
      topic_status: topic?.status ?? 'unknown',
      ai_score: (a as { ai_score?: number | null }).ai_score ?? null,
      ai_grade: (a as { ai_grade?: string | null }).ai_grade ?? null,
    }
  })

  // 5. Law arguments
  const lawArguments = enriched.filter((a) => a.topic_status === 'law')
  const lawCount = lawArguments.length

  // 6. Aggregate totals
  const totalUpvotes = enriched.reduce((s, a) => s + a.upvotes, 0)
  const totalReplies = enriched.reduce((s, a) => s + a.reply_count, 0)

  // 7. Impact score: law args are most valuable, then replies, then upvotes
  const impactScore = Math.round(
    lawCount * 50 +
    totalReplies * 3 +
    totalUpvotes * 0.5
  )

  // 8. Reach estimate (unique people exposed)
  const reachEstimate = Math.round(totalUpvotes * 1.4 + totalReplies * 2.5)

  // 9. Category impact breakdown
  const catMap = new Map<string, CategoryImpact>()
  for (const a of enriched) {
    const cat = a.topic_category ?? 'Other'
    const existing = catMap.get(cat) ?? {
      category: cat,
      total: 0,
      lawCount: 0,
      upvotes: 0,
      replies: 0,
    }
    existing.total++
    existing.upvotes += a.upvotes
    existing.replies += a.reply_count
    if (a.topic_status === 'law') existing.lawCount++
    catMap.set(cat, existing)
  }
  const categoryImpact: CategoryImpact[] = Array.from(catMap.values())
    .sort((a, b) => b.lawCount - a.lawCount || b.upvotes - a.upvotes)

  // 10. Top by replies
  const topReplyArgs = [...enriched]
    .sort((a, b) => b.reply_count - a.reply_count)
    .slice(0, 5)

  // 11. Top law args by upvotes
  const topUpvotedLaw = [...lawArguments]
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 5)

  // 12. Milestones
  const milestones = buildMilestones(
    enriched.length,
    lawCount,
    totalUpvotes,
    totalReplies,
    impactScore
  )

  return NextResponse.json({
    arguments: enriched,
    totalArguments: enriched.length,
    lawArguments,
    lawCount,
    totalUpvotes,
    totalReplies,
    impactScore,
    reachEstimate,
    categoryImpact,
    topReplyArgs,
    topUpvotedLaw,
    milestones,
  } satisfies ImpactResponse)
}

function buildMilestones(
  total: number,
  laws: number,
  upvotes: number,
  replies: number,
  score: number,
): ImpactMilestone[] {
  return [
    {
      label: 'First Argument',
      value: '1 argument written',
      achieved: total >= 1,
      icon: 'pen',
    },
    {
      label: 'Voice of the People',
      value: '10 arguments written',
      achieved: total >= 10,
      icon: 'mic',
    },
    {
      label: 'Civic Contributor',
      value: '25 arguments written',
      achieved: total >= 25,
      icon: 'scroll',
    },
    {
      label: 'Law Maker',
      value: 'Argued on a topic that became law',
      achieved: laws >= 1,
      icon: 'gavel',
    },
    {
      label: 'Twice Enacted',
      value: 'Argued on 3 topics that became law',
      achieved: laws >= 3,
      icon: 'stamp',
    },
    {
      label: 'Policy Architect',
      value: 'Argued on 10 topics that became law',
      achieved: laws >= 10,
      icon: 'building',
    },
    {
      label: 'Crowd Favorite',
      value: '100 total upvotes',
      achieved: upvotes >= 100,
      icon: 'thumbsup',
    },
    {
      label: 'Debate Magnet',
      value: '50 replies across arguments',
      achieved: replies >= 50,
      icon: 'messages',
    },
    {
      label: 'Civic Legend',
      value: '1000 impact score',
      achieved: score >= 1000,
      icon: 'star',
    },
  ]
}
