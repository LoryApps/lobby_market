import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LegacyTier = 'legend' | 'lawmaker' | 'advocate' | 'citizen' | 'newcomer'

export interface LegacyLaw {
  id: string
  statement: string
  category: string | null
  total_votes: number
  blue_pct: number
  established_at: string
}

export interface LegacyArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  reply_count: number
  ai_grade: string | null
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  created_at: string
}

export interface LegacyMilestone {
  type: 'joined' | 'first_vote' | 'first_argument' | 'first_law_authored' | 'first_debate'
  label: string
  date: string
}

export interface LegacyResponse {
  authenticated: true
  user: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    reputation_score: number
    created_at: string
    civic_archetype: string | null
  }
  legacy_score: number
  tier: LegacyTier
  tier_label: string
  tier_description: string
  laws_authored: LegacyLaw[]
  laws_authored_count: number
  top_arguments: LegacyArgument[]
  total_upvotes_received: number
  debate_record: {
    total: number
    as_speaker: number
    wins: number
    losses: number
    win_rate: number | null
  }
  milestones: LegacyMilestone[]
  total_arguments: number
  total_votes: number
}

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  LegacyTier,
  { label: string; description: string }
> = {
  legend: {
    label: 'Legend',
    description: 'A foundational voice of the Lobby — your laws and arguments define civic history.',
  },
  lawmaker: {
    label: 'Lawmaker',
    description: "You've turned proposals into law. The Codex carries your signature.",
  },
  advocate: {
    label: 'Advocate',
    description: 'A consistent civic force — your arguments and votes shape platform discourse.',
  },
  citizen: {
    label: 'Citizen',
    description: "An engaged member building your civic record. You're making your mark.",
  },
  newcomer: {
    label: 'Newcomer',
    description: 'Your civic journey has begun. Every vote and argument builds your legacy.',
  },
}

