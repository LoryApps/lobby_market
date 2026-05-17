import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface WelcomeArchetype {
  name: string
  tagline: string
  description: string
  accent: 'gold' | 'for' | 'emerald' | 'purple' | 'against'
}

export interface WelcomeTopic {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  status: string
}

export interface WelcomeResponse {
  archetype: WelcomeArchetype
  categories: string[]
  topics: WelcomeTopic[]
  profile: { display_name: string | null; username: string | null }
}

const ARCHETYPES: Record<string, WelcomeArchetype> = {
  Economics: {
    name: 'The Market Realist',
    tagline: 'Markets drive progress',
    description:
      'You trust competition and free markets as engines of prosperity. Economic debates — trade, taxes, and growth — are your arena.',
    accent: 'gold',
  },
  Technology: {
    name: 'The Techno-Optimist',
    tagline: 'Innovation unlocks tomorrow',
    description:
      "You see technology as humanity's greatest lever for change. AI, digital rights, and the ethics of innovation matter most.",
    accent: 'for',
  },
  Science: {
    name: 'The Evidence-First Citizen',
    tagline: 'Data over ideology',
    description:
      'You trust expertise and empirical evidence above all. Policy should follow the science — and you hold it accountable when it does not.',
    accent: 'emerald',
  },
  Politics: {
    name: 'The Democratic Voice',
    tagline: 'Power belongs to the people',
    description:
      'You believe in collective governance and civic participation. Voting, representation, and public institutions are your battleground.',
    accent: 'for',
  },
  Ethics: {
    name: 'The Principled Thinker',
    tagline: 'Rights before results',
    description:
      'Every policy question is also a moral question. You bring ethical clarity to debates where others only see tradeoffs.',
    accent: 'purple',
  },
  Philosophy: {
    name: 'The Civic Philosopher',
    tagline: 'Ideas shape civilizations',
    description:
      'You ask the deep questions: what makes a just society, what values should guide our laws, what do we owe each other.',
    accent: 'purple',
  },
  Culture: {
    name: 'The Cultural Steward',
    tagline: 'Tradition is wisdom encoded',
    description:
      'You care about shared values, social norms, and the cultural fabric that holds communities together across generations.',
    accent: 'gold',
  },
  _default: {
    name: 'The Civic Thinker',
    tagline: 'Reason guides the republic',
    description:
      'You approach civic debates with curiosity and an open mind. Every perspective deserves scrutiny before a verdict.',
    accent: 'for',
  },
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch profile with category preferences
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username, category_preferences')
    .eq('id', user.id)
    .single()

  const categories: string[] = Array.isArray(profile?.category_preferences)
    ? (profile.category_preferences as string[])
    : []

  // Fetch matched topics (preferred categories)
  let matched: WelcomeTopic[] = []
  if (categories.length > 0) {
    const { data } = await supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes, status')
      .in('status', ['active', 'voting'])
      .in('category', categories)
      .order('feed_score', { ascending: false })
      .limit(5)
    matched = (data ?? []) as WelcomeTopic[]
  }

  // Fill remaining slots with trending topics
  let finalTopics = matched
  if (finalTopics.length < 5) {
    const matchedIds = matched.map((t) => t.id)
    const { data: trending } = await supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes, status')
      .in('status', ['active', 'voting'])
      .order('feed_score', { ascending: false })
      .limit(10)

    const fill = (trending ?? []).filter(
      (t) => !matchedIds.includes(t.id)
    ) as WelcomeTopic[]

    finalTopics = [...matched, ...fill].slice(0, 5)
  }

  const topCategory = categories[0] ?? '_default'
  const archetype = ARCHETYPES[topCategory] ?? ARCHETYPES['_default']

  return NextResponse.json({
    archetype,
    categories,
    topics: finalTopics,
    profile: {
      display_name: profile?.display_name ?? null,
      username: profile?.username ?? null,
    },
  } satisfies WelcomeResponse)
}
