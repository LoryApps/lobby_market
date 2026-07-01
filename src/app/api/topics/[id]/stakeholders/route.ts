import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type StakeholderStance = 'strongly_for' | 'leaning_for' | 'neutral' | 'leaning_against' | 'strongly_against'
export type StakeholderPower = 'high' | 'medium' | 'low'

export interface StakeholderGroup {
  id: string
  name: string
  description: string
  stance: StakeholderStance
  power: StakeholderPower
  stake_level: number        // 0–100 how much they have at stake
  affected_count_est: string // e.g. "~12M people"
  key_interests: string[]
  top_arguments: TopArgument[]
  gains: string[]
  losses: string[]
}

export interface TopArgument {
  id: string
  body: string
  side: 'for' | 'against'
  upvotes: number
}

export interface StakeholdersResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    scope: string | null
  }
  stakeholders: StakeholderGroup[]
  overall_balance: number   // -100 (all against) to +100 (all for), power-weighted
  contested: boolean
  scope_note: string
}

// ─── Stakeholder templates per category ──────────────────────────────────────

type StakeholderTemplate = {
  id: string
  name: string
  description: string
  power: StakeholderPower
  keywords: string[]
  default_stance_lean: number   // -50 to +50 added to computed score
  affected_est: (scope: string | null) => string
  key_interests: string[]
  gains_if_passes: string[]
  losses_if_passes: string[]
}

