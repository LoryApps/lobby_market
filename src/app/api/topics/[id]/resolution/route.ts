import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// The supermajority threshold required to pass a topic into law status.
export const LAW_THRESHOLD = 67

// ─── Response types ───────────────────────────────────────────────────────────

export interface ResolutionTopic {
  id: string
  statement: string
  category: string | null
  scope: string
  status: string
  blue_pct: number
  total_votes: number
  support_count: number
  activation_threshold: number
  voting_ends_at: string | null
  created_at: string
  author_id: string | null
}

export interface SimilarOutcome {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  resolved_at: string
  outcome: 'law' | 'failed'
  days_active: number
}

export interface ResolutionMilestone {
  label: string
  sublabel: string
  reached: boolean
  current: boolean
}

export interface ResolutionData {
  topic: ResolutionTopic
  lawThreshold: number
  // Progress
  supportsNeeded: number | null   // for proposed: how many more needed
  votesNeededForLaw: number | null // estimate of additional votes to hit 67%
  // Timing
  daysActive: number
  votingEndsAt: string | null
  // Milestones
  milestones: ResolutionMilestone[]
  // Predictions
  lawProbability: number | null
  totalPredictors: number
  // Category context
  categoryLawRate: number | null   // % of topics in same category that became law
  categoryMedianDays: number | null
  // Recent similar outcomes
  recentLaws: SimilarOutcome[]
  recentFailed: SimilarOutcome[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildMilestones(topic: ResolutionTopic): ResolutionMilestone[] {
  const { status, support_count, activation_threshold, blue_pct } = topic
  const supportPct = Math.min(100, Math.round((support_count / activation_threshold) * 100))
  const forPct = Math.round(blue_pct)

  const reached = (s: string) =>
    ['active', 'voting', 'law', 'failed', 'continued', 'archived'].includes(status)
      ? true
      : s === 'proposed'

  const milestones: ResolutionMilestone[] = [
    {
      label: 'Proposed',
      sublabel: 'Topic submitted to the Lobby',
      reached: true,
      current: status === 'proposed',
    },
    {
      label: 'Activated',
      sublabel: `${activation_threshold.toLocaleString()} supporters needed`,
      reached: reached('active'),
      current: status === 'active',
    },
    {
      label: 'Voting Phase',
      sublabel: 'Community votes on final outcome',
      reached: ['voting', 'law', 'failed', 'continued', 'archived'].includes(status),
      current: status === 'voting',
    },
    {
      label: 'Law Established',
      sublabel: `${LAW_THRESHOLD}%+ supermajority required`,
      reached: status === 'law',
      current: status === 'law',
    },
  ]

  // Adjust sublabels for current state
  if (status === 'proposed') {
    milestones[0].sublabel = `${supportPct}% of supporters gathered`
    milestones[1].sublabel = `${Math.max(0, activation_threshold - support_count).toLocaleString()} more supporters needed`
  }
  if (status === 'active' || status === 'voting') {
    milestones[2].sublabel = `Currently ${forPct}% FOR — need ${LAW_THRESHOLD}%`
  }
  if (status === 'failed') {
    milestones[3].label = 'Failed'
    milestones[3].sublabel = 'Did not reach supermajority'
    milestones[3].reached = true
    milestones[3].current = true
  }

  return milestones
}

function estimateVotesNeeded(bluePct: number, totalVotes: number): number | null {
  if (bluePct >= LAW_THRESHOLD) return 0
  // How many more FOR votes (assuming against stays fixed) to hit threshold
  const currentFor = Math.round((bluePct / 100) * totalVotes)
  // FOR / (FOR + x) ≈ 0.67 → additional FOR votes needed (against held constant)
  const targetTotal = currentFor / (LAW_THRESHOLD / 100)
  const needed = Math.ceil(targetTotal - totalVotes)
  return Math.max(0, needed)
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // 1. Fetch the topic
  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .select(
      'id, statement, category, scope, status, blue_pct, total_votes, support_count, activation_threshold, voting_ends_at, created_at, author_id'
    )
    .eq('id', id)
    .maybeSingle()

  if (topicErr || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // 2. Prediction market consensus
  let lawProbability: number | null = null
  let totalPredictors = 0
  try {
    const { data: preds } = await supabase
      .from('user_predictions')
      .select('predicted_law')
      .eq('topic_id', id)

    if (preds && preds.length > 0) {
      totalPredictors = preds.length
      lawProbability = Math.round(
        (preds.filter((p) => p.predicted_law).length / preds.length) * 100
      )
    }
  } catch {
    // predictions table may not exist — safe to ignore
  }

  // 3. Category context: % of topics in same category that became law
  let categoryLawRate: number | null = null
  let categoryMedianDays: number | null = null
  if (topic.category) {
    const { data: catTopics } = await supabase
      .from('topics')
      .select('status, created_at')
      .eq('category', topic.category)
      .in('status', ['law', 'failed', 'active', 'voting', 'proposed'])
      .limit(200)

    if (catTopics && catTopics.length > 0) {
      const concluded = catTopics.filter((t) =>
        ['law', 'failed'].includes(t.status)
      )
      if (concluded.length > 0) {
        categoryLawRate = Math.round(
          (concluded.filter((t) => t.status === 'law').length / concluded.length) * 100
        )
      }
    }

    // Median days for topics in same category that became law
    const { data: lawTopics } = await supabase
      .from('laws')
      .select('established_at, topic_id')
      .limit(100)

    if (lawTopics && lawTopics.length > 0) {
      const topicIds = lawTopics.map((l) => l.topic_id)
      const { data: relatedTopics } = await supabase
        .from('topics')
        .select('id, created_at')
        .in('id', topicIds)
        .eq('category', topic.category)

      if (relatedTopics && relatedTopics.length > 0) {
        const days = relatedTopics.map((t) => {
          const lawRow = lawTopics.find((l) => l.topic_id === t.id)
          if (!lawRow) return null
          const created = new Date(t.created_at).getTime()
          const established = new Date(lawRow.established_at).getTime()
          return Math.round((established - created) / 86_400_000)
        }).filter((d): d is number => d !== null)

        if (days.length > 0) {
          days.sort((a, b) => a - b)
          categoryMedianDays = days[Math.floor(days.length / 2)]
        }
      }
    }
  }

  // 4. Recent similar outcomes (same category, recently concluded)
  const recentLaws: SimilarOutcome[] = []
  const recentFailed: SimilarOutcome[] = []

  if (topic.category) {
    const { data: catLaws } = await supabase
      .from('laws')
      .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
      .eq('category', topic.category)
      .neq('topic_id', id)
      .order('established_at', { ascending: false })
      .limit(4)

    if (catLaws) {
      // Get creation dates for calculating days_active
      const topicIds = catLaws.map((l) => l.topic_id)
      const { data: lawTopicDates } = await supabase
        .from('topics')
        .select('id, created_at')
        .in('id', topicIds)

      for (const law of catLaws) {
        const topicDate = lawTopicDates?.find((t) => t.id === law.topic_id)
        const created = topicDate ? new Date(topicDate.created_at).getTime() : 0
        const established = new Date(law.established_at).getTime()
        recentLaws.push({
          id: law.id,
          statement: law.statement,
          category: law.category,
          blue_pct: law.blue_pct ?? 0,
          total_votes: law.total_votes ?? 0,
          resolved_at: law.established_at,
          outcome: 'law',
          days_active: created > 0 ? Math.round((established - created) / 86_400_000) : 0,
        })
      }
    }

    const { data: catFailed } = await supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes, updated_at')
      .eq('category', topic.category)
      .eq('status', 'failed')
      .neq('id', id)
      .order('updated_at', { ascending: false })
      .limit(3)

    if (catFailed) {
      for (const t of catFailed) {
        recentFailed.push({
          id: t.id,
          statement: t.statement,
          category: t.category,
          blue_pct: t.blue_pct ?? 0,
          total_votes: t.total_votes ?? 0,
          resolved_at: t.updated_at,
          outcome: 'failed',
          days_active: 0,
        })
      }
    }
  }

  // 5. Build result
  const daysActive = Math.round(
    (Date.now() - new Date(topic.created_at).getTime()) / 86_400_000
  )

  const supportsNeeded =
    topic.status === 'proposed'
      ? Math.max(0, topic.activation_threshold - topic.support_count)
      : null

  const votesNeededForLaw =
    topic.status === 'active' || topic.status === 'voting'
      ? estimateVotesNeeded(topic.blue_pct, topic.total_votes)
      : null

  const result: ResolutionData = {
    topic: topic as ResolutionTopic,
    lawThreshold: LAW_THRESHOLD,
    supportsNeeded,
    votesNeededForLaw,
    daysActive,
    votingEndsAt: topic.voting_ends_at,
    milestones: buildMilestones(topic as ResolutionTopic),
    lawProbability,
    totalPredictors,
    categoryLawRate,
    categoryMedianDays,
    recentLaws,
    recentFailed,
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  })
}
