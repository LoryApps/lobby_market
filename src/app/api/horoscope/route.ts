import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HoroscopeReading {
  // User profile
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  clout: number
  vote_streak: number
  civic_archetype: string | null

  // Civic sign (archetype-based)
  civic_sign: CivicSign

  // Today's aligned topics (good matches for this user's pattern)
  aligned_topics: AlignedTopic[]

  // Category alignment - which issues are "in their stars" today
  category_energy: CategoryEnergy[]

  // Daily prophecy (date-seeded, archetype-keyed)
  daily_prophecy: string

  // Celestial tension: topics where this archetype tends to be outvoted
  tension_warning: string | null

  // Civic compatibility
  compatible_archetype: string
  tense_archetype: string

  // Stats
  total_votes: number
  top_category: string | null
}

export interface CivicSign {
  id: string
  name: string
  symbol: string
  element: string
  trait: string
  today_energy: string
}

export interface AlignedTopic {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  status: string
  alignment_reason: string
}

export interface CategoryEnergy {
  category: string
  energy: 'high' | 'medium' | 'low'
  label: string
}

// ─── Archetype → Civic Sign ───────────────────────────────────────────────────

const CIVIC_SIGNS: Record<string, CivicSign> = {
  pragmatist: {
    id: 'pragmatist',
    name: 'The Scales of Reason',
    symbol: '⚖',
    element: 'Earth',
    trait: 'Evidence-driven, measured, outcome-focused',
    today_energy: 'Mercury is in your alignment — data and logic prevail today.',
  },
  idealist: {
    id: 'idealist',
    name: 'The Torch of Justice',
    symbol: '🔥',
    element: 'Fire',
    trait: 'Principle-first, passionate, morally consistent',
    today_energy: 'Mars amplifies conviction — your voice carries unusual weight.',
  },
  guardian: {
    id: 'guardian',
    name: 'The Pillar of Order',
    symbol: '🏛',
    element: 'Earth',
    trait: 'Stability-seeking, institutional, long-term oriented',
    today_energy: 'Saturn fortifies your position — tradition speaks through you.',
  },
  reformer: {
    id: 'reformer',
    name: 'The Rising Tide',
    symbol: '🌊',
    element: 'Water',
    trait: 'Change-oriented, systems-thinking, incremental',
    today_energy: 'Jupiter expands your reform agenda — propose boldly today.',
  },
  libertarian: {
    id: 'libertarian',
    name: 'The Open Horizon',
    symbol: '🌐',
    element: 'Air',
    trait: 'Freedom-first, anti-authoritarian, individualist',
    today_energy: 'Uranus favours your independence — resist the herd instinct.',
  },
  communitarian: {
    id: 'communitarian',
    name: 'The Common Hearth',
    symbol: '🤝',
    element: 'Water',
    trait: 'Community-minded, solidarity-focused, empathetic',
    today_energy: 'Venus illuminates shared bonds — coalitions form around you.',
  },
  technocrat: {
    id: 'technocrat',
    name: 'The Analytical Mind',
    symbol: '⚡',
    element: 'Air',
    trait: 'Data-driven, systems-optimising, expertise-valuing',
    today_energy: 'Mercury sharpens your analysis — your metrics land hard today.',
  },
  democrat: {
    id: 'democrat',
    name: 'The Voice of the Agora',
    symbol: '🗳',
    element: 'Air',
    trait: 'Process-faithful, consensus-building, pluralist',
    today_energy: 'The Moon elevates collective will — participation energises you.',
  },
}

const DEFAULT_SIGN: CivicSign = {
  id: 'unknown',
  name: 'The Civic Wanderer',
  symbol: '✦',
  element: 'Aether',
  trait: 'Curious, uncommitted, exploring',
  today_energy: 'Complete the Archetype Quiz to unlock your full civic reading.',
}

// ─── Archetype compatibility ───────────────────────────────────────────────────

const ARCHETYPE_COMPAT: Record<string, { compatible: string; tense: string }> = {
  pragmatist:    { compatible: 'technocrat',    tense: 'idealist'      },
  idealist:      { compatible: 'communitarian', tense: 'pragmatist'    },
  guardian:      { compatible: 'reformer',      tense: 'libertarian'   },
  reformer:      { compatible: 'guardian',      tense: 'technocrat'    },
  libertarian:   { compatible: 'democrat',      tense: 'communitarian' },
  communitarian: { compatible: 'idealist',      tense: 'libertarian'   },
  technocrat:    { compatible: 'pragmatist',    tense: 'democrat'      },
  democrat:      { compatible: 'libertarian',   tense: 'guardian'      },
}