const CATEGORY_STAKEHOLDERS: Record<string, StakeholderTemplate[]> = {
  Economics: [
    {
      id: 'corporations', name: 'Corporations & Business',
      description: 'Large enterprises with economic stakes in policy outcomes.',
      power: 'high', keywords: ['tax', 'corporate', 'business', 'market', 'trade', 'profit', 'industry'],
      default_stance_lean: -10,
      affected_est: () => '~500K+ firms',
      key_interests: ['Regulatory burden', 'Taxation', 'Market access', 'Labor costs'],
      gains_if_passes: ['Reduced compliance costs', 'Expanded market opportunities'],
      losses_if_passes: ['Higher tax obligations', 'Increased regulatory constraints'],
    },
    {
      id: 'workers', name: 'Workers & Labor Unions',
      description: 'Employees and organized labor seeking fair wages and conditions.',
      power: 'medium', keywords: ['wage', 'worker', 'labor', 'union', 'employ', 'minimum', 'job'],
      default_stance_lean: 20,
      affected_est: (s) => s === 'Local' ? '~50K workers' : s === 'Regional' ? '~500K workers' : '~150M workers',
      key_interests: ['Wages & benefits', 'Job security', 'Working conditions', 'Collective bargaining'],
      gains_if_passes: ['Better wages and benefits', 'Stronger worker protections'],
      losses_if_passes: ['Potential job displacement', 'Automation pressure'],
    },
    {
      id: 'consumers', name: 'Consumers & Households',
      description: 'Everyday people affected by prices, services, and economic conditions.',
      power: 'medium', keywords: ['consumer', 'price', 'cost', 'household', 'afford', 'spend', 'buy'],
      default_stance_lean: 15,
      affected_est: (s) => s === 'Local' ? '~200K residents' : '~330M households',
      key_interests: ['Affordability', 'Product safety', 'Service quality', 'Purchasing power'],
      gains_if_passes: ['Lower costs', 'Better consumer protections'],
      losses_if_passes: ['Higher prices from compliance costs', 'Reduced choice'],
    },
    {
      id: 'investors', name: 'Investors & Financial Markets',
      description: 'Capital allocators whose returns depend on stable, predictable policy.',
      power: 'high', keywords: ['invest', 'stock', 'market', 'capital', 'finance', 'asset', 'return'],
      default_stance_lean: -15,
      affected_est: () => '~100M investors',
      key_interests: ['Returns on capital', 'Market stability', 'Regulatory predictability', 'Tax treatment'],
      gains_if_passes: ['New investment opportunities', 'Market expansion'],
      losses_if_passes: ['Reduced returns', 'Increased uncertainty'],
    },
    {
      id: 'government', name: 'Government & Public Sector',
      description: 'Public institutions responsible for implementation and fiscal management.',
      power: 'high', keywords: ['government', 'public', 'federal', 'state', 'budget', 'fiscal', 'spend'],
      default_stance_lean: 5,
      affected_est: () => 'All public agencies',
      key_interests: ['Revenue collection', 'Service delivery', 'Fiscal sustainability', 'Public welfare'],
      gains_if_passes: ['Increased revenue', 'Program expansion'],
      losses_if_passes: ['Reduced revenue', 'Implementation burden'],
    },
  ],
  Politics: [
    {
      id: 'elected_officials', name: 'Elected Officials',
      description: 'Politicians whose constituencies are directly affected.',
      power: 'high', keywords: ['vote', 'elect', 'congress', 'senate', 'legislat', 'democrat', 'republican'],
      default_stance_lean: 0,
      affected_est: () => '~535 federal officials + thousands local',
      key_interests: ['Electoral advantage', 'Policy outcomes', 'Constituency interests', 'Party alignment'],
      gains_if_passes: ['Political capital', 'Voter satisfaction'],
      losses_if_passes: ['Opposition backlash', 'Political risk'],
    },
    {
      id: 'civil_society', name: 'Civil Society & NGOs',
      description: 'Advocacy groups, nonprofits, and community organizations.',
      power: 'medium', keywords: ['civil', 'advocacy', 'rights', 'freedom', 'nonprofit', 'community', 'democratic'],
      default_stance_lean: 20,
      affected_est: () => '~1.5M nonprofits',
      key_interests: ['Rights protection', 'Democratic accountability', 'Community welfare', 'Mission fulfillment'],
      gains_if_passes: ['Expanded rights', 'Stronger institutions'],
      losses_if_passes: ['Reduced civil liberties', 'Bureaucratic constraints'],
    },
    {
      id: 'media', name: 'Media & Press',
      description: 'Journalists and outlets shaping public narrative around this issue.',
      power: 'medium', keywords: ['media', 'press', 'free speech', 'information', 'news', 'censorship'],
      default_stance_lean: 10,
      affected_est: () => '~50K+ journalists',
      key_interests: ['Press freedom', 'Access to information', 'Public trust', 'First Amendment'],
      gains_if_passes: ['Greater transparency', 'More news content'],
      losses_if_passes: ['Access restrictions', 'Chilling effects'],
    },
    {
      id: 'citizens', name: 'General Public',
      description: 'Ordinary citizens who vote, pay taxes, and live under these laws.',
      power: 'high', keywords: [],
      default_stance_lean: 10,
      affected_est: (s) => s === 'Local' ? '~50K residents' : '~330M citizens',
      key_interests: ['Personal freedoms', 'Public services', 'Safety', 'Opportunity'],
      gains_if_passes: ['Better governance', 'Expanded services'],
      losses_if_passes: ['Reduced freedoms', 'Higher taxes'],
    },
  ],
  Technology: [
    {
      id: 'tech_companies', name: 'Tech Companies',
      description: 'Software, hardware, and platform companies directly affected.',
      power: 'high', keywords: ['tech', 'digital', 'software', 'platform', 'data', 'ai', 'internet', 'algorithm'],
      default_stance_lean: -20,
      affected_est: () => '~70K tech firms',
      key_interests: ['Innovation freedom', 'Data rights', 'Market access', 'IP protection'],
      gains_if_passes: ['Level playing field', 'Clear regulation'],
      losses_if_passes: ['Compliance costs', 'Innovation constraints'],
    },
    {
      id: 'users', name: 'Digital Users & Consumers',
      description: 'Billions of people who use technology products daily.',
      power: 'medium', keywords: ['user', 'privacy', 'data', 'consumer', 'digital', 'online'],
      default_stance_lean: 25,
      affected_est: () => '~5B internet users',
      key_interests: ['Privacy rights', 'Data security', 'Fair access', 'Product quality'],
      gains_if_passes: ['Stronger privacy protections', 'Better product safety'],
      losses_if_passes: ['Reduced innovation', 'Higher prices'],
    },
    {
      id: 'startups', name: 'Startups & Innovators',
      description: 'Early-stage companies that depend on regulatory clarity to grow.',
      power: 'low', keywords: ['startup', 'innovat', 'entrepreneur', 'venture', 'disrupt'],
      default_stance_lean: -10,
      affected_est: () => '~5M+ startups globally',
      key_interests: ['Low regulatory burden', 'Access to talent', 'Funding environment', 'Market entry'],
      gains_if_passes: ['Clearer rules', 'Increased trust in tech'],
      losses_if_passes: ['Compliance costs', 'Market entry barriers'],
    },
    {
      id: 'researchers', name: 'Researchers & Academia',
      description: 'Scientists and academics conducting technology research.',
      power: 'low', keywords: ['research', 'science', 'academic', 'study', 'experiment'],
      default_stance_lean: 15,
      affected_est: () => '~2M researchers',
      key_interests: ['Research freedom', 'Data access', 'Funding', 'Ethical standards'],
      gains_if_passes: ['Better funding', 'Ethical AI guidelines'],
      losses_if_passes: ['Access restrictions', 'IP complications'],
    },
  ],
  Science: [
    {
      id: 'scientists', name: 'Scientific Community',
      description: 'Researchers, universities, and scientific institutions.',
      power: 'medium', keywords: ['science', 'research', 'climate', 'experiment', 'data', 'study', 'evidence'],
      default_stance_lean: 30,
      affected_est: () => '~8M scientists globally',
      key_interests: ['Research freedom', 'Funding levels', 'Evidence-based policy', 'Publication rights'],
      gains_if_passes: ['Increased funding', 'Science-led policy'],
      losses_if_passes: ['Reduced research funding', 'Political interference'],
    },
    {
      id: 'industry_users', name: 'Industry & Applied Science',
      description: 'Companies that rely on scientific research for product development.',
      power: 'high', keywords: ['manufactur', 'pharma', 'biotech', 'chemical', 'energy', 'material'],
      default_stance_lean: -5,
      affected_est: () => '~200K industrial firms',
      key_interests: ['IP protection', 'R&D tax credits', 'Regulatory approval timelines', 'Safety standards'],
      gains_if_passes: ['Streamlined approvals', 'Better partnerships'],
      losses_if_passes: ['Stricter standards', 'Longer approval times'],
    },
    {
      id: 'public_health', name: 'Public Health Agencies',
      description: 'Health departments and international health organizations.',
      power: 'high', keywords: ['health', 'disease', 'medical', 'vaccine', 'drug', 'treatment', 'hospital'],
      default_stance_lean: 20,
      affected_est: () => 'All public health systems',
      key_interests: ['Disease prevention', 'Healthcare access', 'Safety standards', 'Research funding'],
      gains_if_passes: ['Better health outcomes', 'Stronger preparedness'],
      losses_if_passes: ['Resource constraints', 'Reduced authority'],
    },
  ],
  Environment: [
    {
      id: 'environmental_orgs', name: 'Environmental Organizations',
      description: 'Advocacy groups fighting for ecological protection.',
      power: 'medium', keywords: ['environment', 'climate', 'pollution', 'carbon', 'green', 'emission', 'fossil', 'renewable'],
      default_stance_lean: 35,
      affected_est: () => '~15K environmental NGOs',
      key_interests: ['Ecosystem protection', 'Climate targets', 'Clean air/water', 'Biodiversity'],
      gains_if_passes: ['Stronger environmental protections', 'Reduced emissions'],
      losses_if_passes: ['Weakened regulations', 'Continued pollution'],
    },
    {
      id: 'fossil_fuels', name: 'Fossil Fuel Industry',
      description: 'Oil, gas, and coal companies with major stakes in energy policy.',
      power: 'high', keywords: ['oil', 'gas', 'coal', 'fossil', 'carbon', 'emission', 'drill', 'refiner'],
      default_stance_lean: -40,
      affected_est: () => '~150K energy firms',
      key_interests: ['Market viability', 'Regulatory certainty', 'Subsidy preservation', 'Stranded assets'],
      gains_if_passes: ['Continued operations', 'Subsidy retention'],
      losses_if_passes: ['Asset write-downs', 'Regulatory compliance costs'],
    },
    {
      id: 'clean_energy', name: 'Clean Energy Sector',
      description: 'Solar, wind, and renewable energy companies.',
      power: 'medium', keywords: ['solar', 'wind', 'renewable', 'clean', 'electric', 'battery', 'sustainable'],
      default_stance_lean: 30,
      affected_est: () => '~50K clean energy firms',
      key_interests: ['Subsidies and incentives', 'Grid access', 'Market competition', 'Public investment'],
      gains_if_passes: ['Expanded market', 'Stronger subsidies'],
      losses_if_passes: ['Reduced incentives', 'Slower adoption'],
    },
    {
      id: 'future_generations', name: 'Future Generations',
      description: 'Those who will inherit the long-term consequences of today\'s policies.',
      power: 'low', keywords: [],
      default_stance_lean: 40,
      affected_est: () => 'All future citizens',
      key_interests: ['Livable climate', 'Clean ecosystems', 'Sustainable economy', 'Inherited debt'],
      gains_if_passes: ['Safer climate', 'Sustainable resources'],
      losses_if_passes: ['Climate degradation', 'Resource depletion'],
    },
  ],
  Health: [
    {
      id: 'patients', name: 'Patients & Caregivers',
      description: 'People seeking or receiving healthcare and those who care for them.',
      power: 'medium', keywords: ['patient', 'health', 'medical', 'care', 'treat', 'insurance', 'hospital'],
      default_stance_lean: 30,
      affected_est: (s) => s === 'Local' ? '~500K patients' : '~300M Americans',
      key_interests: ['Access to care', 'Affordability', 'Quality of treatment', 'Patient rights'],
      gains_if_passes: ['Better access', 'Lower costs'],
      losses_if_passes: ['Restricted access', 'Higher costs'],
    },
    {
      id: 'healthcare_providers', name: 'Healthcare Providers',
      description: 'Doctors, nurses, hospitals, and clinics delivering care.',
      power: 'high', keywords: ['doctor', 'nurse', 'hospital', 'clinic', 'provider', 'physician'],
      default_stance_lean: 0,
      affected_est: () => '~18M healthcare workers',
      key_interests: ['Reimbursement rates', 'Autonomy', 'Liability', 'Working conditions'],
      gains_if_passes: ['Clearer guidelines', 'Better funding'],
      losses_if_passes: ['Payment cuts', 'Administrative burden'],
    },
    {
      id: 'pharma', name: 'Pharmaceutical Industry',
      description: 'Drug makers whose pricing and patents are often central to health debates.',
      power: 'high', keywords: ['drug', 'pharma', 'medicine', 'prescription', 'patent', 'biotech'],
      default_stance_lean: -25,
      affected_est: () => '~1K pharma companies',
      key_interests: ['Patent protection', 'Pricing power', 'Approval timelines', 'R&D incentives'],
      gains_if_passes: ['Expanded market', 'Faster approvals'],
      losses_if_passes: ['Price controls', 'Patent reform'],
    },
    {
      id: 'insurers', name: 'Insurance Industry',
      description: 'Health insurance companies that pay claims and set premiums.',
      power: 'high', keywords: ['insur', 'premium', 'coverage', 'deductible', 'claim', 'benefit'],
      default_stance_lean: -20,
      affected_est: () => '~1K insurance companies',
      key_interests: ['Risk management', 'Profitability', 'Regulatory compliance', 'Market stability'],
      gains_if_passes: ['Stable market conditions'],
      losses_if_passes: ['Coverage mandates', 'Rate regulation'],
    },
  ],
  Education: [
    {
      id: 'students', name: 'Students',
      description: 'Current and future learners at all education levels.',
      power: 'low', keywords: ['student', 'school', 'learn', 'educat', 'tuition', 'loan', 'college', 'university'],
      default_stance_lean: 35,
      affected_est: (s) => s === 'Local' ? '~30K students' : '~80M students',
      key_interests: ['Affordability', 'Quality of education', 'Job preparation', 'Debt burden'],
      gains_if_passes: ['Lower tuition', 'Better resources'],
      losses_if_passes: ['Reduced funding', 'Higher debt'],
    },
    {
      id: 'teachers', name: 'Teachers & Educators',
      description: 'K-12 teachers, professors, and school staff.',
      power: 'medium', keywords: ['teacher', 'educator', 'professor', 'school', 'curriculum', 'clasroom'],
      default_stance_lean: 25,
      affected_est: () => '~4M K-12 teachers',
      key_interests: ['Salary & benefits', 'Autonomy', 'Resources', 'Working conditions'],
      gains_if_passes: ['Better pay', 'More resources'],
      losses_if_passes: ['Budget cuts', 'Increased mandates'],
    },
    {
      id: 'institutions', name: 'Educational Institutions',
      description: 'Schools, colleges, and universities managing budgets and policy.',
      power: 'high', keywords: ['universit', 'college', 'school', 'institution', 'campus', 'fund', 'accredit'],
      default_stance_lean: 0,
      affected_est: () => '~140K schools + 4K colleges',
      key_interests: ['Funding levels', 'Autonomy', 'Accreditation', 'Student enrollment'],
      gains_if_passes: ['Increased funding', 'Stable enrollment'],
      losses_if_passes: ['Budget constraints', 'Regulatory burden'],
    },
    {
      id: 'parents', name: 'Parents & Families',
      description: 'Families with school-aged children affected by education policy.',
      power: 'medium', keywords: ['parent', 'famil', 'child', 'school choice', 'curriculum', 'voucher'],
      default_stance_lean: 10,
      affected_est: (s) => s === 'Local' ? '~20K families' : '~90M parents',
      key_interests: ['School quality', 'Safety', 'School choice', 'Local control'],
      gains_if_passes: ['Better schools', 'More choice'],
      losses_if_passes: ['Reduced options', 'Higher local taxes'],
    },
  ],
  Ethics: [
    {
      id: 'affected_communities', name: 'Affected Communities',
      description: 'Groups whose rights or wellbeing are directly at stake.',
      power: 'medium', keywords: ['rights', 'equal', 'justice', 'communit', 'discriminat', 'protect', 'vulnerable'],
      default_stance_lean: 30,
      affected_est: () => 'Varies by context',
      key_interests: ['Equal rights', 'Protection from harm', 'Dignity', 'Access to services'],
      gains_if_passes: ['Expanded protections', 'Recognition of rights'],
      losses_if_passes: ['Reduced protections', 'Continued discrimination'],
    },
    {
      id: 'religious_orgs', name: 'Religious & Faith Communities',
      description: 'Churches and faith-based organizations with moral stakes.',
      power: 'medium', keywords: ['religion', 'faith', 'church', 'moral', 'ethic', 'conscienc'],
      default_stance_lean: -15,
      affected_est: () => '~300K religious congregations',
      key_interests: ['Religious freedom', 'Moral values', 'Community welfare', 'Political influence'],
      gains_if_passes: ['Exemption protections', 'Policy alignment'],
      losses_if_passes: ['Compelled compliance', 'Loss of influence'],
    },
    {
      id: 'philosophers', name: 'Ethicists & Academics',
      description: 'Academics who study and advise on ethical frameworks.',
      power: 'low', keywords: ['ethic', 'moral', 'philosoph', 'just', 'value', 'principl'],
      default_stance_lean: 20,
      affected_est: () => '~50K ethicists',
      key_interests: ['Principled debate', 'Evidence-based ethics', 'Academic freedom', 'Public influence'],
      gains_if_passes: ['Ethics-led policy', 'Academic recognition'],
      losses_if_passes: ['Ethics ignored', 'Utilitarian trade-offs'],
    },
  ],
  Philosophy: [
    {
      id: 'intellectuals', name: 'Intellectuals & Thought Leaders',
      description: 'Writers, philosophers, and public intellectuals shaping discourse.',
      power: 'medium', keywords: ['philosophy', 'idea', 'concept', 'theory', 'principle', 'value', 'truth'],
      default_stance_lean: 15,
      affected_est: () => 'Broad intellectual class',
      key_interests: ['Freedom of thought', 'Open debate', 'Intellectual integrity', 'Cultural influence'],
      gains_if_passes: ['Better cultural frameworks', 'Principled policy'],
      losses_if_passes: ['Ideological capture', 'Dogmatic outcomes'],
    },
    {
      id: 'general_public_phil', name: 'General Public',
      description: 'Citizens whose worldviews and daily lives are shaped by cultural philosophy.',
      power: 'high', keywords: [],
      default_stance_lean: 5,
      affected_est: () => '~330M citizens',
      key_interests: ['Personal freedom', 'Meaning and purpose', 'Social trust', 'Cultural identity'],
      gains_if_passes: ['Clearer social values', 'Stronger community'],
      losses_if_passes: ['Value conflicts', 'Social division'],
    },
  ],
  Culture: [
    {
      id: 'artists', name: 'Artists & Creators',
      description: 'Musicians, filmmakers, writers, and cultural producers.',
      power: 'medium', keywords: ['art', 'music', 'film', 'creat', 'cultur', 'express', 'copyright', 'entertainment'],
      default_stance_lean: 25,
      affected_est: () => '~10M artists',
      key_interests: ['Creative freedom', 'IP rights', 'Funding', 'Audience access'],
      gains_if_passes: ['Better funding', 'Stronger IP rights'],
      losses_if_passes: ['Censorship', 'Reduced support'],
    },
    {
      id: 'cultural_institutions', name: 'Cultural Institutions',
      description: 'Museums, theaters, libraries, and cultural organizations.',
      power: 'medium', keywords: ['museum', 'librar', 'theater', 'institution', 'heritage', 'preserv'],
      default_stance_lean: 15,
      affected_est: () => '~35K cultural institutions',
      key_interests: ['Funding stability', 'Public access', 'Preservation mandate', 'Audience reach'],
      gains_if_passes: ['Increased funding', 'Policy support'],
      losses_if_passes: ['Budget cuts', 'Restrictions on content'],
    },
  ],
}

