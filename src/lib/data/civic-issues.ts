export interface CivicIssue {
  slug: string
  title: string
  description: string
  tags: string[]
  categories: string[]
  color: string
  icon: string
}

export const CIVIC_ISSUES: CivicIssue[] = [
  {
    slug: 'climate',
    title: 'Climate & Environment',
    description: 'Emissions, energy policy, conservation, and the planet\'s future',
    tags: ['climate', 'environment', 'energy', 'emissions', 'carbon', 'renewable', 'fossil', 'nuclear', 'green'],
    categories: ['Environment', 'Science'],
    color: 'emerald',
    icon: 'Leaf',
  },
  {
    slug: 'economy',
    title: 'Economy & Taxes',
    description: 'Taxation, trade, wages, inequality, and economic growth',
    tags: ['tax', 'economy', 'wage', 'trade', 'inequality', 'income', 'wealth', 'tariff', 'inflation', 'gdp'],
    categories: ['Economics'],
    color: 'gold',
    icon: 'TrendingUp',
  },
  {
    slug: 'democracy',
    title: 'Democracy & Voting',
    description: 'Elections, representation, campaign finance, and civic participation',
    tags: ['voting', 'election', 'democracy', 'representation', 'campaign', 'senate', 'congress', 'parliament'],
    categories: ['Politics'],
    color: 'for',
    icon: 'Vote',
  },
  {
    slug: 'technology',
    title: 'Technology & AI',
    description: 'Artificial intelligence, social media, privacy, and digital rights',
    tags: ['ai', 'technology', 'social media', 'privacy', 'data', 'algorithm', 'digital', 'surveillance', 'internet'],
    categories: ['Technology'],
    color: 'purple',
    icon: 'Cpu',
  },
  {
    slug: 'justice',
    title: 'Criminal Justice',
    description: 'Policing, prisons, sentencing, rehabilitation, and public safety',
    tags: ['police', 'prison', 'crime', 'justice', 'sentencing', 'rehabilitation', 'law enforcement'],
    categories: ['Ethics', 'Politics'],
    color: 'against',
    icon: 'Scale',
  },
  {
    slug: 'healthcare',
    title: 'Healthcare',
    description: 'Universal coverage, drug pricing, mental health, and public health',
    tags: ['healthcare', 'health', 'medicine', 'insurance', 'drug', 'hospital', 'mental health', 'vaccine'],
    categories: ['Health'],
    color: 'emerald',
    icon: 'Heart',
  },
  {
    slug: 'education',
    title: 'Education',
    description: 'Schools, curriculum, student debt, teachers, and higher education',
    tags: ['education', 'school', 'teacher', 'student', 'university', 'debt', 'curriculum', 'college'],
    categories: ['Education'],
    color: 'gold',
    icon: 'GraduationCap',
  },
  {
    slug: 'immigration',
    title: 'Immigration & Borders',
    description: 'Border policy, asylum, citizenship, and the immigration system',
    tags: ['immigration', 'border', 'asylum', 'refugee', 'citizen', 'deportation', 'visa', 'migrant'],
    categories: ['Politics'],
    color: 'for',
    icon: 'Globe',
  },
  {
    slug: 'speech',
    title: 'Free Speech & Media',
    description: 'Censorship, platform moderation, press freedom, and online speech',
    tags: ['free speech', 'censorship', 'media', 'press', 'platform', 'moderation', 'journalism', 'misinformation'],
    categories: ['Ethics', 'Technology'],
    color: 'purple',
    icon: 'Mic',
  },
  {
    slug: 'housing',
    title: 'Housing & Cities',
    description: 'Rent, zoning, homelessness, development, and urban policy',
    tags: ['housing', 'rent', 'zoning', 'homeless', 'development', 'urban', 'city', 'landlord', 'property'],
    categories: ['Economics', 'Politics'],
    color: 'gold',
    icon: 'Building2',
  },
  {
    slug: 'rights',
    title: 'Civil Rights',
    description: 'Equality, discrimination, identity, and constitutional rights',
    tags: ['rights', 'equality', 'discrimination', 'race', 'gender', 'civil rights', 'lgbtq', 'diversity'],
    categories: ['Ethics', 'Politics'],
    color: 'against',
    icon: 'Shield',
  },
  {
    slug: 'security',
    title: 'National Security',
    description: 'Defense spending, foreign policy, intelligence, and war',
    tags: ['military', 'defense', 'security', 'war', 'intelligence', 'foreign', 'nato', 'nuclear', 'terrorism'],
    categories: ['Politics'],
    color: 'for',
    icon: 'Landmark',
  },
]
