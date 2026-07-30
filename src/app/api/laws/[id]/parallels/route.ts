import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 7200

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GlobalLawComparative {
  id: string
  jurisdiction: string
  title: string
  enacted: string
  domain: string
  description: string
  implementation: 'strong' | 'moderate' | 'weak' | 'contested'
  implementationLabel: string
  publicAcceptance: number
  amendmentCount: number
  yearsInForce: number
  currentStatus: 'active' | 'repealed' | 'amended' | 'expanded' | 'contested'
  similarityScore: number
  matchReasons: string[]
  keyOutcome: string
  keyLesson: string
  landmark: boolean
}

export interface LawParallelsResponse {
  law: {
    id: string
    statement: string
    category: string | null
    total_votes: number
    established_at: string | null
  }
  comparatives: GlobalLawComparative[]
  implementationForecast: {
    mostLikelyChallenges: string
    confidenceScore: number
    basedOn: string
    averageAmendmentYears: number
    strongImplementationRate: number
  }
  themeFingerprint: string[]
  overallInsight: string
}

// ─── Data pool ────────────────────────────────────────────────────────────────

interface PoolEntry {
  id: string
  jurisdiction: string
  title: string
  enacted: string
  domain: string
  description: string
  implementation: 'strong' | 'moderate' | 'weak' | 'contested'
  implementationLabel: string
  publicAcceptance: number
  amendmentCount: number
  yearsInForce: number
  currentStatus: 'active' | 'repealed' | 'amended' | 'expanded' | 'contested'
  keyOutcome: string
  keyLesson: string
  landmark: boolean
  categories: string[]
}

