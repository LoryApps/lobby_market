import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PrepArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  created_at: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface PrepEvidence {
  id: string
  url: string
  title: string
  description: string | null
  domain: string | null
  side: 'for' | 'against' | 'neutral'
  upvotes: number
  author: {
    username: string
    display_name: string | null
  } | null
}

export interface DebatePrepStats {
  contestedness: number          // 0–100: 100 = perfectly 50/50
  for_strength: 'dominant' | 'strong' | 'contested' | 'weak'
  against_strength: 'dominant' | 'strong' | 'contested' | 'weak'
  for_arguments_count: number
  against_arguments_count: number
  total_evidence: number
  has_evidence: boolean
}

export interface StrategicTip {
  title: string
  body: string
}

export interface SideStrategy {
  overview: string
  tips: StrategicTip[]
}

export interface DebatePrepResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    created_at: string
    description: string | null
  }
  for_arguments: PrepArgument[]
  against_arguments: PrepArgument[]
  evidence: PrepEvidence[]
  stats: DebatePrepStats
  for_strategy: SideStrategy
  against_strategy: SideStrategy
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function strengthLabel(pct: number): 'dominant' | 'strong' | 'contested' | 'weak' {
  if (pct >= 65) return 'dominant'
  if (pct >= 53) return 'strong'
  if (pct >= 47) return 'contested'
  return 'weak'
}

function buildForStrategy(blue_pct: number, forArgs: number, againstArgs: number): SideStrategy {
  const margin = blue_pct - 50
  const isLeading = margin > 0

  if (isLeading && margin > 15) {
    return {
      overview: `The FOR side holds a commanding ${blue_pct.toFixed(1)}% majority. Your job is to defend the consensus — anchor the debate in shared values and concrete evidence.`,
      tips: [
        {
          title: 'Own the majority narrative',
          body: 'Frame the debate around why this issue has earned broad support. Reference the vote count as evidence of community consensus, not just personal opinion.',
        },
        {
          title: 'Anticipate the contrarian attack',
          body: 'When you are leading, the opposition will try to paint consensus as groupthink. Prepare steel-man counterarguments that acknowledge minority concerns while holding your ground.',
        },
        {
          title: 'Lead with values, close with evidence',
          body: 'Open by establishing shared values that most people hold. Then show how the FOR position best realises those values with concrete evidence.',
        },
        {
          title: 'Avoid overconfidence',
          body: `You lead by ${margin.toFixed(1)} percentage points, but debates shift. A single powerful argument from the AGAINST side can move undecided voters. Stay sharp.`,
        },
      ],
    }
  }

  if (isLeading) {
    return {
      overview: `FOR holds a slim ${blue_pct.toFixed(1)}% edge. The debate is winnable but not locked in — every strong argument pushes the consensus further in your favour.`,
      tips: [
        {
          title: 'Press your small advantage',
          body: 'You have a plurality but not a mandate. Focus on converting the 10–15% of undecided voters rather than preaching to existing supporters.',
        },
        {
          title: 'Neutralise the strongest AGAINST argument first',
          body: `The AGAINST side has ${againstArgs} community arguments. Study the most-upvoted one and prepare a direct, concise rebuttal to open with.`,
        },
        {
          title: 'Use consensus momentum',
          body: 'Cite recent voting trends if the FOR position has been gaining. Momentum is persuasive — people naturally lean toward a moving majority.',
        },
        {
          title: 'Keep it specific',
          body: 'Concrete examples and specific evidence beat abstract principles in close debates. Bring numbers, studies, or real-world precedents.',
        },
      ],
    }
  }

  // Behind
  return {
    overview: `FOR trails at ${blue_pct.toFixed(1)}%. You are arguing against the current consensus — that means your arguments need to be exceptional. Focus on reframing the debate.`,
    tips: [
      {
        title: 'Challenge the premise, not just the conclusion',
        body: 'When trailing, you need to shift the debate itself. Question the assumptions underlying the AGAINST position before engaging on their terms.',
      },
      {
        title: 'Find the compelling minority case',
        body: 'Identify the strongest single reason someone should vote FOR. Lead with that — one compelling argument beats five mediocre ones.',
      },
      {
        title: 'Reframe the question',
        body: 'The current framing disadvantages you. Find a different angle — future consequences, overlooked stakeholders, or a comparative case — that resets how voters think about this.',
      },
      {
        title: 'Acknowledge the gap, then close it',
        body: 'Conceding the current vote count early ("I know most people currently oppose this, but...") builds credibility and lowers defences before you make your case.',
      },
    ],
  }
}

