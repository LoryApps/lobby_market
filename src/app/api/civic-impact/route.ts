import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Scoring weights ──────────────────────────────────────────────────────────
// Each dimension contributes a portion of the 0–1000 total impact score.
// Weights sum to 1.0.
const W = {
  votes: 0.25,        // civic participation through voting
  arguments: 0.30,    // quality argumentation drives discourse
  debates: 0.15,      // live debate engagement
  laws: 0.20,         // highest civic achievement: shaping laws
  community: 0.10,    // building the civic network
}

// ─── Dimension caps (raw input values that yield a score of 1.0) ───────────────
const CAPS = {
  votes: 500,             // 500+ votes → full vote score
  argUpvotes: 200,        // 200+ argument upvotes → full arg score
  debateWins: 20,         // 20+ debate wins → full debate score
  lawTopics: 10,          // 10+ law-status topics voted FOR → full law score
  followers: 100,         // 100+ followers → full community score
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CivicImpactDimension {
  key: string
  label: string
  description: string
  score: number        // 0–100 within this dimension
  contribution: number // points this adds to total (out of 1000)
  detail: string       // human-readable stat
  icon: string
  color: string
}

export interface CivicImpactResponse {
  totalScore: number           // 0–1000
  tier: string
  tierLabel: string
  tierColor: string
  percentile: number           // 0–100 (estimated platform percentile)
  dimensions: CivicImpactDimension[]
  highlights: string[]         // 2–3 notable achievements
  nextActions: string[]        // 2–3 suggested actions to improve score
  joinedAt: string
  daysActive: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function scoreDim(raw: number, cap: number): number {
  // Logarithmic scaling so early gains feel quick; diminishing returns near cap
  if (raw <= 0) return 0
  const linear = raw / cap
  // Blend: 60% log, 40% linear for a natural feel
  const log = Math.log(1 + raw) / Math.log(1 + cap)
  return clamp01(log * 0.6 + linear * 0.4)
}

function tierFromScore(score: number): { tier: string; label: string; color: string } {
  if (score >= 850) return { tier: 'lawmaker',   label: 'Lawmaker',       color: 'gold' }
  if (score >= 650) return { tier: 'elder',      label: 'Elder',          color: 'emerald' }
  if (score >= 450) return { tier: 'champion',   label: 'Champion',       color: 'purple' }
  if (score >= 250) return { tier: 'activist',   label: 'Activist',       color: 'for-400' }
  if (score >= 100) return { tier: 'citizen',    label: 'Citizen',        color: 'surface-600' }
  return               { tier: 'observer',    label: 'Observer',       color: 'surface-500' }
}

function estimatePercentile(score: number): number {
  // Rough power-law distribution: most users cluster at 50–200
  if (score >= 850) return 99
  if (score >= 700) return 97
  if (score >= 550) return 93
  if (score >= 400) return 85
  if (score >= 250) return 70
  if (score >= 150) return 50
  if (score >= 75)  return 30
  if (score >= 25)  return 15
  return 5
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 1. Profile basics ──────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, total_votes, total_arguments, vote_streak, clout, reputation_score, created_at, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // ── 2. Arguments – upvotes + quality scores ────────────────────────────────
  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select('upvotes, ai_grade')
    .eq('user_id', user.id)
    .order('upvotes', { ascending: false })
    .limit(500)

  const args = argsRaw ?? []
  const totalArgUpvotes = args.reduce((s, a) => s + (a.upvotes ?? 0), 0)
  const qualityArgs = args.filter((a) => a.ai_grade && ['A', 'B'].includes(a.ai_grade)).length

  // ── 3. Debates participated in ─────────────────────────────────────────────
  const { data: debateParticipations } = await supabase
    .from('debate_participants')
    .select('debate_id, side')
    .eq('user_id', user.id)
    .limit(200)

  const totalDebates = (debateParticipations ?? []).length

  // Estimate debate wins: completed debates where the user's side had higher sway
  const debateIds = (debateParticipations ?? []).map((d) => d.debate_id)
  let debateWins = 0
  if (debateIds.length > 0) {
    const { data: completedDebates } = await supabase
      .from('debates')
      .select('id, blue_sway, red_sway, status')
      .in('id', debateIds.slice(0, 100))
      .eq('status', 'ended')

    if (completedDebates) {
      const sideMap = new Map((debateParticipations ?? []).map((d) => [d.debate_id, d.side]))
      debateWins = completedDebates.filter((d) => {
        const side = sideMap.get(d.id)
        if (side === 'blue') return (d.blue_sway ?? 50) > (d.red_sway ?? 50)
        if (side === 'red')  return (d.red_sway  ?? 50) > (d.blue_sway ?? 50)
        return false
      }).length
    }
  }

  // ── 4. Law impact – topics user voted FOR that became law ─────────────────
  const { data: forVotesRaw } = await supabase
    .from('votes')
    .select('topic_id')
    .eq('user_id', user.id)
    .eq('side', 'blue')
    .limit(1000)

  const forTopicIds = (forVotesRaw ?? []).map((v) => v.topic_id)
  let lawTopics = 0
  if (forTopicIds.length > 0) {
    const { count } = await supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .in('id', forTopicIds.slice(0, 200))
      .eq('status', 'law')
    lawTopics = count ?? 0
  }

  // Also count topics the user proposed that became law
  const { count: proposedLaws } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', user.id)
    .eq('status', 'law')

  const totalLawImpact = lawTopics + (proposedLaws ?? 0)

  // ── 5. Community – followers ───────────────────────────────────────────────
  const { count: followerCount } = await supabase
    .from('user_follows')
    .select('id', { count: 'exact', head: true })
    .eq('following_id', user.id)

  // ── 6. Achievements earned ─────────────────────────────────────────────────
  const { count: achievementCount } = await supabase
    .from('user_achievements')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // ── 7. Compute dimension scores ────────────────────────────────────────────
  const voteScore     = scoreDim(profile.total_votes ?? 0, CAPS.votes)
  const argScore      = scoreDim(totalArgUpvotes, CAPS.argUpvotes)
  const debateScore   = scoreDim(debateWins, CAPS.debateWins)
  const lawScore      = scoreDim(totalLawImpact, CAPS.lawTopics)
  const communityScore = scoreDim(followerCount ?? 0, CAPS.followers)

  const dimScores = {
    votes: voteScore,
    arguments: argScore,
    debates: debateScore,
    laws: lawScore,
    community: communityScore,
  }

  // ── 8. Total score (0–1000) ────────────────────────────────────────────────
  const rawTotal =
    dimScores.votes     * W.votes     +
    dimScores.arguments * W.arguments +
    dimScores.debates   * W.debates   +
    dimScores.laws      * W.laws      +
    dimScores.community * W.community

  const totalScore = Math.round(rawTotal * 1000)
  const { tier, label: tierLabel, color: tierColor } = tierFromScore(totalScore)
  const percentile = estimatePercentile(totalScore)

  // ── 9. Days active ────────────────────────────────────────────────────────
  const joinedAt = profile.created_at ?? new Date().toISOString()
  const daysActive = Math.max(
    1,
    Math.floor((Date.now() - new Date(joinedAt).getTime()) / 86_400_000)
  )

  // ── 10. Dimension objects ──────────────────────────────────────────────────
  const dimensions: CivicImpactDimension[] = [
    {
      key: 'votes',
      label: 'Vote Power',
      description: 'How actively you participate in civic votes',
      score: Math.round(voteScore * 100),
      contribution: Math.round(voteScore * W.votes * 1000),
      detail: `${profile.total_votes ?? 0} total votes · ${profile.vote_streak ?? 0}-day streak`,
      icon: 'Scale',
      color: 'for',
    },
    {
      key: 'arguments',
      label: 'Argument Strength',
      description: 'The quality and reach of your arguments',
      score: Math.round(argScore * 100),
      contribution: Math.round(argScore * W.arguments * 1000),
      detail: `${totalArgUpvotes} upvotes received · ${qualityArgs} A/B grade arguments`,
      icon: 'MessageSquare',
      color: 'purple',
    },
    {
      key: 'debates',
      label: 'Debate Record',
      description: 'Performance in live civic debates',
      score: Math.round(debateScore * 100),
      contribution: Math.round(debateScore * W.debates * 1000),
      detail: `${totalDebates} debates entered · ${debateWins} wins`,
      icon: 'Mic',
      color: 'against',
    },
    {
      key: 'laws',
      label: 'Law Making',
      description: 'Your role in turning consensus into law',
      score: Math.round(lawScore * 100),
      contribution: Math.round(lawScore * W.laws * 1000),
      detail: `${lawTopics} laws shaped · ${proposedLaws ?? 0} proposed`,
      icon: 'Gavel',
      color: 'gold',
    },
    {
      key: 'community',
      label: 'Civic Network',
      description: 'Your influence and reach in the community',
      score: Math.round(communityScore * 100),
      contribution: Math.round(communityScore * W.community * 1000),
      detail: `${followerCount ?? 0} followers · ${achievementCount ?? 0} achievements`,
      icon: 'Users',
      color: 'emerald',
    },
  ]

  // ── 11. Highlights ────────────────────────────────────────────────────────
  const highlights: string[] = []
  if ((proposedLaws ?? 0) > 0)
    highlights.push(`${proposedLaws} of your topics became law`)
  if (profile.vote_streak && profile.vote_streak >= 7)
    highlights.push(`${profile.vote_streak}-day voting streak`)
  if (qualityArgs >= 5)
    highlights.push(`${qualityArgs} A/B grade arguments`)
  if (debateWins >= 3)
    highlights.push(`Won ${debateWins} live debates`)
  if ((followerCount ?? 0) >= 10)
    highlights.push(`${followerCount} citizens following you`)

  // ── 12. Next actions ──────────────────────────────────────────────────────
  const nextActions: string[] = []
  const lowestDim = [...dimensions].sort((a, b) => a.score - b.score)[0]
  if (lowestDim.key === 'votes' && (profile.total_votes ?? 0) < 10)
    nextActions.push('Vote on 5 active topics to boost your Vote Power')
  else if (lowestDim.key === 'arguments' && (profile.total_arguments ?? 0) < 5)
    nextActions.push('Write your first civic argument to build Argument Strength')
  else if (lowestDim.key === 'debates' && totalDebates < 3)
    nextActions.push('Join a live debate to start building your Debate Record')
  else if (lowestDim.key === 'laws')
    nextActions.push('Vote on topics in their final voting phase to shape more laws')
  else if (lowestDim.key === 'community')
    nextActions.push('Share your arguments and profile to grow your Civic Network')

  if ((profile.vote_streak ?? 0) === 0)
    nextActions.push('Vote today to start a voting streak')
  if (!nextActions.some((a) => a.includes('argument')))
    nextActions.push('Write high-quality arguments to earn upvotes from the community')

  return NextResponse.json({
    totalScore,
    tier,
    tierLabel,
    tierColor,
    percentile,
    dimensions,
    highlights: highlights.slice(0, 3),
    nextActions: nextActions.slice(0, 3),
    joinedAt,
    daysActive,
  } satisfies CivicImpactResponse)
}