const LAW_POOL: PoolEntry[] = [
  // ── Taxation ─────────────────────────────────────────────────────────────
  {
    id: 'uk-windfall-tax-2022',
    jurisdiction: 'United Kingdom',
    title: 'Energy Profits Levy (Windfall Tax)',
    enacted: '2022',
    domain: 'Taxation & Energy',
    description: 'A 25% surcharge on North Sea oil and gas profits, later raised to 35%, raising £26bn. Designed to fund energy bill relief during the cost-of-living crisis.',
    implementation: 'moderate',
    implementationLabel: 'Partially effective — revenue exceeded targets but investment fell',
    publicAcceptance: 68,
    amendmentCount: 3,
    yearsInForce: 2,
    currentStatus: 'amended',
    landmark: false,
    categories: ['tax', 'energy', 'economy', 'windfall', 'fossil', 'profit', 'oil', 'gas'],
    keyOutcome: 'Raised £14bn in year one — but energy companies cut investment by 14%. The Revenue vs Investment trade-off became the defining policy debate.',
    keyLesson: 'Windfall taxes work best when paired with clear investment incentives; untargeted levies risk capital flight before the crisis resolves.',
  },
  {
    id: 'ireland-sugar-tax-2018',
    jurisdiction: 'Ireland',
    title: 'Sugar-Sweetened Drinks Tax',
    enacted: '2018',
    domain: 'Public Health & Taxation',
    description: 'A tiered tax on sugary drinks based on sugar content — following similar UK and Mexico models. Raised €35m per year and reduced high-sugar product market share by 16%.',
    implementation: 'strong',
    implementationLabel: 'Strong — reformulation and behaviour change both documented',
    publicAcceptance: 61,
    amendmentCount: 1,
    yearsInForce: 6,
    currentStatus: 'active',
    landmark: false,
    categories: ['health', 'tax', 'sugar', 'food', 'obesity', 'consumption', 'drink', 'nutrition'],
    keyOutcome: 'Manufacturers reformulated 35% of products to avoid the highest tax band. Per-capita consumption of high-sugar drinks fell 12% in the first two years.',
    keyLesson: 'Tiered tax structures incentivise reformulation more effectively than flat taxes — the industry responds to the gradient, not just the cost.',
  },
  {
    id: 'france-wealth-tax-ifi',
    jurisdiction: 'France',
    title: 'Impôt sur la Fortune Immobilière (Wealth Tax)',
    enacted: '2018',
    domain: 'Wealth Taxation',
    description: 'Replaced the ISF (comprehensive wealth tax) with IFI, limited to real estate assets. The original ISF was estimated to have driven 10,000 millionaires abroad annually.',
    implementation: 'moderate',
    implementationLabel: 'Moderate — reduced capital flight, but equity goals contested',
    publicAcceptance: 55,
    amendmentCount: 2,
    yearsInForce: 6,
    currentStatus: 'active',
    landmark: true,
    categories: ['tax', 'wealth', 'inequality', 'rich', 'estate', 'property', 'economy', 'fiscal'],
    keyOutcome: 'Capital flight slowed after scope was narrowed to real estate. Revenue fell 60% vs. ISF baseline. The trade-off between tax base and enforcement became a template debate.',
    keyLesson: 'Comprehensive wealth taxes face structural enforcement challenges in open economies. Narrowly-scoped variants tend to survive; broad ones get reformed or abolished.',
  },
  {
    id: 'new-zealand-capital-gains',
    jurisdiction: 'New Zealand',
    title: 'Capital Gains Tax Proposal',
    enacted: '2019',
    domain: 'Taxation',
    description: 'A comprehensive capital gains tax recommended by a government-commissioned working group — then rejected by PM Jacinda Ardern despite her own party\'s support.',
    implementation: 'weak',
    implementationLabel: 'Never implemented — politically shelved',
    publicAcceptance: 43,
    amendmentCount: 0,
    yearsInForce: 0,
    currentStatus: 'repealed',
    landmark: false,
    categories: ['tax', 'capital', 'gains', 'property', 'investment', 'wealth', 'economy'],
    keyOutcome: 'Despite expert consensus and party support, public opposition — especially from property owners — forced abandonment. Property-linked taxes consistently face the highest political resistance in home-owning democracies.',
    keyLesson: 'Laws affecting asset values face uniquely intense opposition from those who stand to lose. Even majority-support proposals fail when the most-affected minority mobilizes effectively.',
  },
  // ── Healthcare ───────────────────────────────────────────────────────────
  {
    id: 'uk-sugar-levy-2018',
    jurisdiction: 'United Kingdom',
    title: 'Soft Drinks Industry Levy',
    enacted: '2018',
    domain: 'Public Health',
    description: 'A tiered levy on sugary soft drinks, with the highest rate on drinks with 8g+ sugar per 100ml. Raised £340m per year, with revenues ringfenced for school sport and breakfast clubs.',
    implementation: 'strong',
    implementationLabel: 'Strong — 50% of UK soft drinks reformulated before enactment',
    publicAcceptance: 72,
    amendmentCount: 0,
    yearsInForce: 6,
    currentStatus: 'active',
    landmark: true,
    categories: ['health', 'sugar', 'food', 'obesity', 'children', 'diet', 'drink', 'nutrition', 'school'],
    keyOutcome: 'Industry preemptively reformulated 50% of drinks. Sugar from soft drinks fell 34.3% in the first two years. Often cited as the most successful public health intervention of its type.',
    keyLesson: 'Pre-announcing a tax gives industry time to adapt, which is a feature not a bug. The best outcome isn\'t revenue — it\'s behaviour change that makes the tax collect less.',
  },
  {
    id: 'australia-plain-packaging',
    jurisdiction: 'Australia',
    title: 'Tobacco Plain Packaging Act',
    enacted: '2011',
    domain: 'Public Health',
    description: 'The world\'s first law mandating standardised, unbranded cigarette packaging — opposed by tobacco companies who launched trade disputes in 40 countries. All lost.',
    implementation: 'strong',
    implementationLabel: 'Strong — became global template for tobacco regulation',
    publicAcceptance: 67,
    amendmentCount: 1,
    yearsInForce: 12,
    currentStatus: 'expanded',
    landmark: true,
    categories: ['health', 'tobacco', 'smoking', 'packaging', 'cancer', 'addiction', 'regulation'],
    keyOutcome: 'Smoking prevalence fell to its lowest ever level. 17+ countries adopted similar laws. All international trade challenges were defeated. Became the gold standard for health packaging.',
    keyLesson: 'Laws that survive corporate legal challenge gain a precedent-shield that makes them stronger, not weaker. Early legal battles against progressive health regulations consistently fail.',
  },
  {
    id: 'germany-nursing-insurance',
    jurisdiction: 'Germany',
    title: 'Long-term Care Insurance Act (Pflegeversicherung)',
    enacted: '1994',
    domain: 'Healthcare & Social Insurance',
    description: 'Mandatory social insurance for long-term nursing care — a fifth pillar of the German welfare state. Now covers 4.9 million people and is periodically reformed to address demographic pressure.',
    implementation: 'strong',
    implementationLabel: 'Strong — stable for 30 years with incremental reforms',
    publicAcceptance: 79,
    amendmentCount: 12,
    yearsInForce: 30,
    currentStatus: 'amended',
    landmark: true,
    categories: ['healthcare', 'health', 'care', 'elderly', 'insurance', 'social', 'pension', 'nursing', 'welfare'],
    keyOutcome: 'Universal long-term care coverage established; premiums have risen but the system is solvent. Demographic aging forces constant reform but no serious repeal movement has ever emerged.',
    keyLesson: 'Social insurance laws with universal coverage build their own constituencies — the longer they run, the harder repeal becomes. Demographic pressures require iterative reform, not abolition.',
  },
  {
    id: 'canada-pharmacare',
    jurisdiction: 'Canada',
    title: 'Canada Pharmacare Act',
    enacted: '2024',
    domain: 'Healthcare',
    description: 'Introduced universal public drug coverage for diabetes and contraceptive medications — a first step toward a full national pharmacare system covering all Canadians.',
    implementation: 'weak',
    implementationLabel: 'Early stage — limited scope, full implementation pending',
    publicAcceptance: 61,
    amendmentCount: 0,
    yearsInForce: 0,
    currentStatus: 'active',
    landmark: true,
    categories: ['healthcare', 'health', 'drugs', 'medication', 'insurance', 'coverage', 'universal', 'pharmaceutical'],
    keyOutcome: 'First legislation passed; however, coverage limited to two drug classes pending provincial agreements. Full implementation requires 13 provincial/territorial agreements.',
    keyLesson: 'Large healthcare expansions almost always start with a limited scope "wedge" — a popular subset that builds political capital for broader rollout.',
  },
  // ── Environment & Climate ─────────────────────────────────────────────────
  {
    id: 'eu-ets',
    jurisdiction: 'European Union',
    title: 'EU Emissions Trading System',
    enacted: '2005',
    domain: 'Climate & Environment',
    description: 'The world\'s first major carbon market — initially gave away most permits for free. After a decade of reform, now the price signal is strong enough to drive coal phase-out.',
    implementation: 'moderate',
    implementationLabel: 'Moderate — weak for a decade, then reformed to become effective',
    publicAcceptance: 58,
    amendmentCount: 7,
    yearsInForce: 19,
    currentStatus: 'expanded',
    landmark: true,
    categories: ['climate', 'environment', 'carbon', 'emissions', 'pollution', 'energy', 'green', 'sustainability'],
    keyOutcome: 'Emissions in covered sectors fell 37% from 2005–2022. Carbon price reached €100/tonne in 2023. First 8 years largely ineffective; reforms in 2018 and 2023 transformed the system.',
    keyLesson: 'Market-based environmental instruments require stringent caps to function. Political concessions at launch (free permits, weak targets) delay effectiveness by a decade or more.',
  },
  {
    id: 'denmark-green-transition',
    jurisdiction: 'Denmark',
    title: 'Climate Act — 70% Emissions Reduction by 2030',
    enacted: '2020',
    domain: 'Climate Policy',
    description: 'Denmark legislated a legally binding 70% emissions cut by 2030 vs 1990 — the most ambitious legally binding climate target in the world at the time of passage.',
    implementation: 'moderate',
    implementationLabel: 'On track for ~65% — close but policy gaps remain',
    publicAcceptance: 74,
    amendmentCount: 2,
    yearsInForce: 4,
    currentStatus: 'active',
    landmark: true,
    categories: ['climate', 'environment', 'emissions', 'green', 'energy', 'carbon', 'net zero', 'renewable'],
    keyOutcome: 'Emissions have fallen significantly, but analysis shows current policies reach ~60-65% by 2030. The gap between the legal target and achievable policies is the defining governance challenge.',
    keyLesson: 'Ambitious climate legislation shifts the political burden: the default question becomes "why aren\'t you meeting the target?" rather than "should we have a target?" — a significant governance advantage.',
  },
  {
    id: 'new-zealand-zero-carbon',
    jurisdiction: 'New Zealand',
    title: 'Climate Change Response (Zero Carbon) Amendment Act',
    enacted: '2019',
    domain: 'Climate Policy',
    description: 'Established a legally binding net-zero carbon target by 2050, an independent Climate Change Commission, and five-year carbon budgets with parliamentary scrutiny.',
    implementation: 'strong',
    implementationLabel: 'Strong institutional framework — first budgets set and tracking',
    publicAcceptance: 69,
    amendmentCount: 1,
    yearsInForce: 5,
    currentStatus: 'active',
    landmark: true,
    categories: ['climate', 'environment', 'carbon', 'emissions', 'green', 'net zero', 'sustainability'],
    keyOutcome: 'An independent body (Climate Change Commission) now produces binding carbon budgets. Political durability enhanced by cross-party institutional design. Seen as a model for climate governance.',
    keyLesson: 'Independent statutory bodies insulate climate targets from electoral cycles. Institutional design choices matter as much as the targets themselves.',
  },
  {
    id: 'uk-plastic-bag-charge',
    jurisdiction: 'United Kingdom',
    title: 'Single-Use Carrier Bag Charge',
    enacted: '2015',
    domain: 'Environment',
    description: 'A 5p charge on single-use plastic bags (later raised to 10p). The simplest environmental policy of its era — and one of the most effective per unit cost.',
    implementation: 'strong',
    implementationLabel: 'Strong — 97% reduction in major supermarket bags',
    publicAcceptance: 82,
    amendmentCount: 1,
    yearsInForce: 9,
    currentStatus: 'expanded',
    landmark: false,
    categories: ['environment', 'plastic', 'waste', 'pollution', 'bag', 'shopping', 'sustainability'],
    keyOutcome: 'Bag distribution by major supermarkets fell 97% within 3 years. Marine plastic pollution indicators improved measurably. Widely replicated across 50+ countries.',
    keyLesson: 'Small price signals on common items can drive dramatic behaviour change at near-zero government cost. The most effective environmental policies are often the least expensive.',
  },
  // ── Technology & Digital Rights ───────────────────────────────────────────
  {
    id: 'eu-ai-act-2024',
    jurisdiction: 'European Union',
    title: 'EU Artificial Intelligence Act',
    enacted: '2024',
    domain: 'Technology Regulation',
    description: 'The world\'s first comprehensive AI regulatory framework — creating risk-tiered requirements for AI systems, with the strictest rules for high-risk applications.',
    implementation: 'weak',
    implementationLabel: 'Early stage — compliance periods extend to 2026–2027',
    publicAcceptance: 57,
    amendmentCount: 0,
    yearsInForce: 0,
    currentStatus: 'active',
    landmark: true,
    categories: ['technology', 'ai', 'artificial intelligence', 'digital', 'privacy', 'regulation', 'data', 'tech', 'algorithm'],
    keyOutcome: 'Major compliance deadlines are still forthcoming. Early implementation has already triggered industry adaptation — companies are redesigning systems before enforcement begins.',
    keyLesson: 'Regulatory anticipation effects are as important as enforcement. Companies change behaviour before laws take effect when fines are credible — a phenomenon called "chilling effect" when negative, "regulatory pull" when positive.',
  },
  {
    id: 'eu-dma-2022',
    jurisdiction: 'European Union',
    title: 'Digital Markets Act',
    enacted: '2022',
    domain: 'Technology & Competition',
    description: 'Designated 6 "gatekeepers" (Apple, Google, Meta, Amazon, Microsoft, ByteDance) subject to mandatory interoperability, data sharing, and competition rules. First enforcement actions began in 2024.',
    implementation: 'moderate',
    implementationLabel: 'Moderate — gatekeepers adapting, enforcement just beginning',
    publicAcceptance: 64,
    amendmentCount: 0,
    yearsInForce: 2,
    currentStatus: 'active',
    landmark: true,
    categories: ['technology', 'digital', 'competition', 'monopoly', 'internet', 'platform', 'antitrust', 'data', 'tech', 'market'],
    keyOutcome: 'Apple opened the App Store to third-party app stores in the EU. Google modified search results. Meta allowed messaging interoperability. The DMA achieved more structural change in 18 months than antitrust litigation achieved in a decade.',
    keyLesson: 'Targeted structural remedies (interoperability, data access) achieve faster market correction than retrospective antitrust fines. Defining what gatekeepers must do, not just what they cannot do, is the key design innovation.',
  },
  {
    id: 'uk-online-safety-act',
    jurisdiction: 'United Kingdom',
    title: 'Online Safety Act',
    enacted: '2023',
    domain: 'Technology & Free Speech',
    description: 'Imposed a duty of care on social media platforms for harmful content — with Ofcom powers to fine up to £18m or 10% of global revenue. Took 5 years from proposal to Royal Assent.',
    implementation: 'weak',
    implementationLabel: 'Early — Ofcom codes of practice still being developed',
    publicAcceptance: 59,
    amendmentCount: 0,
    yearsInForce: 1,
    currentStatus: 'active',
    landmark: true,
    categories: ['technology', 'internet', 'social media', 'platform', 'speech', 'safety', 'online', 'children', 'content', 'moderation'],
    keyOutcome: 'Legislation passed; implementation codes in development. Major platforms have begun auditing systems ahead of enforcement. Critics from both left (too weak) and right (too censorious) remain active.',
    keyLesson: 'Platform regulation laws face an inherent tension between breadth and enforcement capacity. The law that tries to address everything often enforces nothing — specificity of duty determines implementation quality.',
  },
  // ── Labor & Economy ───────────────────────────────────────────────────────
  {
    id: 'germany-minimum-wage-2015',
    jurisdiction: 'Germany',
    title: 'German Statutory Minimum Wage Act',
    enacted: '2015',
    domain: 'Labor Policy',
    description: 'Introduced Germany\'s first statutory minimum wage at €8.50/hour — a country that had previously relied entirely on collective bargaining. Raised six times since 2015, reaching €12.41 in 2024.',
    implementation: 'strong',
    implementationLabel: 'Strong — no significant employment effect detected; wage floor raised nationwide',
    publicAcceptance: 76,
    amendmentCount: 6,
    yearsInForce: 9,
    currentStatus: 'amended',
    landmark: true,
    categories: ['economy', 'labor', 'wage', 'work', 'minimum wage', 'workers', 'employment', 'income'],
    keyOutcome: 'No statistically significant employment reduction found. Wage inequality narrowed. Low-wage sector improved significantly. Became a template for minimum wage skeptic countries.',
    keyLesson: 'Countries with strong collective bargaining traditions consistently find minimum wages have smaller disemployment effects than predicted. Pre-existing wage infrastructure matters enormously.',
  },
  {
    id: 'france-35-hour-week',
    jurisdiction: 'France',
    title: 'Aubry Laws — 35-Hour Working Week',
    enacted: '1998–2000',
    domain: 'Labor Policy',
    description: 'Reduced the legal working week from 39 to 35 hours, with the aim of sharing work and reducing unemployment. Created a complex system of overtime rules and company exemptions.',
    implementation: 'contested',
    implementationLabel: 'Contested — goal never achieved; became symbol of French exceptionalism',
    publicAcceptance: 48,
    amendmentCount: 8,
    yearsInForce: 24,
    currentStatus: 'amended',
    landmark: true,
    categories: ['economy', 'labor', 'work', 'hours', 'employment', 'workers', 'productivity', 'wages'],
    keyOutcome: 'Average actual working hours changed little due to widespread exemptions. Overtime pay system became very complex. International competitiveness debates persist. Cultural symbol outlasted its economic impact.',
    keyLesson: 'Labor laws that define maximum hours without addressing incentive structures get circumvented through overtime and exemption mechanisms. Cultural norms and regulatory design interact unpredictably.',
  },
  {
    id: 'us-gig-worker-prop-22',
    jurisdiction: 'California, USA',
    title: 'Proposition 22 — Gig Worker Classification',
    enacted: '2020',
    domain: 'Labor & Gig Economy',
    description: 'A ballot initiative overturning AB5 (which classified gig workers as employees) — backed by $220m in corporate spending, the most expensive ballot measure in California history.',
    implementation: 'moderate',
    implementationLabel: 'Partially implemented — partially struck down by courts',
    publicAcceptance: 58,
    amendmentCount: 0,
    yearsInForce: 4,
    currentStatus: 'contested',
    landmark: true,
    categories: ['labor', 'work', 'gig', 'economy', 'workers', 'employment', 'contractor', 'platform', 'uber', 'delivery'],
    keyOutcome: 'Passed 58-42%. California Supreme Court partially struck it down in 2024. Gig workers remain contractors. The fight established that corporate funding can override legislative intent via direct democracy.',
    keyLesson: 'Ballot initiatives allow corporations to override legislative intent with sufficient funding. The gig worker classification debate has no settled answer — expect recurring legal and legislative challenges.',
  },
  // ── Housing & Planning ────────────────────────────────────────────────────
  {
    id: 'germany-rent-brake',
    jurisdiction: 'Germany',
    title: 'Mietpreisbremse (Rent Brake)',
    enacted: '2015',
    domain: 'Housing Policy',
    description: 'Limited rent increases in designated "tight housing markets" to 10% above local reference rent. Berlin later attempted a more aggressive rent freeze, which the Constitutional Court struck down.',
    implementation: 'weak',
    implementationLabel: 'Weak — widely evaded; many exemptions; enforcement scarce',
    publicAcceptance: 54,
    amendmentCount: 3,
    yearsInForce: 9,
    currentStatus: 'amended',
    landmark: false,
    categories: ['housing', 'rent', 'property', 'landlord', 'tenant', 'housing', 'urban', 'affordability', 'home'],
    keyOutcome: 'Rents in "cold markets" (new tenancies) were not covered, severely limiting impact. Enforcement was tenant-initiated and legally complex. Court cases proliferated. Berlin\'s harder rent freeze was struck down by federal courts in 2021.',
    keyLesson: 'Rent controls require strong enforcement mechanisms to function; self-enforcement by tenants is rarely sufficient. Partial controls with many exemptions generate legal complexity without solving affordability.',
  },
  {
    id: 'uk-right-to-buy',
    jurisdiction: 'United Kingdom',
    title: 'Right to Buy — Housing Act 1980',
    enacted: '1980',
    domain: 'Housing Policy',
    description: 'Gave council house tenants the right to buy their home at a discount — a defining Thatcher policy that sold 2 million council homes and created a property-owning democracy.',
    implementation: 'strong',
    implementationLabel: 'Strong — fundamentally reshaped UK housing tenure',
    publicAcceptance: 73,
    amendmentCount: 15,
    yearsInForce: 44,
    currentStatus: 'amended',
    landmark: true,
    categories: ['housing', 'property', 'home', 'ownership', 'rent', 'council', 'tenant', 'privatisation'],
    keyOutcome: 'Over 2.2 million homes sold by 2022. Social housing stock fell from 31% to 17% of tenure. Contributed significantly to the current housing shortage. Has never been abolished despite political opposition.',
    keyLesson: 'Policies that transfer assets from public to private hands create permanent ownership stakes that make reversal politically toxic. The short-term beneficiary class becomes a durable political constituency.',
  },
  // ── Education ────────────────────────────────────────────────────────────
  {
    id: 'finland-education-reform',
    jurisdiction: 'Finland',
    title: 'Comprehensive School Reform',
    enacted: '1972',
    domain: 'Education',
    description: 'Finland abolished its dual-track education system (academic vs vocational split at age 11), replacing it with a unified nine-year comprehensive school for all children.',
    implementation: 'strong',
    implementationLabel: 'Strong — transformed outcomes over 20 years',
    publicAcceptance: 66,
    amendmentCount: 5,
    yearsInForce: 52,
    currentStatus: 'expanded',
    landmark: true,
    categories: ['education', 'school', 'learning', 'children', 'equality', 'teaching', 'curriculum', 'skills'],
    keyOutcome: 'Finland rose from average OECD outcomes to consistently top PISA rankings within two decades. Social mobility significantly improved. The reform is now studied globally as evidence that unified systems outperform tracked ones.',
    keyLesson: 'Education reforms require multi-decade evaluation windows. Political patience is the rarest ingredient — systems that change curricula every electoral cycle show the worst outcomes.',
  },
  {
    id: 'us-no-child-left-behind',
    jurisdiction: 'United States',
    title: 'No Child Left Behind Act',
    enacted: '2002',
    domain: 'Education',
    description: 'Required annual testing, school accountability, and "adequate yearly progress" for all schools — with sanctions for persistent underperformance including school closure.',
    implementation: 'contested',
    implementationLabel: 'Contested — widespread gaming of tests; replaced in 2015',
    publicAcceptance: 47,
    amendmentCount: 0,
    yearsInForce: 13,
    currentStatus: 'repealed',
    landmark: true,
    categories: ['education', 'school', 'learning', 'children', 'testing', 'standards', 'performance', 'accountability'],
    keyOutcome: 'Test score gaming became endemic. Schools narrowed curriculum to tested subjects. "Adequate Yearly Progress" requirements set 100% proficiency targets that nearly every school would eventually fail — a structural design flaw. Replaced by Every Student Succeeds Act in 2015.',
    keyLesson: 'Accountability systems with impossible targets and high stakes generate perverse incentives. Measuring what\'s easy to measure often crowds out what matters most.',
  },
  // ── Immigration ───────────────────────────────────────────────────────────
  {
    id: 'canada-points-system',
    jurisdiction: 'Canada',
    title: 'Points-Based Immigration System',
    enacted: '1967',
    domain: 'Immigration Policy',
    description: 'Canada became the first country to use a skills-based points system for immigration — selecting migrants on education, language ability, and work experience rather than national origin.',
    implementation: 'strong',
    implementationLabel: 'Strong — continuously refined and widely replicated',
    publicAcceptance: 71,
    amendmentCount: 22,
    yearsInForce: 57,
    currentStatus: 'expanded',
    landmark: true,
    categories: ['immigration', 'border', 'migration', 'visa', 'skilled', 'workers', 'national', 'citizenship', 'foreign'],
    keyOutcome: 'Canada\'s system has selected for human capital successfully for 57 years and maintained high public support for immigration (among the highest globally). Adopted by Australia, UK, and others.',
    keyLesson: 'Selection criteria that are transparent and merit-based maintain higher public legitimacy than quota-based systems. The political durability of immigration policies depends heavily on perceived fairness of the selection mechanism.',
  },
  {
    id: 'denmark-strict-immigration',
    jurisdiction: 'Denmark',
    title: 'Tightened Family Reunification Rules',
    enacted: '2002–present',
    domain: 'Immigration Policy',
    description: 'Denmark systematically tightened family reunification, integration contracts, and language requirements — creating some of the strictest immigration rules in the EU.',
    implementation: 'strong',
    implementationLabel: 'Strong — implemented but integration outcomes contested',
    publicAcceptance: 62,
    amendmentCount: 30,
    yearsInForce: 22,
    currentStatus: 'expanded',
    landmark: true,
    categories: ['immigration', 'border', 'migration', 'integration', 'asylum', 'foreign', 'national', 'citizenship', 'family'],
    keyOutcome: 'Immigration levels fell; language acquisition in immigrant communities improved. Long-term integration outcomes remain contested. Denmark\'s approach has influenced EU-wide debates on managed migration.',
    keyLesson: 'Restrictive immigration laws can achieve their stated aims, but integration outcomes depend far more on investment in settlement services than on entry restrictions. The two policy levers are often conflated.',
  },
  // ── Drug Policy ───────────────────────────────────────────────────────────
  {
    id: 'portugal-drug-decrim',
    jurisdiction: 'Portugal',
    title: 'Drug Decriminalisation Law',
    enacted: '2001',
    domain: 'Drug Policy',
    description: 'Decriminalised personal possession of all drugs — treating addiction as a public health issue rather than a criminal one. The most radical drug policy reform in modern European history.',
    implementation: 'strong',
    implementationLabel: 'Strong — drug deaths, HIV infection, and incarceration all fell sharply',
    publicAcceptance: 64,
    amendmentCount: 3,
    yearsInForce: 23,
    currentStatus: 'active',
    landmark: true,
    categories: ['drugs', 'decriminalisation', 'health', 'addiction', 'criminal', 'justice', 'cannabis', 'drug', 'policy'],
    keyOutcome: 'Drug-related HIV infections fell 95%. Drug-related deaths became the lowest in Europe. Drug use rates remained stable (did not increase). Prison population fell. Became the international benchmark for evidence-based drug policy.',
    keyLesson: 'Decriminalisation of drug possession, when paired with treatment investment, reduces harm without increasing use. The feared "signal" of increased drug use has not materialised in any decriminalising jurisdiction.',
  },
  {
    id: 'canada-cannabis-legalisation',
    jurisdiction: 'Canada',
    title: 'Cannabis Act — Federal Legalisation',
    enacted: '2018',
    domain: 'Drug Policy',
    description: 'Canada became the first G7 nation to federally legalise recreational cannabis — creating a heavily regulated legal market to displace the illegal one.',
    implementation: 'moderate',
    implementationLabel: 'Moderate — legal market grew but illegal market persists',
    publicAcceptance: 65,
    amendmentCount: 4,
    yearsInForce: 6,
    currentStatus: 'active',
    landmark: true,
    categories: ['drugs', 'cannabis', 'marijuana', 'legalisation', 'health', 'criminal', 'justice', 'drug'],
    keyOutcome: 'Legal cannabis industry generates C$5bn+ annually. Black market share fell from ~70% to ~35% by 2023. Tax revenue exceeded projections. Youth use rates have not increased. Road safety impacts remain debated.',
    keyLesson: 'Legal markets displace illegal ones slowly — usually 5–8 years to achieve majority market share. The transition requires sustainable legal pricing and consistent enforcement of unlicensed sellers.',
  },
  // ── Electoral & Constitutional ────────────────────────────────────────────
  {
    id: 'new-zealand-mmp',
    jurisdiction: 'New Zealand',
    title: 'Electoral Act 1993 — Mixed Member Proportional',
    enacted: '1993',
    domain: 'Electoral Reform',
    description: 'New Zealand switched from First Past the Post to Mixed Member Proportional representation — the most significant democratic reform in the country\'s history, confirmed in a second referendum.',
    implementation: 'strong',
    implementationLabel: 'Strong — fundamentally changed party system and representation',
    publicAcceptance: 54,
    amendmentCount: 4,
    yearsInForce: 31,
    currentStatus: 'active',
    landmark: true,
    categories: ['voting', 'election', 'democracy', 'reform', 'parliament', 'representation', 'proportional', 'government'],
    keyOutcome: 'Minor parties now consistently win seats. Women and minority representation increased markedly. Coalition governments became the norm. Despite a review in 2011 which offered reversal, NZ kept MMP by 58-42%.',
    keyLesson: 'Electoral system changes, once experienced for one or two cycles, tend to entrench. The parties that benefit from the new system form a coalition to protect it, even if they initially opposed it.',
  },
  {
    id: 'scotland-devolution',
    jurisdiction: 'United Kingdom',
    title: 'Scotland Act 1998 — Devolution',
    enacted: '1998',
    domain: 'Constitutional Reform',
    description: 'Established the Scottish Parliament with devolved powers over education, health, justice, and taxation — a fundamental constitutional change ratified by referendum (74% in favour).',
    implementation: 'strong',
    implementationLabel: 'Strong — stable institution for 25+ years, though independence question remains',
    publicAcceptance: 73,
    amendmentCount: 5,
    yearsInForce: 26,
    currentStatus: 'expanded',
    landmark: true,
    categories: ['government', 'constitution', 'democracy', 'parliament', 'devolution', 'power', 'national', 'regional'],
    keyOutcome: 'Scottish Parliament passed over 250 Acts in its first 20 years. Policy divergence from England emerged in health, education, and justice. The institution has significantly increased salience of the independence debate rather than settling it.',
    keyLesson: 'Devolution tends to strengthen, not weaken, regional identity. Constitutional settlements that were designed to resolve a national question often amplify it instead.',
  },
]

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function categoryScore(lawCategory: string | null, pool: PoolEntry): number {
  if (!lawCategory) return 0
  const cat = lawCategory.toLowerCase()
  let score = 0
  for (const kw of pool.categories) {
    if (cat.includes(kw) || kw.includes(cat)) {
      score += 30
      break
    }
  }
  return Math.min(score, 40)
}

