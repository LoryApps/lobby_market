import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlueprintPhase {
  phase: number
  title: string
  duration: string
  description: string
  key_actions: string[]
  dependencies: string[]
}

export interface BlueprintArgument {
  id: string
  content: string
  side: 'for' | 'against'
  upvotes: number
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
  author_clout: number
}

export interface BlueprintLaw {
  id: string
  title: string | null
  statement: string
  established_at: string | null
  category: string | null
}

export interface BlueprintResponse {
  topic: {
    id: string
    statement: string
    description: string | null
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    created_at: string
  }
  // Policy framing derived from topic statement
  policy: {
    headline: string          // Short policy title
    core_objective: string    // One sentence description of what this law would do
    scope: string             // Who/what it applies to
    mechanism: string         // How it would be enforced/implemented
    rationale: string         // Why this matters (derived from top FOR arguments)
    opposition_summary: string // Core opposition concern (derived from top AGAINST args)
  }
  // Phased implementation plan (category-specific)
  phases: BlueprintPhase[]
  // Top community arguments informing the blueprint
  for_arguments: BlueprintArgument[]
  against_arguments: BlueprintArgument[]
  // Existing laws in this category as precedents
  precedent_laws: BlueprintLaw[]
  // Community consensus summary
  consensus: {
    support_level: string     // e.g. "Strong majority"
    for_pct: number
    for_votes: number
    against_votes: number
    verdict: string           // One-sentence community verdict
  }
}

// ─── Implementation templates by category ─────────────────────────────────────

