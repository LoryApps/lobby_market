import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Politics',
  'Economics',
  'Technology',
  'Ethics',
  'Science',
  'Culture',
  'Philosophy',
  'Health',
  'Environment',
  'Education',
] as const

const MAX_VOTES_SCANNED = 500

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FingerprintCategory {
  category: string
  user_for_pct: number
  platform_for_pct: number
  deviation: number
  user_votes: number
}

export interface OutlierVote {
  topic_id: string
  statement: string
  category: string | null
  status: string
  user_side: 'for' | 'against'
  minority_pct: number
  total_votes: number
}

export interface FingerprintData {
  categories: FingerprintCategory[]
  overall_alignment: number
  fingerprint_score: number
  total_votes: number
  minority_votes: number
  mainstream_votes: number
  rarest_position: OutlierVote | null
  most_mainstream: OutlierVote | null
  unique_label: string
  unique_description: string
}

// ─── Uniqueness label ─────────────────────────────────────────────────────────

function computeLabel(
  fingerprintScore: number,
  alignmentPct: number,
  totalVotes: number,
): { label: string; description: string } {
  if (totalVotes < 5) {
    return {
      label: 'Uncharted',
      description: 'Cast more votes to reveal your civic fingerprint.',
    }
  }
  if (fingerprintScore >= 28) {
    return {
      label: 'Radical Outlier',
      description:
        'Your civic positions deviate dramatically from platform consensus. You chart your own course.',
    }
  }
  if (fingerprintScore >= 20) {
    return {
      label: 'Bold Contrarian',
      description:
        'You frequently oppose the majority view. Your fingerprint is distinctive and uncompromising.',
    }
  }
  if (fingerprintScore >= 13) {
    return {
      label: 'Independent Thinker',
      description:
        'You often diverge from the crowd on key issues. Your fingerprint shows genuine civic independence.',
    }
  }
  if (alignmentPct >= 72) {
    return {
      label: 'Consensus Builder',
      description:
        'You align closely with platform consensus. You vote with the majority most of the time.',
    }
  }
  if (fingerprintScore >= 7) {
    return {
      label: 'Selective Dissenter',
      description:
        'You agree with the majority on most issues, but hold firm outlier positions in a few key areas.',
    }
  }
  return {
    label: 'Voice of the Mainstream',
    description:
      'Your votes closely track platform consensus across almost every category. You are the median citizen.',
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: myVotesRaw } = await supabase
    .from('votes')
    .select('side, topic_id, topics(id, statement, category, status, blue_pct, total_votes)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(MAX_VOTES_SCANNED)

  const myVotes = (myVotesRaw ?? []) as Array<{
    side: string
    topic_id: string
    topics: {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
    } | null
  }>

  if (myVotes.length === 0) {
    return NextResponse.json({
      categories: [],
      overall_alignment: 0,
      fingerprint_score: 0,
      total_votes: 0,
      minority_votes: 0,
      mainstream_votes: 0,
      rarest_position: null,
      most_mainstream: null,
      unique_label: 'Uncharted',
      unique_description: 'Cast votes to reveal your civic fingerprint.',
    } satisfies FingerprintData)
  }

  const categoryMap = new Map<
    string,
    { userFor: number; userAgainst: number; platformForSum: number; topicCount: number }
  >()

  let totalVotes = 0
  let minorityVotes = 0
  let mainstreamVotes = 0
  let rarestPosition: OutlierVote | null = null
  let mainstreamPosition: OutlierVote | null = null
  let rarestPct = 100
  let mainstreamPct = 0

  for (const vote of myVotes) {
    const topic = vote.topics
    if (!topic || topic.total_votes < 2) continue

    const cat = topic.category ?? 'Other'
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, { userFor: 0, userAgainst: 0, platformForSum: 0, topicCount: 0 })
    }
    const entry = categoryMap.get(cat)!

    const isFor = vote.side === 'for'
    if (isFor) entry.userFor++
    else entry.userAgainst++
    entry.platformForSum += topic.blue_pct ?? 50
    entry.topicCount++
    totalVotes++

    const majorityFor = (topic.blue_pct ?? 50) >= 50
    const userFor2 = vote.side === 'for'
    const aligned = majorityFor === userFor2
    const agreePct = userFor2 ? topic.blue_pct : 100 - topic.blue_pct

    if (aligned) {
      mainstreamVotes++
      if (agreePct > mainstreamPct) {
        mainstreamPct = agreePct
        mainstreamPosition = {
          topic_id: topic.id,
          statement: topic.statement,
          category: topic.category,
          status: topic.status,
          user_side: userFor2 ? 'for' : 'against',
          minority_pct: Math.round(agreePct),
          total_votes: topic.total_votes,
        }
      }
    } else {
      minorityVotes++
      if (agreePct < rarestPct) {
        rarestPct = agreePct
        rarestPosition = {
          topic_id: topic.id,
          statement: topic.statement,
          category: topic.category,
          status: topic.status,
          user_side: userFor2 ? 'for' : 'against',
          minority_pct: Math.round(agreePct),
          total_votes: topic.total_votes,
        }
      }
    }
  }

  const categories: FingerprintCategory[] = []

  for (const cat of CATEGORIES) {
    const entry = categoryMap.get(cat)
    if (!entry || entry.topicCount === 0) continue

    const userTotal = entry.userFor + entry.userAgainst
    const userForPct = userTotal > 0 ? Math.round((entry.userFor / userTotal) * 100) : 50
    const platformForPct = Math.round(entry.platformForSum / entry.topicCount)
    categories.push({
      category: cat,
      user_for_pct: userForPct,
      platform_for_pct: platformForPct,
      deviation: userForPct - platformForPct,
      user_votes: userTotal,
    })
  }

  const otherEntry = categoryMap.get('Other')
  if (otherEntry && otherEntry.topicCount > 0) {
    const userTotal = otherEntry.userFor + otherEntry.userAgainst
    const userForPct = userTotal > 0 ? Math.round((otherEntry.userFor / userTotal) * 100) : 50
    const platformForPct = Math.round(otherEntry.platformForSum / otherEntry.topicCount)
    categories.push({
      category: 'Other',
      user_for_pct: userForPct,
      platform_for_pct: platformForPct,
      deviation: userForPct - platformForPct,
      user_votes: userTotal,
    })
  }

  categories.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))

  const fingerprintScore =
    categories.length > 0
      ? Math.round(
          categories.reduce((s, c) => s + Math.abs(c.deviation), 0) / categories.length,
        )
      : 0

  const overallAlignment =
    totalVotes > 0 ? Math.round((mainstreamVotes / totalVotes) * 100) : 0

  const { label, description } = computeLabel(fingerprintScore, overallAlignment, totalVotes)

  return NextResponse.json({
    categories,
    overall_alignment: overallAlignment,
    fingerprint_score: fingerprintScore,
    total_votes: totalVotes,
    minority_votes: minorityVotes,
    mainstream_votes: mainstreamVotes,
    rarest_position: rarestPosition,
    most_mainstream: mainstreamPosition,
    unique_label: label,
    unique_description: description,
  } satisfies FingerprintData)
}
