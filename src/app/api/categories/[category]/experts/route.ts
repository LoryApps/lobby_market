import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const CANONICAL_CATEGORIES: Record<string, string> = {
  economics: 'Economics',
  politics: 'Politics',
  technology: 'Technology',
  science: 'Science',
  ethics: 'Ethics',
  philosophy: 'Philosophy',
  culture: 'Culture',
  health: 'Health',
  environment: 'Environment',
  education: 'Education',
}

export interface CategoryExpert {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  total_upvotes: number
  argument_count: number
  avg_ai_score: number | null
  best_argument: string | null
  best_argument_id: string | null
  best_argument_topic: string | null
  best_argument_upvotes: number
  law_count: number
}

export interface CategoryExpertsResponse {
  category: string
  experts: CategoryExpert[]
  total_arguments: number
  total_votes_in_category: number
}

export async function GET(
  _req: Request,
  { params }: { params: { category: string } }
) {
  const canonical = CANONICAL_CATEGORIES[params.category.toLowerCase()]
  if (!canonical) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 404 })
  }

  try {
    const supabase = await createClient()

    // Get all topic IDs in this category
    const { data: topicsInCat } = await supabase
      .from('topics')
      .select('id, total_votes, status')
      .eq('category', canonical)

    const topicIds = (topicsInCat ?? []).map((t) => t.id)
    const totalVotes = (topicsInCat ?? []).reduce((sum, t) => sum + (t.total_votes ?? 0), 0)
    const lawTopicIds = new Set(
      (topicsInCat ?? []).filter((t) => t.status === 'law').map((t) => t.id)
    )

    if (topicIds.length === 0) {
      return NextResponse.json({
        category: canonical,
        experts: [],
        total_arguments: 0,
        total_votes_in_category: 0,
      } satisfies CategoryExpertsResponse)
    }

    // Get all arguments in those topics
    const { data: rawArgs } = await supabase
      .from('topic_arguments')
      .select(`
        id,
        user_id,
        content,
        upvotes,
        ai_score,
        topic_id,
        profiles!inner (
          username,
          display_name,
          avatar_url,
          role,
          clout
        )
      `)
      .in('topic_id', topicIds.slice(0, 500))
      .order('upvotes', { ascending: false })

    type RawArg = {
      id: string
      user_id: string
      content: string
      upvotes: number
      ai_score: number | null
      topic_id: string
      profiles: {
        username: string
        display_name: string | null
        avatar_url: string | null
        role: string
        clout: number
      } | null
    }

    const args = ((rawArgs ?? []) as RawArg[]).filter((a) => a.profiles !== null)

    // Aggregate per user
    const userMap = new Map<string, {
      user_id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
      clout: number
      total_upvotes: number
      argument_count: number
      ai_scores: number[]
      best_argument: string | null
      best_argument_id: string | null
      best_argument_topic_id: string | null
      best_argument_upvotes: number
      topics_covered: Set<string>
    }>()

    for (const arg of args) {
      if (!arg.profiles) continue
      const p = arg.profiles
      const existing = userMap.get(arg.user_id)
      if (!existing) {
        userMap.set(arg.user_id, {
          user_id: arg.user_id,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          role: p.role,
          clout: p.clout,
          total_upvotes: arg.upvotes,
          argument_count: 1,
          ai_scores: arg.ai_score !== null ? [arg.ai_score] : [],
          best_argument: arg.content,
          best_argument_id: arg.id,
          best_argument_topic_id: arg.topic_id,
          best_argument_upvotes: arg.upvotes,
          topics_covered: new Set([arg.topic_id]),
        })
      } else {
        existing.total_upvotes += arg.upvotes
        existing.argument_count += 1
        if (arg.ai_score !== null) existing.ai_scores.push(arg.ai_score)
        existing.topics_covered.add(arg.topic_id)
        if (arg.upvotes > existing.best_argument_upvotes) {
          existing.best_argument = arg.content
          existing.best_argument_id = arg.id
          existing.best_argument_topic_id = arg.topic_id
          existing.best_argument_upvotes = arg.upvotes
        }
      }
    }

    // Fetch topic statements for best arguments
    const bestTopicIds = Array.from(
      new Set(Array.from(userMap.values()).map((u) => u.best_argument_topic_id).filter(Boolean))
    ) as string[]

    const topicStatements = new Map<string, string>()
    if (bestTopicIds.length > 0) {
      const { data: topicRows } = await supabase
        .from('topics')
        .select('id, statement')
        .in('id', bestTopicIds)
      for (const t of topicRows ?? []) {
        topicStatements.set(t.id, t.statement)
      }
    }

    // Count laws per user (topics that became law where this user voted FOR)
    // We approximate by counting topics they argued on that are now law
    const lawCountByUser = new Map<string, number>()
    for (const arg of args) {
      if (lawTopicIds.has(arg.topic_id)) {
        lawCountByUser.set(arg.user_id, (lawCountByUser.get(arg.user_id) ?? 0) + 1)
      }
    }

    // Compute composite score: upvotes * 0.6 + avg_ai_score * 0.3 + log(arg_count) * 0.1
    const scored = Array.from(userMap.values()).map((u) => {
      const avgAi = u.ai_scores.length > 0
        ? u.ai_scores.reduce((s, v) => s + v, 0) / u.ai_scores.length
        : null
      const score =
        u.total_upvotes * 0.6 +
        (avgAi ?? 50) * 0.3 +
        Math.log1p(u.argument_count) * 10

      return {
        ...u,
        avg_ai_score: avgAi !== null ? Math.round(avgAi) : null,
        law_count: lawCountByUser.get(u.user_id) ?? 0,
        best_argument_topic: u.best_argument_topic_id
          ? (topicStatements.get(u.best_argument_topic_id) ?? null)
          : null,
        _score: score,
      }
    })

    scored.sort((a, b) => b._score - a._score)
    const top = scored.slice(0, 12)

    const experts: CategoryExpert[] = top.map((u) => ({
      user_id: u.user_id,
      username: u.username,
      display_name: u.display_name,
      avatar_url: u.avatar_url,
      role: u.role,
      clout: u.clout,
      total_upvotes: u.total_upvotes,
      argument_count: u.argument_count,
      avg_ai_score: u.avg_ai_score,
      best_argument: u.best_argument
        ? u.best_argument.slice(0, 180) + (u.best_argument.length > 180 ? '…' : '')
        : null,
      best_argument_id: u.best_argument_id,
      best_argument_topic: u.best_argument_topic,
      best_argument_upvotes: u.best_argument_upvotes,
      law_count: u.law_count,
    }))

    return NextResponse.json({
      category: canonical,
      experts,
      total_arguments: args.length,
      total_votes_in_category: totalVotes,
    } satisfies CategoryExpertsResponse)
  } catch (err) {
    console.error('[CategoryExperts] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
