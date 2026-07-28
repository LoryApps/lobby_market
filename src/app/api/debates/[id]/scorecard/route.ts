import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ScorecardCriterion {
  id: string
  label: string
  description: string
  blue_raw: number
  red_raw: number
  blue_pts: number
  red_pts: number
  max_pts: number
  winner: 'blue' | 'red' | 'tie'
}

export interface ScorecardSpeaker {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

export interface ScorecardResponse {
  debate: {
    id: string
    title: string
    status: string
    type: string
    blue_sway: number
    red_sway: number
    started_at: string | null
    ended_at: string | null
    viewer_count: number
    topic_statement: string | null
    topic_category: string | null
  }
  blue_speaker: ScorecardSpeaker | null
  red_speaker: ScorecardSpeaker | null
  criteria: ScorecardCriterion[]
  blue_total: number
  red_total: number
  max_total: number
  overall_winner: 'blue' | 'red' | 'tie' | 'undecided'
}

function awardPoints(blueVal: number, redVal: number, maxPts: number): [number, number] {
  if (blueVal === 0 && redVal === 0) return [0, 0]
  const total = blueVal + redVal
  if (total === 0) return [0, 0]
  const bluePts = Math.round((blueVal / total) * maxPts)
  const redPts = maxPts - bluePts
  return [bluePts, redPts]
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { id } = params

  const { data: debate } = await supabase
    .from('debates')
    .select('id, title, status, type, blue_sway, red_sway, started_at, ended_at, topic_id, viewer_count')
    .eq('id', id)
    .single()

  if (!debate) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
  }

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category')
    .eq('id', debate.topic_id)
    .maybeSingle()

  const { data: participants } = await supabase
    .from('debate_participants')
    .select('user_id, side, is_speaker')
    .eq('debate_id', id)
    .eq('is_speaker', true)

  const blueParticipant = participants?.find((p) => p.side === 'blue') ?? null
  const redParticipant = participants?.find((p) => p.side === 'red') ?? null

  const speakerIds = [blueParticipant?.user_id, redParticipant?.user_id].filter(Boolean) as string[]

  let blueSpeaker: ScorecardSpeaker | null = null
  let redSpeaker: ScorecardSpeaker | null = null

  if (speakerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', speakerIds)

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? [])