// Default stakeholders applied to all categories
const DEFAULT_STAKEHOLDERS: StakeholderTemplate[] = [
  {
    id: 'marginalized', name: 'Marginalized Communities',
    description: 'Low-income, minority, and underrepresented groups often most affected by policy.',
    power: 'low', keywords: ['inequal', 'poverty', 'dispar', 'access', 'afford', 'minority', 'underserv'],
    default_stance_lean: 25,
    affected_est: (s) => s === 'Local' ? '~10K residents' : '~50M people',
    key_interests: ['Equity', 'Access to services', 'Economic security', 'Anti-discrimination'],
    gains_if_passes: ['Improved services', 'Reduced inequality'],
    losses_if_passes: ['Increased burden', 'Reduced protections'],
  },
  {
    id: 'taxpayers', name: 'Taxpayers',
    description: 'Citizens whose public funds finance government programs.',
    power: 'medium', keywords: ['tax', 'spend', 'budget', 'cost', 'fund', 'fiscal', 'debt'],
    default_stance_lean: -10,
    affected_est: (s) => s === 'Local' ? '~100K taxpayers' : '~150M taxpayers',
    key_interests: ['Fiscal responsibility', 'Value for money', 'Tax burden', 'Government efficiency'],
    gains_if_passes: ['Better-funded services'],
    losses_if_passes: ['Higher tax burden'],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractKeywords(text: string): string[] {
  const stops = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
    'from','is','are','was','were','be','been','have','has','had','do','does',
    'did','will','would','should','could','may','might','must','shall','can',
    'that','this','these','those','it','its','their','they','we','our','all',
    'any','not','no','more','other','into','through','about','against','without',
    'such','being','having','there','here','upon','than','then','when','where',
    'who','which','what','how','if','because','as','while','each','every',
  ])
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stops.has(w))
    .slice(0, 20)
}

