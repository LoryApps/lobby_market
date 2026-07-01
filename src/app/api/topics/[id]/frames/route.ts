import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Frame Definitions ─────────────────────────────────────────────────────────

export interface IdeologicalFrame {
  id: string
  name: string
  tagline: string
  coreValues: string[]
  color: 'blue' | 'amber' | 'yellow' | 'slate' | 'purple' | 'red'
  forLean: number       // 0–100, how this frame naturally leans FOR (50 = neutral)
  keyArgument: string   // framing of the debate from this lens
  valueTension: string  // what value is at stake for this frame
  naturalSide: 'for' | 'against' | 'split'
  catchphrase: string   // short memorable framing
}

export interface FramesResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  frames: IdeologicalFrame[]
  frameDivide: {
    mostForFrame: string
    mostAgainstFrame: string
    splitFrames: string[]
    consensusRange: number // spread between highest and lowest lean (0–100)
  }
  insight: string
}

// ─── Category → Frame Lean Map ─────────────────────────────────────────────────
// Each category has a base lean per frame, offset from 50 (neutral).
// Values represent how FOR this frame naturally leans for this category.

type CategoryKey =
  | 'Economy'
  | 'Healthcare'
  | 'Environment'
  | 'Education'
  | 'Criminal Justice'
  | 'Foreign Policy'
  | 'Immigration'
  | 'Technology'
  | 'Housing'
  | 'Civil Rights'
  | 'default'

type FrameId = 'progressive' | 'conservative' | 'libertarian' | 'centrist' | 'technocratic' | 'populist'

const CATEGORY_LEANS: Record<CategoryKey, Record<FrameId, number>> = {
  Economy: {
    progressive:   62,  // favor redistribution, regulation
    conservative:  38,  // favor market freedom, low tax
    libertarian:   30,  // strongly anti-regulation
    centrist:      52,  // moderate mixed economy
    technocratic:  55,  // favor evidence-based policy
    populist:      68,  // favor economic justice, anti-corporate
  },
  Healthcare: {
    progressive:   78,  // universal coverage
    conservative:  32,  // market-based, personal responsibility
    libertarian:   22,  // strongly against mandates
    centrist:      60,  // favor moderate reform
    technocratic:  70,  // favor universal efficient systems
    populist:      74,  // strongly for public healthcare
  },
  Environment: {
    progressive:   82,  // climate action priority
    conservative:  35,  // skeptical of regulation, economy first
    libertarian:   40,  // property rights framing
    centrist:      62,  // balanced approach
    technocratic:  75,  // favor science-based solutions
    populist:      58,  // mixed — pollution vs jobs
  },
  Education: {
    progressive:   75,  // public investment, equity
    conservative:  45,  // local control, parental rights
    libertarian:   38,  // school choice, deregulation
    centrist:      65,  // favor reform and investment
    technocratic:  70,  // favor evidence-based teaching
    populist:      65,  // favor public schools, anti-elite colleges
  },
  'Criminal Justice': {
    progressive:   70,  // reform, rehabilitation, equity
    conservative:  30,  // law and order, strong penalties
    libertarian:   60,  // against over-incarceration, civil liberties
    centrist:      52,  // balanced reform
    technocratic:  60,  // evidence on recidivism, rehabilitation
    populist:      45,  // mixed — tough on crime vs corrupt system
  },
  'Foreign Policy': {
    progressive:   55,  // multilateralism, human rights
    conservative:  58,  // strong defense, national interest
    libertarian:   35,  // non-interventionist
    centrist:      55,  // moderate engagement
    technocratic:  58,  // favor strategic alliances
    populist:      40,  // anti-war, anti-foreign spending
  },
  Immigration: {
    progressive:   72,  // open, humanitarian
    conservative:  28,  // restrictionist, rule of law
    libertarian:   62,  // pro-immigration (free movement)
    centrist:      52,  // managed, orderly process
    technocratic:  58,  // skills-based, economic modeling
    populist:      30,  // restrictionist, protect workers
  },
  Technology: {
    progressive:   60,  // regulate big tech, digital rights
    conservative:  55,  // innovation, minimal regulation
    libertarian:   70,  // strongly pro-tech, anti-censorship
    centrist:      60,  // measured oversight
    technocratic:  72,  // strongly pro-innovation
    populist:      40,  // skeptical of big tech, surveillance
  },
  Housing: {
    progressive:   70,  // public housing, rent control
    conservative:  42,  // deregulation, property rights
    libertarian:   35,  // zoning reform, free market
    centrist:      60,  // mixed reforms
    technocratic:  65,  // evidence-based density/zoning
    populist:      72,  // affordable housing priority
  },
  'Civil Rights': {
    progressive:   80,  // strong protections, anti-discrimination
    conservative:  40,  // traditional values, religious liberty
    libertarian:   65,  // individual rights lens
    centrist:      65,  // broad protections
    technocratic:  68,  // evidence on discrimination effects
    populist:      60,  // anti-establishment rights framing
  },
  default: {
    progressive:   60,
    conservative:  40,
    libertarian:   45,
    centrist:      52,
    technocratic:  55,
    populist:      50,
  },
}

