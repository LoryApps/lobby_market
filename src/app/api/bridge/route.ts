import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BridgeTopic {
  id: string
  statement: string
  category: string
  status: string
  blue_pct: number
  total_votes: number
  user_side: 'blue' | 'red'
  // This is a "bridge topic" because the user voted with the minority
  // in their typical lean for this category, OR the category lean was
  // opposite to the platform average
  bridge_reason: 'crossed_own_lean' | 'crossed_platform_lean' | 'minority_vote'
  agreement_pct: number // How "surprising" this agreement is (0-100; higher = more surprising)
}

export interface BridgeCategory {
  category: string
  user_for_pct: number       // % of user's votes FOR in this category
  platform_for_pct: number   // platform-wide FOR% in this category
  deviation: number          // how much user's lean differs from platform
  bridge_votes: number       // votes in this category that crossed the user's own lean
  total_votes: number
}

export interface BridgeCitizen {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  overall_agreement_pct: number  // % topics where they vote the same side as user
  bridge_agreements: number      // topics where they agree but user voted minority
  dominant_lean: 'for' | 'against' | 'mixed'
}

export interface BridgeData {
  totalVotes: number
  bridgeScore: number         // 0–100: how often you cross partisan lines
  bridgeTopics: BridgeTopic[] // Topics where you voted unexpectedly
  byCategory: BridgeCategory[]
  bridgeCitizens: BridgeCitizen[]
  mostBridgedCategory: string | null
  label: 'Partisan' | 'Occasional Bridge' | 'Bridge Builder' | 'Consensus Seeker' | 'Unifier'
  labelColor: string
  labelDesc: string
  minVotesRequired: number
  summary: {
    topicsAgreedWithOpponents: number
    categoriesWithBridgeMoments: number
    averageSurpriseScore: number
  }
}

const ALL_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const MIN_VOTES = 5

function toLabelMeta(score: number): { label: BridgeData['label']; color: string; desc: string } {
  if (score < 15) return {
    label: 'Partisan',
    color: 'text-against-400',
    desc: 'Your votes closely follow your established positions. You rarely cross your typical category lean — but the occasional bridge moment matters.',
  }
  if (score < 30) return {
    label: 'Occasional Bridge',
    color: 'text-gold',
    desc: 'You sometimes vote against your usual lean, showing genuine openness to the strongest argument. These moments of common ground are valuable.',
  }
  if (score < 50) return {
    label: 'Bridge Builder',
    color: 'text-for-400',
    desc: 'You regularly find common ground with those on the other side. Your votes reflect a willingness to follow evidence over ideology.',
  }
  if (score < 70) return {
    label: 'Consensus Seeker',
    color: 'text-emerald',
    desc: 'You actively seek common ground and frequently vote with the unexpected side when the argument is strong. A civic asset.',
  }
  return {
    label: 'Unifier',
    color: 'text-purple',
    desc: 'Exceptional bridge-building. Your voting record transcends partisan lines — you evaluate each issue on its merits, not its political tribe.',
  }
}