function scoreTemplate(tmpl: StakeholderTemplate, topicKws: string[]): number {
  if (tmpl.keywords.length === 0) return 1
  const matches = tmpl.keywords.filter((k) => topicKws.some((tw) => tw.includes(k) || k.includes(tw)))
  return matches.length
}

function computeStance(lean: number, blue_pct: number): StakeholderStance {
  const combined = lean + (blue_pct - 50) * 0.3
  if (combined >= 25) return 'strongly_for'
  if (combined >= 8) return 'leaning_for'
  if (combined <= -25) return 'strongly_against'
  if (combined <= -8) return 'leaning_against'
  return 'neutral'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()

  const { data: topicRow } = await supabase
    .from('topics')
    .select('id, statement, category, scope, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topicRow) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const topic = topicRow as {
    id: string; statement: string; category: string | null; scope: string | null
    status: string; blue_pct: number; total_votes: number
  }

  const topicKws = extractKeywords(topic.statement)
  const category = topic.category ?? 'Economics'

  // Fetch top arguments to surface stakeholder-relevant ones
  type ArgRow = { id: string; body: string; side: string; upvotes: number }
  const { data: rawArgs } = await supabase
    .from('arguments')
    .select('id, body, side, upvotes')
    .eq('topic_id', topic.id)
    .order('upvotes', { ascending: false })
    .limit(60)

  const args: ArgRow[] = (rawArgs ?? []) as ArgRow[]

  // Select stakeholder templates for this category + defaults
  const categoryTemplates: StakeholderTemplate[] = CATEGORY_STAKEHOLDERS[category] ?? CATEGORY_STAKEHOLDERS['Economics']
  const allTemplates = [...categoryTemplates, ...DEFAULT_STAKEHOLDERS]

  // Score each template against the topic
  const scored = allTemplates
    .map((tmpl) => ({ tmpl, score: scoreTemplate(tmpl, topicKws) }))
    .filter((x) => x.score > 0 || tmpl_always_include(x.tmpl.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)

  function tmpl_always_include(id: string): boolean {
    return ['citizens', 'general_public', 'general_public_phil', 'taxpayers'].includes(id)
  }

  // Build stakeholder groups
  const stakeholders: StakeholderGroup[] = scored.map(({ tmpl }) => {
    const stance = computeStance(tmpl.default_stance_lean, topic.blue_pct)
    const stakeLevel = Math.min(
      100,
      Math.max(20, 40 + tmpl.default_stance_lean + Math.abs(tmpl.default_stance_lean) * 0.5),
    )

    // Find relevant arguments for this stakeholder
    const stakeKws = [...tmpl.keywords, ...topicKws.slice(0, 5)]
    const relevantArgs = args
      .filter((a) => {
        if (stakeKws.length === 0) return true
        const lower = a.body.toLowerCase()
        return stakeKws.some((k) => lower.includes(k))
      })
      .slice(0, 3)
      .map((a) => ({
        id: a.id,
        body: a.body.slice(0, 200),
        side: a.side as 'for' | 'against',
        upvotes: a.upvotes ?? 0,
      }))

    return {
      id: tmpl.id,
      name: tmpl.name,
      description: tmpl.description,
      stance,
      power: tmpl.power,
      stake_level: Math.round(stakeLevel),
      affected_count_est: tmpl.affected_est(topic.scope),
      key_interests: tmpl.key_interests,
      top_arguments: relevantArgs,
      gains: tmpl.gains_if_passes,
      losses: tmpl.losses_if_passes,
    }
  })

  // Power-weighted balance
  const powerWeight = { high: 3, medium: 2, low: 1 }
  const stanceSigns: Record<StakeholderStance, number> = {
    strongly_for: 2,
    leaning_for: 1,
    neutral: 0,
    leaning_against: -1,
    strongly_against: -2,
  }
  let weightSum = 0
  let signSum = 0
  for (const s of stakeholders) {
    const w = powerWeight[s.power]
    weightSum += w
    signSum += stanceSigns[s.stance] * w
  }
  const overallBalance = weightSum > 0 ? Math.round((signSum / weightSum) * 50) : 0

  const forCount = stakeholders.filter((s) => s.stance === 'strongly_for' || s.stance === 'leaning_for').length
  const againstCount = stakeholders.filter((s) => s.stance === 'strongly_against' || s.stance === 'leaning_against').length
  const contested = Math.abs(forCount - againstCount) <= 1

  const scopeNote = topic.scope === 'Local'
    ? 'Stakeholder estimates reflect local-level impact.'
    : topic.scope === 'Regional'
    ? 'Stakeholder estimates reflect regional-level impact.'
    : topic.scope === 'National'
    ? 'Stakeholder estimates reflect national-level impact.'
    : 'Stakeholder estimates reflect global-level impact.'

  const response: StakeholdersResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct,
      total_votes: topic.total_votes,
      scope: topic.scope,
    },
    stakeholders,
    overall_balance: overallBalance,
    contested,
    scope_note: scopeNote,
  }

  return NextResponse.json(response)
}
