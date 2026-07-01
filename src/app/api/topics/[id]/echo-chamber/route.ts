import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BridgeBuilder {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  clout: number
  voted_side: 'for' | 'against'
  cross_upvotes: number          // upvotes given to the opposite side's arguments
  total_upvotes_given: number
  cross_ratio: number            // 0-1 fraction of upvotes that crossed partisan lines
  top_cross_argument: string     // excerpt of their most-upvoted cross-partisan argument
}

export interface EchoArgument {
  id: string
  content: string
  side: 'for' | 'against'
  upvotes: number
  cross_upvotes: number    // upvotes from the opposing side's voters
  total_upvotes: number
  cross_ratio: number      // share of upvotes that came from opposite-side voters
  author_username: string | null
  author_display_name: string | null
}

export interface EchoChamberResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  // Echo chamber index 0-100 (100 = perfect echo chamber, 0 = complete cross-aisle)
  echo_index: number
  // Label
  echo_label: 'Highly Polarised' | 'Moderately Siloed' | 'Mixed Engagement' | 'Healthy Cross-Aisle'
  // Raw counts
  total_voters: number
  for_voters: number
  against_voters: number
  voters_with_upvotes: number      // voters who also upvoted arguments
  cross_partisan_upvoters: number  // voters who upvoted at least 1 opposite-side argument
  total_cross_upvotes: number
  total_same_side_upvotes: number
  // Bridge builders — voters who crossed the aisle
  bridge_builders: BridgeBuilder[]
  // Most cross-partisan arguments (highest opposite-side upvote share)
  bridge_arguments: EchoArgument[]
  // Siloed arguments (arguments receiving almost no cross-partisan engagement)
  siloed_arguments: EchoArgument[]
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const topicId = params.id

  // ── 1. Fetch topic metadata ───────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', topicId)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // ── 2. Fetch all votes on this topic ──────────────────────────────────────
  const { data: votes } = await supabase
    .from('votes')
    .select('user_id, side')
    .eq('topic_id', topicId)

  const voteMap = new Map<string, 'for' | 'against'>()
  for (const v of votes ?? []) {
    voteMap.set(v.user_id, v.side === 'blue' ? 'for' : 'against')
  }

  // ── 3. Fetch all arguments on this topic ──────────────────────────────────
  const { data: args } = await supabase
    .from('topic_arguments')
    .select(`
      id, content, side, upvotes,
      author:profiles!user_id(id, username, display_name, avatar_url, clout)
    `)
    .eq('topic_id', topicId)
    .order('upvotes', { ascending: false })
    .limit(200)

  const argMap = new Map<string, { side: 'for' | 'against'; content: string }>()
  for (const a of args ?? []) {
    argMap.set(a.id, {
      side: a.side === 'blue' ? 'for' : 'against',
      content: a.content,
    })
  }

  // ── 4. Fetch all argument upvotes on this topic ───────────────────────────
  // We need: who upvoted which argument
  const argIds = (args ?? []).map(a => a.id)

  let argVotes: Array<{ argument_id: string; user_id: string }> = []
  if (argIds.length > 0) {
    const { data: av } = await supabase
      .from('topic_argument_votes')
      .select('argument_id, user_id')
      .in('argument_id', argIds)
    argVotes = av ?? []
  }

  // ── 5. Compute per-user cross-partisan stats ──────────────────────────────
  // For each voter, tally: how many of their argument-upvotes went to same/opposite side?

  // Per-argument: how many cross-side vs same-side upvotes?
  const argCrossUp = new Map<string, number>()   // argument_id → cross upvotes
  const argTotalUp = new Map<string, number>()   // argument_id → all upvotes from voters

  // Per-user: cross upvotes count + total upvotes count
  const userCross   = new Map<string, number>()
  const userTotal   = new Map<string, number>()
  const userCrossArgs = new Map<string, string>() // user → best cross arg excerpt

  for (const av of argVotes) {
    const argSide = argMap.get(av.argument_id)?.side
    const voterSide = voteMap.get(av.user_id)
    if (!argSide || !voterSide) continue   // upvoter didn't vote on the topic

    const isCross = argSide !== voterSide
    argTotalUp.set(av.argument_id, (argTotalUp.get(av.argument_id) ?? 0) + 1)
    if (isCross) {
      argCrossUp.set(av.argument_id, (argCrossUp.get(av.argument_id) ?? 0) + 1)
    }

    userTotal.set(av.user_id, (userTotal.get(av.user_id) ?? 0) + 1)
    if (isCross) {
      userCross.set(av.user_id, (userCross.get(av.user_id) ?? 0) + 1)
      // Track a sample cross-partisan argument for this user
      if (!userCrossArgs.has(av.user_id)) {
        const argContent = argMap.get(av.argument_id)?.content ?? ''
        userCrossArgs.set(av.user_id, argContent.slice(0, 120))
      }
    }
  }

  // ── 6. Overall echo index ─────────────────────────────────────────────────
  let totalCross = 0
  let totalSameSide = 0
  for (const [argId, total] of argTotalUp) {
    const cross = argCrossUp.get(argId) ?? 0
    totalCross += cross
    totalSameSide += total - cross
  }

  const totalEngagements = totalCross + totalSameSide
  // Echo index: 0 = all cross-aisle, 100 = pure echo chamber
  const echoIndex = totalEngagements > 0
    ? Math.round(((totalSameSide) / totalEngagements) * 100)
    : 50

  let echoLabel: EchoChamberResponse['echo_label']
  if (echoIndex >= 80) echoLabel = 'Highly Polarised'
  else if (echoIndex >= 60) echoLabel = 'Moderately Siloed'
  else if (echoIndex >= 40) echoLabel = 'Mixed Engagement'
  else echoLabel = 'Healthy Cross-Aisle'

  // ── 7. Bridge builders ────────────────────────────────────────────────────
  // Fetch profile data for bridge builders (users with at least 1 cross upvote)
  const bridgeUserIds = [...userCross.entries()]
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([id]) => id)

  let bridgeProfiles: Array<{
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    clout: number
  }> = []

  if (bridgeUserIds.length > 0) {
    const { data: bp } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, clout')
      .in('id', bridgeUserIds)
    bridgeProfiles = bp ?? []
  }

  const bridgeBuilders: BridgeBuilder[] = bridgeProfiles
    .map(p => {
      const cross = userCross.get(p.id) ?? 0
      const total = userTotal.get(p.id) ?? 1
      return {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        clout: p.clout ?? 0,
        voted_side: voteMap.get(p.id) ?? 'for',
        cross_upvotes: cross,
        total_upvotes_given: total,
        cross_ratio: Math.round((cross / total) * 100) / 100,
        top_cross_argument: userCrossArgs.get(p.id) ?? '',
      }
    })
    .sort((a, b) => b.cross_upvotes - a.cross_upvotes)

  // ── 8. Bridge arguments (most cross-aisle engagement) ────────────────────
  const bridgeArgs: EchoArgument[] = (args ?? [])
    .map(a => {
      const argSide: 'for' | 'against' = a.side === 'blue' ? 'for' : 'against'
      const cross = argCrossUp.get(a.id) ?? 0
      const total = argTotalUp.get(a.id) ?? 0
      const author = Array.isArray(a.author) ? a.author[0] : a.author
      return {
        id: a.id,
        content: a.content,
        side: argSide,
        upvotes: a.upvotes,
        cross_upvotes: cross,
        total_upvotes: total,
        cross_ratio: total > 0 ? Math.round((cross / total) * 100) / 100 : 0,
        author_username: author?.username ?? null,
        author_display_name: author?.display_name ?? null,
      }
    })
    .filter(a => a.total_upvotes >= 2)
    .sort((a, b) => b.cross_ratio - a.cross_ratio || b.cross_upvotes - a.cross_upvotes)
    .slice(0, 6)

  // ── 9. Siloed arguments (lowest cross-partisan share, but popular) ────────
  const siloedArgs: EchoArgument[] = (args ?? [])
    .map(a => {
      const argSide: 'for' | 'against' = a.side === 'blue' ? 'for' : 'against'
      const cross = argCrossUp.get(a.id) ?? 0
      const total = argTotalUp.get(a.id) ?? 0
      const author = Array.isArray(a.author) ? a.author[0] : a.author
      return {
        id: a.id,
        content: a.content,
        side: argSide,
        upvotes: a.upvotes,
        cross_upvotes: cross,
        total_upvotes: total,
        cross_ratio: total > 0 ? Math.round((cross / total) * 100) / 100 : 0,
        author_username: author?.username ?? null,
        author_display_name: author?.display_name ?? null,
      }
    })
    .filter(a => a.total_upvotes >= 3)
    .sort((a, b) => a.cross_ratio - b.cross_ratio || b.upvotes - a.upvotes)
    .slice(0, 4)

  // ── 10. Counts ────────────────────────────────────────────────────────────
  const forVoters = [...voteMap.values()].filter(s => s === 'for').length
  const againstVoters = voteMap.size - forVoters
  const votersWithUpvotes = new Set(argVotes.map(av => av.user_id).filter(uid => voteMap.has(uid))).size
  const crossPartisanUpvoters = bridgeUserIds.length

  const response: EchoChamberResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
    },
    echo_index: echoIndex,
    echo_label: echoLabel,
    total_voters: voteMap.size,
    for_voters: forVoters,
    against_voters: againstVoters,
    voters_with_upvotes: votersWithUpvotes,
    cross_partisan_upvoters: crossPartisanUpvoters,
    total_cross_upvotes: totalCross,
    total_same_side_upvotes: totalSameSide,
    bridge_builders: bridgeBuilders,
    bridge_arguments: bridgeArgs,
    siloed_arguments: siloedArgs,
  }

  return NextResponse.json(response)
}