function buildAgainstStrategy(blue_pct: number, forArgs: number, _againstArgs: number): SideStrategy {
  const red_pct = 100 - blue_pct
  const margin = red_pct - 50
  const isLeading = margin > 0

  if (isLeading && margin > 15) {
    return {
      overview: `AGAINST holds a commanding ${red_pct.toFixed(1)}% majority. Your priority is to reinforce the consensus — defend the community's collective verdict and rebut any attempt to reverse it.`,
      tips: [
        {
          title: 'Anchor in community judgment',
          body: 'The majority has already decided. Frame your argument as giving voice to the collective wisdom, not a fringe view.',
        },
        {
          title: 'Prepare for reversal attempts',
          body: 'The FOR side will try everything to shift momentum. Prepare calm, evidence-based rebuttals to their most popular arguments.',
        },
        {
          title: 'Use specific failure examples',
          body: 'If this policy has been tried elsewhere and failed, cite it. Concrete examples of past failure are more persuasive than theoretical concerns.',
        },
        {
          title: 'Close on consequences',
          body: 'When you are leading, close by emphasising the real-world consequences of changing course. Make the cost of switching feel concrete and near-term.',
        },
      ],
    }
  }

  if (isLeading) {
    return {
      overview: `AGAINST leads at ${red_pct.toFixed(1)}% but the margin is narrow. The debate is yours to win — stay disciplined, concise, and evidence-driven.`,
      tips: [
        {
          title: 'Protect your lead',
          body: 'In close debates, the current leader often loses ground as the debate proceeds. Do not rest on the majority — actively reinforce it with fresh arguments.',
        },
        {
          title: 'Target undecided voters',
          body: 'The 15–20% in the middle are your prize. Tailor your arguments to people who are persuadable, not to your existing supporters.',
        },
        {
          title: 'Attack the strongest FOR argument directly',
          body: `There are ${forArgs} FOR community arguments. Identify the most upvoted one and have a sharp, prepared rebuttal ready early in the debate.`,
        },
        {
          title: 'Emphasise unintended consequences',
          body: 'One of the most effective AGAINST techniques: show what happens if the FOR side prevails. Make the downstream effects vivid and concrete.',
        },
      ],
    }
  }

  // Behind
  return {
    overview: `AGAINST trails at ${red_pct.toFixed(1)}%. You are making the minority case — which means you need to be disruptive, specific, and willing to challenge the consensus narrative.`,
    tips: [
      {
        title: 'Expose the strongest vulnerability',
        body: 'Study the FOR arguments carefully and find the single biggest weak point. One successful deconstruction of their best argument is worth more than attacking ten weaker ones.',
      },
      {
        title: 'Reframe what is really at stake',
        body: 'The current majority may be voting on a different question than you are arguing. Shift the frame — new context creates new openings.',
      },
      {
        title: 'Cite concrete costs and tradeoffs',
        body: 'The FOR side is unlikely to address costs and tradeoffs unprompted. Force them into that conversation — what does this policy actually cost, and who pays?',
      },
      {
        title: 'Be the adult in the room',
        body: 'When you are behind, calm reason beats outrage. Acknowledge what is appealing about the FOR case before methodically dismantling it.',
      },
    ],
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const [topicRes, argsRes, evidenceRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, created_at, description')
      .eq('id', params.id)
      .single(),

    supabase
      .from('topic_arguments')
      .select(`
        id, content, side, upvotes, created_at,
        author:profiles!user_id ( username, display_name, avatar_url, role )
      `)
      .eq('topic_id', params.id)
      .order('upvotes', { ascending: false })
      .limit(30),

    supabase
      .from('topic_evidence')
      .select(`
        id, url, title, description, domain, side, upvotes,
        author:profiles!user_id ( username, display_name )
      `)
      .eq('topic_id', params.id)
      .order('upvotes', { ascending: false })
      .limit(8),
  ])

  if (topicRes.error || !topicRes.data) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const topic = topicRes.data
  const allArgs = (argsRes.data ?? []) as PrepArgument[]
  const allEvidence = (evidenceRes.data ?? []) as PrepEvidence[]

  const forArgs = allArgs.filter((a) => a.side === 'blue').slice(0, 6)
  const againstArgs = allArgs.filter((a) => a.side === 'red').slice(0, 6)

  const blue_pct = topic.blue_pct ?? 50
  const contestedness = Math.round(100 - Math.abs(blue_pct - 50) * 2)

  const stats: DebatePrepStats = {
    contestedness,
    for_strength: strengthLabel(blue_pct),
    against_strength: strengthLabel(100 - blue_pct),
    for_arguments_count: allArgs.filter((a) => a.side === 'blue').length,
    against_arguments_count: allArgs.filter((a) => a.side === 'red').length,
    total_evidence: allEvidence.length,
    has_evidence: allEvidence.length > 0,
  }

  const forStrategy = buildForStrategy(blue_pct, forArgs.length, againstArgs.length)
  const againstStrategy = buildAgainstStrategy(blue_pct, forArgs.length, againstArgs.length)

  const response: DebatePrepResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category ?? null,
      status: topic.status,
      blue_pct: blue_pct,
      total_votes: topic.total_votes ?? 0,
      created_at: topic.created_at,
      description: (topic as { description?: string | null }).description ?? null,
    },
    for_arguments: forArgs,
    against_arguments: againstArgs,
    evidence: allEvidence,
    stats,
    for_strategy: forStrategy,
    against_strategy: againstStrategy,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
  })
}
