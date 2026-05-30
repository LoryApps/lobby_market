import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BiasMetric {
  id: string
  label: string
  score: number       // 0–100 (higher = stronger bias signal)
  level: 'low' | 'moderate' | 'notable' | 'strong'
  headline: string    // plain-language summary
  detail: string      // more context
  tip: string         // actionable suggestion
  evidence: string    // specific data point
  color: string       // tailwind text class
  bg: string          // tailwind bg class
  border: string      // tailwind border class
}

export interface BiasReport {
  totalVotes: number
  totalArgumentUpvotes: number
  overallScore: number     // composite 0–100 (lower = less bias)
  overallLevel: 'Balanced' | 'Mild Lean' | 'Noticeable' | 'Strong'
  overallDesc: string
  metrics: BiasMetric[]
  // Summary counts used in the report
  forVotes: number
  againstVotes: number
  categoriesVoted: number
  insufficientData: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function biasLevel(score: number): BiasMetric['level'] {
  if (score < 25) return 'low'
  if (score < 50) return 'moderate'
  if (score < 75) return 'notable'
  return 'strong'
}

function shannonEntropy(counts: number[]): number {
  const total = counts.reduce((s, c) => s + c, 0)
  if (total === 0) return 0
  return -counts.reduce((s, c) => {
    const p = c / total
    return s + (p > 0 ? p * Math.log2(p) : 0)
  }, 0)
}

const MAX_ENTROPY_10 = Math.log2(10) // ≈ 3.321

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const ALL_CATEGORIES = [
    'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
    'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
  ]