function emptyData(): BridgeData {
  return {
    totalVotes: 0,
    bridgeScore: 0,
    bridgeTopics: [],
    byCategory: [],
    bridgeCitizens: [],
    mostBridgedCategory: null,
    label: 'Partisan',
    labelColor: 'text-against-400',
    labelDesc: 'Vote on more topics to build your civic bridge profile.',
    minVotesRequired: MIN_VOTES,
    summary: { topicsAgreedWithOpponents: 0, categoriesWithBridgeMoments: 0, averageSurpriseScore: 0 },
  }
}

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1. Fetch user's votes with topic metadata ─────────────────────────────
  const { data: voteRows, error: voteErr } = await supabase
    .from('votes')
    .select('side, topic_id')
    .eq('user_id', user.id)

  if (voteErr || !voteRows || voteRows.length < MIN_VOTES) {
    return NextResponse.json(emptyData())
  }

  const topicIds = [...new Set(voteRows.map((v) => v.topic_id))]

  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, status, total_votes')
    .in('id', topicIds)

  if (!topicRows || topicRows.length === 0) {
    return NextResponse.json(emptyData())
  }

  const topicMap = new Map(topicRows.map((t) => [t.id, t]))

  // ── 2. Compute per-category lean ─────────────────────────────────────────
  type CatAgg = { forVotes: number; total: number }
  const catMap = new Map<string, CatAgg>()

  for (const vote of voteRows) {
    const t = topicMap.get(vote.topic_id)
    if (!t || !t.category) continue
    const agg = catMap.get(t.category) ?? { forVotes: 0, total: 0 }
    agg.total++
    if (vote.side === 'blue') agg.forVotes++
    catMap.set(t.category, agg)
  }

  // User's FOR% per category — their "expected lean"
  const userForByCat: Record<string, number> = {}
  for (const [cat, agg] of catMap.entries()) {
    userForByCat[cat] = agg.total > 0 ? (agg.forVotes / agg.total) * 100 : 50
  }

  // ── 3. Platform-wide FOR% per category ───────────────────────────────────
  // Approximate from topics the user has seen; good enough for bridge detection
  type CatPlatAgg = { sum: number; count: number }
  const platForMap = new Map<string, CatPlatAgg>()
  for (const t of topicRows) {
    if (!t.category || t.blue_pct === null) continue
    const agg = platForMap.get(t.category) ?? { sum: 0, count: 0 }
    agg.sum += t.blue_pct
    agg.count++
    platForMap.set(t.category, agg)
  }

  const platformForByCat: Record<string, number> = {}
  for (const [cat, agg] of platForMap.entries()) {
    platformForByCat[cat] = agg.count > 0 ? agg.sum / agg.count : 50
  }

  // ── 4. Identify bridge votes ──────────────────────────────────────────────
  const bridgeTopicsRaw: BridgeTopic[] = []
  let bridgeVoteCount = 0

  for (const vote of voteRows) {
    const t = topicMap.get(vote.topic_id)
    if (!t || !t.category) continue

    const userForPct = userForByCat[t.category] ?? 50
    const platForPct = platformForByCat[t.category] ?? 50
    const votedFor = vote.side === 'blue'

    // User's typical lean in this category
    const userLeanFor = userForPct >= 50
    // Platform lean in this category
    const platLeanFor = platForPct >= 55 // need a clear majority

    // Bridge condition 1: user voted AGAINST their own typical lean in this category
    const crossedOwnLean = votedFor !== userLeanFor && Math.abs(userForPct - 50) > 15

    // Bridge condition 2: user voted AGAINST the platform lean
    const crossedPlatformLean = platLeanFor !== votedFor && Math.abs(platForPct - 50) > 15

    // Bridge condition 3: user voted with the minority (their side got < 40%)
    const topicForPct = t.blue_pct ?? 50
    const inMinority = votedFor
      ? topicForPct < 40   // voted FOR but it lost
      : topicForPct > 60   // voted AGAINST but FOR won

    if (!crossedOwnLean && !crossedPlatformLean && !inMinority) continue

    bridgeVoteCount++

    const bridgeReason: BridgeTopic['bridge_reason'] =
      crossedOwnLean ? 'crossed_own_lean'
      : crossedPlatformLean ? 'crossed_platform_lean'
      : 'minority_vote'

    // Surprise score: how unexpected was this vote?
    // Higher if more distant from user's usual lean
    const ownLeanDistance = Math.abs(userForPct - (votedFor ? 100 : 0))
    const platDistance = Math.abs(platForPct - (votedFor ? 100 : 0))
    const agreementPct = Math.round(Math.max(ownLeanDistance, platDistance))

    bridgeTopicsRaw.push({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      user_side: vote.side as 'blue' | 'red',
      bridge_reason: bridgeReason,
      agreement_pct: agreementPct,
    })
  }

  // Sort by surprise score descending, keep top 12
  bridgeTopicsRaw.sort((a, b) => b.agreement_pct - a.agreement_pct)
  const bridgeTopics = bridgeTopicsRaw.slice(0, 12)

  // ── 5. Bridge score (0–100) ───────────────────────────────────────────────
  const totalVotes = voteRows.length
  const bridgeScore = Math.round((bridgeVoteCount / totalVotes) * 100)

  // ── 6. Per-category breakdown ─────────────────────────────────────────────
  const catBridgeCounts = new Map<string, number>()
  for (const bt of bridgeTopicsRaw) {
    catBridgeCounts.set(bt.category, (catBridgeCounts.get(bt.category) ?? 0) + 1)
  }

  const byCategory: BridgeCategory[] = ALL_CATEGORIES
    .filter((cat) => catMap.has(cat))
    .map((cat) => {
      const agg = catMap.get(cat) ?? { forVotes: 0, total: 0 }
      const userFor = userForByCat[cat] ?? 50
      const platFor = platformForByCat[cat] ?? 50
      return {
        category: cat,
        user_for_pct: Math.round(userFor),
        platform_for_pct: Math.round(platFor),
        deviation: Math.round(Math.abs(userFor - platFor)),
        bridge_votes: catBridgeCounts.get(cat) ?? 0,
        total_votes: agg.total,
      }
    })
    .filter((c) => c.total_votes > 0)
    .sort((a, b) => b.bridge_votes - a.bridge_votes)

  const mostBridgedCategory = byCategory.find((c) => c.bridge_votes > 0)?.category ?? null

  // ── 7. Bridge citizens ────────────────────────────────────────────────────
  // Find other users who voted the same way as the current user on bridge topics
  // Only do this if we have bridge topics to work with
  const bridgeCitizens: BridgeCitizen[] = []

  if (bridgeTopics.length >= 2) {
    const bridgeTopicIds = bridgeTopics.map((bt) => bt.id)

    // Get other users' votes on the same bridge topics
    const { data: otherVotes } = await supabase
      .from('votes')
      .select('user_id, topic_id, side')
      .in('topic_id', bridgeTopicIds)
      .neq('user_id', user.id)
      .limit(500)

    if (otherVotes && otherVotes.length > 0) {
      // Build user vote map
      const userVoteMap = new Map(bridgeTopics.map((bt) => [bt.id, bt.user_side]))

      // Compute agreement per other user
      type UserAgg = { agree: number; total: number; oppAgree: number }
      const uMap = new Map<string, UserAgg>()

      for (const ov of otherVotes) {
        const agg = uMap.get(ov.user_id) ?? { agree: 0, total: 0, oppAgree: 0 }
        agg.total++
        if (ov.side === userVoteMap.get(ov.topic_id)) {
          agg.agree++
          agg.oppAgree++
        }
        uMap.set(ov.user_id, agg)
      }

      // Filter to users with ≥2 bridge topic agreements, sort by agreement count
      const candidateIds = Array.from(uMap.entries())
        .filter(([, agg]) => agg.oppAgree >= 2 && agg.total >= 2)
        .sort((a, b) => b[1].oppAgree - a[1].oppAgree)
        .slice(0, 6)
        .map(([uid]) => uid)

      if (candidateIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role, clout')
          .in('id', candidateIds)

        if (profiles) {
          // Fetch each candidate's overall voting pattern to determine their lean
          for (const p of profiles.slice(0, 6)) {
            const agg = uMap.get(p.id)
            if (!agg) continue

            bridgeCitizens.push({
              id: p.id,
              username: p.username,
              display_name: p.display_name,
              avatar_url: p.avatar_url,
              role: p.role,
              clout: p.clout ?? 0,
              overall_agreement_pct: Math.round((agg.agree / agg.total) * 100),
              bridge_agreements: agg.oppAgree,
              dominant_lean: 'mixed',
            })
          }
        }
      }
    }
  }

  // ── 8. Assemble response ─────────────────────────────────────────────────
  const { label, color: labelColor, desc: labelDesc } = toLabelMeta(bridgeScore)

  const categoriesWithBridgeMoments = byCategory.filter((c) => c.bridge_votes > 0).length
  const avgSurprise = bridgeTopics.length > 0
    ? Math.round(bridgeTopics.reduce((s, t) => s + t.agreement_pct, 0) / bridgeTopics.length)
    : 0

  const result: BridgeData = {
    totalVotes,
    bridgeScore,
    bridgeTopics,
    byCategory,
    bridgeCitizens,
    mostBridgedCategory,
    label,
    labelColor,
    labelDesc,
    minVotesRequired: MIN_VOTES,
    summary: {
      topicsAgreedWithOpponents: bridgeVoteCount,
      categoriesWithBridgeMoments,
      averageSurpriseScore: avgSurprise,
    },
  }

  return NextResponse.json(result)
}
