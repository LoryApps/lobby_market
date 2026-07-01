import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HistoricalParallel {
  id: string
  title: string
  period: string
  domain: string
  country: string
  description: string
  outcome: 'passed' | 'failed' | 'partial' | 'mixed'
  outcomeLabel: string
  forSentiment: number        // public support at peak, 0–100
  contestedLevel: 'low' | 'medium' | 'high' | 'fierce'
  resolutionTime: string
  similarityScore: number     // 0–100
  matchReasons: string[]
  keyLesson: string
  landmark: boolean
  currentRelevance: string    // how this applies TODAY
}

export interface ParallelsResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    total_arguments: number
  }
  parallels: HistoricalParallel[]
  precedentForecast: {
    mostLikelyOutcome: string
    confidenceScore: number   // 0–100
    basedOn: string
    historicalPassRate: number // % of similar historical debates that passed
  }
  themeFingerprint: string[]  // Keywords extracted from topic
  overallInsight: string
}

// ─── Historical parallels pool ────────────────────────────────────────────────

interface PoolEntry {
  id: string
  title: string
  period: string
  domain: string
  country: string
  description: string
  outcome: 'passed' | 'failed' | 'partial' | 'mixed'
  outcomeLabel: string
  forSentiment: number
  resolutionTime: string
  landmark: boolean
  categories: string[]        // matched categories (lowercase keywords)
  keyLesson: string
  currentRelevance: string
  minContestedScore: number   // 0–100 vote closeness (50=perfectly tied)
  maxContestedScore: number
}