function classifyTier(score: number): LegacyTier {
  if (score >= 80) return 'legend'
  if (score >= 60) return 'lawmaker'
  if (score >= 40) return 'advocate'
  if (score >= 20) return 'citizen'
  return 'newcomer'
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Profile ────────────────────────────────────────────────────────────────

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'username, display_name, avatar_url, role, clout, reputation_score, created_at, civic_archetype, total_votes, total_arguments'
    )
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // ── Laws authored ──────────────────────────────────────────────────────────

  const { data: authoredTopics } = await supabase
    .from('topics')
    .select('id, statement, category, total_votes, blue_pct, updated_at')
    .eq('author_id', user.id)
    .eq('status', 'law')
    .order('updated_at', { ascending: false })

  const lawsAuthored: LegacyLaw[] = (authoredTopics ?? []).map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category,
    total_votes: t.total_votes ?? 0,
    blue_pct: t.blue_pct ?? 50,
    established_at: t.updated_at,
  }))

  // ── Top arguments ──────────────────────────────────────────────────────────

  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select(
      'id, content, side, upvotes, reply_count, ai_grade, topic_id, created_at, topics!inner(statement, category, status)'
    )
    .eq('user_id', user.id)
    .order('upvotes', { ascending: false })
    .limit(5)

  type RawArg = {
    id: string
    content: string
    side: string
    upvotes: number
    reply_count: number
    ai_grade: string | null
    topic_id: string
    created_at: string
    topics: { statement: string; category: string | null; status: string } | null
  }

  const topArguments: LegacyArgument[] = (rawArgs ?? []).map((a: RawArg) => ({
    id: a.id,
    content: a.content,
    side: a.side as 'blue' | 'red',
    upvotes: a.upvotes ?? 0,
    reply_count: a.reply_count ?? 0,
    ai_grade: a.ai_grade,
    topic_id: a.topic_id,
    topic_statement: a.topics?.statement ?? '',
    topic_category: a.topics?.category ?? null,
    topic_status: a.topics?.status ?? '',
    created_at: a.created_at,
  }))

  const totalUpvotesReceived = topArguments.reduce((s, a) => s + a.upvotes, 0)

  // ── Debate record ──────────────────────────────────────────────────────────

  const { data: participations } = await supabase
    .from('debate_participants')
    .select('debate_id, side, is_speaker')
    .eq('user_id', user.id)

  const parts = participations ?? []
  let debateWins = 0
  let debateLosses = 0

  if (parts.length > 0) {
    const debateIds = parts.map((p) => p.debate_id)
    const { data: debates } = await supabase
      .from('debates')
      .select('id, blue_sway, red_sway, status')
      .in('id', debateIds)
      .eq('status', 'ended')

    const debateMap = new Map(
      (debates ?? []).map((d) => [d.id, d])
    )

    for (const p of parts) {
      const debate = debateMap.get(p.debate_id)
      if (!debate) continue
      const winner =
        debate.blue_sway > debate.red_sway
          ? 'blue'
          : debate.red_sway > debate.blue_sway
            ? 'red'
            : 'tie'
      if (winner === 'tie') continue
      if (winner === p.side) debateWins++
      else debateLosses++
    }
  }

  const totalDebates = parts.length
  const asSpeaker = parts.filter((p) => p.is_speaker).length
  const resolvedDebates = debateWins + debateLosses
  const winRate =
    resolvedDebates >= 3 ? Math.round((debateWins / resolvedDebates) * 100) : null

  // ── Milestones ─────────────────────────────────────────────────────────────

  const milestones: LegacyMilestone[] = [
    {
      type: 'joined',
      label: 'Joined the Lobby',
      date: profile.created_at,
    },
  ]

  // First vote
  const { data: firstVote } = await supabase
    .from('votes')
    .select('created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (firstVote) {
    milestones.push({
      type: 'first_vote',
      label: 'Cast first vote',
      date: firstVote.created_at,
    })
  }

  // First argument
  const { data: firstArg } = await supabase
    .from('topic_arguments')
    .select('created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (firstArg) {
    milestones.push({
      type: 'first_argument',
      label: 'Posted first argument',
      date: firstArg.created_at,
    })
  }

  // First law authored
  if (lawsAuthored.length > 0) {
    const oldest = [...lawsAuthored].sort(
      (a, b) => new Date(a.established_at).getTime() - new Date(b.established_at).getTime()
    )[0]
    milestones.push({
      type: 'first_law_authored',
      label: 'First law established',
      date: oldest.established_at,
    })
  }

  // First debate
  if (parts.length > 0) {
    const { data: firstDebateParticipation } = await supabase
      .from('debate_participants')
      .select('joined_at')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (firstDebateParticipation) {
      milestones.push({
        type: 'first_debate',
        label: 'Entered first debate',
        date: firstDebateParticipation.joined_at,
      })
    }
  }

  milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // ── Legacy score ───────────────────────────────────────────────────────────

  // Laws authored: 10 pts each, max 50
  const lawScore = Math.min(50, lawsAuthored.length * 10)

  // Top argument upvotes: log-based, max 25
  const topUpvotes = topArguments[0]?.upvotes ?? 0
  const argScore = topUpvotes > 0
    ? Math.min(25, Math.round(Math.log10(topUpvotes + 1) * 10))
    : 0

  // Reputation: scale 0–100 to 0–25
  const repScore = Math.min(25, Math.round(((profile.reputation_score ?? 0) / 1000) * 25))

  const legacyScore = Math.min(100, lawScore + argScore + repScore)
  const tier = classifyTier(legacyScore)
  const tierMeta = TIER_CONFIG[tier]

  return NextResponse.json({
    authenticated: true,
    user: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout ?? 0,
      reputation_score: profile.reputation_score ?? 0,
      created_at: profile.created_at,
      civic_archetype: (profile as { civic_archetype?: string | null }).civic_archetype ?? null,
    },
    legacy_score: legacyScore,
    tier,
    tier_label: tierMeta.label,
    tier_description: tierMeta.description,
    laws_authored: lawsAuthored,
    laws_authored_count: lawsAuthored.length,
    top_arguments: topArguments,
    total_upvotes_received: totalUpvotesReceived,
    debate_record: {
      total: totalDebates,
      as_speaker: asSpeaker,
      wins: debateWins,
      losses: debateLosses,
      win_rate: winRate,
    },
    milestones,
    total_arguments: profile.total_arguments ?? 0,
    total_votes: profile.total_votes ?? 0,
  } satisfies LegacyResponse)
}