// ─── Daily prophecies (per archetype, 7 options — seeded by day-of-week) ────

const PROPHECIES: Record<string, string[]> = {
  pragmatist: [
    'A topic with thin evidence will test your resolve today. Demand the data.',
    'Two proposals collide — one is cosplay, one will actually work. Trust your judgment.',
    'The loudest voices are not the most informed. Tune them out and look at the numbers.',
    'An argument you dismissed last week resurfaces. Reconsider it with fresh eyes.',
    "Today's vote will matter more than it appears. Long-term effects are in play.",
    'A coalition offers you a shortcut. The shortcut is wrong. Resist it.',
    'Outcomes, not intentions, define progress. Someone will test whether you believe that.',
  ],
  idealist: [
    'A compromise will be offered today. Accept the spirit, not the dilution.',
    'Someone will argue "perfect is the enemy of good." Remind them good can still be better.',
    'A principle you hold dear faces a real-world challenge. Stand firm, then reflect.',
    'The majority is wrong today. You know it. Say it anyway.',
    'A debate turns personal. Rise above — your argument is stronger than your anger.',
    'Someone abandons a cause for convenience. Let it remind you why you fight.',
    'The stars align for moral clarity. Trust your conscience over the crowd.',
  ],
  guardian: [
    'A rapid change is proposed with too little thought. Ask what we stand to lose.',
    "History has a lesson for today's debate. You are one of the few who will cite it.",
    'Stability is not stagnation. Make that case today.',
    "A tradition is challenged unfairly. Defend it — not because it's old, but because it works.",
    "Someone's enthusiasm outpaces their experience. Offer wisdom, not dismissal.",
    'The institution creaks but does not fall. Maintain it.',
    'What endures does so for reasons. Trace them before tearing anything down.',
  ],
  reformer: [
    'A broken system presents its daily damage. Today is a good day to name it clearly.',
    'Incrementalism is the path. One step taken firmly is worth a leap that falls short.',
    "An insider proposes the change you've argued for. Trust the movement, not the messenger.",
    'The opposition misreads you as a radical. Let the record correct them.',
    'A bill staggers forward — imperfect but moving. Vote for motion over stasis.',
    'Reform without patience is chaos. Take the long view.',
    "Your most important argument today is about what comes next, not what's wrong now.",
  ],
  libertarian: [
    'A well-meaning restriction is still a restriction. Name it.',
    'Someone trades freedom for a feeling of safety. Calculate the actual risk.',
    'The Lobby trends toward permission-seeking today. Dissent is your gift to it.',
    'An overreach is dressed in emergency language. See past the framing.',
    'A decentralised solution exists. It will be ignored. Propose it anyway.',
    'Your vote is yours. No coalition, argument, or social pressure changes that.',
    'Today the state overestimates its competence. Point that out specifically.',
  ],
  communitarian: [
    'Someone falls through a gap in the system today. Notice them.',
    'A policy ignores its effect on the most vulnerable. Bring them into the debate.',
    'Solidarity is tested by a topic that divides your coalition. Hold the line anyway.',
    "Your archetype builds bridges others won't touch. Cross one today.",
    'The social fabric frays at one specific point. Name the stitch.',
    'Individual triumph is celebrated while collective failure is ignored. Reframe it.',
    'A debate that looks economic is really about dignity. Argue for dignity.',
  ],
  technocrat: [
    'Someone cites a statistic without a source. Ask for the source.',
    'The emotional argument is winning. Introduce friction with accuracy.',
    'A policy has unintended consequences nobody modelled. Model them now.',
    'An expert is dismissed for not being relatable. Defend expertise.',
    'The data contradicts the narrative. This is your moment.',
    "Efficiency is not everything — but it's often the thing that's missing. Add it.",
    'A complex system is simplified into a slogan. Resist the slogan.',
  ],
  democrat: [
    'A minority position deserves a hearing today, even if you disagree with it.',
    'Process matters as much as outcome. Someone will skip the process. Object.',
    'Participation rates are low on a topic you care about. Invite others in.',
    "The will of the majority is clear. Make sure it's heard.",
    'A shortcut bypasses legitimate deliberation. Call it out.',
    "Democracy slows things down on purpose. Explain why that's a feature today.",
    "Every voice adds signal. Amplify one that's been quiet.",
  ],
}

