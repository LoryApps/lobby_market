import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export type HallLaw = {
  id: string
  topic_id: string
  statement: string
  category: string | null
  established_at: string
  blue_pct: number
  total_votes: number
}

export type HallContributor = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  reputation_score: number
  clout: number
  total_votes: number
  total_arguments: number
}

export type HallStats = {
  total_laws: number
  total_votes_on_laws: number
  categories_with_laws: number
  newest_law: HallLaw | null
}

export type HallOfFameResponse = {
  topByVotes: HallLaw[]
  mostUnanimous: HallLaw[]
  mostContested: HallLaw[]
  categoryChampions: Record<string, HallLaw>
  topContributors: HallContributor[]
  stats: HallStats
}

const MIN_VOTES_FOR_UNANIMOUS = 30
const MIN_VOTES_FOR_CONTESTED = 30
const CONTESTED_MAX_PCT = 72

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch all active laws once, do in-memory processing
    const { data: allLaws, error } = await supabase
      .from('laws')
      .select('id, topic_id, statement, category, established_at, blue_pct, total_votes')
      .eq('is_active', true)
      .order('total_votes', { ascending: false })

    if (error) throw error

    const laws = (allLaws ?? []) as HallLaw[]

    // Top 5 by vote count
    const topByVotes = laws.slice(0, 5)

    // Most unanimous (highest blue_pct, minimum engagement)
    const mostUnanimous = laws
      .filter((l) => l.total_votes >= MIN_VOTES_FOR_UNANIMOUS)
      .sort((a, b) => b.blue_pct - a.blue_pct)
      .slice(0, 3)

    // Most contested (barely passed, above threshold)
    const mostContested = laws
      .filter((l) => l.total_votes >= MIN_VOTES_FOR_CONTESTED && l.blue_pct <= CONTESTED_MAX_PCT)
      .sort((a, b) => b.total_votes - a.total_votes)
      .slice(0, 3)

    // Category champions — best law per category
    const categoryChampions: Record<string, HallLaw> = {}
    for (const law of laws) {
      const cat = law.category
      if (!cat) continue
      const current = categoryChampions[cat]
      if (!current || law.total_votes > current.total_votes) {
        categoryChampions[cat] = law
      }
    }

    // Top contributors by reputation_score
    const { data: contributors } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, reputation_score, clout, total_votes, total_arguments')
      .order('reputation_score', { ascending: false })
      .limit(5)

    const topContributors = (contributors ?? []) as HallContributor[]

    const totalVotesOnLaws = laws.reduce((sum, l) => sum + l.total_votes, 0)
    const categoriesWithLaws = new Set(laws.map((l) => l.category).filter(Boolean)).size

    const sortedByDate = [...laws].sort(
      (a, b) => new Date(b.established_at).getTime() - new Date(a.established_at).getTime()
    )

    const stats: HallStats = {
      total_laws: laws.length,
      total_votes_on_laws: totalVotesOnLaws,
      categories_with_laws: categoriesWithLaws,
      newest_law: sortedByDate[0] ?? null,
    }

    const payload: HallOfFameResponse = {
      topByVotes,
      mostUnanimous,
      mostContested,
      categoryChampions,
      topContributors,
      stats,
    }

    return NextResponse.json(payload)
  } catch (err) {
    console.error('[hall-of-fame] error:', err)
    return NextResponse.json(
      { error: 'Failed to load Hall of Fame data' },
      { status: 500 }
    )
  }
}
