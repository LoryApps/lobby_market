import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ValueDomain {
  key: string
  label: string
  icon: string
  description: string
  forCount: number
  againstCount: number
  forScore: number   // 0-100
  againstScore: number
  // shared = both sides invoke this value
  shared: boolean
  // sample arguments from each side
  forArgs: string[]
  againstArgs: string[]
}

export interface SharedPremise {
  premise: string
  forEvidence: string
  againstEvidence: string
}

export interface DivergencePoint {
  topic: string
  forPosition: string
  againstPosition: string
}

export interface ConsensusResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  // 0-100: higher = more common ground
  consensusScore: number
  sharedDomains: ValueDomain[]
  forOnlyDomains: ValueDomain[]
  againstOnlyDomains: ValueDomain[]
  sharedPremises: SharedPremise[]
  divergencePoints: DivergencePoint[]
  stats: {
    totalArgs: number
    forArgs: number
    againstArgs: number
    sharedDomainCount: number
    agreementZones: number
  }
}

// ─── Value domain detection ───────────────────────────────────────────────────

interface RawDomain {
  key: string
  label: string
  icon: string
  description: string
  patterns: RegExp[]
}

const VALUE_DOMAINS: RawDomain[] = [
  {
    key: 'economic',
    label: 'Economic Impact',
    icon: 'TrendingUp',
    description: 'Arguments grounded in economic costs, benefits, jobs, and markets',
    patterns: [
      /\b(econom|cost|benefit|job|employ|gdp|market|spend|tax|revenue|afford|budget|price|wage|income|poverty|wealth|financial|fiscal|invest)\w*/i,
    ],
  },
  {
    key: 'rights',
    label: 'Individual Rights',
    icon: 'Shield',
    description: 'Arguments invoking personal freedom, autonomy, and civil liberties',
    patterns: [
      /\b(right|freedom|liberty|autonomy|free|choice|privacy|civil|individual|personal|consent|voluntary|self-determin)\w*/i,
    ],
  },
  {
    key: 'evidence',
    label: 'Evidence & Data',
    icon: 'BookOpen',
    description: 'Arguments citing research, studies, statistics, or expert opinion',
    patterns: [
      /\b(stud|research|data|evidence|statistic|percent|survey|report|expert|scientific|peer|review|trial|meta-analysis|accord)\w*/i,
      /\d+%/,
    ],
  },
  {
    key: 'safety',
    label: 'Public Safety',
    icon: 'AlertTriangle',
    description: 'Arguments focused on harm reduction, risk, and protecting people',
    patterns: [
      /\b(safe|harm|risk|danger|protect|secur|health|well-being|welfare|injur|death|surviv|vulnerabl|prevent|child|victim)\w*/i,
    ],
  },
  {
    key: 'fairness',
    label: 'Fairness & Equality',
    icon: 'Scale',
    description: 'Arguments about justice, equity, and equal treatment',
    patterns: [
      /\b(fair|equal|equit|just|discrimin|bias|oppres|marginaliz|privilege|access|opportunit|systemic|inequalit|disparit)\w*/i,
    ],
  },
  {
    key: 'environment',
    label: 'Environment',
    icon: 'Leaf',
    description: 'Arguments about environmental impact, sustainability, and climate',
    patterns: [
      /\b(environment|climate|carbon|emission|sustain|green|ecolog|planet|nature|pollut|renewable|fossil|biodiversit)\w*/i,
    ],
  },
  {
    key: 'community',
    label: 'Community & Society',
    icon: 'Users',
    description: 'Arguments about social cohesion, community values, and collective good',
    patterns: [
      /\b(community|society|social|cohesion|togeth|solidar|neighbor|local|collective|public|common|civic|cultural|tradition)\w*/i,
    ],
  },
  {
    key: 'government',
    label: 'Government & Authority',
    icon: 'Landmark',
    description: 'Arguments about the role of government, regulation, and institutions',
    patterns: [
      /\b(govern|state|regul|law|legislat|policy|institution|enforce|authority|bureauc|federal|constitution|democrat|elect)\w*/i,
    ],
  },
  {
    key: 'innovation',
    label: 'Innovation & Progress',
    icon: 'Zap',
    description: 'Arguments about technological progress, innovation, and modernisation',
    patterns: [
      /\b(innovat|technolog|progress|modern|future|develop|advance|digital|AI|automat|transform|disrupt|pioneer)\w*/i,
    ],
  },
  {
    key: 'ethics',
    label: 'Ethics & Morality',
    icon: 'Heart',
    description: 'Arguments from moral principles, values, and ethical frameworks',
    patterns: [
      /\b(ethic|moral|wrong|right|principl|value|virtue|responsib|duty|oblig|conscience|integrity|honest|corrupt)\w*/i,
    ],
  },
]