// ─── Frame Metadata ────────────────────────────────────────────────────────────

const FRAME_META: Record<FrameId, Omit<IdeologicalFrame, 'forLean' | 'keyArgument' | 'valueTension' | 'naturalSide' | 'catchphrase'>> = {
  progressive: {
    id: 'progressive',
    name: 'Progressive',
    tagline: 'Equity, systemic change, collective welfare',
    coreValues: ['Equity', 'Social Justice', 'Collective Good', 'Anti-Discrimination', 'Public Investment'],
    color: 'blue',
  },
  conservative: {
    id: 'conservative',
    name: 'Conservative',
    tagline: 'Tradition, personal responsibility, limited government',
    coreValues: ['Tradition', 'Personal Responsibility', 'Free Markets', 'Rule of Law', 'Family'],
    color: 'amber',
  },
  libertarian: {
    id: 'libertarian',
    name: 'Libertarian',
    tagline: 'Individual freedom, minimal state, non-coercion',
    coreValues: ['Individual Liberty', 'Non-Coercion', 'Property Rights', 'Free Markets', 'Privacy'],
    color: 'yellow',
  },
  centrist: {
    id: 'centrist',
    name: 'Centrist',
    tagline: 'Pragmatism, evidence, incremental reform',
    coreValues: ['Pragmatism', 'Evidence-Based', 'Compromise', 'Stability', 'Incrementalism'],
    color: 'slate',
  },
  technocratic: {
    id: 'technocratic',
    name: 'Technocratic',
    tagline: 'Expertise, data-driven decisions, long-term planning',
    coreValues: ['Expert Knowledge', 'Data & Evidence', 'Efficiency', 'Long-Term Planning', 'Innovation'],
    color: 'purple',
  },
  populist: {
    id: 'populist',
    name: 'Populist',
    tagline: 'Common people, anti-elite, direct democracy',
    coreValues: ['People Power', 'Anti-Elite', 'Economic Justice', 'Direct Democracy', 'Sovereignty'],
    color: 'red',
  },
}

// ─── Category-specific argument templates ─────────────────────────────────────

type ArgTemplates = Record<FrameId, { keyArgument: string; valueTension: string; catchphrase: string }>

