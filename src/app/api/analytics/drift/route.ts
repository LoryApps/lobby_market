import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DriftBucket =
  | 'strongly_aligned'
  | 'aligned'
  | 'deadlocked'
  | 'contrarian'
  | 'strongly_contrarian'

export interface DriftTopic {
  topic_id: string
  statement: string
  category: string | null
  status: string
  user_vote: 'blue' | 'red'
  blue_pct: number
  total_votes: number
  bucket: DriftBucket
  gap: number
  voted_at: string
}

export interface DriftBucketSummary {
  bucket: DriftBucket
  count: number
  label: string
  description: string
}

export interface DriftResponse {
  user: {
    username: string
    display_name: string | null
    avatar_url: string | null
  }
  total_voted: number
  aligned_count: number
  contrarian_count: number
  deadlocked_count: number
  alignment_score: number
  avg_gap: number
  buckets: DriftBucketSummary[]
  most_contrarian: DriftTopic[]
  most_aligned: DriftTopic[]
  category_drift: { category: string; aligned: number; contrarian: number; score: number }[]
  recent_topics: DriftTopic[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyBucket(userVote: 'blue' | 'red', bluePct: number): DriftBucket {
  const consensusStrength = Math.abs(bluePct - 50) * 2 // 0–100
  const consensusFor = bluePct > 50
  const userFor = userVote === 'blue'
  const aligned = userFor === consensusFor

  if (consensusStrength < 8) return 'deadlocked'
  if (aligned && consensusStrength >= 40) return 'strongly_aligned'
  if (aligned) return 'aligned'
  if (consensusStrength >= 40) return 'strongly_contrarian'
  return 'contrarian'
}

function gapForTopic(userVote: 'blue' | 'red', bluePct: number): number {
  // How far is the user from the consensus? 0 = perfectly aligned, 100 = maximally contrarian
  const userFor = userVote === 'blue'
  const userPct = userFor ? bluePct : 100 - bluePct
  // userPct = percentage of voters who agree with user. 50 = deadlock, 100 = unanimous agreement
  // gap = how contrarian: 50 - userPct (clamped to 0 if aligned)
  return Math.max(0, 50 - userPct)
}

const BUCKET_META: Record<DriftBucket, { label: string; description: string }> = {
  strongly_aligned: {
    label: 'Strongly Aligned',
    description: 'Your vote matches a clear community consensus (70%+)',
  },
  aligned: {
    label: 'Aligned',
    description: 'Your vote agrees with the majority but consensus is moderate',
  },
  deadlocked: {
    label: 'Deadlocked',
    description: 'Near 50/50 split — community is genuinely divided',
  },
  contrarian: {
    label: 'Contrarian',
    description: 'Your vote goes against a moderate majority',
  },
  strongly_contrarian: {
    label: 'Strongly Contrarian',
    description: 'Your vote opposes a decisive community consensus (70%+)',
  },
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Fetch all user votes joined with topic data
  const { data: voteRows } = await supabase
    .from('votes')
    .select(
      `
      side,
      created_at,
      topics (
        id,
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (!voteRows || voteRows.length === 0) {
    return NextResponse.json({
      user: {
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      },
      total_voted: 0,
      aligned_count: 0,
      contrarian_count: 0,
      deadlocked_count: 0,
      alignment_score: 50,
      avg_gap: 0,
      buckets: (Object.keys(BUCKET_META) as DriftBucket[]).map((b) => ({
        bucket: b,
        count: 0,
        ...BUCKET_META[b],
      })),
      most_contrarian: [],
      most_aligned: [],
      category_drift: [],
      recent_topics: [],
    } satisfies DriftResponse)
  }

  // Build DriftTopic array
  const driftTopics: DriftTopic[] = []
  for (const row of voteRows) {
    const topic = row.topics as {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
    } | null
    if (!topic) continue

    const userVote = row.side as 'blue' | 'red'
    const bluePct = topic.blue_pct ?? 50
    const bucket = classifyBucket(userVote, bluePct)
    const gap = gapForTopic(userVote, bluePct)

    driftTopics.push({
      topic_id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      user_vote: userVote,
      blue_pct: bluePct,
      total_votes: topic.total_votes,
      bucket,
      gap,
      voted_at: row.created_at,
    })
  }

  // Aggregates
  const aligned = driftTopics.filter(
    (t) => t.bucket === 'strongly_aligned' || t.bucket === 'aligned'
  )
  const contrarian = driftTopics.filter(
    (t) => t.bucket === 'strongly_contrarian' || t.bucket === 'contrarian'
  )
  const deadlocked = driftTopics.filter((t) => t.bucket === 'deadlocked')

  const totalVoted = driftTopics.length
  const alignedCount = aligned.length
  const contrarianCount = contrarian.length
  const deadlockedCount = deadlocked.length
  const alignmentScore =
    totalVoted > 0
      ? Math.round(((alignedCount + deadlockedCount * 0.5) / totalVoted) * 100)
      : 50

  const avgGap =
    driftTopics.length > 0
      ? Math.round(driftTopics.reduce((s, t) => s + t.gap, 0) / driftTopics.length)
      : 0

  // Bucket counts
  const bucketCounts: Record<DriftBucket, number> = {
    strongly_aligned: 0,
    aligned: 0,
    deadlocked: 0,
    contrarian: 0,
    strongly_contrarian: 0,
  }
  for (const t of driftTopics) bucketCounts[t.bucket]++

  const buckets: DriftBucketSummary[] = (
    Object.keys(BUCKET_META) as DriftBucket[]
  ).map((b) => ({
    bucket: b,
    count: bucketCounts[b],
    ...BUCKET_META[b],
  }))

  // Most contrarian (largest gap, only true contrarian buckets)
  const mostContrarian = [...contrarian]
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 10)

  // Most aligned (smallest gap, only clearly aligned buckets, must have enough votes on topic)
  const mostAligned = [...aligned]
    .filter((t) => t.total_votes >= 5)
    .sort((a, b) => a.gap - b.gap || b.total_votes - a.total_votes)
    .slice(0, 10)

  // Category drift breakdown
  const catMap = new Map<string, { aligned: number; contrarian: number }>()
  for (const t of driftTopics) {
    const cat = t.category ?? 'Uncategorised'
    const entry = catMap.get(cat) ?? { aligned: 0, contrarian: 0 }
    if (t.bucket === 'strongly_aligned' || t.bucket === 'aligned') entry.aligned++
    else if (t.bucket === 'strongly_contrarian' || t.bucket === 'contrarian')
      entry.contrarian++
    catMap.set(cat, entry)
  }

  const categoryDrift = Array.from(catMap.entries())
    .map(([category, counts]) => {
      const total = counts.aligned + counts.contrarian
      return {
        category,
        aligned: counts.aligned,
        contrarian: counts.contrarian,
        score: total > 0 ? Math.round((counts.aligned / total) * 100) : 50,
      }
    })
    .filter((c) => c.aligned + c.contrarian >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  // Recent 20 topics (chronological)
  const recentTopics = driftTopics.slice(0, 20)

  return NextResponse.json({
    user: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
    },
    total_voted: totalVoted,
    aligned_count: alignedCount,
    contrarian_count: contrarianCount,
    deadlocked_count: deadlockedCount,
    alignment_score: alignmentScore,
    avg_gap: avgGap,
    buckets,
    most_contrarian: mostContrarian,
    most_aligned: mostAligned,
    category_drift: categoryDrift,
    recent_topics: recentTopics,
  } satisfies DriftResponse)
}
