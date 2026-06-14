import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RepBreakdown {
  votes_score: number        // total_votes × 1
  topics_score: number       // topics authored × 5
  laws_score: number         // laws authored × 50
  total: number
  total_votes: number
  topics_authored: number
  laws_authored: number
}

export interface RepMilestone {
  label: string
  threshold: number
  reached: boolean
  role?: string
  description: string
}

export interface RepLeader {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  reputation_score: number
  total_votes: number
  clout: number
}

export interface RepActivity {
  type: 'vote' | 'topic' | 'law'
  occurred_at: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  points: number
}

export interface ReputationResponse {
  breakdown: RepBreakdown
  percentile: number | null       // 0–100, null if not authenticated
  platform_avg: number
  milestones: RepMilestone[]
  leaders: RepLeader[]
  recent_activity: RepActivity[]
  is_authenticated: boolean
}

// ─── Milestones ───────────────────────────────────────────────────────────────

function buildMilestones(score: number): RepMilestone[] {
  return [
    {
      label: 'First Vote',
      threshold: 1,
      reached: score >= 1,
      description: 'Cast your first vote in a civic debate',
    },
    {
      label: 'Active Citizen',
      threshold: 50,
      reached: score >= 50,
      description: '50 points — 50 votes or a few topic proposals',
    },
    {
      label: 'Debator',
      threshold: 500,
      reached: score >= 500,
      role: 'debator',
      description: '500 points — unlocks the Debator role',
    },
    {
      label: 'Influencer',
      threshold: 1000,
      reached: score >= 1000,
      description: '1,000 points — a genuine civic voice',
    },
    {
      label: 'Power Voter',
      threshold: 2500,
      reached: score >= 2500,
      description: '2,500 points — consistent civic participation',
    },
    {
      label: 'Lawmaker',
      threshold: 5000,
      reached: score >= 5000,
      description: '5,000 points — you\'ve shaped major civic outcomes',
    },
    {
      label: 'Senior Influencer',
      threshold: 10000,
      reached: score >= 10000,
      description: '10,000 points — unlocks Influencer status platform-wide',
    },
    {
      label: 'Civic Legend',
      threshold: 25000,
      reached: score >= 25000,
      description: '25,000 points — among the platform\'s most impactful citizens',
    },
  ]
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // ── Platform leaders (public) ──────────────────────────────────────────────
  const { data: leaderRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, reputation_score, total_votes, clout')
    .order('reputation_score', { ascending: false })
    .limit(10)

  const leaders: RepLeader[] = (leaderRows ?? []).map((r) => ({
    id: r.id,
    username: r.username,
    display_name: r.display_name,
    avatar_url: r.avatar_url,
    role: r.role,
    reputation_score: r.reputation_score ?? 0,
    total_votes: r.total_votes ?? 0,
    clout: r.clout ?? 0,
  }))

  // ── Platform average ───────────────────────────────────────────────────────
  const { data: avgData } = await supabase
    .rpc('avg_reputation' as string)
    .single()
    .catch(() => ({ data: null }))

  // Fallback: pull avg from the top 100
  let platformAvg = 0
  if (!avgData || typeof (avgData as Record<string, unknown>)?.avg_reputation !== 'number') {
    const { data: sample } = await supabase
      .from('profiles')
      .select('reputation_score')
      .order('reputation_score', { ascending: false })
      .limit(100)
    if (sample && sample.length > 0) {
      platformAvg = Math.round(
        sample.reduce((s, r) => s + (r.reputation_score ?? 0), 0) / sample.length
      )
    }
  } else {
    platformAvg = Math.round((avgData as Record<string, number>).avg_reputation ?? 0)
  }

  // ── Unauthenticated response ───────────────────────────────────────────────
  if (!user) {
    return NextResponse.json({
      breakdown: { votes_score: 0, topics_score: 0, laws_score: 0, total: 0, total_votes: 0, topics_authored: 0, laws_authored: 0 },
      percentile: null,
      platform_avg: platformAvg,
      milestones: buildMilestones(0),
      leaders,
      recent_activity: [],
      is_authenticated: false,
    } satisfies ReputationResponse)
  }

  // ── User profile ───────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('total_votes, reputation_score')
    .eq('id', user.id)
    .maybeSingle()

  const totalVotes = profile?.total_votes ?? 0
  const repScore = profile?.reputation_score ?? 0

  // ── Topics / laws authored ─────────────────────────────────────────────────
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, created_at')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const topics = topicRows ?? []
  const lawsAuthored = topics.filter((t) => t.status === 'law')
  const topicsAuthored = topics.length

  const breakdown: RepBreakdown = {
    votes_score: totalVotes * 1,
    topics_score: topicsAuthored * 5,
    laws_score: lawsAuthored.length * 50,
    total: repScore,
    total_votes: totalVotes,
    topics_authored: topicsAuthored,
    laws_authored: lawsAuthored.length,
  }

  // ── Percentile ────────────────────────────────────────────────────────────
  const { count: belowCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .lt('reputation_score', repScore)

  const { count: totalCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  const percentile =
    totalCount && totalCount > 0
      ? Math.round(((belowCount ?? 0) / totalCount) * 100)
      : null

  // ── Recent reputation-earning activity ───────────────────────────────────
  // Show latest votes + authored topics (laws highlighted)
  const recentVotes = await supabase
    .from('votes')
    .select('id, created_at, topic_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const voteTopicIds = (recentVotes.data ?? []).map((v) => v.topic_id)
  const voteTopicMap: Map<string, { statement: string; category: string | null; status: string }> = new Map()
  if (voteTopicIds.length > 0) {
    const { data: vTopics } = await supabase
      .from('topics')
      .select('id, statement, category, status')
      .in('id', voteTopicIds)
    for (const t of vTopics ?? []) {
      voteTopicMap.set(t.id, { statement: t.statement, category: t.category, status: t.status })
    }
  }

  const voteActivity: RepActivity[] = (recentVotes.data ?? [])
    .map((v) => {
      const t = voteTopicMap.get(v.topic_id)
      if (!t) return null
      return {
        type: 'vote' as const,
        occurred_at: v.created_at,
        topic_id: v.topic_id,
        topic_statement: t.statement,
        topic_category: t.category,
        topic_status: t.status,
        points: 1,
      }
    })
    .filter(Boolean) as RepActivity[]

  const topicActivity: RepActivity[] = topics.slice(0, 10).map((t) => ({
    type: (t.status === 'law' ? 'law' : 'topic') as 'law' | 'topic',
    occurred_at: t.created_at,
    topic_id: t.id,
    topic_statement: t.statement,
    topic_category: t.category,
    topic_status: t.status,
    points: t.status === 'law' ? 50 : 5,
  }))

  const recent_activity = [...voteActivity, ...topicActivity]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 20)

  return NextResponse.json({
    breakdown,
    percentile,
    platform_avg: platformAvg,
    milestones: buildMilestones(repScore),
    leaders,
    recent_activity,
    is_authenticated: true,
  } satisfies ReputationResponse)
}
