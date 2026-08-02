import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConvictionArg {
  id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  convictionWeight: number
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface ConvictionBand {
  label: string
  description: string
  forCount: number
  againstCount: number
  forPct: number
  againstPct: number
  color: string
}

export interface LawConvictionResponse {
  law: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string
  }
  topic_id: string | null
  // 0–100 composite conviction score for the founding debate
  convictionScore: number
  // How locked-in were FOR voters vs AGAINST voters during the founding debate
  forConviction: number
  againstConviction: number
  // % of voters who wrote a reason (deliberateness proxy)
  reasonRate: number
  // 0–100: mandate strength (how decisively this law was backed)
  mandateStrength: number
  // Key conviction signals from the founding debate
  keySignals: string[]
  // Top founding arguments per side
  topFor: ConvictionArg | null
  topAgainst: ConvictionArg | null
  // Upvote concentration across founding arguments
  distribution: ConvictionBand[]
  // Raw stats
  stats: {
    totalArgs: number
    forArgs: number
    againstArgs: number
    totalForUpvotes: number
    totalAgainstUpvotes: number
    avgUpvotesPerForArg: number
    avgUpvotesPerAgainstArg: number
    reasonCount: number
    totalVotes: number
  }
  insight: string
}

// ─── GET /api/laws/[id]/conviction ────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const lawId = params.id

  // ── 1. Law basics ──────────────────────────────────────────────────────────
  const { data: rawLaw } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
    .eq('id', lawId)
    .maybeSingle()

  if (!rawLaw) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const law = rawLaw as {
    id: string
    statement: string
    category: string | null
    blue_pct: number | null
    total_votes: number | null
    established_at: string
    topic_id: string | null
  }

  const bluePct = law.blue_pct ?? 50
  const totalVotes = law.total_votes ?? 0
  const topicId = law.topic_id

  // ── 2. Founding arguments from the originating topic ──────────────────────
  type RawArg = {
    id: string
    side: string
    content: string
    upvotes: number
    created_at: string
    user_id: string | null
    profiles: {
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
    } | null
  }

  let rawArgs: RawArg[] = []

  if (topicId) {
    const { data } = await supabase
      .from('topic_arguments')
      .select(`
        id,
        side,
        content,
        upvotes,
        created_at,
        user_id,
        profiles!topic_arguments_user_id_fkey (
          username,
          display_name,
          avatar_url,
          role
        )
      `)
      .eq('topic_id', topicId)
      .order('upvotes', { ascending: false })

    rawArgs = (data ?? []) as unknown as RawArg[]
  }

  // ── 3. Vote reasons ────────────────────────────────────────────────────────
  let totalReasons = 0
  if (topicId) {
    const { count } = await supabase
      .from('vote_reasons')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', topicId)

    totalReasons = count ?? 0
  }

  // ── 4. Split and compute upvote totals ────────────────────────────────────
  const forArgs  = rawArgs.filter((a) => a.side === 'blue')
  const againstArgs = rawArgs.filter((a) => a.side === 'red')

  const totalForUpvotes     = forArgs.reduce((s, a) => s + a.upvotes, 0)
  const totalAgainstUpvotes = againstArgs.reduce((s, a) => s + a.upvotes, 0)

  const avgUpvotesPerForArg =
    forArgs.length ? totalForUpvotes / forArgs.length : 0
  const avgUpvotesPerAgainstArg =
    againstArgs.length ? totalAgainstUpvotes / againstArgs.length : 0

  // ── 5. Side conviction scores (0–100) ─────────────────────────────────────
  function sideConviction(
    sideUpvotes: number,
    totalUpvotes: number,
    sideCount: number,
    sideVotePct: number,
  ): number {
    if (sideCount === 0) return 0
    const engagementScore  = Math.min(100, (sideUpvotes / Math.max(1, sideCount)) * 5)
    const concentrationScore = totalUpvotes > 0
      ? Math.min(100, (sideUpvotes / totalUpvotes) * 100)
      : 50
    const voteWeightScore = Math.min(100, sideVotePct * 1.2)
    return Math.round((engagementScore * 0.4 + concentrationScore * 0.3 + voteWeightScore * 0.3))
  }

  const forConviction     = sideConviction(totalForUpvotes,     totalForUpvotes + totalAgainstUpvotes, forArgs.length,     bluePct)
  const againstConviction = sideConviction(totalAgainstUpvotes, totalForUpvotes + totalAgainstUpvotes, againstArgs.length, 100 - bluePct)

  // ── 6. Composite score ────────────────────────────────────────────────────
  const totalArgs = rawArgs.length
  const _totalUpvotes = totalForUpvotes + totalAgainstUpvotes
  const engagementRate = totalVotes > 0
    ? Math.min(100, (totalArgs / Math.max(1, totalVotes)) * 500)
    : 0
  const voteMarginScore = Math.min(100, Math.abs(bluePct - 50) * 2.5)
  const convictionScore = Math.round(
    (forConviction * 0.4 + againstConviction * 0.3 + voteMarginScore * 0.2 + engagementRate * 0.1),
  )

  // ── 7. Reason rate & persuadability ──────────────────────────────────────
  const reasonRate = totalVotes > 0
    ? Math.round((totalReasons / totalVotes) * 100)
    : 0

  // Mandate strength = how decisively this law was backed (inverted persuadability)
  const mandateStrength = Math.round(
    (voteMarginScore * 0.5 + forConviction * 0.3 + Math.min(100, reasonRate * 3) * 0.2),
  )

  // ── 8. Top conviction-driving arguments ───────────────────────────────────
  function toConvictionArg(a: RawArg, sideTotalUpvotes: number): ConvictionArg {
    return {
      id: a.id,
      side: a.side === 'blue' ? 'blue' : 'red',
      content: a.content,
      upvotes: a.upvotes,
      convictionWeight: sideTotalUpvotes > 0
        ? Math.round((a.upvotes / (Math.sqrt(sideTotalUpvotes) + 1)) * 100) / 100
        : 0,
      author: a.profiles
        ? {
            username:     a.profiles.username,
            display_name: a.profiles.display_name,
            avatar_url:   a.profiles.avatar_url,
            role:         a.profiles.role,
          }
        : null,
    }
  }

  const topFor     = forArgs[0]     ? toConvictionArg(forArgs[0],     totalForUpvotes)     : null
  const topAgainst = againstArgs[0] ? toConvictionArg(againstArgs[0], totalAgainstUpvotes) : null

  // ── 9. Upvote concentration distribution ─────────────────────────────────
  function getDistribution(sideArgs: RawArg[]): {
    dominant: number; moderate: number; minor: number; silent: number
  } {
    if (sideArgs.length === 0) return { dominant: 0, moderate: 0, minor: 0, silent: 0 }
    const total = sideArgs.reduce((s, a) => s + a.upvotes, 0)
    if (total === 0) return { dominant: 0, moderate: 0, minor: 0, silent: sideArgs.length }
    let dominant = 0, moderate = 0, minor = 0, silent = 0
    for (const a of sideArgs) {
      const pct = a.upvotes / total
      if (pct >= 0.4)       dominant++
      else if (pct >= 0.15) moderate++
      else if (pct > 0)     minor++
      else                  silent++
    }
    return { dominant, moderate, minor, silent }
  }

  const forDist = getDistribution(forArgs)
  const agDist  = getDistribution(againstArgs)

  const distribution: ConvictionBand[] = [
    {
      label: 'Dominant voice',
      description: 'Single argument carrying ≥40% of side\'s upvotes',
      forCount: forDist.dominant,
      againstCount: agDist.dominant,
      forPct: forArgs.length ? Math.round((forDist.dominant / forArgs.length) * 100) : 0,
      againstPct: againstArgs.length ? Math.round((agDist.dominant / againstArgs.length) * 100) : 0,
      color: '#3b82f6',
    },
    {
      label: 'Strong voice',
      description: 'Arguments carrying 15–40% of side\'s upvotes',
      forCount: forDist.moderate,
      againstCount: agDist.moderate,
      forPct: forArgs.length ? Math.round((forDist.moderate / forArgs.length) * 100) : 0,
      againstPct: againstArgs.length ? Math.round((agDist.moderate / againstArgs.length) * 100) : 0,
      color: '#6366f1',
    },
    {
      label: 'Supporting voice',
      description: 'Arguments with some upvotes reinforcing their side',
      forCount: forDist.minor,
      againstCount: agDist.minor,
      forPct: forArgs.length ? Math.round((forDist.minor / forArgs.length) * 100) : 0,
      againstPct: againstArgs.length ? Math.round((agDist.minor / againstArgs.length) * 100) : 0,
      color: '#8b5cf6',
    },
    {
      label: 'Silent voice',
      description: 'Posted but received no upvotes',
      forCount: forDist.silent,
      againstCount: agDist.silent,
      forPct: forArgs.length ? Math.round((forDist.silent / forArgs.length) * 100) : 0,
      againstPct: againstArgs.length ? Math.round((agDist.silent / againstArgs.length) * 100) : 0,
      color: '#374151',
    },
  ]

  // ── 10. Key signals ───────────────────────────────────────────────────────
  const keySignals: string[] = []

  if (forConviction > againstConviction + 15) {
    keySignals.push('FOR supporters showed significantly higher conviction during the founding debate')
  } else if (againstConviction > forConviction + 15) {
    keySignals.push('AGAINST supporters showed surprisingly high conviction — this law passed over determined opposition')
  } else {
    keySignals.push('Both sides showed comparable conviction levels in the founding debate')
  }

  const marginLabel = bluePct >= 75 ? 'supermajority' : bluePct >= 60 ? 'strong majority' : 'narrow majority'
  keySignals.push(`Passed with a ${marginLabel} (${Math.round(bluePct)}% FOR)`)

  if (reasonRate > 30) {
    keySignals.push(`${reasonRate}% of founding voters wrote explicit reasons — highly deliberate consensus`)
  } else if (reasonRate < 5 && totalVotes > 50) {
    keySignals.push('Few voters wrote explicit reasons — instinctive rather than deliberate consensus')
  }

  if (forDist.dominant > 0) {
    keySignals.push('A single dominant argument was pivotal in rallying FOR voters')
  }

  if (mandateStrength >= 70) {
    keySignals.push('Strong democratic mandate — clear conviction led to this law')
  } else if (mandateStrength <= 35) {
    keySignals.push('Narrow mandate — this law passed but conviction was divided')
  }

  // ── 11. Narrative insight ─────────────────────────────────────────────────
  let insight: string
  const winSide = bluePct >= 50 ? 'FOR' : 'AGAINST'
  const gap = Math.abs(forConviction - againstConviction)

  if (mandateStrength >= 70 && forConviction >= 60) {
    insight = `This law carries a strong democratic mandate. The founding debate showed ${forConviction} FOR conviction and ${againstConviction} AGAINST — a clear, deliberate consensus. The ${Math.round(bluePct)}% FOR majority reflects genuine, deeply held support rather than a passive plurality.`
  } else if (againstConviction > forConviction && bluePct > 50) {
    insight = `An interesting tension: this law passed ${Math.round(bluePct)}% FOR, yet AGAINST supporters actually showed higher argument conviction (${againstConviction} vs ${forConviction}). The law was established by voter numbers, but the opposition made their case with more passion — worth revisiting.`
  } else if (gap > 20) {
    insight = `${winSide} supporters showed a commanding ${gap}-point conviction advantage during the founding debate. This suggests the ${winSide} arguments landed significantly harder, creating a conviction-backed consensus rather than just a numerical majority.`
  } else if (reasonRate > 40) {
    insight = `Unusually deliberate founding: ${reasonRate}% of voters chose to explain their stance. This law was established through careful, reasoned engagement — a particularly strong form of democratic conviction.`
  } else {
    insight = `The founding debate showed ${forConviction} FOR conviction and ${againstConviction} AGAINST. The law was established with a ${Math.round(bluePct)}% majority, reflecting a measured community consensus. ${mandateStrength >= 50 ? 'The mandate is solid.' : 'The mandate, while valid, was not overwhelming.'}`
  }

  const response: LawConvictionResponse = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      blue_pct: bluePct,
      total_votes: totalVotes,
      established_at: law.established_at,
    },
    topic_id: topicId,
    convictionScore,
    forConviction,
    againstConviction,
    reasonRate,
    mandateStrength,
    keySignals,
    topFor,
    topAgainst,
    distribution,
    stats: {
      totalArgs,
      forArgs: forArgs.length,
      againstArgs: againstArgs.length,
      totalForUpvotes,
      totalAgainstUpvotes,
      avgUpvotesPerForArg: Math.round(avgUpvotesPerForArg * 10) / 10,
      avgUpvotesPerAgainstArg: Math.round(avgUpvotesPerAgainstArg * 10) / 10,
      reasonCount: totalReasons,
      totalVotes,
    },
    insight,
  }

  return NextResponse.json(response)
}