function keywordScore(statement: string, pool: PoolEntry): number {
  const stmt = statement.toLowerCase()
  let hits = 0
  for (const kw of pool.categories) {
    if (stmt.includes(kw)) hits++
  }
  return Math.min(hits * 12, 40)
}

function implementationBonus(pool: PoolEntry): number {
  return pool.implementation === 'strong' ? 10 : pool.landmark ? 8 : 5
}

function buildReasons(
  lawCategory: string | null,
  statement: string,
  pool: PoolEntry,
): string[] {
  const reasons: string[] = []
  const stmt = statement.toLowerCase()
  const cat = lawCategory?.toLowerCase() ?? ''

  if (cat && (pool.categories.some((k) => k.includes(cat)) || pool.categories.some((k) => cat.includes(k)))) {
    reasons.push(`Both fall within the ${pool.domain} domain`)
  }
  const matchedKws = pool.categories.filter((k) => stmt.includes(k))
  if (matchedKws.length > 0) {
    reasons.push(`Shares thematic keywords: ${matchedKws.slice(0, 2).join(', ')}`)
  }
  if (pool.landmark) {
    reasons.push(`${pool.jurisdiction}'s ${pool.title} is a landmark reference law for this domain`)
  }
  if (pool.currentStatus === 'expanded') {
    reasons.push(`Both laws show signs of long-term political durability and expansion`)
  }
  if (pool.currentStatus === 'repealed' || pool.currentStatus === 'contested') {
    reasons.push(`${pool.jurisdiction}'s experience illustrates common implementation failure modes in this domain`)
  }
  if (reasons.length === 0) {
    reasons.push(`Structural and thematic overlap across policy dimensions`)
  }
  return reasons.slice(0, 3)
}