const PARALLELS_POOL: PoolEntry[] = [
  // ── Economy / Taxation ───────────────────────────────────────────────────
  {
    id: 'reagan-tax-cut-1981',
    title: 'Reagan Economic Recovery Tax Act',
    period: '1981',
    domain: 'Economic Policy',
    country: 'United States',
    description: 'The largest peacetime tax cut in U.S. history, slashing top marginal rates from 70% to 50% — a defining debate over supply-side economics versus government investment.',
    outcome: 'passed',
    outcomeLabel: 'Passed into law',
    forSentiment: 62,
    resolutionTime: '8 months',
    landmark: true,
    categories: ['economy', 'tax', 'fiscal', 'budget', 'wealth', 'income'],
    keyLesson: 'Landmark economic legislation typically requires a compelling narrative about who benefits — in this case, "trickle-down" framing moved moderates who initially opposed it.',
    currentRelevance: 'Tax debates today echo the same fault lines: growth vs. equity, investment vs. redistribution. The pattern of initial opposition softening under economic pressure persists.',
    minContestedScore: 55,
    maxContestedScore: 100,
  },
  {
    id: 'minimum-wage-1938',
    title: 'Fair Labor Standards Act — Minimum Wage',
    period: '1938',
    domain: 'Labor & Economy',
    country: 'United States',
    description: 'The introduction of the first federal minimum wage at $0.25/hour — a fiercely contested battle between business interests and labor advocates that took nearly a decade of organizing.',
    outcome: 'passed',
    outcomeLabel: 'Passed into law',
    forSentiment: 58,
    resolutionTime: '7 years',
    landmark: true,
    categories: ['economy', 'labor', 'wage', 'work', 'minimum wage', 'workers'],
    keyLesson: 'Economic reforms with broad working-class support ultimately prevail, but only when advocates build coalition with middle-class stakeholders who fear the alternative.',
    currentRelevance: 'Every minimum wage debate since has used the same framework: opponents forecast job losses, proponents cite dignity and demand — and history shows the job losses are consistently overstated.',
    minContestedScore: 52,
    maxContestedScore: 100,
  },
  {
    id: 'thatcher-poll-tax-1990',
    title: "Thatcher's Community Charge (Poll Tax)",
    period: '1989–1990',
    domain: 'Taxation & Civil Unrest',
    country: 'United Kingdom',
    description: 'A flat-rate local tax replacing property-based rates — widely perceived as unfair to low earners. Led to the 1990 Trafalgar Square riots and Thatcher\'s resignation.',
    outcome: 'failed',
    outcomeLabel: 'Repealed within 2 years',
    forSentiment: 35,
    resolutionTime: '18 months before repeal',
    landmark: true,
    categories: ['economy', 'tax', 'fiscal', 'equality', 'fairness', 'wealth'],
    keyLesson: 'Even politically dominant governments cannot sustain policies perceived as structurally unfair to the majority. Flat taxes on unequal populations generate disproportionate backlash.',
    currentRelevance: 'Tax proposals framed as "everyone pays equally" face the same public fairness test — when equality ignores inequality, political costs are severe.',
    minContestedScore: 0,
    maxContestedScore: 45,
  },
  // ── Healthcare ───────────────────────────────────────────────────────────
  {
    id: 'medicare-1965',
    title: 'Medicare & Medicaid Act',
    period: '1965',
    domain: 'Healthcare',
    country: 'United States',
    description: 'After 20 years of failed attempts, LBJ signed healthcare for seniors and the poor. The AMA called it "socialized medicine." It now covers 150 million Americans.',
    outcome: 'passed',
    outcomeLabel: 'Passed — became permanent',
    forSentiment: 57,
    resolutionTime: '20 years of debate',
    landmark: true,
    categories: ['healthcare', 'health', 'medical', 'insurance', 'medicare', 'medicaid', 'care'],
    keyLesson: 'Healthcare reforms that appear politically impossible can pass when a legislative supermajority aligns with a public mandate — and once established, become nearly impossible to repeal.',
    currentRelevance: 'No major healthcare expansion in the U.S. has ever been fully repealed. Programs that create direct beneficiaries build their own political constituencies.',
    minContestedScore: 48,
    maxContestedScore: 100,
  },
  {
    id: 'aca-2010',
    title: 'Affordable Care Act (Obamacare)',
    period: '2009–2010',
    domain: 'Healthcare',
    country: 'United States',
    description: 'The most significant healthcare legislation since Medicare — passed without a single Republican vote after 14 months of debate and 11,000+ amendments.',
    outcome: 'passed',
    outcomeLabel: 'Passed — core provisions survived repeal attempts',
    forSentiment: 52,
    resolutionTime: '14 months',
    landmark: true,
    categories: ['healthcare', 'health', 'insurance', 'coverage', 'mandate', 'medical'],
    keyLesson: 'Partisan-only passage of major legislation creates perpetual political vulnerability, but once 20M+ people gain coverage, full repeal becomes politically toxic.',
    currentRelevance: 'Healthcare debates are rarely about policy alone — they\'re about which party "owns" the issue. The side that controls the narrative frame usually wins.',
    minContestedScore: 45,
    maxContestedScore: 60,
  },
  // ── Civil Rights / Equality ──────────────────────────────────────────────
  {
    id: 'civil-rights-act-1964',
    title: 'Civil Rights Act of 1964',
    period: '1964',
    domain: 'Civil Rights',
    country: 'United States',
    description: 'Banned discrimination based on race, color, religion, sex, or national origin — after an 83-day Senate filibuster, the longest in U.S. history.',
    outcome: 'passed',
    outcomeLabel: 'Passed — landmark law',
    forSentiment: 61,
    resolutionTime: '1 year (with century of organizing behind it)',
    landmark: true,
    categories: ['rights', 'equality', 'discrimination', 'race', 'civil rights', 'justice', 'gender', 'fairness'],
    keyLesson: 'Structural civil rights changes require both moral framing AND political coalition-building. The filibuster collapsed only when economic and international pressure aligned with domestic organizing.',
    currentRelevance: 'Rights expansions that seem radical in their time become baseline moral consensus within a generation. Opposition that seems principled often reframes as "timing" or "process."',
    minContestedScore: 50,
    maxContestedScore: 100,
  },
  {
    id: 'women-suffrage-1920',
    title: "Women's Suffrage — 19th Amendment",
    period: '1848–1920',
    domain: 'Civil Rights & Voting',
    country: 'United States',
    description: 'The right for women to vote — a 72-year campaign from Seneca Falls to ratification, facing constant arguments that women were "not suited" for political life.',
    outcome: 'passed',
    outcomeLabel: 'Ratified after 72 years',
    forSentiment: 54,
    resolutionTime: '72 years',
    landmark: true,
    categories: ['rights', 'voting', 'gender', 'equality', 'women', 'suffrage', 'democracy'],
    keyLesson: 'Enfranchisement reforms almost always take longer than any single generation expects, and the strongest arguments against them — based on "nature" or "social order" — become the most embarrassing to history.',
    currentRelevance: 'Arguments that exclude groups from civic participation on the grounds of "suitability" have a 100% historical reversal rate. The timeline varies; the outcome doesn\'t.',
    minContestedScore: 40,
    maxContestedScore: 100,
  },
  {
    id: 'marriage-equality-2015',
    title: 'Marriage Equality — Obergefell v. Hodges',
    period: '2003–2015',
    domain: 'Civil Rights',
    country: 'United States',
    description: 'Same-sex marriage legalized nationally — shifting from 27% public support in 2003 to 60% by the time SCOTUS ruled, an historically rapid shift in public opinion.',
    outcome: 'passed',
    outcomeLabel: 'Supreme Court affirmed, 5–4',
    forSentiment: 60,
    resolutionTime: '12 years',
    landmark: true,
    categories: ['rights', 'marriage', 'equality', 'lgbtq', 'gay', 'gender', 'family'],
    keyLesson: 'Public opinion on rights issues can shift faster than any political institution. By the time SCOTUS ruled, the debate had already been won in the court of public opinion.',
    currentRelevance: 'Rights debates often follow a sigmoid curve: slow initial movement, then rapid acceleration once a tipping point of personal connection is reached in the electorate.',
    minContestedScore: 35,
    maxContestedScore: 65,
  },
  // ── Environment ──────────────────────────────────────────────────────────
  {
    id: 'clean-air-act-1970',
    title: 'Clean Air Act',
    period: '1970',
    domain: 'Environment',
    country: 'United States',
    description: 'Landmark environmental legislation establishing the EPA — passed during the first Earth Day era when smog and pollution crises made inaction politically untenable.',
    outcome: 'passed',
    outcomeLabel: 'Passed — bipartisan landslide',
    forSentiment: 73,
    resolutionTime: '2 years',
    landmark: true,
    categories: ['environment', 'climate', 'pollution', 'air', 'emissions', 'carbon', 'green', 'sustainability'],
    keyLesson: 'Environmental legislation passes when the harm is visible and immediate. Abstract future threats struggle; present-day crises generate the political will for action.',
    currentRelevance: 'Climate debates that fail to connect abstract projections to present-day experiences consistently struggle for majority support. Localizing the cost changes the calculus.',
    minContestedScore: 55,
    maxContestedScore: 100,
  },
  {
    id: 'paris-agreement-2016',
    title: 'Paris Climate Agreement',
    period: '2015–2016',
    domain: 'Climate Policy',
    country: 'Global',
    description: 'Historic multilateral climate accord signed by 196 nations — then withdrawn from by the U.S. in 2017, rejoined in 2021. A case study in policy fragility without institutional lock-in.',
    outcome: 'mixed',
    outcomeLabel: 'Signed — then contested, then reaffirmed',
    forSentiment: 66,
    resolutionTime: '30+ years of negotiation',
    landmark: true,
    categories: ['environment', 'climate', 'global', 'emissions', 'carbon', 'international', 'sustainability'],
    keyLesson: 'International agreements without domestic enforcement mechanisms are vulnerable to political reversal. Durability requires institutional embedding, not just political momentum.',
    currentRelevance: 'Any policy that can be reversed by executive action alone is inherently fragile. The Paris Agreement demonstrated that "global consensus" doesn\'t override domestic political cycles.',
    minContestedScore: 40,
    maxContestedScore: 75,
  },
  // ── Technology / Privacy ─────────────────────────────────────────────────
  {
    id: 'gdpr-2018',
    title: 'GDPR — General Data Protection Regulation',
    period: '2012–2018',
    domain: 'Technology & Privacy',
    country: 'European Union',
    description: 'The most comprehensive digital privacy law ever enacted — setting a global standard despite fierce tech industry opposition. Took 6 years from proposal to implementation.',
    outcome: 'passed',
    outcomeLabel: 'Enacted — became global standard',
    forSentiment: 64,
    resolutionTime: '6 years',
    landmark: true,
    categories: ['technology', 'privacy', 'data', 'internet', 'digital', 'ai', 'surveillance', 'tech'],
    keyLesson: 'Tech regulation initially framed as "anti-innovation" often becomes the baseline standard that better-regulated industries use as a competitive advantage.',
    currentRelevance: 'Digital rights debates follow the GDPR pattern: industry resistance, regulatory capture attempts, then acceptance once the standard is set by a major jurisdiction.',
    minContestedScore: 45,
    maxContestedScore: 80,
  },
  {
    id: 'section-230-cda',
    title: 'Section 230 of the Communications Decency Act',
    period: '1996–present',
    domain: 'Technology & Free Speech',
    country: 'United States',
    description: 'The legal foundation of the modern internet — a 26-word provision shielding platforms from liability for user content. Now both sides of the political spectrum want to repeal it, for opposite reasons.',
    outcome: 'mixed',
    outcomeLabel: 'Passed in 1996 — reform perpetually debated',
    forSentiment: 55,
    resolutionTime: 'Ongoing since 1996',
    landmark: true,
    categories: ['technology', 'speech', 'internet', 'platform', 'social media', 'content', 'censorship', 'moderation'],
    keyLesson: 'Foundational internet policy, once established, becomes load-bearing infrastructure — politically impossible to remove even when all sides agree it\'s imperfect.',
    currentRelevance: 'Platform governance debates mirror Section 230: the question is never whether to have rules, but who sets them and who benefits from the current state of affairs.',
    minContestedScore: 40,
    maxContestedScore: 70,
  },
  // ── Education ────────────────────────────────────────────────────────────
  {
    id: 'brown-v-board',
    title: 'Brown v. Board of Education',
    period: '1954',
    domain: 'Education & Civil Rights',
    country: 'United States',
    description: 'Unanimous SCOTUS ruling ending school segregation — yet 10 years later, only 1.2% of Black children in the Deep South attended integrated schools. A gap between law and implementation.',
    outcome: 'passed',
    outcomeLabel: 'Ruled unanimously — implementation took decades',
    forSentiment: 60,
    resolutionTime: '3 years of litigation — decades of compliance',
    landmark: true,
    categories: ['education', 'school', 'equality', 'race', 'civil rights', 'access'],
    keyLesson: 'Legal wins without implementation infrastructure often fail in practice. The gap between a ruling and a reality is where most reform dies.',
    currentRelevance: 'Education debates about access and equity consistently underestimate implementation complexity. The policy that passes on paper and the policy that changes lives are often very different.',
    minContestedScore: 50,
    maxContestedScore: 100,
  },
  {
    id: 'no-child-left-behind',
    title: 'No Child Left Behind Act',
    period: '2001–2002',
    domain: 'Education',
    country: 'United States',
    description: 'Landmark bipartisan education reform — initial consensus eroded as standardized testing mandates proved punishing to under-resourced schools. Eventually replaced in 2015.',
    outcome: 'partial',
    outcomeLabel: 'Passed — revised after 13 years',
    forSentiment: 68,
    resolutionTime: '13 years before reform',
    landmark: false,
    categories: ['education', 'school', 'testing', 'standards', 'children', 'teachers', 'curriculum'],
    keyLesson: 'Bipartisan agreement on goals doesn\'t guarantee agreement on methods. Accountability mechanisms that looked sensible in theory created perverse incentives in practice.',
    currentRelevance: 'High-accountability education policies generate political consensus at launch but face implementation backlash when unintended consequences emerge at scale.',
    minContestedScore: 55,
    maxContestedScore: 100,
  },
  // ── Immigration ──────────────────────────────────────────────────────────
  {
    id: 'irca-1986',
    title: 'Immigration Reform and Control Act',
    period: '1986',
    domain: 'Immigration',
    country: 'United States',
    description: 'Reagan-era "grand bargain" — 3M undocumented immigrants legalized, employers sanctioned for hiring. Enforcement provisions proved weak; a lesson in unenforceable compromise.',
    outcome: 'partial',
    outcomeLabel: 'Passed — enforcement provisions failed',
    forSentiment: 57,
    resolutionTime: '6 years of debate',
    landmark: true,
    categories: ['immigration', 'border', 'migrants', 'citizenship', 'asylum', 'visa'],
    keyLesson: 'Compromise legislation that papers over structural disagreements creates policy that satisfies no one and is enforced selectively based on political convenience.',
    currentRelevance: 'Immigration "grand bargains" have repeatedly failed because they require long-term institutional commitment from actors with short-term political incentives.',
    minContestedScore: 40,
    maxContestedScore: 70,
  },
  // ── Criminal Justice ─────────────────────────────────────────────────────
  {
    id: 'crime-bill-1994',
    title: '1994 Violent Crime Control Act',
    period: '1994',
    domain: 'Criminal Justice',
    country: 'United States',
    description: 'Biden-authored crime bill — passed with broad bipartisan support and CBC backing at the time, later criticized for contributing to mass incarceration. A lesson in second-order effects.',
    outcome: 'passed',
    outcomeLabel: 'Passed — bipartisan; later widely criticized',
    forSentiment: 65,
    resolutionTime: '2 years',
    landmark: true,
    categories: ['criminal justice', 'crime', 'police', 'prison', 'sentencing', 'law enforcement', 'justice'],
    keyLesson: 'Legislation passed during a crisis often over-corrects in ways its authors don\'t anticipate. Second-order effects in criminal justice policy typically emerge over decades, not years.',
    currentRelevance: 'Criminal justice debates require honest accounting of what the research actually shows — outcomes in criminal justice rarely match the intentions of legislation.',
    minContestedScore: 55,
    maxContestedScore: 100,
  },
  // ── Gun Policy ───────────────────────────────────────────────────────────
  {
    id: 'gun-control-act-1968',
    title: 'Gun Control Act of 1968',
    period: '1968',
    domain: 'Gun Policy',
    country: 'United States',
    description: 'Passed after the assassinations of MLK and RFK — the first major federal gun legislation since 1938. A case study in crisis-driven policy that shapes the parameters of every debate since.',
    outcome: 'passed',
    outcomeLabel: 'Passed — set framework for all future gun law',
    forSentiment: 66,
    resolutionTime: '6 months post-assassination',
    landmark: true,
    categories: ['gun', 'firearms', 'weapons', 'second amendment', 'violence', 'public safety'],
    keyLesson: 'Gun legislation passes primarily in the immediate aftermath of high-profile crises. The "window" for action is historically 6–12 months before opposition regroups.',
    currentRelevance: 'Gun debates in the U.S. have changed parameters but not fundamental dynamics since 1968. The crisis-response cycle repeats without structural change to the political calculus.',
    minContestedScore: 45,
    maxContestedScore: 100,
  },
  // ── Social Policy / Welfare ──────────────────────────────────────────────
  {
    id: 'social-security-1935',
    title: 'Social Security Act',
    period: '1935',
    domain: 'Social Policy',
    country: 'United States',
    description: 'FDR\'s Depression-era safety net — called "socialism" by opponents. Now one of the most popular government programs, with 70+ years of political untouchability.',
    outcome: 'passed',
    outcomeLabel: 'Passed — permanent, politically immovable',
    forSentiment: 62,
    resolutionTime: '3 years',
    landmark: true,
    categories: ['welfare', 'social', 'retirement', 'poverty', 'inequality', 'benefits', 'safety net', 'pension'],
    keyLesson: 'Universal benefit programs become self-reinforcing politically — every generation becomes a constituency. Programs with broad base coverage are nearly impossible to repeal.',
    currentRelevance: 'The lesson of Social Security is that the hardest program to build is also the hardest to dismantle. Universal programs generate universal constituencies.',
    minContestedScore: 50,
    maxContestedScore: 100,
  },
  {
    id: 'welfare-reform-1996',
    title: 'Personal Responsibility and Work Opportunity Act',
    period: '1994–1996',
    domain: 'Social Policy',
    country: 'United States',
    description: 'Clinton-signed welfare reform ending AFDC — replacing entitlements with time-limited grants. Economists still debate whether it reduced poverty or created "deep poverty."',
    outcome: 'passed',
    outcomeLabel: 'Passed — effects remain fiercely debated',
    forSentiment: 58,
    resolutionTime: '2 years',
    landmark: true,
    categories: ['welfare', 'poverty', 'benefits', 'social', 'work', 'assistance', 'inequality'],
    keyLesson: 'Social policy whose effects are invisible to middle-class voters tends to get revised based on political narrative rather than empirical evidence of who is helped or harmed.',
    currentRelevance: 'Benefits debates that frame recipients as "deserving" vs. "undeserving" consistently distort policy toward politically satisfying but empirically weak solutions.',
    minContestedScore: 40,
    maxContestedScore: 70,
  },
  // ── Drug Policy ──────────────────────────────────────────────────────────
  {
    id: 'prohibition-1920',
    title: 'National Prohibition Act (Volstead Act)',
    period: '1919–1933',
    domain: 'Drug & Social Policy',
    country: 'United States',
    description: 'The complete federal ban on alcohol — a moral reform that generated organized crime, corruption, and eventually its own repeal 14 years later. The textbook case of unenforceable law.',
    outcome: 'failed',
    outcomeLabel: 'Enacted — repealed 14 years later',
    forSentiment: 55,
    resolutionTime: '14 years before repeal',
    landmark: true,
    categories: ['drug', 'alcohol', 'prohibition', 'substance', 'legalization', 'ban', 'regulation', 'cannabis', 'marijuana'],
    keyLesson: 'Prohibitions on widely desired activities consistently generate black markets. The question is never whether demand disappears — it\'s whether legal or illegal actors satisfy it.',
    currentRelevance: 'Any debate about prohibition of a widely used substance must grapple with Prohibition\'s lesson: banning the supply without eliminating the demand creates criminal enterprise.',
    minContestedScore: 40,
    maxContestedScore: 70,
  },
  // ── Free Speech / Media ──────────────────────────────────────────────────
  {
    id: 'fairness-doctrine-1987',
    title: 'FCC Fairness Doctrine Repeal',
    period: '1949–1987',
    domain: 'Media & Free Speech',
    country: 'United States',
    description: 'Requiring broadcasters to cover controversial topics fairly — repealed in 1987. Within a decade, political talk radio exploded. Widely cited as a factor in media polarization.',
    outcome: 'failed',
    outcomeLabel: 'Repealed — polarization followed',
    forSentiment: 42,
    resolutionTime: '38 years — then abruptly ended',
    landmark: false,
    categories: ['media', 'speech', 'free speech', 'information', 'press', 'news', 'content', 'social media', 'censorship'],
    keyLesson: 'Regulations removed in the name of free speech often produce homogenization of opinion through market incentives rather than diversity through pluralism.',
    currentRelevance: 'Media platform governance debates today mirror the Fairness Doctrine debate: the question is whether market forces produce "more speech" or more partisan entrenchment.',
    minContestedScore: 35,
    maxContestedScore: 65,
  },
  // ── Housing ──────────────────────────────────────────────────────────────
  {
    id: 'housing-act-1949',
    title: 'Housing Act of 1949',
    period: '1947–1949',
    domain: 'Housing & Urban Policy',
    country: 'United States',
    description: '"A decent home and suitable living environment for every American family" — the stated goal of federal housing policy. Urban renewal programs that followed often destroyed more housing than they created.',
    outcome: 'partial',
    outcomeLabel: 'Passed — implementation fell far short of goals',
    forSentiment: 63,
    resolutionTime: '2 years',
    landmark: false,
    categories: ['housing', 'rent', 'home', 'zoning', 'urban', 'shelter', 'affordable', 'property'],
    keyLesson: 'Housing policy with noble stated goals routinely produces outcomes that harm the constituencies it claims to serve. Urban renewal required community-level implementation that federal law couldn\'t mandate.',
    currentRelevance: 'Housing reforms that don\'t address local zoning, community opposition, and implementation infrastructure consistently underperform their stated goals.',
    minContestedScore: 45,
    maxContestedScore: 80,
  },
  // ── Finance ──────────────────────────────────────────────────────────────
  {
    id: 'glass-steagall-1933',
    title: 'Glass-Steagall Act',
    period: '1933',
    domain: 'Financial Regulation',
    country: 'United States',
    description: 'Separated commercial and investment banking after the 1929 crash — repealed in 1999. The 2008 financial crisis renewed the debate about whether its absence mattered.',
    outcome: 'passed',
    outcomeLabel: 'Passed — repealed 66 years later',
    forSentiment: 67,
    resolutionTime: '1 year (post-crash urgency)',
    landmark: true,
    categories: ['finance', 'banking', 'financial', 'regulation', 'wall street', 'economy', 'market'],
    keyLesson: 'Crisis-driven financial regulation tends to be strong at passage but gradually weakened through industry lobbying during stable periods — until the next crisis.',
    currentRelevance: 'Financial regulation debates cycle between crisis-driven expansion and prosperity-driven rollback. The political economy almost always favors the industry during good times.',
    minContestedScore: 50,
    maxContestedScore: 100,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function categorySimilarity(category: string | null, pool: PoolEntry): number {
  if (!category) return 0
  const cat = category.toLowerCase()
  const catWords = cat.split(/[\s,/&]+/)
  let score = 0
  for (const word of catWords) {
    if (word.length < 3) continue
    for (const poolCat of pool.categories) {
      if (poolCat.includes(word) || word.includes(poolCat)) {
        score += poolCat === word ? 40 : 20
      }
    }
  }
  return Math.min(score, 50)
}

function contestedSimilarity(bluePct: number, pool: PoolEntry): number {
  // closeness: 0=one-sided (e.g. blue_pct=90), 50=tied
  const closeness = 50 - Math.abs(bluePct - 50)
  const inRange = closeness >= pool.minContestedScore && closeness <= pool.maxContestedScore
  if (!inRange) return 0
  const midRange = (pool.minContestedScore + pool.maxContestedScore) / 2
  const dist = Math.abs(closeness - midRange)
  const range = (pool.maxContestedScore - pool.minContestedScore) / 2 || 1
  return Math.round(30 * (1 - dist / range))
}

function outcomeSimilarity(status: string, pool: PoolEntry): number {
  if (status === 'law' && pool.outcome === 'passed') return 20
  if (status === 'failed' && pool.outcome === 'failed') return 20
  if (status === 'active' || status === 'proposed' || status === 'voting') {
    return pool.outcome === 'partial' || pool.outcome === 'mixed' ? 10 : 5
  }
  return 0
}

function buildMatchReasons(
  topic: { category: string | null; blue_pct: number; status: string; total_votes: number },
  pool: PoolEntry,
): string[] {
  const reasons: string[] = []
  const bluePct = topic.blue_pct ?? 50
  const closeness = 50 - Math.abs(bluePct - 50)

  if (categorySimilarity(topic.category, pool) > 15) {
    reasons.push(`Both debates fall within the ${pool.domain} domain`)
  }
  if (closeness > 35 && pool.minContestedScore > 30) {
    reasons.push(`Both were highly contested with no clear dominant position early on`)
  } else if (closeness < 20 && pool.maxContestedScore < 50) {
    reasons.push(`Both debates saw one side hold a structural advantage`)
  }
  if (topic.status === 'law' && pool.outcome === 'passed') {
    reasons.push(`Both measures achieved passage — the winning coalition paths share structural similarities`)
  }
  if (topic.status === 'failed' && pool.outcome === 'failed') {
    reasons.push(`Both failed to achieve full passage — the resistance patterns are comparable`)
  }
  if (topic.total_votes > 1000 && pool.landmark) {
    reasons.push(`Both are landmark-scale debates with high civic participation`)
  }
  if (reasons.length === 0) {
    reasons.push(`Thematic and structural overlap across debate dimensions`)
  }
  return reasons.slice(0, 3)
}

function extractThemes(statement: string, category: string | null, args: { content: string }[]): string[] {
  const allText = [statement, category ?? '', ...args.map((a) => a.content)].join(' ').toLowerCase()
  const candidates = [
    'taxation', 'healthcare', 'education', 'environment', 'immigration', 'rights',
    'technology', 'economy', 'housing', 'security', 'labor', 'equality', 'justice',
    'privacy', 'speech', 'governance', 'reform', 'regulation', 'welfare', 'climate',
  ]
  const found = candidates.filter((c) => allText.includes(c))
  return found.slice(0, 5)
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const topicId = params.id

  // ── 1. Fetch topic ────────────────────────────────────────────────────────
  const { data: topic, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at')
    .eq('id', topicId)
    .maybeSingle()

  if (error || !topic) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // ── 2. Fetch top arguments for theme extraction ────────────────────────────
  const { data: topArgs } = await supabase
    .from('arguments')
    .select('content, side, upvotes')
    .eq('topic_id', topicId)
    .order('upvotes', { ascending: false })
    .limit(20)

  const args = topArgs ?? []

  // ── 3. Fetch total argument count ─────────────────────────────────────────
  const { count: argCount } = await supabase
    .from('arguments')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', topicId)

  const totalArguments = argCount ?? 0
  const bluePct = topic.blue_pct ?? 50
  const totalVotes = topic.total_votes ?? 0

  // ── 4. Score parallels ────────────────────────────────────────────────────
  type ScoredEntry = PoolEntry & { score: number; matchReasons: string[] }
  const topicForScoring = {
    category: topic.category,
    blue_pct: bluePct,
    status: topic.status,
    total_votes: totalVotes,
  }

  const scored: ScoredEntry[] = PARALLELS_POOL.map((entry) => {
    const catScore = categorySimilarity(topic.category, entry)
    const contestScore = contestedSimilarity(bluePct, entry)
    const outScore = outcomeSimilarity(topic.status, entry)
    const landmarkBonus = entry.landmark && totalVotes > 500 ? 5 : 0
    const total = catScore + contestScore + outScore + landmarkBonus
    return {
      ...entry,
      score: Math.min(total, 100),
      matchReasons: buildMatchReasons(topicForScoring, entry),
    }
  })

  scored.sort((a, b) => b.score - a.score)

  // ── 5. Take top 5, ensure variety ─────────────────────────────────────────
  const seen = new Set<string>()
  const top: ScoredEntry[] = []
  for (const s of scored) {
    if (top.length >= 5) break
    if (!seen.has(s.domain)) {
      seen.add(s.domain)
      top.push(s)
    }
  }
  // Fill remaining slots from remaining scored
  for (const s of scored) {
    if (top.length >= 5) break
    if (!top.find((t) => t.id === s.id)) {
      top.push(s)
    }
  }

  // Normalise scores to be relative to the top match
  const maxRaw = top[0]?.score ?? 1
  const parallels: HistoricalParallel[] = top.map((t) => ({
    id: t.id,
    title: t.title,
    period: t.period,
    domain: t.domain,
    country: t.country,
    description: t.description,
    outcome: t.outcome,
    outcomeLabel: t.outcomeLabel,
    forSentiment: t.forSentiment,
    contestedLevel: (() => {
      const closeness = 50 - Math.abs(t.forSentiment - 50)
      if (closeness > 40) return 'fierce'
      if (closeness > 30) return 'high'
      if (closeness > 15) return 'medium'
      return 'low'
    })(),
    resolutionTime: t.resolutionTime,
    similarityScore: Math.round(40 + (t.score / maxRaw) * 55),
    matchReasons: t.matchReasons,
    keyLesson: t.keyLesson,
    landmark: t.landmark,
    currentRelevance: t.currentRelevance,
  }))

  // ── 6. Precedent forecast ─────────────────────────────────────────────────
  const passedCount = top.filter((t) => t.outcome === 'passed').length
  const historicalPassRate = Math.round((passedCount / top.length) * 100)
  const closeness = 50 - Math.abs(bluePct - 50)

  let mostLikelyOutcome: string
  let confidenceScore: number

  if (topic.status === 'law') {
    mostLikelyOutcome = 'Already enacted — historical parallels suggest similar laws face significant implementation challenges in the first 3–5 years.'
    confidenceScore = 85
  } else if (topic.status === 'failed') {
    mostLikelyOutcome = 'Already failed — historical parallels suggest revival attempts typically take 5–15 years and require a significant political realignment.'
    confidenceScore = 78
  } else if (historicalPassRate >= 70 && closeness > 30) {
    mostLikelyOutcome = 'Strong historical precedent for passage in contested debates of this type — requires sustained coalition building.'
    confidenceScore = 65
  } else if (historicalPassRate <= 30) {
    mostLikelyOutcome = 'Historical parallels trend toward failure or partial implementation — structural opposition typically prevails in debates of this type.'
    confidenceScore = 58
  } else {
    mostLikelyOutcome = 'Mixed historical precedent — outcome highly sensitive to the quality of the winning coalition and near-term political conditions.'
    confidenceScore = 45
  }

  const themeFingerprint = extractThemes(topic.statement, topic.category, args)

  // ── 7. Overall insight ────────────────────────────────────────────────────
  const topParallel = parallels[0]
  const overallInsight = topParallel
    ? `The closest historical mirror is "${topParallel.title}" (${topParallel.period}) — a ${topParallel.domain.toLowerCase()} debate that ${topParallel.outcome === 'passed' ? 'passed' : topParallel.outcome === 'failed' ? 'failed' : 'had a mixed outcome'} with ${topParallel.forSentiment}% public support at its peak. The key lesson from that era: ${topParallel.keyLesson.split('.')[0]}.`
    : `This debate spans a domain with rich historical precedent. The parallels surfaced here reflect the closest structural and thematic matches across ${PARALLELS_POOL.length} landmark historical debates.`

  const response: ParallelsResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: bluePct,
      total_votes: totalVotes,
      total_arguments: totalArguments,
    },
    parallels,
    precedentForecast: {
      mostLikelyOutcome,
      confidenceScore,
      basedOn: `${top.length} historical parallels across ${[...new Set(top.map((t) => t.domain))].join(', ')}`,
      historicalPassRate,
    },
    themeFingerprint,
    overallInsight,
  }

  return NextResponse.json(response)
}
