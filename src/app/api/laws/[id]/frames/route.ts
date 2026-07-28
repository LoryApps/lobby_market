import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LawIdeologicalFrame {
  id: string
  name: string
  tagline: string
  coreValues: string[]
  color: 'blue' | 'amber' | 'yellow' | 'slate' | 'purple' | 'red'
  alignmentScore: number      // 0–100, how aligned this frame is with the law passing
  stance: 'accepts' | 'contests' | 'ambivalent'
  verdict: string             // one-line verdict on the law from this ideology
  interpretation: string      // how this ideology interprets the law
  concern: string             // what concerns this ideology has about the law
  implementation: string      // how this ideology would want the law implemented
}

export interface LawFramesResponse {
  law: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string
  }
  frames: LawIdeologicalFrame[]
  landscape: {
    acceptingFrames: string[]
    contestingFrames: string[]
    ambivalentFrames: string[]
    dominantSentiment: 'broad-support' | 'contested' | 'polarized'
    ideologicalRange: number
  }
  insight: string
}

// ─── Category types ───────────────────────────────────────────────────────────

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

// ─── Alignment scores per category ───────────────────────────────────────────
// How aligned each frame naturally is with laws in this category passing.
// 50 = neutral; >60 = accepts; <40 = contests.

const CATEGORY_ALIGNMENT: Record<CategoryKey, Record<FrameId, number>> = {
  Economy: {
    progressive:   65,
    conservative:  35,
    libertarian:   28,
    centrist:      54,
    technocratic:  57,
    populist:      70,
  },
  Healthcare: {
    progressive:   80,
    conservative:  28,
    libertarian:   20,
    centrist:      62,
    technocratic:  72,
    populist:      76,
  },
  Environment: {
    progressive:   84,
    conservative:  32,
    libertarian:   38,
    centrist:      64,
    technocratic:  77,
    populist:      55,
  },
  Education: {
    progressive:   77,
    conservative:  43,
    libertarian:   35,
    centrist:      67,
    technocratic:  72,
    populist:      66,
  },
  'Criminal Justice': {
    progressive:   72,
    conservative:  28,
    libertarian:   62,
    centrist:      54,
    technocratic:  62,
    populist:      44,
  },
  'Foreign Policy': {
    progressive:   57,
    conservative:  60,
    libertarian:   32,
    centrist:      57,
    technocratic:  60,
    populist:      38,
  },
  Immigration: {
    progressive:   74,
    conservative:  26,
    libertarian:   64,
    centrist:      54,
    technocratic:  60,
    populist:      28,
  },
  Technology: {
    progressive:   58,
    conservative:  53,
    libertarian:   72,
    centrist:      62,
    technocratic:  75,
    populist:      38,
  },
  Housing: {
    progressive:   72,
    conservative:  40,
    libertarian:   32,
    centrist:      62,
    technocratic:  67,
    populist:      74,
  },
  'Civil Rights': {
    progressive:   82,
    conservative:  36,
    libertarian:   67,
    centrist:      67,
    technocratic:  70,
    populist:      62,
  },
  default: {
    progressive:   62,
    conservative:  38,
    libertarian:   44,
    centrist:      54,
    technocratic:  57,
    populist:      52,
  },
}

// ─── Frame metadata ───────────────────────────────────────────────────────────