function detectDomains(content: string): Set<string> {
  const found = new Set<string>()
  for (const domain of VALUE_DOMAINS) {
    if (domain.patterns.some((p) => p.test(content))) {
      found.add(domain.key)
    }
  }
  return found
}

// Derive a "shared premise" sentence for a domain when both sides invoke it
function buildSharedPremise(domain: RawDomain, forEx: string, againstEx: string): SharedPremise {
  const MAP: Record<string, string> = {
    economic: 'Both sides agree the economic dimension matters — they disagree on who bears the cost.',
    rights: 'Both sides invoke individual rights — but disagree on whose rights take precedence.',
    evidence: 'Both sides claim the evidence supports them — implying a dispute about data interpretation, not values.',
    safety: 'Both sides care about public safety — they disagree on which risk is greater.',
    fairness: 'Both sides appeal to fairness — but reach opposite conclusions about who is treated unfairly.',
    environment: 'Both sides acknowledge environmental considerations — they differ on how to balance them.',
    community: 'Both sides value community — they differ on which community values are primary.',
    government: 'Both sides agree government has a role — they disagree on the correct scope.',
    innovation: 'Both sides see innovation as relevant — they disagree on whether it helps or creates risk.',
    ethics: 'Both sides argue from moral grounds — indicating a genuine value conflict, not a factual one.',
  }
  return {
    premise: MAP[domain.key] ?? `Both sides invoke ${domain.label.toLowerCase()}.`,
    forEvidence: forEx,
    againstEvidence: againstEx,
  }
}

