import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CabinetSeat {
  category: string
  title: string
  icon: string
  metric: string
  incumbent: CabinetMember | null
  challenger: CabinetMember | null
}

export interface CabinetMember {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  clout: number
  role: string
  reputation_score: number
  total_votes: number
  total_arguments: number
  score: number
}

export interface ShadowCabinetResponse {
  seats: CabinetSeat[]
  total_members: number
  last_updated: string
}

// ─── Cabinet positions with distinct scoring weights ──────────────────────────
// Each seat uses a different combination of profile metrics so incumbents differ
// across seats, making the cabinet genuinely competitive and varied.

interface Position {
  category: string
  title: string
  icon: string
  metric: string
  weights: { clout: number; reputation: number; votes: number; arguments: number }
}

const POSITIONS: Position[] = [
  {
    category: 'Economics',
    title: 'Secretary of the Treasury',
    icon: '⚖',
    metric: 'Clout-weighted',
    weights: { clout: 1, reputation: 0.5, votes: 0.02, arguments: 0.1 },
  },
  {
    category: 'Technology',
    title: 'Secretary of Technology',
    icon: '⚡',
    metric: 'Argument-depth',
    weights: { clout: 0.2, reputation: 0.8, votes: 0.01, arguments: 0.5 },
  },
  {
    category: 'Science',
    title: 'Secretary of Science',
    icon: '⚗',
    metric: 'Reputation-led',
    weights: { clout: 0.3, reputation: 1, votes: 0.01, arguments: 0.3 },
  },
  {
    category: 'Politics',
    title: 'Secretary of State',
    icon: '🏛',
    metric: 'Vote-participation',
    weights: { clout: 0.4, reputation: 0.4, votes: 0.05, arguments: 0.2 },
  },
  {
    category: 'Ethics',
    title: 'Chief Ethics Officer',
    icon: '⚙',
    metric: 'Balanced score',
    weights: { clout: 0.5, reputation: 0.7, votes: 0.02, arguments: 0.4 },
  },
  {
    category: 'Environment',
    title: 'Secretary of the Environment',
    icon: '🌿',
    metric: 'Engagement-focused',
    weights: { clout: 0.3, reputation: 0.6, votes: 0.04, arguments: 0.35 },
  },
  {
    category: 'Education',
    title: 'Secretary of Education',
    icon: '📚',
    metric: 'Knowledge depth',
    weights: { clout: 0.2, reputation: 0.9, votes: 0.02, arguments: 0.45 },
  },
  {
    category: 'Health',
    title: 'Secretary of Health',
    icon: '🏥',
    metric: 'Civic activity',
    weights: { clout: 0.4, reputation: 0.5, votes: 0.04, arguments: 0.3 },
  },
  {
    category: 'Culture',
    title: 'Secretary of Culture',
    icon: '🎭',
    metric: 'Creative engagement',
    weights: { clout: 0.6, reputation: 0.4, votes: 0.02, arguments: 0.5 },
  },
  {
    category: 'Philosophy',
    title: 'Philosopher General',
    icon: '💡',
    metric: 'Depth of thought',
    weights: { clout: 0.1, reputation: 0.8, votes: 0.01, arguments: 0.6 },
  },
]

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  try {
    // Fetch the top 200 profiles by clout — all data needed is in profiles table.
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select(
        'id, username, display_name, avatar_url, clout, role, reputation_score, total_votes, total_arguments',
      )
      .order('clout', { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const members = (profiles ?? []) as CabinetMember[]

    // For each seat, score every member using the seat's unique weighting.
    // This guarantees each seat has different incumbents, making the cabinet
    // genuinely multi-dimensional rather than a simple clout leaderboard.
    const seats: CabinetSeat[] = POSITIONS.map((pos) => {
      const scored = members.map((m) => ({
        ...m,
        score:
          (m.clout ?? 0) * pos.weights.clout +
          (m.reputation_score ?? 0) * pos.weights.reputation +
          (m.total_votes ?? 0) * pos.weights.votes +
          (m.total_arguments ?? 0) * pos.weights.arguments,
      }))
      scored.sort((a, b) => b.score - a.score)

      return {
        category: pos.category,
        title: pos.title,
        icon: pos.icon,
        metric: pos.metric,
        incumbent: scored[0] ?? null,
        challenger: scored[1] ?? null,
      } satisfies CabinetSeat
    })

    const uniqueMembers = new Set(
      seats.flatMap((s) => [s.incumbent?.id, s.challenger?.id]).filter(Boolean),
    ).size

    return NextResponse.json({
      seats,
      total_members: uniqueMembers,
      last_updated: new Date().toISOString(),
    } satisfies ShadowCabinetResponse)
  } catch (err) {
    console.error('[shadow-cabinet] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