const DEFAULT_PROPHECIES = [
  'The stars encourage civic engagement — cast your vote before sunset.',
  'A new topic aligns with your values. Seek it out.',
  'Your silence on one issue speaks louder than your voice on another.',
  'Consensus builds slowly. Your contribution accelerates it.',
  'Today the Lobby turns. Be part of the turning.',
]

// ─── Category energy rotations (day-seeded cycling) ───────────────────────────

const CATEGORY_ROTATION: Record<string, CategoryEnergy[]>[] = [
  {
    default: [
      { category: 'Economics', energy: 'high', label: 'Markets are volatile — economic votes carry extra weight' },
      { category: 'Environment', energy: 'medium', label: 'Neutral — your values align partially' },
      { category: 'Healthcare', energy: 'low', label: 'Conservative day — reserved judgement advised' },
    ],
  },
  {
    default: [
      { category: 'Technology', energy: 'high', label: 'Digital policy is in motion — your technical vote matters' },
      { category: 'Education', energy: 'high', label: 'Generational debates surface today' },
      { category: 'Politics', energy: 'low', label: 'Political noise is high — vote on substance, not optics' },
    ],
  },
  {
    default: [
      { category: 'Ethics', energy: 'high', label: 'Moral clarity shines today — trust your principles' },
      { category: 'Culture', energy: 'medium', label: 'Cultural debates shift — stay grounded' },
      { category: 'Science', energy: 'high', label: 'Evidence is unusually persuasive today' },
    ],
  },
  {
    default: [
      { category: 'Politics', energy: 'high', label: 'Policy alignment is optimal — engage fully' },
      { category: 'Healthcare', energy: 'high', label: 'Health issues reach decision points today' },
      { category: 'Economics', energy: 'low', label: 'Economic arguments feel abstract today — seek concrete data' },
    ],
  },
  {
    default: [
      { category: 'Environment', energy: 'high', label: 'Environmental tipping points are in debate — your vote is planetary' },
      { category: 'Technology', energy: 'medium', label: 'Digital rights debates are in progress' },
      { category: 'Culture', energy: 'low', label: 'Cultural positions are entrenched today — argue carefully' },
    ],
  },
  {
    default: [
      { category: 'Education', energy: 'high', label: 'Future-oriented debates crystallise today' },
      { category: 'Science', energy: 'high', label: 'Evidence-based positions gain ground' },
      { category: 'Ethics', energy: 'medium', label: 'Moral tensions are present but manageable' },
    ],
  },
  {
    default: [
      { category: 'Culture', energy: 'high', label: 'Cultural debates reach a turning point today' },
      { category: 'Politics', energy: 'medium', label: 'Partisan lines blur — independent judgement wins' },
      { category: 'Philosophy', energy: 'high', label: 'First principles debates attract your archetype strongly' },
    ],
  },
]

// ─── Tension warnings per archetype ───────────────────────────────────────────

const TENSION_WARNINGS: Record<string, string> = {
  pragmatist:    'Heads up: an ideological debate today may resist your evidence-based approach.',
  idealist:      'Caution: the majority may compromise on a principle you consider non-negotiable.',
  guardian:      'Alert: a rapid change proposal has momentum. Prepare your counter-argument.',
  reformer:      'Note: institutional resistance is strong today. Persistence over confrontation.',
  libertarian:   'Warning: a popular security measure may pass despite your objection. Make it count.',
  communitarian: 'Signal: an individualist narrative is gaining ground. Collective framing needed.',
  technocrat:    'Watch: emotional arguments are outperforming data in today\'s active debates.',
  democrat:      'Flag: a procedural shortcut is being proposed. The process needs defending.',
}

// ─── Alignment reasons ─────────────────────────────────────────────────────────