  // ── 1. Vote data ────────────────────────────────────────────────────────────
  const { data: voteRows } = await supabase
    .from('votes')
    .select('side, topics(category, blue_pct, total_votes)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500)

  const votes = (voteRows ?? []) as {
    side: 'blue' | 'red'
    topics: { category: string | null; blue_pct: number | null; total_votes: number | null } | null
  }[]

  const totalVotes = votes.length

  // ── 2. Argument upvote data ─────────────────────────────────────────────────
  // Find arguments the user has upvoted
  const { data: upvoteRows } = await supabase
    .from('argument_upvotes')
    .select('argument_id, topic_arguments(side)')
    .eq('user_id', user.id)
    .limit(300)

  const upvotes = (upvoteRows ?? []) as {
    argument_id: string
    topic_arguments: { side: 'blue' | 'red' } | null
  }[]

  const totalArgumentUpvotes = upvotes.length

  // If too little data, return a minimal report
  if (totalVotes < 5) {
    return NextResponse.json({
      totalVotes,
      totalArgumentUpvotes,
      overallScore: 0,
      overallLevel: 'Balanced',
      overallDesc: 'Vote on at least 5 topics to generate your Civic Bias Report.',
      metrics: [],
      forVotes: 0,
      againstVotes: 0,
      categoriesVoted: 0,
      insufficientData: true,
    } satisfies BiasReport)
  }

  const metrics: BiasMetric[] = []

  // ── Bias 1: Confirmation Bias ────────────────────────────────────────────────
  // Measures: do you upvote arguments on your own side more than the other side?
  {
    // If the user mostly voted FOR, do their upvoted arguments skew FOR too?
    const forVoteCount = votes.filter((v) => v.side === 'blue').length
    const voteForPct = totalVotes > 0 ? forVoteCount / totalVotes : 0.5

    // Count upvoted arguments by side
    const upvotedFor = upvotes.filter((u) => u.topic_arguments?.side === 'blue').length
    const upvotedAgainst = upvotes.filter((u) => u.topic_arguments?.side === 'red').length
    const totalUpvotedSided = upvotedFor + upvotedAgainst

    let confirmationScore = 50 // neutral if no upvote data
    let evidence = 'No argument upvotes to measure yet.'

    if (totalUpvotedSided >= 3) {
      const upvoteForPct = upvotedFor / totalUpvotedSided
      // Confirmation bias: how aligned are upvote preferences with your vote side?
      const alignment = Math.abs(upvoteForPct - voteForPct)
      // 0 = perfect alignment (high bias), 0.5 = opposite
      confirmationScore = Math.round(alignment < 0.05
        ? 85
        : alignment < 0.15
          ? 65
          : alignment < 0.3
            ? 35
            : 15)

      // Actually let's be more direct: if you vote mostly FOR AND upvote mostly FOR = high bias
      const upvoteAlignmentPct = Math.round(
        voteForPct >= 0.5
          ? (upvotedFor / (totalUpvotedSided || 1)) * 100
          : (upvotedAgainst / (totalUpvotedSided || 1)) * 100
      )
      confirmationScore = Math.min(100, Math.round(upvoteAlignmentPct * 1.1))
      evidence = `${upvoteAlignmentPct}% of your upvoted arguments match your own vote side.`
    } else {
      evidence = `${totalUpvotedSided} sided upvotes found — more data needed for accuracy.`
      confirmationScore = 40
    }

    const level = biasLevel(confirmationScore)
    metrics.push({
      id: 'confirmation',
      label: 'Confirmation Bias',
      score: confirmationScore,
      level,
      headline: level === 'low'
        ? 'You engage across both sides'
        : level === 'moderate'
          ? 'Mild preference for same-side arguments'
          : level === 'notable'
            ? 'You tend to upvote your own side'
            : 'Strong same-side argument preference',
      detail: 'Confirmation bias is the tendency to favour information that confirms your existing beliefs. Here it\'s measured by how often you upvote arguments that align with your own vote direction.',
      tip: level === 'low'
        ? 'Great job engaging with opposing arguments. Keep exploring the other side\'s strongest cases.'
        : 'Try reading and rating the top-scored arguments on the opposing side of topics you\'ve voted on.',
      evidence,
      color: confirmationScore >= 65 ? 'text-against-400' : confirmationScore >= 35 ? 'text-gold' : 'text-emerald',
      bg: confirmationScore >= 65 ? 'bg-against-500/10' : confirmationScore >= 35 ? 'bg-gold/10' : 'bg-emerald/10',
      border: confirmationScore >= 65 ? 'border-against-500/30' : confirmationScore >= 35 ? 'border-gold/30' : 'border-emerald/30',
    })
  }

  // ── Bias 2: Social Proof Bias ────────────────────────────────────────────────
  // Measures: do you vote with the majority?
  {
    const votesWithData = votes.filter(
      (v) => v.topics?.blue_pct != null && v.topics.total_votes != null && v.topics.total_votes >= 5
    )
    let socialProofScore = 50
    let evidence = 'Not enough topic data to measure.'
    let withMajority = 0

    if (votesWithData.length >= 3) {
      withMajority = votesWithData.filter((v) => {
        const majorityFor = (v.topics!.blue_pct ?? 50) >= 50
        const votedFor = v.side === 'blue'
        return majorityFor === votedFor
      }).length
      const withMajorityPct = Math.round((withMajority / votesWithData.length) * 100)
      // 50% = random (neutral), 100% = always with majority
      // Score scales from 0 (always contrarian) to 100 (always with majority)
      // We mark "bias" as being far from 50% in EITHER direction
      const deviation = Math.abs(withMajorityPct - 50) * 2 // 0–100
      socialProofScore = Math.round(deviation * (withMajorityPct > 50 ? 1 : 0.7)) // weigh conformity higher
      evidence = `${withMajorityPct}% of your votes match the current majority on those topics (${votesWithData.length} topics measured).`
    }

    const level = biasLevel(socialProofScore)
    const conformist = withMajority > votesWithData.length * 0.5
    metrics.push({
      id: 'social_proof',
      label: 'Social Proof Bias',
      score: socialProofScore,
      level,
      headline: level === 'low'
        ? 'Your votes are genuinely independent'
        : level === 'moderate'
          ? conformist ? 'Slight tendency to vote with the crowd' : 'Slight contrarian streak'
          : level === 'notable'
            ? conformist ? 'You often vote with the majority' : 'You frequently vote against the grain'
            : conformist ? 'Strong conformity pattern detected' : 'Strong contrarian pattern detected',
      detail: 'Social proof bias is the tendency to align with what most people believe. On Lobby Market this shows up as consistently voting with the platform consensus. Some correlation with majorities is natural — but high alignment may suggest following rather than independent reasoning.',
      tip: level === 'low'
        ? 'Your independent voting pattern is valuable for platform diversity.'
        : conformist
          ? 'Before voting, try reading arguments on both sides rather than checking the current vote split.'
          : 'You\'re impressively contrarian! Just ensure you\'re voting on conviction, not reflexive opposition.',
      evidence,
      color: socialProofScore >= 65 ? 'text-against-400' : socialProofScore >= 35 ? 'text-gold' : 'text-emerald',
      bg: socialProofScore >= 65 ? 'bg-against-500/10' : socialProofScore >= 35 ? 'bg-gold/10' : 'bg-emerald/10',
      border: socialProofScore >= 65 ? 'border-against-500/30' : socialProofScore >= 35 ? 'border-gold/30' : 'border-emerald/30',
    })
  }

  // ── Bias 3: Negativity Bias ─────────────────────────────────────────────────
  // Measures: do you disproportionately vote AGAINST?
  {
    const forVotes = votes.filter((v) => v.side === 'blue').length
    const againstVotes = votes.filter((v) => v.side === 'red').length
    const total = forVotes + againstVotes

    let negativityScore = 50
    let evidence = 'Equal FOR and AGAINST votes — no negativity bias.'
    const againstPct = total > 0 ? Math.round((againstVotes / total) * 100) : 50

    if (total >= 5) {
      // Score: 0 = all FOR (positivity bias), 50 = balanced, 100 = all AGAINST (negativity bias)
      negativityScore = againstPct
      // We report bias as distance from 50%
      const biasStrength = Math.round(Math.abs(againstPct - 50) * 2)
      negativityScore = biasStrength
      evidence = `${againstPct}% of your votes are AGAINST vs ${100 - againstPct}% FOR. (${total} votes)`
    }

    const dominantSide = againstVotes > forVotes ? 'AGAINST' : 'FOR'
    const level = biasLevel(negativityScore)
    metrics.push({
      id: 'negativity',
      label: 'Negativity Bias',
      score: negativityScore,
      level,
      headline: level === 'low'
        ? 'Balanced FOR / AGAINST voting pattern'
        : dominantSide === 'AGAINST'
          ? level === 'moderate' ? 'Slight lean toward voting AGAINST' : 'Strong tendency to vote AGAINST'
          : level === 'moderate' ? 'Slight lean toward voting FOR' : 'Strong tendency to vote FOR',
      detail: 'Negativity bias in civic discourse is the tendency to oppose change or proposals more reflexively than support them. It can also manifest as "positivity bias" — automatically supporting all proposals. Neither extreme is ideal: each topic deserves individual evaluation.',
      tip: level === 'low'
        ? 'You evaluate each topic on its own merits. Excellent civic reasoning.'
        : dominantSide === 'AGAINST'
          ? 'For your next 10 votes, actively look for reasons why a proposal COULD work before deciding.'
          : 'Try engaging more with AGAINST arguments — strong counterarguments often reveal important nuances.',
      evidence,
      color: negativityScore >= 65 ? 'text-against-400' : negativityScore >= 35 ? 'text-gold' : 'text-emerald',
      bg: negativityScore >= 65 ? 'bg-against-500/10' : negativityScore >= 35 ? 'bg-gold/10' : 'bg-emerald/10',
      border: negativityScore >= 65 ? 'border-against-500/30' : negativityScore >= 35 ? 'border-gold/30' : 'border-emerald/30',
    })
  }

  // ── Bias 4: Category Tunnel Vision ──────────────────────────────────────────
  // Measures: do you only engage with a narrow set of categories?
  {
    const categoryCounts = new Map<string, number>()
    for (const v of votes) {
      const cat = v.topics?.category ?? 'Unknown'
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1)
    }

    const categoryValues = ALL_CATEGORIES.map((c) => categoryCounts.get(c) ?? 0)
    const entropy = shannonEntropy(categoryValues)
    const normalizedEntropy = entropy / MAX_ENTROPY_10 // 0–1 (1 = perfectly spread)
    const tunnelScore = Math.round((1 - normalizedEntropy) * 100)
    const categoriesVoted = [...categoryCounts.keys()].filter((k) =>
      ALL_CATEGORIES.includes(k) && categoryCounts.get(k)! > 0
    ).length
    const topCategory = [...categoryCounts.entries()]
      .filter(([k]) => ALL_CATEGORIES.includes(k))
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

    const level = biasLevel(tunnelScore)
    metrics.push({
      id: 'tunnel_vision',
      label: 'Category Tunnel Vision',
      score: tunnelScore,
      level,
      headline: level === 'low'
        ? 'Broad engagement across civic categories'
        : level === 'moderate'
          ? `Lean toward ${topCategory ?? 'a few'} topics`
          : level === 'notable'
            ? `Concentrated in ${categoriesVoted} categories`
            : `Heavy focus in ${topCategory ?? 'a single'} category`,
      detail: 'Category tunnel vision occurs when you only engage with civic debates in topics that already interest you. Broad civic engagement across economics, science, ethics, culture, and more leads to richer understanding — and helps you make better-informed votes even in your speciality.',
      tip: level === 'low'
        ? `You\'re a civic polymath — engaging across ${categoriesVoted} categories. Keep exploring!`
        : `Try voting on 3 topics in categories you rarely visit. Explore /categories for a guided browse.`,
      evidence: topCategory
        ? `You\'ve voted in ${categoriesVoted}/10 categories. Most active in ${topCategory} (${categoryCounts.get(topCategory)?.toLocaleString() ?? 0} votes).`
        : `Voted in ${categoriesVoted} of 10 civic categories.`,
      color: tunnelScore >= 65 ? 'text-against-400' : tunnelScore >= 35 ? 'text-gold' : 'text-emerald',
      bg: tunnelScore >= 65 ? 'bg-against-500/10' : tunnelScore >= 35 ? 'bg-gold/10' : 'bg-emerald/10',
      border: tunnelScore >= 65 ? 'border-against-500/30' : tunnelScore >= 35 ? 'border-gold/30' : 'border-emerald/30',
    })
  }

