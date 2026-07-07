import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
] as const

type Category = typeof CATEGORIES[number]

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PortraitCategory {
  category: string
  count: number
  for_pct: number
}

export interface PortraitData {
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  member_since: string
  archetype_id: string | null

  total_votes: number
  for_pct: number
  against_pct: number

  clout: number
  reputation_score: number
  vote_streak: number
  total_arguments: number

  top_categories: PortraitCategory[]
  dominant_category: string | null

  vote_persona: string
  vote_persona_desc: string
  civic_voice: string
  civic_voice_desc: string

  accuracy: number | null
  resolved_votes: number
  accuracy_tier: string | null

  days_active: number
}

// ─── Vote persona ─────────────────────────────────────────────────────────────

function computeVotePersona(forPct: number, totalVotes: number): { persona: string; desc: string } {
  if (totalVotes < 5) return { persona: 'Newcomer', desc: 'Just getting started. The civic landscape awaits.' }
  if (forPct >= 75) return { persona: 'Strong Supporter', desc: 'You lean overwhelmingly FOR — a true believer in civic progress.' }
  if (forPct >= 60) return { persona: 'Progressive Voice', desc: 'Mostly in favour, with room for nuance. You push things forward.' }
  if (forPct >= 48) return { persona: 'True Centrist', desc: 'Balanced and deliberate. Your vote can go either way.' }
  if (forPct >= 35) return { persona: 'Reform Skeptic', desc: 'You challenge the prevailing direction — and that matters.' }
  return { persona: 'Principled Dissenter', desc: 'A consistent voice against the majority. Contrarians keep democracy honest.' }
}

// ─── Civic voice (mainstream vs outlier) ─────────────────────────────────────

function computeCivicVoice(
  userVotes: Array<{ side: string; blue_pct: number }>,
): { voice: string; desc: string } {
  if (userVotes.length < 5) return { voice: 'Uncharted', desc: 'Vote more to reveal your civic voice.' }

  let alignedCount = 0
  for (const v of userVotes) {
    const majority = v.blue_pct >= 50 ? 'for' : 'against'
    if (v.side === majority) alignedCount++
  }
  const alignedPct = (alignedCount / userVotes.length) * 100

  if (alignedPct >= 75) return { voice: 'Mainstream', desc: 'You consistently vote with the majority. Consensus comes naturally to you.' }
  if (alignedPct >= 55) return { voice: 'Independent', desc: 'Mostly with the crowd, but never afraid to break ranks.' }
  if (alignedPct >= 40) return { voice: 'Contrarian', desc: 'You side with the minority more than most. Your perspective is rare.' }
  return { voice: 'Outlier', desc: 'You stand apart from the crowd — a distinctive civic fingerprint.' }
}

// ─── Accuracy tier ────────────────────────────────────────────────────────────

function accuracyTier(pct: number | null): string | null {
  if (pct === null) return null
  if (pct >= 75) return 'Oracle'
  if (pct >= 60) return 'Sharp'
  if (pct >= 50) return 'Aligned'
  return 'Contrarian'
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, role, created_at, clout, reputation_score, vote_streak, total_votes, blue_vote_count, red_vote_count, total_arguments, archetype_id')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const totalVotes = profile.total_votes ?? 0
  const forPct = totalVotes > 0
    ? Math.round(((profile.blue_vote_count ?? 0) / totalVotes) * 100)
    : 50

  // Fetch votes with topic data for civic voice calculation
  const { data: voteRows } = await supabase
    .from('votes')
    .select('side, topics!inner(category, blue_pct)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(300)

  type VoteRow = { side: string; topics: { category: string | null; blue_pct: number | null } }
  const votes = (voteRows ?? []) as VoteRow[]

  // Category breakdown
  const catMap = new Map<Category, { count: number; for: number }>()
  for (const v of votes) {
    const cat = v.topics?.category as Category | null
    if (!cat || !CATEGORIES.includes(cat)) continue
    const entry = catMap.get(cat) ?? { count: 0, for: 0 }
    entry.count++
    if (v.side === 'for') entry.for++
    catMap.set(cat, entry)
  }

  const topCategories: PortraitCategory[] = Array.from(catMap.entries())
    .map(([category, data]) => ({
      category,
      count: data.count,
      for_pct: data.count > 0 ? Math.round((data.for / data.count) * 100) : 50,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const dominantCategory = topCategories.length > 0 ? topCategories[0].category : null

  // Civic voice
  const voiceVotes = votes.map((v) => ({
    side: v.side,
    blue_pct: v.topics?.blue_pct ?? 50,
  }))
  const { voice, desc: voiceDesc } = computeCivicVoice(voiceVotes)

  // Vote persona
  const { persona, desc: personaDesc } = computeVotePersona(forPct, totalVotes)

  // Accuracy from resolved topics
  let accuracy: number | null = null
  let resolvedCount = 0
  const { data: resolvedVotes } = await supabase
    .from('votes')
    .select('side, topics!inner(status, blue_pct)')
    .eq('user_id', user.id)
    .eq('topics.status', 'law')
    .limit(500)

  type ResolvedVote = { side: string; topics: { blue_pct: number | null } }
  const resolved = (resolvedVotes ?? []) as ResolvedVote[]
  resolvedCount = resolved.length

  if (resolvedCount >= 5) {
    let correct = 0
    for (const v of resolved) {
      const majority = (v.topics?.blue_pct ?? 50) >= 50 ? 'for' : 'against'
      if (v.side === majority) correct++
    }
    accuracy = Math.round((correct / resolvedCount) * 100)
  }

  const daysActive = Math.floor(
    (Date.now() - new Date(profile.created_at).getTime()) / 86_400_000,
  )

  const portrait: PortraitData = {
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    role: profile.role ?? 'citizen',
    member_since: profile.created_at,
    archetype_id: profile.archetype_id ?? null,

    total_votes: totalVotes,
    for_pct: forPct,
    against_pct: 100 - forPct,

    clout: profile.clout ?? 0,
    reputation_score: profile.reputation_score ?? 0,
    vote_streak: profile.vote_streak ?? 0,
    total_arguments: profile.total_arguments ?? 0,

    top_categories: topCategories,
    dominant_category: dominantCategory,

    vote_persona: persona,
    vote_persona_desc: personaDesc,
    civic_voice: voice,
    civic_voice_desc: voiceDesc,

    accuracy,
    resolved_votes: resolvedCount,
    accuracy_tier: accuracyTier(accuracy),

    days_active: daysActive,
  }

  return NextResponse.json(portrait)
}