function getImplementationPhases(
  category: string | null,
  _statement: string
): BlueprintPhase[] {
  const cat = category ?? 'General'

  const basePhases: Record<string, BlueprintPhase[]> = {
    Economics: [
      {
        phase: 1,
        title: 'Economic Assessment',
        duration: '3–6 months',
        description: 'Commission independent economic analysis, stakeholder impact studies, and fiscal modelling.',
        key_actions: [
          'Appoint independent economic review board',
          'Model fiscal impact across income brackets',
          'Conduct stakeholder consultation rounds',
          'Review international precedents',
        ],
        dependencies: [],
      },
      {
        phase: 2,
        title: 'Legislative Drafting',
        duration: '6–9 months',
        description: 'Draft the enabling legislation, define enforcement mechanisms, and set compliance timelines.',
        key_actions: [
          'Draft primary legislation with legal counsel',
          'Define regulatory framework and enforcement body',
          'Establish compliance deadlines and grace periods',
          'Open public comment period',
        ],
        dependencies: ['Phase 1 economic assessment complete'],
      },
      {
        phase: 3,
        title: 'Phased Rollout',
        duration: '12–24 months',
        description: 'Staged implementation beginning with pilot regions or sectors before national adoption.',
        key_actions: [
          'Launch pilot programme in test region/sector',
          'Monitor impact metrics and adjust',
          'Scale enforcement capability',
          'Full national implementation',
        ],
        dependencies: ['Legislation passed', 'Enforcement agency staffed'],
      },
      {
        phase: 4,
        title: 'Review & Adjustment',
        duration: 'Ongoing (annual)',
        description: 'Annual review cycles to assess real-world impact and make evidence-based adjustments.',
        key_actions: [
          'Annual impact report to parliament',
          'Public consultation on effectiveness',
          'Statutory five-year comprehensive review',
          'Adjust legislation based on evidence',
        ],
        dependencies: ['Phase 3 complete'],
      },
    ],
    Technology: [
      {
        phase: 1,
        title: 'Technical Scoping',
        duration: '2–4 months',
        description: 'Define technical standards, consult industry experts, and identify regulatory gaps.',
        key_actions: [
          'Form cross-sector technical advisory committee',
          'Map current regulatory landscape',
          'Identify technical feasibility constraints',
          'Benchmark against international digital frameworks',
        ],
        dependencies: [],
      },
      {
        phase: 2,
        title: 'Standard Setting',
        duration: '4–8 months',
        description: 'Develop interoperability standards, compliance frameworks, and certification processes.',
        key_actions: [
          'Publish draft technical standards for public consultation',
          'Establish certification bodies',
          'Create sandboxed testing environments',
          'Define audit and accountability mechanisms',
        ],
        dependencies: ['Technical scoping finalised'],
      },
      {
        phase: 3,
        title: 'Implementation',
        duration: '12–18 months',
        description: 'Industry onboarding, regulatory compliance windows, and enforcement launch.',
        key_actions: [
          'Staggered compliance deadlines by entity size',
          'Launch regulatory enforcement body',
          'Public-facing transparency portal',
          'Cross-border coordination with allied jurisdictions',
        ],
        dependencies: ['Standards published', 'Certification bodies operational'],
      },
    ],
    Health: [
      {
        phase: 1,
        title: 'Clinical & Public Health Review',
        duration: '4–6 months',
        description: 'Evidence review by public health experts, clinical trials data assessment, and equity analysis.',
        key_actions: [
          'Commission systematic evidence review',
          'Assess equity implications across demographics',
          'Consult healthcare providers and patient groups',
          'Model population health outcomes',
        ],
        dependencies: [],
      },
      {
        phase: 2,
        title: 'Policy Design',
        duration: '6–9 months',
        description: 'Design implementation framework with healthcare sector, set service standards, secure funding.',
        key_actions: [
          'Define service delivery standards',
          'Secure multi-year funding commitment',
          'Train healthcare workforce',
          'Design monitoring and evaluation framework',
        ],
        dependencies: ['Evidence review complete'],
      },
      {
        phase: 3,
        title: 'System Integration',
        duration: '18–36 months',
        description: 'Integrate policy into healthcare systems with phased rollout by region and healthcare setting.',
        key_actions: [
          'Pilot in volunteer health systems',
          'National rollout with regional support',
          'Public awareness and education campaign',
          'Track health outcome metrics',
        ],
        dependencies: ['Funding secured', 'Workforce trained'],
      },
    ],
    Education: [
      {
        phase: 1,
        title: 'Curriculum & Standards Review',
        duration: '6–12 months',
        description: 'Engage educators, parents, and students to co-design implementation approach.',
        key_actions: [
          'Consult teachers, school leaders, and student representatives',
          'Review international best-practice curricula',
          'Pilot assessment frameworks',
          'Commission independent pedagogy review',
        ],
        dependencies: [],
      },
      {
        phase: 2,
        title: 'Resource Development',
        duration: '12–18 months',
        description: 'Develop teaching materials, train educators, and build digital infrastructure.',
        key_actions: [
          'Develop or procure learning materials',
          'Train teaching workforce nationally',
          'Build digital infrastructure where needed',
          'Design parent and community engagement plan',
        ],
        dependencies: ['Standards finalised'],
      },
      {
        phase: 3,
        title: 'Nationwide Implementation',
        duration: '18–36 months',
        description: 'Phased adoption by schools with ongoing support and annual progress reviews.',
        key_actions: [
          'Staged school adoption with support teams',
          'Annual student outcome measurement',
          'Public reporting on progress',
          'Five-year statutory curriculum review',
        ],
        dependencies: ['Resources developed', 'Educators trained'],
      },
    ],
    Environment: [
      {
        phase: 1,
        title: 'Environmental Assessment',
        duration: '3–6 months',
        description: 'Scientific impact modelling, ecological surveys, and cross-sector consultation.',
        key_actions: [
          'Commission independent environmental impact study',
          'Map affected ecosystems and communities',
          'Consult environmental and industry stakeholders',
          'Review international climate/environmental commitments',
        ],
        dependencies: [],
      },
      {
        phase: 2,
        title: 'Regulatory Framework',
        duration: '6–12 months',
        description: 'Set emission/impact targets, establish reporting standards, and create incentive structures.',
        key_actions: [
          'Define measurable environmental targets with timelines',
          'Design carbon/impact pricing or offset mechanisms',
          'Create green transition support programmes',
          'Establish monitoring and reporting obligations',
        ],
        dependencies: ['Environmental assessment complete'],
      },
      {
        phase: 3,
        title: 'Transition & Enforcement',
        duration: '24–60 months',
        description: 'Managed sector transition with compliance enforcement and innovation support.',
        key_actions: [
          'Activate transition support funds',
          'Launch enforcement with escalating penalties',
          'Public progress dashboard',
          'Review and tighten targets every 5 years',
        ],
        dependencies: ['Framework enacted', 'Support programmes funded'],
      },
    ],
  }

  const defaultPhases: BlueprintPhase[] = [
    {
      phase: 1,
      title: 'Research & Consultation',
      duration: '3–6 months',
      description: 'Conduct expert research, public consultation, and cost-benefit analysis.',
      key_actions: [
        'Commission independent expert review',
        'Launch public consultation process',
        'Conduct stakeholder impact assessment',
        'Review domestic and international precedents',
      ],
      dependencies: [],
    },
    {
      phase: 2,
      title: 'Legislative Framework',
      duration: '6–12 months',
      description: 'Draft legislation, define enforcement mechanisms, and secure parliamentary approval.',
      key_actions: [
        'Draft primary and secondary legislation',
        'Define implementation body and responsibilities',
        'Set compliance timelines and penalties',
        'Parliamentary debate and passage',
      ],
      dependencies: ['Consultation complete'],
    },
    {
      phase: 3,
      title: 'Implementation',
      duration: '12–24 months',
      description: 'Phased rollout with monitoring, adaptation, and public reporting.',
      key_actions: [
        'Establish implementation body',
        'Staged rollout by sector/region',
        'Public communications campaign',
        'Quarterly progress reporting',
      ],
      dependencies: ['Legislation enacted'],
    },
    {
      phase: 4,
      title: 'Review & Evolution',
      duration: 'Ongoing',
      description: 'Evidence-based policy review cycles to ensure ongoing effectiveness.',
      key_actions: [
        'Annual effectiveness review',
        'Independent audit every 3 years',
        'Public outcome reporting',
        'Legislative adjustment as required',
      ],
      dependencies: ['Phase 3 complete'],
    },
  ]

  return basePhases[cat] ?? defaultPhases
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const topicId = params.id
  if (!topicId) {
    return NextResponse.json({ error: 'Missing topic id' }, { status: 400 })
  }

  const supabase = await createClient()

  // ── Topic basics ──────────────────────────────────────────────────────────
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('id, statement, description, category, status, blue_pct, total_votes, created_at, scope')
    .eq('id', topicId)
    .maybeSingle()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const forPct = topic.blue_pct ?? 50
  const totalVotes = topic.total_votes ?? 0
  const forVotes = Math.round((forPct / 100) * totalVotes)
  const againstVotes = totalVotes - forVotes

  // ── Top arguments ─────────────────────────────────────────────────────────
  const { data: rawArgs } = await supabase
    .from('arguments')
    .select('id, content, side, upvotes, author_id, created_at')
    .eq('topic_id', topicId)
    .order('upvotes', { ascending: false })
    .limit(20)

  const argIds = (rawArgs ?? []).map((a) => a.author_id).filter(Boolean)
  const profileMap = new Map<string, { username: string | null; display_name: string | null; avatar_url: string | null; clout: number }>()

  if (argIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, clout')
      .in('id', argIds.slice(0, 20))

    for (const p of profiles ?? []) {
      profileMap.set(p.id, {
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        clout: p.clout ?? 0,
      })
    }
  }

  const allArgs: BlueprintArgument[] = (rawArgs ?? []).map((a) => {
    const profile = a.author_id ? profileMap.get(a.author_id) : null
    return {
      id: a.id,
      content: a.content,
      side: a.side as 'for' | 'against',
      upvotes: a.upvotes ?? 0,
      author_username: profile?.username ?? null,
      author_display_name: profile?.display_name ?? null,
      author_avatar_url: profile?.avatar_url ?? null,
      author_clout: profile?.clout ?? 0,
    }
  })

  const forArgs = allArgs.filter((a) => a.side === 'for').slice(0, 3)
  const againstArgs = allArgs.filter((a) => a.side === 'against').slice(0, 3)

  // ── Precedent laws in same category ──────────────────────────────────────
  const { data: rawLaws } = await supabase
    .from('topics')
    .select('id, statement, category, created_at')
    .eq('category', topic.category ?? 'General')
    .eq('status', 'law')
    .neq('id', topicId)
    .order('created_at', { ascending: false })
    .limit(3)

  // Check the laws table for established_at dates
  const precedentLaws: BlueprintLaw[] = (rawLaws ?? []).map((t) => ({
    id: t.id,
    title: null,
    statement: t.statement,
    established_at: t.created_at,
    category: t.category,
  }))

  // ── Derive policy framing ─────────────────────────────────────────────────
  const stmt = topic.statement ?? ''
  const topForArg = forArgs[0]?.content ?? ''
  const topAgainstArg = againstArgs[0]?.content ?? ''

  // Derive a short policy headline (max 80 chars)
  const headline = stmt.length <= 80 ? stmt : `${stmt.slice(0, 77)}…`

  // Scope determination
  const scopeLabel =
    (topic as { scope?: string | null }).scope === 'local' ? 'Local (municipal level)' :
    (topic as { scope?: string | null }).scope === 'state' ? 'State/provincial level' :
    (topic as { scope?: string | null }).scope === 'national' ? 'National / federal level' :
    'Broad applicability'

  // Mechanism by category
  const mechanismMap: Record<string, string> = {
    Economics: 'Fiscal policy, regulatory requirement, or market mechanism — enforced by existing financial regulatory bodies with compliance audits.',
    Technology: 'Technical standards, licensing requirements, or platform obligations — enforced by a dedicated digital regulatory authority.',
    Health: 'National health service integration, clinical guidelines, or public health orders — overseen by the national health authority.',
    Education: 'Curriculum mandate, school licensing conditions, or teacher certification requirements — administered by national education authority.',
    Environment: 'Emissions caps, resource quotas, or environmental permits — regulated by environmental protection agency with mandatory reporting.',
    Politics: 'Legislative mandate, constitutional amendment, or executive order — with parliamentary oversight and judicial review.',
    Ethics: 'Professional standards body, statutory obligations, or codes of conduct with independent enforcement.',
    Philosophy: 'Institutional policy or cultural guidance — with community monitoring and voluntary adoption frameworks.',
    Culture: 'Funding conditions, licensing requirements, or public institution mandates.',
    Science: 'Research funding conditions, publication standards, or institutional accreditation requirements.',
  }

  const mechanism = mechanismMap[topic.category ?? ''] ?? 'Regulatory requirement enforced by the relevant statutory authority.'

  // Rationale from top FOR argument
  const rationale =
    topForArg.length > 0
      ? (topForArg.length > 200 ? topForArg.slice(0, 200) + '…' : topForArg)
      : `The community strongly supports this policy at ${Math.round(forPct)}% FOR, reflecting a clear demand for change in the ${topic.category ?? 'public'} domain.`

  // Opposition from top AGAINST argument
  const oppositionSummary =
    topAgainstArg.length > 0
      ? (topAgainstArg.length > 200 ? topAgainstArg.slice(0, 200) + '…' : topAgainstArg)
      : `${Math.round(100 - forPct)}% of voters oppose this proposal, raising concerns about feasibility, cost, or unintended consequences.`

  // Core objective
  const core_objective = topic.description
    ? (topic.description.length > 250 ? topic.description.slice(0, 250) + '…' : topic.description)
    : `Establish a legal framework for: ${stmt}`

  // Consensus verdict
  const verdictMap = [
    [85, 'The community has delivered a decisive mandate. Overwhelming consensus supports this becoming law.'],
    [75, 'A clear majority supports this proposal. The community consensus favours legal adoption.'],
    [60, 'A growing majority supports this policy. The mandate is building toward the law threshold.'],
    [50, 'The community is closely divided. Further debate and evidence are needed before consensus emerges.'],
    [40, 'The community is divided but leans toward opposition. More persuasion needed for the FOR side.'],
    [25, 'A majority opposes this proposal. The against side currently holds a clear mandate.'],
    [0, 'The community has strongly rejected this proposal. Overwhelming opposition makes passage unlikely.'],
  ] as const

  const verdict = verdictMap.find(([threshold]) => forPct >= threshold)?.[1]
    ?? 'Insufficient votes to determine community position.'

  const supportLevel =
    forPct >= 85 ? 'Decisive supermajority' :
    forPct >= 75 ? 'Strong majority' :
    forPct >= 60 ? 'Majority support' :
    forPct >= 50 ? 'Narrow majority' :
    forPct >= 40 ? 'Near split' :
    forPct >= 25 ? 'Majority opposition' :
    'Strong opposition'

  // ── Response ──────────────────────────────────────────────────────────────
  const response: BlueprintResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      description: topic.description ?? null,
      category: topic.category,
      status: topic.status,
      blue_pct: forPct,
      total_votes: totalVotes,
      created_at: topic.created_at,
    },
    policy: {
      headline,
      core_objective,
      scope: scopeLabel,
      mechanism,
      rationale,
      opposition_summary: oppositionSummary,
    },
    phases: getImplementationPhases(topic.category, stmt),
    for_arguments: forArgs,
    against_arguments: againstArgs,
    precedent_laws: precedentLaws,
    consensus: {
      support_level: supportLevel,
      for_pct: forPct,
      for_votes: forVotes,
      against_votes: againstVotes,
      verdict,
    },
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