function extractThemes(statement: string, category: string | null): string[] {
  const text = [statement, category ?? ''].join(' ').toLowerCase()
  const candidates = [
    'taxation', 'healthcare', 'education', 'environment', 'immigration', 'housing',
    'technology', 'labor', 'workers', 'climate', 'digital', 'rights', 'equality',
    'criminal', 'justice', 'energy', 'privacy', 'economy', 'welfare', 'democracy',
    'elections', 'drugs', 'trade', 'finance', 'security',
  ]
  return candidates.filter((c) => text.includes(c)).slice(0, 5)
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()

  const { data: law, error } = await supabase
    .from('laws')
    .select('id, statement, category, total_votes, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (error || !law) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const statement: string = law.statement ?? ''
  const category: string | null = law.category ?? null

  // Score and rank pool entries
  type Scored = PoolEntry & { score: number; matchReasons: string[] }
  const scored: Scored[] = LAW_POOL.map((entry) => {
    const score =
      categoryScore(category, entry) +
      keywordScore(statement, entry) +
      implementationBonus(entry)
    return {
      ...entry,
      score: Math.min(score, 100),
      matchReasons: buildReasons(category, statement, entry),
    }
  })
  scored.sort((a, b) => b.score - a.score)

  // Top 5 with domain diversity
  const seenDomains = new Set<string>()
  const top: Scored[] = []
  for (const s of scored) {
    if (top.length >= 5) break
    if (!seenDomains.has(s.domain)) {
      seenDomains.add(s.domain)
      top.push(s)
    }
  }
  for (const s of scored) {
    if (top.length >= 5) break
    if (!top.find((t) => t.id === s.id)) top.push(s)
  }

  const maxRaw = top[0]?.score ?? 1
  const comparatives: GlobalLawComparative[] = top.map((t) => ({
    id: t.id,
    jurisdiction: t.jurisdiction,
    title: t.title,
    enacted: t.enacted,
    domain: t.domain,
    description: t.description,
    implementation: t.implementation,
    implementationLabel: t.implementationLabel,
    publicAcceptance: t.publicAcceptance,
    amendmentCount: t.amendmentCount,
    yearsInForce: t.yearsInForce,
    currentStatus: t.currentStatus,
    similarityScore: Math.round(42 + (t.score / maxRaw) * 53),
    matchReasons: t.matchReasons,
    keyOutcome: t.keyOutcome,
    keyLesson: t.keyLesson,
    landmark: t.landmark,
  }))

  // Implementation forecast
  const strongCount = top.filter((t) => t.implementation === 'strong').length
  const weakCount = top.filter((t) => t.implementation === 'weak' || t.implementation === 'contested').length
  const totalAmendments = top.reduce((s, t) => s + t.amendmentCount, 0)
  const avgAmendments = Math.round(totalAmendments / top.length)
  const totalYears = top.reduce((s, t) => s + t.yearsInForce, 0)
  const avgYears = Math.round(totalYears / top.length)
  const strongImplementationRate = Math.round((strongCount / top.length) * 100)

  let mostLikelyChallenges: string
  let confidenceScore: number

  if (strongImplementationRate >= 60) {
    mostLikelyChallenges =
      `Laws in this domain typically achieve strong implementation when enforcement mechanisms are well-designed. Historical comparatives average ${avgAmendments} amendments over ${avgYears} years — expect iterative refinement rather than wholesale revision.`
    confidenceScore = 72
  } else if (weakCount >= 3) {
    mostLikelyChallenges =
      `This policy domain has a challenging implementation track record. Comparable laws face enforcement gaps, industry adaptation, or legal challenge. Expect significant amendment activity and periodic review within 5 years.`
    confidenceScore = 65
  } else {
    mostLikelyChallenges =
      `Mixed implementation record in this domain. Success depends heavily on enforcement design and stakeholder buy-in. Laws with similar scope average ${avgAmendments} revisions before reaching stable form.`
    confidenceScore = 55
  }

  const themeFingerprint = extractThemes(statement, category)

  const top1 = comparatives[0]
  const overallInsight = top1
    ? `The closest global comparative is ${top1.jurisdiction}'s "${top1.title}" (${top1.enacted}) — a ${top1.domain.toLowerCase()} law with ${top1.implementationLabel.split('—')[0].trim().toLowerCase()} results. The key lesson from that experience: ${top1.keyLesson.split('.')[0]}.`
    : `This law spans a domain with rich international precedent. The comparatives surfaced here reflect the closest structural and thematic matches across ${LAW_POOL.length} global laws.`

  const response: LawParallelsResponse = {
    law: {
      id: law.id,
      statement,
      category,
      total_votes: law.total_votes ?? 0,
      established_at: law.established_at ?? null,
    },
    comparatives,
    implementationForecast: {
      mostLikelyChallenges,
      confidenceScore,
      basedOn: `${top.length} global law comparatives across ${[...seenDomains].join(', ')}`,
      averageAmendmentYears: avgYears,
      strongImplementationRate,
    },
    themeFingerprint,
    overallInsight,
  }

  return NextResponse.json(response)
}
