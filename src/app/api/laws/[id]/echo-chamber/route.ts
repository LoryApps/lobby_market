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
  cross_upvotes: number
  total_upvotes_given: number
  cross_ratio: number
  top_cross_argument: string
}

export interface EchoArgument {
  id: string
  content: string
  side: 'for' | 'against'
  upvotes: number
  cross_upvotes: number
  total_upvotes: number
  cross_ratio: number
  author_username: string | null
  author_display_name: string | null
}

export interface LawEchoChamberResponse {
  law: {
    id: string
    statement: string
    category: string | null
    topic_id: string
    blue_pct: number
    total_votes: number
    established_at: string | null
  }
  echo_index: number
  echo_label: 'Highly Polarised' | 'Moderately Siloed' | 'Mixed Engagement' | 'Healthy Cross-Aisle'
  consensus_type: 'Landslide' | 'Clear Majority' | 'Narrow Victory' | 'Contested'
  total_voters: number
  for_voters: number
  against_voters: number
  voters_with_upvotes: number
  cross_partisan_upvoters: number
  total_cross_upvotes: number
  total_same_side_upvotes: number
  bridge_builders: BridgeBuilder[]
  bridge_arguments: EchoArgument[]
  siloed_arguments: EchoArgument[]
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const lawId = params.id

  // ── 1. Fetch law metadata ─────────────────────────────────────────────────
  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, topic_id, blue_pct, total_votes, established_at')
    .eq('id', lawId)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const topicId = law.topic_id

  // ── 2. Fetch all votes on the source topic ────────────────────────────────
  const { data: votes } = await supabase
    .from('votes')
    .select('user_id, side')
    .eq('topic_id', topicId)

  const voteMap = new Map<string, 'for' | 'against'>()
  for (const v of votes ?? []) {
    voteMap.set(v.user_id, v.side === 'blue' ? 'for' : 'against')
  }

  // ── 3. Fetch all arguments on the source topic ────────────────────────────
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
  const argIds = (args ?? []).map(a => a.id)

  let argVotes: Array<{ argument_id: string; user_id: string }> = []
  if (argIds.length > 0) {
    const { data: av } = await supabase
      .from('topic_argument_votes')
      .select('argument_id, user_id')
      .in('argument_id', argIds)
    argVotes = av ?? []
  }

  // ── 5. Compute per-argument cross-partisan stats ──────────────────────────
  const argCrossUp = new Map<string, number>()
  const argTotalUp = new Map<string, number>()
  const userCross   = new Map<string, number>()
  const userTotal   = new Map<string, number>()
  const userCrossArgs = new Map<string, string>()

  for (const av of argVotes) {
    const argSide  = argMap.get(av.argument_id)?.side
    const voterSide = voteMap.get(av.user_id)
    if (!argSide || !voterSide) continue

    const isCross = argSide !== voterSide
    argTotalUp.set(av.argument_id, (argTotalUp.get(av.argument_id) ?? 0) + 1)
    if (isCross) {
      argCrossUp.set(av.argument_id, (argCrossUp.get(av.argument_id) ?? 0) + 1)
    }

    userTotal.set(av.user_id, (userTotal.get(av.user_id) ?? 0) + 1)
    if (isCross) {
      userCross.set(av.user_id, (userCross.get(av.user_id) ?? 0) + 1)
      if (!userCrossArgs.has(av.user_id)) {
        const argContent = argMap.get(av.argument_id)?.content ?? ''
        userCrossArgs.set(av.user_id, argContent.slice(0, 120))
      }
    }
  }

  // ── 6. Echo index ─────────────────────────────────────────────────────────
  let totalCross = 0
  let totalSameSide = 0
  for (const [argId, total] of argTotalUp) {
    const cross = argCrossUp.get(argId) ?? 0
    totalCross += cross
    totalSameSide += total - cross
  }

  const totalEngagements = totalCross + totalSameSide
  const echoIndex = totalEngagements > 0
    ? Math.round((totalSameSide / totalEngagements) * 100)
    : 50

  let echoLabel: LawEchoChamberResponse['echo_label']
  if (echoIndex >= 80) echoLabel = 'Highly Polarised'
  else if (echoIndex >= 60) echoLabel = 'Moderately Siloed'
  else if (echoIndex >= 40) echoLabel = 'Mixed Engagement'
  else echoLabel = 'Healthy Cross-Aisle'

  // ── 7. Consensus type from final vote split ───────────────────────────────
  const forPct = law.blue_pct ?? 50
  let consensusType: LawEchoChamberResponse['consensus_type']
  if (forPct >= 80)      consensusType = 'Landslide'
  else if (forPct >= 65) consensusType = 'Clear Majority'
  else if (forPct >= 55) consensusType = 'Narrow Victory'
  else                   consensusType = 'Contested'

  // ── 8. Bridge builders ────────────────────────────────────────────────────
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

  // ── 9. Bridge arguments ───────────────────────────────────────────────────
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

  // ── 10. Siloed arguments ──────────────────────────────────────────────────
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

  // ── 11. Final counts ──────────────────────────────────────────────────────
  const forVoters = [...voteMap.values()].filter(s => s === 'for').length
  const againstVoters = voteMap.size - forVoters
  const votersWithUpvotes = new Set(
    argVotes.map(av => av.user_id).filter(uid => voteMap.has(uid))
  ).size

  const response: LawEchoChamberResponse = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      topic_id: topicId,
      blue_pct: law.blue_pct ?? 50,
      total_votes: law.total_votes ?? 0,
      established_at: law.established_at,
    },
    echo_index: echoIndex,
    echo_label: echoLabel,
    consensus_type: consensusType,
    total_voters: voteMap.size,
    for_voters: forVoters,
    against_voters: againstVoters,
    voters_with_upvotes: votersWithUpvotes,
    cross_partisan_upvoters: bridgeUserIds.length,
    total_cross_upvotes: totalCross,
    total_same_side_upvotes: totalSameSide,
    bridge_builders: bridgeBuilders,
    bridge_arguments: bridgeArgs,
    siloed_arguments: siloedArgs,
  }

  return NextResponse.json(response)
}
