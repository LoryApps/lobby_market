import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── Types ──────────────────────────────────────────────────────────────────────

export type SideFilter = 'all' | 'for' | 'against'
export type Period = 'week' | 'month' | 'all'
export type SortMode = 'influence' | 'cross_partisan' | 'reactions'

export interface InfluentialArgument {
  id: string
  topic_id: string
  user_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  source_url: string | null
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  // Influence metrics
  cross_partisan_count: number
  reaction_insightful: number
  reaction_compelling: number
  reaction_balanced: number
  influence_score: number
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
}

export interface InfluentialResponse {
  arguments: InfluentialArgument[]
  total: number
  categories: string[]
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PERIOD_CUTOFFS: Record<Period, string | null> = {
  week: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  month: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  all: null,
}

const LIMIT = 30

// ── Handler ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)

    const period = (searchParams.get('period') ?? 'all') as Period
    const side = (searchParams.get('side') ?? 'all') as SideFilter
    const category = searchParams.get('category') ?? 'all'
    const sort = (searchParams.get('sort') ?? 'influence') as SortMode
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10))
    const cutoff = PERIOD_CUTOFFS[period] ?? null

    // ── Step 1: fetch arguments with reaction counts ──────────────────────────
    // We query topic_arguments and join argument_reactions to get reaction counts.
    // Cross-partisan count requires joining topic_argument_votes → votes — done
    // as a subquery for performance.

    let query = supabase
      .from('topic_arguments')
      .select(`
        id,
        topic_id,
        user_id,
        side,
        content,
        upvotes,
        source_url,
        ai_score,
        ai_grade,
        created_at,
        author:profiles!user_id ( id, username, display_name, avatar_url, role ),
        topic:topics!topic_id ( id, statement, category, status, blue_pct, total_votes )
      `)
      .gte('upvotes', 1)

    if (cutoff) {
      query = query.gte('created_at', cutoff)
    }
    if (side === 'for') {
      query = query.eq('side', 'blue')
    } else if (side === 'against') {
      query = query.eq('side', 'red')
    }

    // Category filter — join via topics
    // Supabase doesn't support filter on embedded foreign table in this SDK version,
    // so we filter after fetch for category.

    const { data: rawArgs, error: argsErr } = await query
      .order('upvotes', { ascending: false })
      .limit(500) // fetch a large pool to compute influence ranking

    if (argsErr || !rawArgs) {
      return NextResponse.json({ arguments: [], total: 0, categories: [] }, { status: 200 })
    }

    // Category filter client-side
    const getTopicCategory = (a: typeof rawArgs[0]): string | null => {
      const t = Array.isArray(a.topic) ? a.topic[0] : a.topic
      return (t as { category?: string | null } | null)?.category ?? null
    }

    const filteredArgs = category === 'all'
      ? rawArgs
      : rawArgs.filter((a) => getTopicCategory(a) === category)

    // ── Step 2: fetch reaction counts for these arguments ─────────────────────
    const argIds = filteredArgs.map((a) => a.id)

    const { data: reactions } = await supabase
      .from('argument_reactions')
      .select('argument_id, reaction')
      .in('argument_id', argIds.slice(0, 500))

    // Build reaction maps
    const reactionMap = new Map<string, { insightful: number; compelling: number; balanced: number }>()
    for (const r of reactions ?? []) {
      if (!reactionMap.has(r.argument_id)) {
        reactionMap.set(r.argument_id, { insightful: 0, compelling: 0, balanced: 0 })
      }
      const entry = reactionMap.get(r.argument_id)!
      if (r.reaction === 'insightful') entry.insightful++
      else if (r.reaction === 'compelling') entry.compelling++
      else if (r.reaction === 'balanced') entry.balanced++
    }

    // ── Step 3: fetch cross-partisan upvote counts ────────────────────────────
    // For each argument, count upvoters who voted on the OPPOSITE side of the topic.
    // argument side=blue → opposite = user voted red; side=red → user voted blue.

    const { data: crossVotes } = await supabase
      .from('topic_argument_votes')
      .select('argument_id, user_id')
      .in('argument_id', argIds.slice(0, 500))

    // We need to know what side each voter is on for each topic.
    // Collect all (topic_id, user_id) pairs we need to look up.
    const voteCheck = new Map<string, string>() // "userId:topicId" → side

    if (crossVotes && crossVotes.length > 0) {
      // Build list of topic_ids from our args
      const argSideMap = new Map<string, { side: string; topic_id: string }>()
      for (const a of filteredArgs) {
        argSideMap.set(a.id, { side: a.side as string, topic_id: a.topic_id })
      }

      // Get unique (user_id, topic_id) pairs from the upvoters
      const voteCheckPairs = crossVotes
        .map((cv) => {
          const argInfo = argSideMap.get(cv.argument_id)
          return argInfo ? { user_id: cv.user_id, topic_id: argInfo.topic_id } : null
        })
        .filter((x): x is { user_id: string; topic_id: string } => x !== null)

      // Deduplicate
      const uniquePairs = Array.from(
        new Map(voteCheckPairs.map((p) => [`${p.user_id}:${p.topic_id}`, p])).values(),
      )

      if (uniquePairs.length > 0) {
        // Fetch votes in batches — get the side of each (user, topic) pair
        const topicIds = [...new Set(uniquePairs.map((p) => p.topic_id))]
        const userIds = [...new Set(uniquePairs.map((p) => p.user_id))]

        const { data: voteRecords } = await supabase
          .from('votes')
          .select('user_id, topic_id, side')
          .in('topic_id', topicIds.slice(0, 200))
          .in('user_id', userIds.slice(0, 500))

        for (const vr of voteRecords ?? []) {
          voteCheck.set(`${vr.user_id}:${vr.topic_id}`, vr.side)
        }
      }
    }

    // Build cross_partisan_count per argument
    const crossPartisanMap = new Map<string, number>()
    const argSideMap2 = new Map<string, { side: string; topic_id: string }>()
    for (const a of filteredArgs) {
      argSideMap2.set(a.id, { side: a.side as string, topic_id: a.topic_id })
    }
    for (const cv of crossVotes ?? []) {
      const argInfo = argSideMap2.get(cv.argument_id)
      if (!argInfo) continue
      const voterSide = voteCheck.get(`${cv.user_id}:${argInfo.topic_id}`)
      if (!voterSide) continue
      // Cross-partisan = voter's topic vote is opposite to argument's side
      const isCrossPartisan =
        (argInfo.side === 'blue' && voterSide === 'red') ||
        (argInfo.side === 'red' && voterSide === 'blue')
      if (isCrossPartisan) {
        crossPartisanMap.set(cv.argument_id, (crossPartisanMap.get(cv.argument_id) ?? 0) + 1)
      }
    }

    // ── Step 4: compute influence score and merge ─────────────────────────────

    const enriched: InfluentialArgument[] = filteredArgs.map((a) => {
      const reactions = reactionMap.get(a.id) ?? { insightful: 0, compelling: 0, balanced: 0 }
      const crossPartisan = crossPartisanMap.get(a.id) ?? 0
      const aiScore = (a.ai_score as number | null) ?? 5

      // Influence score formula:
      // cross-partisan upvotes × 4 (strongest signal: opposite side found it compelling)
      // balanced reactions × 3 (explicitly flagged as fair to both sides)
      // insightful reactions × 2 ("shifted my thinking")
      // compelling reactions × 1 ("strong point")
      // raw upvotes × 0.5 (base engagement)
      // AI score × 0.3 (quality baseline)
      const influence_score =
        crossPartisan * 4 +
        reactions.balanced * 3 +
        reactions.insightful * 2 +
        reactions.compelling * 1 +
        (a.upvotes as number) * 0.5 +
        aiScore * 0.3

      return {
        id: a.id,
        topic_id: a.topic_id,
        user_id: a.user_id,
        side: a.side as 'blue' | 'red',
        content: a.content,
        upvotes: a.upvotes as number,
        source_url: a.source_url as string | null,
        ai_score: a.ai_score as number | null,
        ai_grade: a.ai_grade as string | null,
        created_at: a.created_at,
        cross_partisan_count: crossPartisan,
        reaction_insightful: reactions.insightful,
        reaction_compelling: reactions.compelling,
        reaction_balanced: reactions.balanced,
        influence_score,
        author: Array.isArray(a.author) ? (a.author[0] ?? null) : (a.author as InfluentialArgument['author']),
        topic: Array.isArray(a.topic) ? (a.topic[0] ?? null) : (a.topic as InfluentialArgument['topic']),
      }
    })

    // Sort
    if (sort === 'cross_partisan') {
      enriched.sort((a, b) => b.cross_partisan_count - a.cross_partisan_count || b.upvotes - a.upvotes)
    } else if (sort === 'reactions') {
      enriched.sort(
        (a, b) =>
          (b.reaction_insightful + b.reaction_compelling + b.reaction_balanced) -
          (a.reaction_insightful + a.reaction_compelling + a.reaction_balanced) ||
          b.upvotes - a.upvotes,
      )
    } else {
      // Default: influence score
      enriched.sort((a, b) => b.influence_score - a.influence_score)
    }

    // Filter: must have some influence signal (score > 1)
    const withSignal = enriched.filter((a) => a.influence_score > 1)

    const total = withSignal.length
    const page = withSignal.slice(offset, offset + LIMIT)

    // Collect available categories from raw args (before influence filter)
    const catSet = new Set<string>()
    for (const a of enriched) {
      const cat = a.topic?.category
      if (cat) catSet.add(cat)
    }
    const categories = [...catSet].sort()

    const response: InfluentialResponse = { arguments: page, total, categories }
    return NextResponse.json(response)
  } catch (err) {
    console.error('[/api/arguments/influential]', err)
    return NextResponse.json({ arguments: [], total: 0, categories: [] }, { status: 200 })
  }
}
