import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConsistencyArchetype =
  | 'principled'
  | 'pragmatist'
  | 'partisan'
  | 'contrarian'
  | 'specialist'

export type CategoryStance = 'strong_for' | 'lean_for' | 'mixed' | 'lean_against' | 'strong_against'

export interface CategoryProfile {
  category: string
  total_votes: number
  for_votes: number
  against_votes: number
  for_pct: number
  stance: CategoryStance
  stance_label: string
  consistency_pct: number   // % of votes that match the dominant stance
  flip_count: number         // votes that contradict the dominant stance
}

export interface FlipVote {
  topic_id: string
  statement: string
  category: string | null
  user_vote: 'blue' | 'red'
  category_stance: CategoryStance
  voted_at: string
}

export interface ConsistencyResponse {
  authenticated: true
  user: {
    username: string
    display_name: string | null
    avatar_url: string | null
  }
  total_votes: number
  overall_consistency_score: number  // 0–100
  archetype: ConsistencyArchetype
  archetype_label: string
  archetype_tagline: string
  archetype_description: string
  categories: CategoryProfile[]
  flip_votes: FlipVote[]             // top 5 most surprising votes
  most_consistent_category: string | null
  most_mixed_category: string | null
  categories_with_strong_stance: number
  categories_mixed: number
  global_for_pct: number            // overall FOR lean across all votes
}

export interface ConsistencyResponseUnauthenticated {
  authenticated: false
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stanceFromPct(pct: number): CategoryStance {
  if (pct >= 80) return 'strong_for'
  if (pct >= 60) return 'lean_for'
  if (pct <= 20) return 'strong_against'
  if (pct <= 40) return 'lean_against'
  return 'mixed'
}

function stanceLabel(stance: CategoryStance): string {
  const map: Record<CategoryStance, string> = {
    strong_for: 'Strong FOR',
    lean_for: 'Lean FOR',
    mixed: 'Mixed',
    lean_against: 'Lean AGAINST',
    strong_against: 'Strong AGAINST',
  }
  return map[stance]
}

function consistencyPct(forPct: number): number {
  // How far from 50/50 (pure split) is this category?
  // A 100% for → 100% consistent. 50% for → 0% consistent.
  return Math.round(Math.abs(forPct - 50) * 2)
}

function archetypeFromScore(
  score: number,
  globalForPct: number,
  strongCategories: number,
  mixedCategories: number
): ConsistencyArchetype {
  if (score >= 80) {
    // Very consistent — principled or partisan?
    return globalForPct >= 65 || globalForPct <= 35 ? 'partisan' : 'principled'
  }
  if (score >= 60) {
    return mixedCategories <= 1 ? 'principled' : 'pragmatist'
  }
  if (strongCategories >= 3 && mixedCategories >= 3) {
    return 'specialist'
  }
  if (score < 40) {
    return 'contrarian'
  }
  return 'pragmatist'
}

const ARCHETYPE_META: Record<
  ConsistencyArchetype,
  { label: string; tagline: string; description: string }
> = {
  principled: {
    label: 'The Principled',
    tagline: 'You vote by values, not vibes.',
    description:
      'Your votes follow a coherent internal logic across most topics. You have a clear civic identity — when you engage with a new debate, your position is predictable because it flows from consistent underlying principles.',
  },
  pragmatist: {
    label: 'The Pragmatist',
    tagline: 'You weigh each topic on its merits.',
    description:
      'You resist easy categorization. Your votes shift with context — sometimes FOR, sometimes AGAINST, depending on the specifics. This makes you harder to predict, but potentially more nuanced.',
  },
  partisan: {
    label: 'The Partisan',
    tagline: 'You know which side you\'re on.',
    description:
      'Your voting pattern shows a strong, consistent directional lean across most categories. You\'ve picked a side and you hold it — your consistency score reflects deep conviction rather than flip-flopping.',
  },
  contrarian: {
    label: 'The Contrarian',
    tagline: 'You keep the Lobby honest.',
    description:
      'Your votes frequently diverge from both the majority and your own previous pattern. Whether driven by skepticism, devil\'s advocacy, or genuinely unconventional views, you resist easy patterns.',
  },
  specialist: {
    label: 'The Specialist',
    tagline: 'You\'re decisive in your domain.',
    description:
      'You vote with strong conviction in specific categories but remain open-minded in others. Your expertise — or strong personal stakes — shows up in the topics you care most about.',
  },
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json<ConsistencyResponseUnauthenticated>({ authenticated: false })
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json<ConsistencyResponseUnauthenticated>({ authenticated: false })
  }

  // Fetch all votes with topic category info
  const { data: voteRows } = await supabase
    .from('votes')
    .select('vote_type, voted_at, topic_id, topics(statement, category, status, blue_pct, total_votes)')
    .eq('user_id', user.id)
    .order('voted_at', { ascending: false })

  const votes = (voteRows ?? []) as Array<{
    vote_type: string
    voted_at: string
    topic_id: string
    topics: {
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
    } | null
  }>

