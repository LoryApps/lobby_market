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
  convictionWeight: number   // upvotes / (sqrt(total upvotes on that side) + 1)
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

export interface ConvictionResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  // 0–100 composite conviction score for the whole debate
  convictionScore: number
  // How locked-in are FOR voters vs AGAINST voters
  forConviction: number    // 0–100
  againstConviction: number
  // Percentage of voters who wrote a reason (they're more certain)
  reasonRate: number       // 0–100
  // 0–100: how open the debate is to persuasion (inverted conviction + vote closeness)
  persuadability: number
  // Key signals driving conviction
  keySignals: string[]
  // Top conviction-driving arguments per side
  topFor: ConvictionArg | null
  topAgainst: ConvictionArg | null
  // Distribution of upvote "weight" across arguments
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

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const topicId = params.id

  // ── 1. Topic basics ────────────────────────────────────────────────────────
  const { data: rawTopic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', topicId)
    .maybeSingle()

  if (!rawTopic) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const topic = rawTopic as {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number | null
    total_votes: number | null
  }

  // ── 2. Arguments + author profiles ────────────────────────────────────────
  const { data: rawArgs } = await supabase
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
    .limit(200)

  type RawArg = {
    id: string
    side: string
    content: string
    upvotes: number
    created_at: string
    user_id: string
    profiles: {
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
    } | null
  }

  const args = (rawArgs ?? []) as RawArg[]

  // ── 3. Vote reasons count ─────────────────────────────────────────────────
  const { count: reasonCount } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('topic_id', topicId)
    .not('reason', 'is', null)

  // ── 4. Partition by side ──────────────────────────────────────────────────
  const forArgs = args.filter((a) => a.side === 'blue')
  const againstArgs = args.filter((a) => a.side === 'red')

  const totalForUpvotes = forArgs.reduce((s, a) => s + a.upvotes, 0)
  const totalAgainstUpvotes = againstArgs.reduce((s, a) => s + a.upvotes, 0)

  const avgUpvotesPerForArg = forArgs.length ? totalForUpvotes / forArgs.length : 0
  const avgUpvotesPerAgainstArg = againstArgs.length ? totalAgainstUpvotes / againstArgs.length : 0

  const totalVotes = topic.total_votes ?? 0
  const bluePct = topic.blue_pct ?? 50
  const forVotes = Math.round((bluePct / 100) * totalVotes)
  const againstVotes = totalVotes - forVotes

  const totalReasons = reasonCount ?? 0
  const reasonRate = totalVotes > 0 ? Math.round((totalReasons / totalVotes) * 100) : 0

  // ── 5. Conviction scores ─────────────────────────────────────────────────
  //
  // Conviction proxy:
  //   - Engagement ratio: (total_upvotes_on_side / total_votes_on_side) * 100
  //     capped at 50 pts — measures "how engaged are believers per voter"
  //   - Concentration bonus: if a single argument has > 30% of side's upvotes,
  //     the side has a strong rallying point (+10 pts)
  //   - Reason bonus: % of all-votes that wrote a reason, up to 20 pts
  //
  function sideConviction(upvotesTotal: number, voteCount: number, topUpvotes: number): number {
    if (voteCount === 0) return 0
    const engagementRatio = Math.min(50, (upvotesTotal / voteCount) * 100)
    const concentrationBonus =
      upvotesTotal > 0 && (topUpvotes / upvotesTotal) > 0.30 ? 10 : 0
    const reasonBonus = Math.min(20, reasonRate * 0.2)
    return Math.min(100, Math.round(engagementRatio + concentrationBonus + reasonBonus))
  }

  const topForUpvotes = forArgs[0]?.upvotes ?? 0
  const topAgainstUpvotes = againstArgs[0]?.upvotes ?? 0

  const forConviction = sideConviction(totalForUpvotes, forVotes, topForUpvotes)
  const againstConviction = sideConviction(totalAgainstUpvotes, againstVotes, topAgainstUpvotes)

  const convictionScore = Math.round((forConviction + againstConviction) / 2)

  // ── 6. Persuadability ─────────────────────────────────────────────────────
  // How close is the vote to 50/50?  Near 50/50 = high persuadability.
  // Also: if conviction is low on either side, persuadability rises.
  const voteCloseness = Math.max(0, 50 - Math.abs(bluePct - 50))  // 0 at 100/0, 50 at 50/50
  const minConviction = Math.min(forConviction, againstConviction)
  const persuadability = Math.min(
    100,
    Math.round((voteCloseness / 50) * 60 + (1 - minConviction / 100) * 40),
  )

  // ── 7. Top conviction drivers ─────────────────────────────────────────────
  function toConvictionArg(a: RawArg, sideTotal: number): ConvictionArg {
    return {
      id: a.id,
      side: a.side as 'blue' | 'red',
      content: a.content.slice(0, 400) + (a.content.length > 400 ? '…' : ''),
      upvotes: a.upvotes,
      convictionWeight:
        sideTotal > 0 ? Math.round((a.upvotes / sideTotal) * 100) : 0,
      author: a.profiles
        ? {
            username: a.profiles.username,
            display_name: a.profiles.display_name,
            avatar_url: a.profiles.avatar_url,
            role: a.profiles.role,
          }
        : null,
    }
  }

  const topFor = forArgs[0] ? toConvictionArg(forArgs[0], totalForUpvotes) : null
  const topAgainst = againstArgs[0] ? toConvictionArg(againstArgs[0], totalAgainstUpvotes) : null

  // ── 8. Upvote concentration distribution ──────────────────────────────────
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
  const agDist = getDistribution(againstArgs)

  const distribution: ConvictionBand[] = [
    {
      label: 'Dominant voice',
      description: 'Single argument that carries ≥40% of side\'s upvotes',
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
      description: 'Arguments with some upvotes, reinforcing the side',
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

  // ── 9. Key signals ────────────────────────────────────────────────────────
  const keySignals: string[] = []

  if (forConviction > againstConviction + 15) {
    keySignals.push('FOR supporters show significantly higher conviction')
  } else if (againstConviction > forConviction + 15) {
    keySignals.push('AGAINST supporters show significantly higher conviction')
  } else {
    keySignals.push('Both sides show comparable conviction levels')
  }

  if (reasonRate > 30) {
    keySignals.push(`${reasonRate}% of voters explained their stance — high deliberateness`)
  } else if (reasonRate < 5 && totalVotes > 50) {
    keySignals.push('Very few voters explained their stance — instinctive rather than deliberate')
  }

  if (forDist.dominant > 0 || agDist.dominant > 0) {
    const domSide = forDist.dominant > 0 ? 'FOR' : 'AGAINST'
    keySignals.push(`${domSide} side has a single dominant argument rallying their base`)
  }

  if (persuadability > 65) {
    keySignals.push('High persuadability — a strong argument could shift this debate')
  } else if (persuadability < 25) {
    keySignals.push('Positions appear entrenched — unlikely to shift without new evidence')
  }

  // ── 10. Narrative insight ─────────────────────────────────────────────────
  let insight: string
  const forLabel = forConviction > againstConviction ? 'FOR' : 'AGAINST'
  const gap = Math.abs(forConviction - againstConviction)

  if (convictionScore >= 70 && persuadability < 30) {
    insight = `This is a deeply held debate — voters on both sides are firmly committed. Both sides have built strong argument ecosystems with ${forConviction} FOR conviction and ${againstConviction} AGAINST. A breakthrough piece of evidence or a landmark debate could be the only thing to move the needle.`
  } else if (persuadability > 65) {
    insight = `The conviction gap is small and the vote is close — this debate is actively contested. ${forLabel} side leads in conviction by ${gap} points, but ${100 - bluePct}% of voters on the other side haven't fully committed. This is where the most impactful arguments can emerge.`
  } else if (gap > 20) {
    insight = `${forLabel} supporters show much stronger conviction (${gap}-point lead), suggesting their arguments are landing harder. The less-convicted side may benefit from new evidence-based arguments to close this gap.`
  } else if (reasonRate > 40) {
    insight = `Unusually high deliberateness — ${reasonRate}% of voters chose to explain their stance. This signals a debate where citizens are thinking carefully rather than reacting emotionally.`
  } else {
    insight = `A measured debate with ${forConviction} FOR conviction and ${againstConviction} AGAINST. Conviction scores reflect how deeply each side has mobilized argumentation — a balanced but unresolved civic question.`
  }

  const response: ConvictionResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: bluePct,
      total_votes: totalVotes,
    },
    convictionScore,
    forConviction,
    againstConviction,
    reasonRate,
    persuadability,
    keySignals,
    topFor,
    topAgainst,
    distribution,
    stats: {
      totalArgs: args.length,
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