  // ── Overall composite score ──────────────────────────────────────────────────
  const scores = metrics.map((m) => m.score)
  const overallScore = scores.length > 0
    ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
    : 0

  const overallLevel: BiasReport['overallLevel'] = overallScore < 25
    ? 'Balanced'
    : overallScore < 50
      ? 'Mild Lean'
      : overallScore < 75
        ? 'Noticeable'
        : 'Strong'

  const OVERALL_DESC: Record<BiasReport['overallLevel'], string> = {
    'Balanced': 'Your civic engagement patterns show strong independence. You evaluate each topic on its own merits.',
    'Mild Lean': 'You show mild bias tendencies — common for most civic participants. A few small habit changes can sharpen your reasoning.',
    'Noticeable': 'Your voting and engagement patterns show noticeable bias signals. Review the individual metrics below for specific guidance.',
    'Strong': 'Strong bias patterns detected across multiple dimensions. This doesn\'t mean your votes are wrong — but it\'s worth reflecting on the patterns below.',
  }

  const forVotes = votes.filter((v) => v.side === 'blue').length
  const againstVotes = votes.filter((v) => v.side === 'red').length
  const categoriesVoted = metrics.find((m) => m.id === 'tunnel_vision')
    ? parseInt(
        (metrics.find((m) => m.id === 'tunnel_vision')?.evidence ?? '')
          .match(/(\d+)\/10/)?.[1] ?? '0',
        10
      )
    : 0

  return NextResponse.json({
    totalVotes,
    totalArgumentUpvotes,
    overallScore,
    overallLevel,
    overallDesc: OVERALL_DESC[overallLevel],
    metrics,
    forVotes,
    againstVotes,
    categoriesVoted,
    insufficientData: false,
  } satisfies BiasReport)
}
