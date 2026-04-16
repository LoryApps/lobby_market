import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Category axis config ─────────────────────────────────────────────────────
// The 8 axes of the Civic Compass radar chart.
// Each category maps votes to a political/civic dimension.

const COMPASS_CATEGORIES = [
  'Politics',
  'Economics',
  'Technology',
  'Ethics',
  'Science',
  'Culture',
  'Philosophy',
  'Health',
] as const

// ─── Archetype detection ──────────────────────────────────────────────────────

interface CategoryStat {
  category: string
  total: number
  blue: number  // FOR votes
  red: number   // AGAINST votes
  forPct: number // 0–100
}

interface CompassArchetype {
  id: string
  label: string
  subtitle: string
  description: string
  color: string
}

function detectArchetype(
  stats: CategoryStat[],
  totalVotes: number,
  overallForPct: number
): CompassArchetype {
  if (totalVotes === 0) {
    return {
      id: 'newcomer',
      label: 'The Newcomer',
      subtitle: 'New to the Lobby',
      description:
        'Cast your first votes to calibrate your Civic Compass. The Lobby needs every voice.',
      color: '#8b5cf6',
    }
  }

  // Find dominant category (most votes)
  const sorted = [...stats].filter((s) => s.total > 0).sort((a, b) => b.total - a.total)
  const dominant = sorted[0]

  const isReformer = overallForPct >= 68
  const isDissenter = overallForPct <= 32

  if (isReformer && totalVotes >= 20) {
    return {
      id: 'reformer',
      label: 'The Reformer',
      subtitle: 'Agent of Change',
      description:
        'You consistently vote FOR new proposals. A champion of progress who believes the Lobby can always do better.',
      color: '#3b82f6',
    }
  }

  if (isDissenter && totalVotes >= 20) {
    return {
      id: 'traditionalist',
      label: 'The Traditionalist',
      subtitle: 'Guardian of the Status Quo',
      description:
        'You vote AGAINST most proposals, preferring caution over change. Stability and scrutiny guide your civic judgment.',
      color: '#ef4444',
    }
  }

  if (!dominant) {
    return {
      id: 'pragmatist',
      label: 'The Pragmatist',
      subtitle: 'Evidence-Based Voter',
      description:
        'You evaluate each proposal on its merits across all domains. No ideology, just results.',
      color: '#10b981',
    }
  }

  // Category-specific archetypes
  switch (dominant.category) {
    case 'Politics':
      return {
        id: 'politician',
        label: 'The Politician',
        subtitle: 'Power & Governance',
        description:
          'Political topics dominate your voting record. You understand that everything — from rights to resources — is ultimately decided in the political arena.',
        color: '#60a5fa',
      }
    case 'Economics':
      return dominant.forPct >= 55
        ? {
            id: 'economist_pro',
            label: 'The Keynesian',
            subtitle: 'Markets Need Stewards',
            description:
              'You support economic proposals, believing that smart intervention creates better outcomes than pure market forces alone.',
            color: '#f59e0b',
          }
        : {
            id: 'economist_lib',
            label: 'The Libertarian',
            subtitle: 'Free Markets, Free People',
            description:
              'You vote against most economic proposals, trusting individual actors over collective mandates to drive prosperity.',
            color: '#f59e0b',
          }
    case 'Technology':
      return {
        id: 'technologist',
        label: 'The Technologist',
        subtitle: 'Builder of Tomorrow',
        description:
          'Technology debates are your domain. You understand how innovation reshapes society — and you vote to shape it rather than just observe.',
        color: '#8b5cf6',
      }
    case 'Ethics':
      return {
        id: 'ethicist',
        label: 'The Ethicist',
        subtitle: 'Moral Compass',
        description:
          'Ethical debates draw your attention most. You weigh principles, not just outcomes, and hold the Lobby to a higher standard.',
        color: '#10b981',
      }
    case 'Science':
      return {
        id: 'scientist',
        label: 'The Empiricist',
        subtitle: 'Data Over Dogma',
        description:
          'Science and evidence drive your civic engagement. You trust research over rhetoric and demand that proposals be grounded in fact.',
        color: '#34d399',
      }
    case 'Culture':
      return {
        id: 'culturalist',
        label: 'The Culturalist',
        subtitle: 'Society as Story',
        description:
          'You believe culture shapes everything. Your votes reflect a deep engagement with how communities define themselves and evolve.',
        color: '#f472b6',
      }
    case 'Philosophy':
      return {
        id: 'philosopher',
        label: 'The Philosopher',
        subtitle: 'First Principles Thinker',
        description:
          'You dig into the "why" before the "what." Philosophy debates attract your vote, rooted in first-principles reasoning rather than tribal allegiances.',
        color: '#a78bfa',
      }
    case 'Health':
      return {
        id: 'healer',
        label: 'The Healer',
        subtitle: 'Human Wellbeing First',
        description:
          'Health and wellbeing shape your civic perspective. You see policy through the lens of human lives and flourishing.',
        color: '#34d399',
      }
    default:
      return {
        id: 'pragmatist',
        label: 'The Pragmatist',
        subtitle: 'Evidence-Based Voter',
        description:
          'You evaluate each proposal on its merits across all domains. No ideology — just results.',
        color: '#10b981',
      }
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export interface CompassData {
  stats: CategoryStat[]
  totalVotes: number
  overallForPct: number
  archetype: CompassArchetype
  topCategory: string | null
  voteStreak: number
  totalArguments: number
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch profile for supplementary stats
  const { data: profile } = await supabase
    .from('profiles')
    .select('total_votes, blue_vote_count, red_vote_count, vote_streak, total_arguments')
    .eq('id', user.id)
    .maybeSingle()

  // Fetch all votes joined with topic category
  const { data: votesRaw } = await supabase
    .from('votes')
    .select('side, topic_id')
    .eq('user_id', user.id)
    .limit(1000)

  const votes = votesRaw ?? []
  const topicIds = Array.from(new Set(votes.map((v) => v.topic_id)))

  // Fetch topic categories
  const topicCategoryMap = new Map<string, string>()
  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, category')
      .in('id', topicIds)
    for (const t of topics ?? []) {
      topicCategoryMap.set(t.id, t.category ?? 'Other')
    }
  }

  // Aggregate per category
  const catMap = new Map<string, { blue: number; red: number }>()
  for (const v of votes) {
    const cat = topicCategoryMap.get(v.topic_id) ?? 'Other'
    const existing = catMap.get(cat) ?? { blue: 0, red: 0 }
    if (v.side === 'blue') existing.blue++
    else existing.red++
    catMap.set(cat, existing)
  }

  // Build stats for all compass categories (fill missing with zero)
  const stats: CategoryStat[] = COMPASS_CATEGORIES.map((cat) => {
    const raw = catMap.get(cat) ?? { blue: 0, red: 0 }
    const total = raw.blue + raw.red
    return {
      category: cat,
      total,
      blue: raw.blue,
      red: raw.red,
      forPct: total > 0 ? Math.round((raw.blue / total) * 100) : 50,
    }
  })

  const totalVotes = profile?.total_votes ?? votes.length
  const blueTotal = profile?.blue_vote_count ?? votes.filter((v) => v.side === 'blue').length
  const overallForPct =
    totalVotes > 0 ? Math.round((blueTotal / totalVotes) * 100) : 50

  const catEntries = Array.from(catMap.entries())
  const topCategory =
    catEntries.length > 0
      ? catEntries.sort(([, a], [, b]) => b.blue + b.red - (a.blue + a.red))[0][0]
      : null

  const archetype = detectArchetype(stats, totalVotes, overallForPct)

  const response: CompassData = {
    stats,
    totalVotes,
    overallForPct,
    archetype,
    topCategory,
    voteStreak: profile?.vote_streak ?? 0,
    totalArguments: profile?.total_arguments ?? 0,
  }

  return NextResponse.json(response)
}