    if (blueParticipant) {
      const prof = profileMap.get(blueParticipant.user_id)
      if (prof) {
        blueSpeaker = {
          user_id: prof.id,
          username: prof.username,
          display_name: prof.display_name,
          avatar_url: prof.avatar_url,
        }
      }
    }
    if (redParticipant) {
      const prof = profileMap.get(redParticipant.user_id)
      if (prof) {
        redSpeaker = {
          user_id: prof.id,
          username: prof.username,
          display_name: prof.display_name,
          avatar_url: prof.avatar_url,
        }
      }
    }
  }

  const { data: allMessages } = await supabase
    .from('debate_messages')
    .select('id, user_id, content, side, is_argument, upvotes')
    .eq('debate_id', id)

  const messages = allMessages ?? []

  const blueArgs = messages.filter((m) => m.side === 'blue' && m.is_argument)
  const redArgs = messages.filter((m) => m.side === 'red' && m.is_argument)

  const blueArgCount = blueArgs.length
  const redArgCount = redArgs.length

  const blueTotalUpvotes = blueArgs.reduce((s, m) => s + (m.upvotes ?? 0), 0)
  const redTotalUpvotes = redArgs.reduce((s, m) => s + (m.upvotes ?? 0), 0)

  const blueAvgUpvotes = blueArgCount > 0
    ? Math.round((blueTotalUpvotes / blueArgCount) * 10) / 10
    : 0
  const redAvgUpvotes = redArgCount > 0
    ? Math.round((redTotalUpvotes / redArgCount) * 10) / 10
    : 0

  const blueBestUpvotes = blueArgs.length > 0
    ? Math.max(...blueArgs.map((m) => m.upvotes ?? 0))
    : 0
  const redBestUpvotes = redArgs.length > 0
    ? Math.max(...redArgs.map((m) => m.upvotes ?? 0))
    : 0

  const blueSway = debate.blue_sway ?? 0
  const redSway = debate.red_sway ?? 0

  const [blueVolPts, redVolPts] = awardPoints(blueArgCount, redArgCount, 3)
  const [blueImpactPts, redImpactPts] = awardPoints(blueTotalUpvotes, redTotalUpvotes, 5)
  const [blueQualPts, redQualPts] = awardPoints(blueAvgUpvotes, redAvgUpvotes, 5)
  const [blueBestPts, redBestPts] = awardPoints(blueBestUpvotes, redBestUpvotes, 3)
  const [blueSwayPts, redSwayPts] = awardPoints(blueSway, redSway, 5)

  function criterionWinner(b: number, r: number): 'blue' | 'red' | 'tie' {
    if (b > r) return 'blue'
    if (r > b) return 'red'
    return 'tie'
  }

  const criteria: ScorecardCriterion[] = [
    {
      id: 'volume',
      label: 'Argument Volume',
      description: 'Number of formal arguments submitted',
      blue_raw: blueArgCount,
      red_raw: redArgCount,
      blue_pts: blueVolPts,
      red_pts: redVolPts,
      max_pts: 3,
      winner: criterionWinner(blueVolPts, redVolPts),
    },
    {
      id: 'impact',
      label: 'Total Impact',
      description: 'Combined upvotes across all arguments',
      blue_raw: blueTotalUpvotes,
      red_raw: redTotalUpvotes,
      blue_pts: blueImpactPts,
      red_pts: redImpactPts,
      max_pts: 5,
      winner: criterionWinner(blueImpactPts, redImpactPts),
    },
    {
      id: 'quality',
      label: 'Argument Quality',
      description: 'Average upvotes per argument (persuasiveness)',
      blue_raw: blueAvgUpvotes,
      red_raw: redAvgUpvotes,
      blue_pts: blueQualPts,
      red_pts: redQualPts,
      max_pts: 5,
      winner: criterionWinner(blueQualPts, redQualPts),
    },
    {
      id: 'best',
      label: 'Standout Argument',
      description: 'Highest upvotes on a single argument',
      blue_raw: blueBestUpvotes,
      red_raw: redBestUpvotes,
      blue_pts: blueBestPts,
      red_pts: redBestPts,
      max_pts: 3,
      winner: criterionWinner(blueBestPts, redBestPts),
    },
    {
      id: 'sway',
      label: 'Audience Verdict',
      description: 'Final audience sway percentage',
      blue_raw: blueSway,
      red_raw: redSway,
      blue_pts: blueSwayPts,
      red_pts: redSwayPts,
      max_pts: 5,
      winner: criterionWinner(blueSwayPts, redSwayPts),
    },
  ]

  const blueTotal = criteria.reduce((s, c) => s + c.blue_pts, 0)
  const redTotal = criteria.reduce((s, c) => s + c.red_pts, 0)
  const maxTotal = criteria.reduce((s, c) => s + c.max_pts, 0)

  let overall_winner: 'blue' | 'red' | 'tie' | 'undecided'
  if (debate.status !== 'ended') {
    overall_winner = 'undecided'
  } else if (blueTotal > redTotal) {
    overall_winner = 'blue'
  } else if (redTotal > blueTotal) {
    overall_winner = 'red'
  } else {
    overall_winner = 'tie'
  }

  return NextResponse.json({
    debate: {
      id: debate.id,
      title: debate.title,
      status: debate.status,
      type: debate.type,
      blue_sway: blueSway,
      red_sway: redSway,
      started_at: debate.started_at,
      ended_at: debate.ended_at,
      viewer_count: debate.viewer_count,
      topic_statement: topic?.statement ?? null,
      topic_category: topic?.category ?? null,
    },
    blue_speaker: blueSpeaker,
    red_speaker: redSpeaker,
    criteria,
    blue_total: blueTotal,
    red_total: redTotal,
    max_total: maxTotal,
    overall_winner,
  } satisfies ScorecardResponse)
}