  if (votes.length === 0) {
    return NextResponse.json<ConsistencyResponse>({
      authenticated: true,
      user: {
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      },
      total_votes: 0,
      overall_consistency_score: 0,
      archetype: 'pragmatist',
      archetype_label: ARCHETYPE_META.pragmatist.label,
      archetype_tagline: ARCHETYPE_META.pragmatist.tagline,
      archetype_description: ARCHETYPE_META.pragmatist.description,
      categories: [],
      flip_votes: [],
      most_consistent_category: null,
      most_mixed_category: null,
      categories_with_strong_stance: 0,
      categories_mixed: 0,
      global_for_pct: 50,
    })
  }

  // Group votes by category
  const categoryMap = new Map<
    string,
    { for_votes: number; against_votes: number; votes: typeof votes }
  >()

  let globalFor = 0
  let globalTotal = 0

  for (const v of votes) {
    if (!v.topics) continue
    const cat = v.topics.category ?? 'Other'
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, { for_votes: 0, against_votes: 0, votes: [] })
    }
    const entry = categoryMap.get(cat)!
    const isFor = v.vote_type === 'blue'
    if (isFor) { entry.for_votes++; globalFor++ }
    else entry.against_votes++
    entry.votes.push(v)
    globalTotal++
  }

  // Build category profiles
  const categories: CategoryProfile[] = []
  for (const [cat, data] of categoryMap.entries()) {
    const total = data.for_votes + data.against_votes
    if (total === 0) continue
    const forPct = Math.round((data.for_votes / total) * 100)
    const stance = stanceFromPct(forPct)
    const dominant_for = forPct >= 50

    // Flip votes are votes that contradict the dominant stance
    const flipCount = dominant_for ? data.against_votes : data.for_votes
    // For "mixed" categories, flips are whichever side is minority
    const mixedFlip = stance === 'mixed' ? Math.min(data.for_votes, data.against_votes) : flipCount

    categories.push({
      category: cat,
      total_votes: total,
      for_votes: data.for_votes,
      against_votes: data.against_votes,
      for_pct: forPct,
      stance,
      stance_label: stanceLabel(stance),
      consistency_pct: consistencyPct(forPct),
      flip_count: stance === 'mixed' ? mixedFlip : flipCount,
    })
  }

  // Sort by total votes desc
  categories.sort((a, b) => b.total_votes - a.total_votes)

  // Overall consistency score: weighted average of per-category consistency
  const totalVotesAcrossCategories = categories.reduce((s, c) => s + c.total_votes, 0)
  const weightedConsistency = categories.reduce(
    (s, c) => s + c.consistency_pct * (c.total_votes / totalVotesAcrossCategories),
    0
  )
  const overallConsistencyScore = Math.round(weightedConsistency)

  // Stats
  const strongCategories = categories.filter(
    (c) => c.stance === 'strong_for' || c.stance === 'strong_against'
  ).length
  const mixedCategories = categories.filter((c) => c.stance === 'mixed').length

  const mostConsistent = categories.reduce(
    (best, c) =>
      c.total_votes >= 5 && c.consistency_pct > (best?.consistency_pct ?? -1) ? c : best,
    null as CategoryProfile | null
  )
  const mostMixed = categories
    .filter((c) => c.stance === 'mixed' && c.total_votes >= 5)
    .sort((a, b) => a.consistency_pct - b.consistency_pct)[0] ?? null

  // Global FOR pct
  const globalForPct = globalTotal > 0 ? Math.round((globalFor / globalTotal) * 100) : 50

  // Archetype
  const archetype = archetypeFromScore(
    overallConsistencyScore,
    globalForPct,
    strongCategories,
    mixedCategories
  )

  // Flip votes: the most surprising individual votes
  // A "flip" is a vote that contradicts the user's dominant stance in that category
  const flipVotes: FlipVote[] = []
  for (const c of categories) {
    if (c.stance === 'mixed') continue
    const dominantFor = c.for_pct >= 50
    const catEntry = categoryMap.get(c.category)!
    for (const v of catEntry.votes) {
      if (!v.topics) continue
      const isFor = v.vote_type === 'blue'
      if (dominantFor && !isFor) {
        flipVotes.push({
          topic_id: v.topic_id,
          statement: v.topics.statement,
          category: v.topics.category,
          user_vote: 'red',
          category_stance: c.stance,
          voted_at: v.voted_at,
        })
      } else if (!dominantFor && isFor) {
        flipVotes.push({
          topic_id: v.topic_id,
          statement: v.topics.statement,
          category: v.topics.category,
          user_vote: 'blue',
          category_stance: c.stance,
          voted_at: v.voted_at,
        })
      }
    }
  }
  // Take 5 most recent flip votes
  flipVotes.sort((a, b) => new Date(b.voted_at).getTime() - new Date(a.voted_at).getTime())

  return NextResponse.json<ConsistencyResponse>({
    authenticated: true,
    user: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
    },
    total_votes: globalTotal,
    overall_consistency_score: overallConsistencyScore,
    archetype,
    archetype_label: ARCHETYPE_META[archetype].label,
    archetype_tagline: ARCHETYPE_META[archetype].tagline,
    archetype_description: ARCHETYPE_META[archetype].description,
    categories,
    flip_votes: flipVotes.slice(0, 5),
    most_consistent_category: mostConsistent?.category ?? null,
    most_mixed_category: mostMixed?.category ?? null,
    categories_with_strong_stance: strongCategories,
    categories_mixed: mixedCategories,
    global_for_pct: globalForPct,
  })
}