function buildDivergence(domain: RawDomain, _side: 'for' | 'against'): DivergencePoint | null {
  const MAP: Record<string, { topic: string; forPosition: string; againstPosition: string }> = {
    economic: {
      topic: 'Economic frame',
      forPosition: 'The policy creates net economic benefit or reduces inequality.',
      againstPosition: 'The policy creates unsustainable costs or disrupts productive markets.',
    },
    rights: {
      topic: 'Rights frame',
      forPosition: 'This expands or protects fundamental rights.',
      againstPosition: 'This infringes on rights or sets a dangerous precedent.',
    },
    evidence: {
      topic: 'Evidence frame',
      forPosition: 'The evidence clearly supports adoption.',
      againstPosition: 'The evidence is contested, weak, or shows unintended consequences.',
    },
    safety: {
      topic: 'Safety frame',
      forPosition: 'The greater risk lies in not acting.',
      againstPosition: 'The policy itself creates new or larger risks.',
    },
    fairness: {
      topic: 'Fairness frame',
      forPosition: 'The status quo is unfair; this corrects a systemic imbalance.',
      againstPosition: 'This policy is itself unfair to a different group.',
    },
    environment: {
      topic: 'Environmental frame',
      forPosition: 'Environmental benefits outweigh other costs.',
      againstPosition: 'Environmental trade-offs are misrepresented or overstated.',
    },
    community: {
      topic: 'Community frame',
      forPosition: 'This strengthens social bonds and collective wellbeing.',
      againstPosition: 'This undermines community autonomy or traditional structures.',
    },
    government: {
      topic: 'Government role',
      forPosition: 'Government intervention here is appropriate and necessary.',
      againstPosition: 'Government overreach creates worse outcomes than the problem it solves.',
    },
    innovation: {
      topic: 'Innovation frame',
      forPosition: 'Progress requires embracing this change.',
      againstPosition: 'Unchecked innovation creates risks that outweigh the benefits.',
    },
    ethics: {
      topic: 'Moral frame',
      forPosition: 'Moral duty compels action or acceptance.',
      againstPosition: 'Moral principles demand we resist or reject this.',
    },
  }
  return MAP[domain.key] ? { ...MAP[domain.key] } : null
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // Fetch topic
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch top 80 arguments (40 each side)
  const { data: rawArgs } = await supabase
    .from('arguments')
    .select('id, content, side, upvotes')
    .eq('topic_id', params.id)
    .order('upvotes', { ascending: false })
    .limit(80)

  const args = rawArgs ?? []
  const forArgs = args.filter((a) => a.side === 'blue').slice(0, 40)
  const againstArgs = args.filter((a) => a.side === 'red').slice(0, 40)

  // Build domain tallies
  interface DomainTally {
    forCount: number
    againstCount: number
    forExamples: string[]
    againstExamples: string[]
  }
  const tally: Record<string, DomainTally> = {}
  for (const d of VALUE_DOMAINS) {
    tally[d.key] = { forCount: 0, againstCount: 0, forExamples: [], againstExamples: [] }
  }

  for (const arg of forArgs) {
    const domains = detectDomains(arg.content ?? '')
    for (const dk of domains) {
      tally[dk].forCount++
      if (tally[dk].forExamples.length < 2) {
        const snippet = (arg.content ?? '').slice(0, 140).trim()
        tally[dk].forExamples.push(snippet + (snippet.length === 140 ? '…' : ''))
      }
    }
  }
  for (const arg of againstArgs) {
    const domains = detectDomains(arg.content ?? '')
    for (const dk of domains) {
      tally[dk].againstCount++
      if (tally[dk].againstExamples.length < 2) {
        const snippet = (arg.content ?? '').slice(0, 140).trim()
        tally[dk].againstExamples.push(snippet + (snippet.length === 140 ? '…' : ''))
      }
    }
  }

  const totalFor = Math.max(forArgs.length, 1)
  const totalAgainst = Math.max(againstArgs.length, 1)

  // Build domain objects
  const allDomains: ValueDomain[] = VALUE_DOMAINS.map((d) => {
    const t = tally[d.key]
    const forScore = Math.round((t.forCount / totalFor) * 100)
    const againstScore = Math.round((t.againstCount / totalAgainst) * 100)
    const shared = t.forCount > 0 && t.againstCount > 0
    return {
      key: d.key,
      label: d.label,
      icon: d.icon,
      description: d.description,
      forCount: t.forCount,
      againstCount: t.againstCount,
      forScore,
      againstScore,
      shared,
      forArgs: t.forExamples,
      againstArgs: t.againstExamples,
    }
  }).filter((d) => d.forCount > 0 || d.againstCount > 0)
    .sort((a, b) => (b.forScore + b.againstScore) - (a.forScore + a.againstScore))

  const sharedDomains = allDomains.filter((d) => d.shared)
  const forOnlyDomains = allDomains.filter((d) => d.forCount > 0 && d.againstCount === 0)
  const againstOnlyDomains = allDomains.filter((d) => d.againstCount > 0 && d.forCount === 0)

  // Shared premises — one per shared domain (top 4)
  const sharedPremises: SharedPremise[] = sharedDomains.slice(0, 4).map((d) => {
    const raw = VALUE_DOMAINS.find((r) => r.key === d.key)!
    return buildSharedPremise(raw, d.forArgs[0] ?? '', d.againstArgs[0] ?? '')
  })

  // Divergence points — from for-only and against-only domains (top 3 each)
  const divergencePoints: DivergencePoint[] = []
  for (const d of [...forOnlyDomains, ...againstOnlyDomains].slice(0, 6)) {
    const raw = VALUE_DOMAINS.find((r) => r.key === d.key)
    if (raw) {
      const pt = buildDivergence(raw, d.forCount > 0 ? 'for' : 'against')
      if (pt) divergencePoints.push(pt)
    }
  }

  // Consensus score: % of domains that are shared vs total active domains
  const activeCount = allDomains.length
  const consensusScore = activeCount > 0
    ? Math.round((sharedDomains.length / activeCount) * 100)
    : 50

  return NextResponse.json({
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
    },
    consensusScore,
    sharedDomains,
    forOnlyDomains,
    againstOnlyDomains,
    sharedPremises,
    divergencePoints,
    stats: {
      totalArgs: args.length,
      forArgs: forArgs.length,
      againstArgs: againstArgs.length,
      sharedDomainCount: sharedDomains.length,
      agreementZones: sharedPremises.length,
    },
  } satisfies ConsensusResponse)
}