const FRAME_META: Record<FrameId, Omit<LawIdeologicalFrame, 'alignmentScore' | 'stance' | 'verdict' | 'interpretation' | 'concern' | 'implementation'>> = {
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

// ─── Law-specific frame templates ─────────────────────────────────────────────

type LawArgTemplates = Record<FrameId, { verdict: string; interpretation: string; concern: string; implementation: string }>

const LAW_TEMPLATES: Record<CategoryKey, Partial<LawArgTemplates>> = {
  Economy: {
    progressive: {
      verdict: 'A necessary step toward economic fairness — though implementation must guarantee equity.',
      interpretation: 'This law represents the community\'s recognition that unchecked markets produce inequality. Its passage affirms that collective welfare must be placed above profit motive.',
      concern: 'The risk is regulatory capture — corporations lobbying to water down enforcement until the law exists on paper only.',
      implementation: 'Ensure robust enforcement agencies with teeth, community oversight boards, and regular equity impact assessments.',
    },
    conservative: {
      verdict: 'An overreach that will burden enterprise and erode the economic dynamism that creates prosperity.',
      interpretation: 'The passage of this law reflects a community that has prioritized redistributive ideals over the proven virtues of free markets and personal responsibility.',
      concern: 'Every economic intervention distorts price signals and creates unintended consequences. This law will produce inefficiencies that harm the very people it claims to help.',
      implementation: 'If implementation is unavoidable, sunset clauses, cost-benefit reviews, and market-friendly mechanisms should minimize damage.',
    },
    libertarian: {
      verdict: 'A coercive expansion of state power that should be resisted or repealed at the earliest opportunity.',
      interpretation: 'This consensus law demonstrates how democratic majorities can impose economic compulsion on individuals who would thrive under voluntary market arrangements.',
      concern: 'Regulations breed more regulations. Each intervention creates market distortions that justify further intervention in a ratchet toward central planning.',
      implementation: 'Voluntary compliance mechanisms and opt-out provisions would mitigate the coercion inherent in this law.',
    },
    centrist: {
      verdict: 'A reasonable compromise that addresses real market failures while preserving economic dynamism.',
      interpretation: 'This law reflects evidence that some economic coordination problems require collective solutions, while the specifics show awareness of market mechanisms.',
      concern: 'The devil is in the details — implementation will determine whether this achieves its goals or becomes another layer of bureaucratic friction.',
      implementation: 'Regular evidence-based reviews, clear metrics, and willingness to amend provisions that aren\'t working will be key.',
    },
    technocratic: {
      verdict: 'Broadly sound policy — now the work of rigorous implementation begins.',
      interpretation: 'The economic models supporting this intervention are well-established. The consensus reflects an empirically-grounded assessment of where markets produce suboptimal outcomes.',
      concern: 'Political implementation rarely matches policy design. Watch for implementation gaps, measurement failures, and resistance from affected interests.',
      implementation: 'Evidence-based performance metrics, mandatory impact evaluations, and data-driven adjustment cycles are essential.',
    },
    populist: {
      verdict: 'The people have spoken against the elite consensus — this law must be enforced with full force.',
      interpretation: 'This law is what happens when ordinary people\'s voices cut through the noise of corporate lobbying. It reflects the economic reality working people face, not the theoretical models of think-tanks.',
      concern: 'The same entrenched interests that opposed this law will now try to gut it through enforcement gaps, bureaucratic delay, and regulatory capture.',
      implementation: 'Transparent enforcement, public reporting, and mechanisms for citizens to hold powerful actors accountable.',
    },
  },
  Healthcare: {
    progressive: {
      verdict: 'A landmark step toward treating healthcare as the human right it is.',
      interpretation: 'This law embodies the consensus that access to health cannot depend on financial circumstance. It moves us toward a more humane and equitable system.',
      concern: 'Universal coverage without price control risks subsidizing a broken system. Equity in access must be matched by equity in quality.',
      implementation: 'Universal enrollment with strong public option, robust anti-discrimination enforcement, and community health investment.',
    },
    conservative: {
      verdict: 'Government bureaucracy crowding out the innovation and choice that improve healthcare.',
      interpretation: 'This law reflects the community\'s desire for security, but risks delivering worse outcomes at higher cost by displacing competition and consumer choice.',
      concern: 'Single-payer systems historically suffer from rationing, long wait times, and bureaucratic rigidity. This law may trade immediate access for long-term quality decline.',
      implementation: 'If reform must proceed, health savings accounts, competition across state lines, and transparent pricing would preserve market incentives.',
    },
    libertarian: {
      verdict: 'A mandate-driven law that restricts medical freedom and market choice.',
      interpretation: 'This consensus reflects a preference for security over freedom. The government now controls another critical domain of personal decision-making.',
      concern: 'Licensing cartels, mandated coverage, and price controls created the high-cost system this law purports to fix — more intervention isn\'t the cure.',
      implementation: 'Opt-out provisions, direct primary care models, and price transparency requirements would reduce coercion while improving outcomes.',
    },
    centrist: {
      verdict: 'A pragmatic expansion of coverage that balances access and sustainability.',
      interpretation: 'The law reflects a reasonable consensus that the status quo was unacceptable while avoiding the most radical restructuring options.',
      concern: 'Cost containment will be the defining challenge. Without it, coverage expansion becomes fiscally unsustainable.',
      implementation: 'Focus on cost drivers, preventive care investments, and evidence-based payment reforms to ensure long-term viability.',
    },
    technocratic: {
      verdict: 'Sound evidence-based policy — OECD data has long supported this direction.',
      interpretation: 'Comparative health system research clearly shows universal coverage achieves better outcomes at lower per-capita cost. This law aligns with the weight of evidence.',
      concern: 'Implementation quality will determine real-world outcomes. Underfunded rollout or poorly designed benefits create a law that exists in name only.',
      implementation: 'Health technology assessment, outcome-linked payment models, and national quality registries to ensure evidence drives continuous improvement.',
    },
    populist: {
      verdict: 'The people demanded health for all — now we ensure it\'s delivered.',
      interpretation: 'Big pharma and insurance companies spent millions opposing this. The fact that it passed anyway reflects the power of popular will over corporate interests.',
      concern: 'The same industry that lost the vote will now lobby for loopholes in implementation. Eternal vigilance is required.',
      implementation: 'Public accountability for cost and access metrics, patient advocacy built into governance, and whistleblower protections for enforcement.',
    },
  },
  default: {
    progressive: {
      verdict: 'A meaningful step forward — now the harder work of equitable implementation begins.',
      interpretation: 'This consensus law represents the community\'s collective judgment that the status quo needed changing. Its passage reflects an understanding that systemic challenges require collective responses.',
      concern: 'Laws are only as strong as their enforcement. Underfunded agencies, legal challenges, and regulatory capture can hollow out even well-designed legislation.',
      implementation: 'Prioritize communities most affected, build in equity audits, and ensure civil society has meaningful oversight roles.',
    },
    conservative: {
      verdict: 'A well-intentioned overreach that risks creating more problems than it solves.',
      interpretation: 'The community has chosen government expansion over individual responsibility. Time will tell whether this law achieves its stated goals or generates the unintended consequences that typically follow such interventions.',
      concern: 'Government programs rarely achieve their objectives at their projected cost. The administrative burden, compliance costs, and behavioral distortions must be monitored closely.',
      implementation: 'Sunset provisions, cost-benefit reviews, and mechanisms to roll back provisions that prove counterproductive are essential safeguards.',
    },
    libertarian: {
      verdict: 'A new constraint on freedom established by majority rule — to be challenged and eventually reversed.',
      interpretation: 'This law represents the democratic majority imposing its preferences on those who would choose differently. Individual rights have once again been subordinated to collective mandates.',
      concern: 'Compliance costs fall hardest on individuals and small entities least able to absorb them. Enforcement creates opportunities for selective application and abuse.',
      implementation: 'Safe harbors, de minimis thresholds, and sunset clauses are the minimum necessary to protect individual autonomy within an imperfect legal framework.',
    },
    centrist: {
      verdict: 'A reasonable policy response that addresses documented problems without ideological excess.',
      interpretation: 'This law reflects the kind of pragmatic consensus that complex issues require. It doesn\'t perfectly satisfy any ideology — which is often a sign it got the balance roughly right.',
      concern: 'The real test is implementation. Good policy design frequently breaks down in execution, especially when it requires coordination across agencies and jurisdictions.',
      implementation: 'Clear success metrics, independent evaluation after 2-3 years, and bipartisan willingness to amend what isn\'t working.',
    },
    technocratic: {
      verdict: 'Policy grounded in evidence — implementation now becomes the critical variable.',
      interpretation: 'The evidence base supporting this intervention was sufficient to generate consensus. What matters now is whether implementation quality matches policy design.',
      concern: 'Political implementation rarely captures policy nuance. Watch for metric gaming, implementation gaps, and resistance from affected interests eroding effectiveness.',
      implementation: 'Mandatory impact evaluation, adaptive management protocols, and public reporting on key performance indicators.',
    },
    populist: {
      verdict: 'The people\'s will has been codified — now we hold the powerful accountable.',
      interpretation: 'This law passed because ordinary people demanded it, not because elites designed it. That origin story should shape how it\'s implemented — from the bottom up.',
      concern: 'The establishment has many tools to undermine laws they didn\'t want passed. Regulatory capture, enforcement delay, and loophole lobbying are all in play.',
      implementation: 'Public transparency, citizen enforcement rights, and direct accountability mechanisms that don\'t rely solely on government agencies.',
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

function buildFrames(category: CategoryKey, lawForPct: number): LawIdeologicalFrame[] {
  const alignments = CATEGORY_ALIGNMENT[category]
  const templates = LAW_TEMPLATES[category] ?? {}
  const defaults = LAW_TEMPLATES.default

  const frameIds: FrameId[] = ['progressive', 'conservative', 'libertarian', 'centrist', 'technocratic', 'populist']

  return frameIds.map((fid) => {
    const meta = FRAME_META[fid]
    const baseAlignment = alignments[fid]

    // Adjust alignment based on how strong the community consensus was
    const consensusBonus = lawForPct > 70 ? 3 : lawForPct > 60 ? 1 : lawForPct < 40 ? -3 : -1
    const alignmentScore = Math.min(95, Math.max(5, baseAlignment + consensusBonus))

    let stance: LawIdeologicalFrame['stance'] = 'ambivalent'
    if (alignmentScore >= 60) stance = 'accepts'
    else if (alignmentScore <= 40) stance = 'contests'

    const tmpl = templates[fid] ?? defaults[fid]!

    return {
      ...meta,
      alignmentScore,
      stance,
      verdict: tmpl.verdict,
      interpretation: tmpl.interpretation,
      concern: tmpl.concern,
      implementation: tmpl.implementation,
    }
  })
}

function buildInsight(frames: LawIdeologicalFrame[], _category: CategoryKey, forPct: number): string {
  const accepting = frames.filter((f) => f.stance === 'accepts').map((f) => f.name)
  const contesting = frames.filter((f) => f.stance === 'contests').map((f) => f.name)
  const ambivalent = frames.filter((f) => f.stance === 'ambivalent').map((f) => f.name)

  if (accepting.length >= 5) {
    return `This law enjoys near-universal ideological support — ${accepting.slice(0, -1).join(', ')} and ${accepting.at(-1)} all accept its legitimacy. Only ${contesting[0] ?? 'a narrow fringe'} contests the outcome.`
  }
  if (contesting.length >= 4) {
    return `Despite achieving ${forPct}% community consensus, this law faces broad ideological resistance — ${contesting.join(', ')} contest its premises, suggesting this is a genuinely contested policy area.`
  }
  if (accepting.length > contesting.length) {
    return `${accepting.join(' and ')} accept this law's legitimacy, while ${contesting.join(' and ') || 'no major frame'} contest${contesting.length === 1 ? 's' : ''} it. ${ambivalent.length > 0 ? `${ambivalent.join(' and ')} remain${ambivalent.length === 1 ? 's' : ''} ambivalent, watching implementation closely.` : ''}`
  }
  if (contesting.length > accepting.length) {
    return `${contesting.join(' and ')} contest this law despite the community consensus. ${accepting.length > 0 ? `Only ${accepting.join(' and ')} fully accept${accepting.length === 1 ? 's' : ''} the outcome.` : ''} This gap between ideological alignment and community consensus suggests this law won on mobilization, not ideological breadth.`
  }
  return `This law is genuinely contested across ideological lines — ${accepting.join(', ')} accept it while ${contesting.join(', ')} contest it. Implementation will be the battleground where the ideological fight continues.`
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const category = resolveCategory(law.category)
  const forPct = law.blue_pct ?? 50
  const frames = buildFrames(category, forPct)

  const accepting = frames.filter((f) => f.stance === 'accepts').map((f) => f.name)
  const contesting = frames.filter((f) => f.stance === 'contests').map((f) => f.name)
  const ambivalent = frames.filter((f) => f.stance === 'ambivalent').map((f) => f.name)

  const sortedByAlignment = [...frames].sort((a, b) => b.alignmentScore - a.alignmentScore)
  const ideologicalRange = sortedByAlignment[0].alignmentScore - sortedByAlignment[sortedByAlignment.length - 1].alignmentScore

  let dominantSentiment: LawFramesResponse['landscape']['dominantSentiment'] = 'contested'
  if (accepting.length >= 4) dominantSentiment = 'broad-support'
  else if (Math.abs(accepting.length - contesting.length) <= 1 && ambivalent.length <= 1) dominantSentiment = 'polarized'

  const insight = buildInsight(frames, category, forPct)

  const response: LawFramesResponse = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      blue_pct: forPct,
      total_votes: law.total_votes ?? 0,
      established_at: law.established_at,
    },
    frames,
    landscape: {
      acceptingFrames: accepting,
      contestingFrames: contesting,
      ambivalentFrames: ambivalent,
      dominantSentiment,
      ideologicalRange,
    },
    insight,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  })
}