function getAlignmentReason(archetype: string | null, category: string | null, bluePct: number): string {
  if (!archetype || !category) return 'Active topic aligned with your participation pattern'

  const arch = archetype.toLowerCase()
  const cat = (category || '').toLowerCase()

  if (arch === 'pragmatist' && cat === 'economics')    return 'Economic evidence topics suit your outcome-focused lens'
  if (arch === 'idealist' && cat === 'ethics')         return 'Ethical debates align with your principles-first stance'
  if (arch === 'guardian' && cat === 'politics')       return 'Institutional stability debates match your archetype strongly'
  if (arch === 'reformer' && cat === 'politics')       return 'Reform-ready policy — your archetype drives this category'
  if (arch === 'libertarian' && cat === 'technology')  return 'Digital rights and freedom debates call your archetype'
  if (arch === 'communitarian' && cat === 'healthcare') return 'Social safety-net topics resonate deeply with your values'
  if (arch === 'technocrat' && cat === 'science')      return 'Science-based policy is your strongest category match'
  if (arch === 'democrat' && cat === 'politics')       return 'Democratic participation topics pull your archetype forward'

  if (bluePct < 45 || bluePct > 55) return 'A contested debate where your vote changes the margin'
  return 'Balanced debate — your voice can tip the scales'
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  // Load profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, clout, vote_streak, civic_archetype, category_preferences, total_votes')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const archetype = profile.civic_archetype as string | null
  const civicSign = archetype ? (CIVIC_SIGNS[archetype] ?? DEFAULT_SIGN) : DEFAULT_SIGN

  // Date-seeded randomness (same reading all day)
  const today = new Date()
  const daySeed = today.getUTCFullYear() * 10000 + (today.getUTCMonth() + 1) * 100 + today.getUTCDate()
  const dayOfWeek = today.getUTCDay() // 0-6

  // Daily prophecy
  const prophecyList = archetype ? (PROPHECIES[archetype] ?? DEFAULT_PROPHECIES) : DEFAULT_PROPHECIES
  const prophecyIndex = daySeed % prophecyList.length
  const dailyProphecy = prophecyList[prophecyIndex]

  // Category energy (day-of-week based)
  const energySlot = CATEGORY_ROTATION[dayOfWeek] ?? CATEGORY_ROTATION[0]
  const categoryEnergy: CategoryEnergy[] = energySlot.default ?? []

  // Top category from user's vote history
  const userCategories = (profile.category_preferences as string[] | null) ?? []
  const topCategory = userCategories[0] ?? null

  // Fetch aligned topics: active topics in user's preferred categories or matching archetype
  const categoryQuery = userCategories.length > 0
    ? userCategories.slice(0, 3)
    : ['Economics', 'Politics', 'Technology']

  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, category, blue_votes, red_votes, status, total_votes')
    .eq('status', 'active')
    .in('category', categoryQuery)
    .order('total_votes', { ascending: false })
    .limit(12)

  // Score topics by alignment to archetype
  const alignedTopics: AlignedTopic[] = (topicRows ?? [])
    .map((t) => {
      const total = (t.blue_votes ?? 0) + (t.red_votes ?? 0)
      const bluePct = total > 0 ? Math.round(((t.blue_votes ?? 0) / total) * 100) : 50

      // Alignment score: archetypes have preferred ranges
      let alignScore = 50
      if (archetype === 'idealist' || archetype === 'communitarian') {
        alignScore = total > 10 ? (bluePct > 55 ? 90 : 60) : 40
      } else if (archetype === 'libertarian' || archetype === 'guardian') {
        alignScore = total > 10 ? (bluePct < 45 ? 90 : 60) : 40
      } else {
        // Pragmatist, technocrat, democrat, reformer — aligned with close contests
        const margin = Math.abs(bluePct - 50)
        alignScore = Math.max(0, 90 - margin * 2)
      }

      return {
        id: t.id as string,
        statement: t.statement as string,
        category: t.category as string | null,
        blue_pct: bluePct,
        total_votes: total,
        status: t.status as string,
        alignment_reason: getAlignmentReason(archetype, t.category as string | null, bluePct),
        _align_score: alignScore,
      }
    })
    .sort((a, b) => b._align_score - a._align_score)
    .slice(0, 5)
    .map(({ _align_score: _, ...rest }) => rest)

  // Compatibility
  const compat = archetype ? (ARCHETYPE_COMPAT[archetype] ?? { compatible: 'democrat', tense: 'guardian' }) : { compatible: 'democrat', tense: 'guardian' }

  // Tension warning
  const tensionWarning = archetype ? (TENSION_WARNINGS[archetype] ?? null) : null

  const reading: HoroscopeReading = {
    user_id: user.id,
    username: profile.username as string,
    display_name: profile.display_name as string | null,
    avatar_url: profile.avatar_url as string | null,
    clout: profile.clout as number ?? 0,
    vote_streak: profile.vote_streak as number ?? 0,
    civic_archetype: archetype,
    civic_sign: civicSign,
    aligned_topics: alignedTopics,
    category_energy: categoryEnergy,
    daily_prophecy: dailyProphecy,
    tension_warning: tensionWarning,
    compatible_archetype: compat.compatible,
    tense_archetype: compat.tense,
    total_votes: profile.total_votes as number ?? 0,
    top_category: topCategory,
  }

  return NextResponse.json(reading)
}
