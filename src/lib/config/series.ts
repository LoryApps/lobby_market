// ─── Civic Series ─────────────────────────────────────────────────────────────
// Platform-curated thematic reading paths. Each series groups related debates
// around a shared theme, distinct from categories (type-based) and collections
// (personal bookmarks). Series are editorial: they tell a coherent story.

export interface SeriesDefinition {
  slug: string
  title: string
  subtitle: string
  description: string
  iconEmoji: string
  /** Tailwind accent pair used for the card gradient */
  accent: 'blue' | 'red' | 'gold' | 'emerald' | 'purple'
  /** Supabase categories to search within */
  categories: string[]
  /** Optional keyword filter: topics whose statement includes any of these words */
  keywords?: string[]
  /** Minimum total_votes for a topic to qualify (excludes stubs) */
  minVotes?: number
  /** Topic statuses to include */
  statuses?: ('proposed' | 'active' | 'voting' | 'law' | 'failed')[]
  /** Max topics to show in the series */
  limit: number
}

export const CIVIC_SERIES: SeriesDefinition[] = [
  {
    slug: 'ai-frontier',
    title: 'The AI Frontier',
    subtitle: '8 debates shaping the future of artificial intelligence',
    description:
      'Artificial intelligence is rewriting society. These debates explore how we should regulate it, who benefits, who is harmed, and what a human-centered AI future looks like.',
    iconEmoji: '🤖',
    accent: 'purple',
    categories: ['Technology'],
    keywords: ['ai', 'artificial intelligence', 'machine learning', 'algorithm', 'automation', 'robot'],
    limit: 8,
  },
  {
    slug: 'climate-imperative',
    title: 'The Climate Imperative',
    subtitle: '8 debates on Earth\'s most urgent challenge',
    description:
      'From carbon taxes to nuclear power, these debates define how society should respond to climate change — who pays, how fast, and who decides.',
    iconEmoji: '🌍',
    accent: 'emerald',
    categories: ['Environment'],
    limit: 8,
  },
  {
    slug: 'democracy-under-pressure',
    title: 'Democracy Under Pressure',
    subtitle: '7 debates on elections, rights, and civic institutions',
    description:
      'Is democracy working? These debates examine voting rights, media freedom, political polarisation, and what citizens owe their governments — and vice versa.',
    iconEmoji: '🏛️',
    accent: 'blue',
    categories: ['Politics'],
    keywords: ['democracy', 'election', 'vote', 'rights', 'freedom', 'constitution', 'government'],
    limit: 7,
  },
  {
    slug: 'economic-fault-lines',
    title: 'Economic Fault Lines',
    subtitle: '8 debates dividing economists and citizens',
    description:
      'Markets vs regulation. Growth vs equality. These fundamental economic debates split experts and communities — and directly affect your daily life.',
    iconEmoji: '📊',
    accent: 'gold',
    categories: ['Economics'],
    limit: 8,
  },
  {
    slug: 'healthcare-crossroads',
    title: 'Healthcare Crossroads',
    subtitle: '7 debates on the politics of medicine and wellbeing',
    description:
      'Who should pay for healthcare? How much freedom should individuals have over their own bodies? These debates sit at the intersection of rights, economics, and public health.',
    iconEmoji: '🏥',
    accent: 'red',
    categories: ['Health'],
    limit: 7,
  },
  {
    slug: 'digital-rights',
    title: 'Digital Rights & Wrongs',
    subtitle: '7 debates on privacy, speech, and the internet',
    description:
      'The internet has reshaped what it means to be a citizen. These debates explore surveillance, free speech platforms, data ownership, and who controls the digital commons.',
    iconEmoji: '🔐',
    accent: 'blue',
    categories: ['Technology'],
    keywords: ['privacy', 'speech', 'data', 'internet', 'platform', 'censorship', 'surveillance', 'social media'],
    limit: 7,
  },
  {
    slug: 'social-contract',
    title: 'The Social Contract',
    subtitle: '8 debates on welfare, inequality, and shared obligations',
    description:
      'What do citizens owe each other? These debates explore welfare systems, universal basic income, housing policy, and the tension between individual freedom and collective responsibility.',
    iconEmoji: '🤝',
    accent: 'emerald',
    categories: ['Economics', 'Politics', 'Ethics'],
    keywords: ['welfare', 'inequality', 'poverty', 'ubi', 'basic income', 'housing', 'tax', 'redistribution'],
    limit: 8,
  },
  {
    slug: 'education-futures',
    title: 'Education Futures',
    subtitle: '6 debates on how — and what — we teach',
    description:
      'Schools shape the next generation. These debates examine curriculum reform, university access, school choice, and what education in the 21st century should look like.',
    iconEmoji: '📚',
    accent: 'gold',
    categories: ['Education'],
    limit: 6,
  },
  {
    slug: 'ethics-of-power',
    title: 'Ethics of Power',
    subtitle: '7 debates on justice, morality, and who decides',
    description:
      'From capital punishment to corporate responsibility, these ethical debates probe the limits of what society can justifiably do — and who gets to make those choices.',
    iconEmoji: '⚖️',
    accent: 'purple',
    categories: ['Ethics', 'Philosophy'],
    limit: 7,
  },
  {
    slug: 'laws-of-the-land',
    title: 'Laws of the Land',
    subtitle: 'Established laws — the Lobby\'s permanent consensus',
    description:
      'These are the topics that achieved democratic consensus: voted into law by the community. Read them to understand the values the Lobby has collectively endorsed.',
    iconEmoji: '⚡',
    accent: 'gold',
    categories: [],
    statuses: ['law'],
    limit: 10,
  },
  {
    slug: 'most-contested',
    title: 'Most Contested',
    subtitle: 'The closest, most fought-over debates on the platform',
    description:
      'Some debates never resolve easily. These topics have drawn thousands of votes, yet remain within a razor-thin margin — evidence of genuine civic disagreement.',
    iconEmoji: '🔥',
    accent: 'red',
    categories: [],
    minVotes: 20,
    statuses: ['active', 'voting', 'proposed'],
    limit: 8,
  },
]

export function getSeriesBySlug(slug: string): SeriesDefinition | undefined {
  return CIVIC_SERIES.find((s) => s.slug === slug)
}