const ARGUMENT_TEMPLATES: Record<CategoryKey, Partial<ArgTemplates>> = {
  Economy: {
    progressive: {
      keyArgument: 'Economic policy must address structural inequality. Without active redistribution and regulation, market forces deepen the gap between those who inherit wealth and those who work for it.',
      valueTension: 'Equity vs. meritocracy',
      catchphrase: 'The economy works for everyone or it works for no one.',
    },
    conservative: {
      keyArgument: 'Free markets and low taxes create prosperity that government programs cannot match. Personal responsibility and competition drive innovation that lifts living standards for all.',
      valueTension: 'Freedom vs. dependency',
      catchphrase: 'You earn what you build; government takes what you earn.',
    },
    libertarian: {
      keyArgument: 'Economic freedom is freedom. Every regulation, tax, and mandate is coercion. The spontaneous order of voluntary exchange creates more wealth and allocates it more efficiently than any central plan.',
      valueTension: 'Voluntary exchange vs. state compulsion',
      catchphrase: 'If it\'s not voluntary, it\'s not a market.',
    },
    centrist: {
      keyArgument: 'Smart economies blend market dynamism with targeted regulation where markets fail. Evidence shows neither pure laissez-faire nor heavy intervention maximizes broad prosperity.',
      valueTension: 'Efficiency vs. equity trade-offs',
      catchphrase: 'What works, not what\'s ideologically pure.',
    },
    technocratic: {
      keyArgument: 'Economic policy should follow the evidence on what produces long-run growth, employment, and resilience. Models, data, and expert analysis should guide decisions — not ideology.',
      valueTension: 'Optimal outcomes vs. political palatability',
      catchphrase: 'The data says what ideology cannot.',
    },
    populist: {
      keyArgument: 'The economy is rigged by corporations and billionaires who buy the politicians that write the rules. Ordinary people deserve economic policies that actually serve them, not just the donor class.',
      valueTension: 'People vs. elites',
      catchphrase: 'They have accountants. You have a ballot.',
    },
  },
  Healthcare: {
    progressive: {
      keyArgument: 'Healthcare is a human right, not a commodity. A for-profit system creates perverse incentives that leave the sick poor while enriching shareholders. Universal coverage is both more humane and more efficient.',
      valueTension: 'Right to care vs. market allocation',
      catchphrase: 'You shouldn\'t lose everything to stay alive.',
    },
    conservative: {
      keyArgument: 'Government control of healthcare destroys quality and innovation. Competition and consumer choice drive down costs and improve outcomes better than bureaucratic mandates or single-payer programs.',
      valueTension: 'Personal choice vs. collective mandate',
      catchphrase: 'Your doctor, your choice, your money.',
    },
    libertarian: {
      keyArgument: 'Forced insurance mandates, licensing cartels, and FDA monopolies are the cause of high costs — not the cure. Deregulate the market and let people choose their own care.',
      valueTension: 'Medical freedom vs. compulsory coverage',
      catchphrase: 'No mandate can make you healthier than freedom does.',
    },
    centrist: {
      keyArgument: 'Reform should expand coverage while preserving what works. Targeted subsidies, insurance competition reforms, and evidence-based cost controls can improve access without full nationalization.',
      valueTension: 'Access vs. fiscal sustainability',
      catchphrase: 'Cover more people without burning the system down.',
    },
    technocratic: {
      keyArgument: 'OECD data consistently shows universal systems achieve better outcomes at lower cost. Comparative effectiveness research, electronic health records, and preventive care optimization are the levers of reform.',
      valueTension: 'Optimal system design vs. political feasibility',
      catchphrase: 'The evidence on universal care is overwhelming.',
    },
    populist: {
      keyArgument: 'Big pharma, insurance companies, and hospital corporations extract billions while people ration insulin and skip checkups. Medicare for All takes power from the health industry and gives it back to patients.',
      valueTension: 'Corporate profit vs. patient welfare',
      catchphrase: 'They profit from your sickness.',
    },
  },
  default: {
    progressive: {
      keyArgument: 'This issue requires examining its impact on historically marginalized communities. Systemic inequities won\'t resolve themselves — active policy is needed to level the playing field and ensure collective progress.',
      valueTension: 'Equity vs. the status quo',
      catchphrase: 'Progress requires more than good intentions.',
    },
    conservative: {
      keyArgument: 'Before expanding government power, we must ask: what will be lost? Individual responsibility, local community, and time-tested institutions hold society together in ways that legislation cannot replicate.',
      valueTension: 'Liberty vs. government dependency',
      catchphrase: 'Less government means more freedom.',
    },
    libertarian: {
      keyArgument: 'The core question is whether the state should coerce individuals into compliance, or trust free people to manage their own affairs. Coercion is rarely the most effective or just solution.',
      valueTension: 'Individual autonomy vs. collective mandate',
      catchphrase: 'Voluntary cooperation beats compulsion every time.',
    },
    centrist: {
      keyArgument: 'Effective policy requires looking at what the evidence actually shows — setting aside partisan positioning and asking which approach produces measurable improvement for the most people with the fewest trade-offs.',
      valueTension: 'Pragmatic outcomes vs. ideological purity',
      catchphrase: 'What works, not what sounds good.',
    },
    technocratic: {
      keyArgument: 'This is fundamentally a question of system design. Experts who have studied this domain extensively understand the variables at play — policy should reflect their analysis, not popular sentiment.',
      valueTension: 'Expert knowledge vs. democratic preference',
      catchphrase: 'Data over dogma.',
    },
    populist: {
      keyArgument: 'Whoever benefits most from keeping things as they are is funding the opposition to change. The real question is: whose interests does this serve? Follow the money and you\'ll find your answer.',
      valueTension: 'Ordinary people vs. entrenched interests',
      catchphrase: 'They write the rules; you pay the price.',
    },
  },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function resolveCategory(raw: string | null): CategoryKey {
  if (!raw) return 'default'
  const known: CategoryKey[] = [
    'Economy', 'Healthcare', 'Environment', 'Education',
    'Criminal Justice', 'Foreign Policy', 'Immigration',
    'Technology', 'Housing', 'Civil Rights',
  ]
  return known.find((k) => k.toLowerCase() === raw.toLowerCase()) ?? 'default'
}

function buildFrames(category: CategoryKey, _currentForPct: number): IdeologicalFrame[] {
  const leans = CATEGORY_LEANS[category]
  const argTemplates = ARGUMENT_TEMPLATES[category] ?? {}
  const defaultTemplates = ARGUMENT_TEMPLATES.default

  const frameIds: FrameId[] = ['progressive', 'conservative', 'libertarian', 'centrist', 'technocratic', 'populist']

  return frameIds.map((fid) => {
    const meta = FRAME_META[fid]
    const forLean = leans[fid]
    const templates = argTemplates[fid] ?? defaultTemplates[fid]!

    let naturalSide: IdeologicalFrame['naturalSide'] = 'split'
    if (forLean >= 60) naturalSide = 'for'
    else if (forLean <= 40) naturalSide = 'against'

    return {
      ...meta,
      forLean,
      naturalSide,
      keyArgument: templates.keyArgument,
      valueTension: templates.valueTension,
      catchphrase: templates.catchphrase,
    }
  })
}

function buildInsight(frames: IdeologicalFrame[], category: CategoryKey, forPct: number): string {
  const forFrames = frames.filter((f) => f.naturalSide === 'for').map((f) => f.name)
  const againstFrames = frames.filter((f) => f.naturalSide === 'against').map((f) => f.name)
  const splitFrames = frames.filter((f) => f.naturalSide === 'split').map((f) => f.name)

  if (forFrames.length >= 5) {
    return `There is near-universal ideological support FOR this proposition — ${forFrames.join(', ')} all lean FOR. The resistance is primarily from ${againstFrames[0] ?? 'a narrow fringe'}.`
  }
  if (againstFrames.length >= 5) {
    return `There is near-universal ideological resistance to this proposition — almost all frameworks lean AGAINST, suggesting the community consensus ${forPct > 50 ? 'defies' : 'reflects'} the ideological mainstream.`
  }
  if (splitFrames.length >= 3) {
    return `This is a genuinely cross-cutting issue — ${splitFrames.join(', ')} don't have a clear ideological lean. The debate cuts across traditional political lines.`
  }
  if (forFrames.length > againstFrames.length) {
    return `${forFrames.join(' and ')} frame${forFrames.length === 1 ? 's' : ''} this as a clear FOR case, while ${againstFrames.join(' and ') || 'other frameworks'} push${againstFrames.length === 1 ? 'es' : ''} back on ideological grounds.`
  }
  return `${againstFrames.join(' and ')} frame${againstFrames.length === 1 ? 's' : ''} this as a AGAINST case, while ${forFrames.join(' and ') || 'others'} see${forFrames.length === 1 ? 's' : ''} it differently — highlighting a fundamental values divide.`
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const category = resolveCategory(topic.category)
  const forPct = topic.blue_pct ?? 50
  const frames = buildFrames(category, forPct)

  const sortedByLean = [...frames].sort((a, b) => b.forLean - a.forLean)
  const mostForFrame = sortedByLean[0].name
  const mostAgainstFrame = sortedByLean[sortedByLean.length - 1].name
  const splitFrames = frames.filter((f) => f.naturalSide === 'split').map((f) => f.name)
  const consensusRange = sortedByLean[0].forLean - sortedByLean[sortedByLean.length - 1].forLean

  const insight = buildInsight(frames, category, forPct)

  const response: FramesResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: forPct,
      total_votes: topic.total_votes ?? 0,
    },
    frames,
    frameDivide: {
      mostForFrame,
      mostAgainstFrame,
      splitFrames,
      consensusRange,
    },
    insight,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  })
}
