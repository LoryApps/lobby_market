import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Archetype metadata ────────────────────────────────────────────────────────

const ARCHETYPE_META: Record<string, { label: string; icon: string; description: string }> = {
  pragmatist:    { label: 'Pragmatist',    icon: '⚖️',  description: 'Evidence-driven, outcome-focused' },
  idealist:      { label: 'Idealist',      icon: '🌟', description: 'Values and long-term vision' },
  guardian:      { label: 'Guardian',      icon: '🛡️', description: 'Stability-first, skeptical of change' },
  reformer:      { label: 'Reformer',      icon: '🔧', description: 'Structural change and social progress' },
  libertarian:   { label: 'Libertarian',   icon: '🗽', description: 'Individual freedom, limited government' },
  communitarian: { label: 'Communitarian', icon: '🤝', description: 'Community bonds and shared responsibility' },
  technocrat:    { label: 'Technocrat',    icon: '💻', description: 'Data-led expert analysis' },
  democrat:      { label: 'Democrat',      icon: '🗳️', description: 'Participation, transparency, civic voice' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LawSwingSegment {
  archetype: string
  label: string
  icon: string
  description: string
  forVotes: number
  againstVotes: number
  total: number
  forPct: number
  /** 0–100: higher = more contested (closer to 50/50 split) */
  contestScore: number
  /** Whether this archetype ultimately voted in the winning direction */
  alignedWithOutcome: boolean
}

export interface LawSwingArgument {
  id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  aiScore: number | null
  persuasionPotential: number
  authorUsername: string | null
  authorArchetype: string | null
}

export interface LawSwingResponse {
  law: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string
    topic_id: string
  }
  /** How the vote evolved: first 20% vs last 20% of votes */
  founding: {
    early: { forPct: number; total: number }
    late:  { forPct: number; total: number }
    shiftPts: number
    trend: 'built_momentum' | 'lost_momentum' | 'decisive_from_start' | 'close_to_the_end'
    trendLabel: string
    trendDescription: string
  }
  /** Archetype breakdown from the founding debate */
  segments: LawSwingSegment[]
  totalWithArchetype: number
  /** Top arguments that shaped the debate */
  decisiveFor: LawSwingArgument[]
  decisiveAgainst: LawSwingArgument[]
  /** Summary insight */
  mandate: {
    strength: 'landslide' | 'strong' | 'narrow' | 'contested'
    label: string
    description: string
    marginPp: number
  }
}

// ─── GET /api/laws/[id]/swing ─────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const lawId = params.id
  if (!lawId) {
    return NextResponse.json({ error: 'Missing law id' }, { status: 400 })
  }

  const supabase = await createClient()

  // 1. Law metadata
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
    .eq('id', lawId)
    .single()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const topicId: string | null = law.topic_id ?? null

  // 2. Votes on the founding topic — cap at 5k for performance
  let allVotes: Array<{
    side: string
    created_at: string
    user_id: string
    profiles: { civic_archetype: string | null } | null
  }> = []

  if (topicId) {
    const { data: rawVotes } = await supabase
      .from('votes')
      .select('side, created_at, user_id, profiles(civic_archetype)')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true })
      .limit(5000)

    allVotes = (rawVotes ?? []) as typeof allVotes
  }

  // 3. Founding momentum — compare first vs last 20% of votes
  const bucketSize = Math.max(5, Math.floor(allVotes.length * 0.2))
  const earlyVotes = allVotes.slice(0, bucketSize)
  const lateVotes  = allVotes.slice(-bucketSize)

  function bucketForPct(bucket: typeof allVotes): number {
    if (!bucket.length) return Math.round(law.blue_pct ?? 50)
    const f = bucket.filter(v => v.side === 'blue').length
    return Math.round((f / bucket.length) * 100)
  }

  const earlyForPct = allVotes.length >= 10 ? bucketForPct(earlyVotes) : Math.round(law.blue_pct ?? 50)
  const lateForPct  = allVotes.length >= 10 ? bucketForPct(lateVotes)  : Math.round(law.blue_pct ?? 50)
  const shiftPts    = lateForPct - earlyForPct
  const finalForPct = law.blue_pct ?? 75

  let trend: LawSwingResponse['founding']['trend']
  let trendLabel: string
  let trendDescription: string

  if (earlyForPct >= 60 && lateForPct >= 60) {
    trend = 'decisive_from_start'
    trendLabel = 'Decisive from the start'
    trendDescription = 'FOR dominated both early and late voters — the outcome was never seriously in doubt.'
  } else if (shiftPts > 5) {
    trend = 'built_momentum'
    trendLabel = 'Built momentum'
    trendDescription = `Support grew by ${shiftPts}pp from early to late voters — the debate converted fence-sitters over time.`
  } else if (shiftPts < -5) {
    trend = 'lost_momentum'
    trendLabel = 'Late resistance emerged'
    trendDescription = `FOR support dropped ${Math.abs(shiftPts)}pp in the late stage, but the majority held.`
  } else {
    trend = 'close_to_the_end'
    trendLabel = 'Contested throughout'
    trendDescription = 'Sentiment stayed tight from first vote to last — this law passed on consistent, hard-fought conviction.'
  }

  // 4. Archetype segments
  const archetypeMap: Record<string, { for: number; against: number }> = {}
  let totalWithArchetype = 0

  for (const v of allVotes) {
    const arch = v.profiles?.civic_archetype
    if (!arch) continue
    totalWithArchetype++
    if (!archetypeMap[arch]) archetypeMap[arch] = { for: 0, against: 0 }
    if (v.side === 'blue') archetypeMap[arch].for++
    else archetypeMap[arch].against++
  }

  const segments: LawSwingSegment[] = Object.entries(archetypeMap)
    .filter(([, counts]) => counts.for + counts.against >= 2)
    .map(([arch, counts]) => {
      const meta = ARCHETYPE_META[arch] ?? { label: arch, icon: '👤', description: '' }
      const total = counts.for + counts.against
      const segForPct = (counts.for / total) * 100
      // Contest score: 100 at 50/50, 0 at 100/0
      const contestScore = Math.round(100 - Math.abs(segForPct - 50) * 2)
      const alignedWithOutcome = finalForPct >= 50 ? segForPct >= 50 : segForPct < 50

      return {
        archetype: arch,
        label: meta.label,
        icon: meta.icon,
        description: meta.description,
        forVotes: counts.for,
        againstVotes: counts.against,
        total,
        forPct: Math.round(segForPct),
        contestScore,
        alignedWithOutcome,
      }
    })
    .sort((a, b) => b.contestScore - a.contestScore)

  // 5. Decisive arguments from the founding debate
  const argRows = topicId ? await supabase
    .from('topic_arguments')
    .select('id, side, content, upvotes, ai_score, user_id, profiles(username, civic_archetype)')
    .eq('topic_id', topicId)
    .order('upvotes', { ascending: false })
    .limit(40) : { data: null }

  const allArgs = (argRows.data ?? []) as Array<{
    id: string
    side: string
    content: string
    upvotes: number
    ai_score: number | null
    user_id: string
    profiles: { username: string; civic_archetype: string | null } | null
  }>

  function toArg(arg: typeof allArgs[number]): LawSwingArgument {
    const upvoteScore = Math.min(100, (arg.upvotes ?? 0) * 5)
    const aiBoost = arg.ai_score ? arg.ai_score * 6 : 0
    const persuasionPotential = Math.round(Math.min(100, (upvoteScore + aiBoost) / 2))
    return {
      id: arg.id,
      side: arg.side as 'blue' | 'red',
      content: arg.content,
      upvotes: arg.upvotes ?? 0,
      aiScore: arg.ai_score ?? null,
      persuasionPotential,
      authorUsername: arg.profiles?.username ?? null,
      authorArchetype: arg.profiles?.civic_archetype ?? null,
    }
  }

  const decisiveFor     = allArgs.filter(a => a.side === 'blue').slice(0, 5).map(toArg)
  const decisiveAgainst = allArgs.filter(a => a.side === 'red').slice(0, 5).map(toArg)

  // 6. Mandate strength
  const marginPp = Math.round(Math.abs(finalForPct - 50) * 2 * 10) / 10
  let mandate: LawSwingResponse['mandate']

  if (finalForPct >= 80) {
    mandate = { strength: 'landslide', label: 'Landslide',  description: `Passed with an overwhelming ${Math.round(finalForPct)}% FOR — a rare supermajority mandate.`,       marginPp }
  } else if (finalForPct >= 70) {
    mandate = { strength: 'strong',    label: 'Strong',     description: `Passed with ${Math.round(finalForPct)}% FOR — clear consensus and strong public backing.`,              marginPp }
  } else if (finalForPct >= 60) {
    mandate = { strength: 'narrow',    label: 'Narrow',     description: `Passed with ${Math.round(finalForPct)}% FOR — solid majority but with meaningful opposition.`,          marginPp }
  } else {
    mandate = { strength: 'contested', label: 'Contested',  description: `Passed by a slim margin at ${Math.round(finalForPct)}% FOR — this law crossed the line under pressure.`, marginPp }
  }

  const response: LawSwingResponse = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      blue_pct: Math.round((law.blue_pct ?? 75) * 10) / 10,
      total_votes: law.total_votes ?? 0,
      established_at: law.established_at,
      topic_id: topicId ?? '',
    },
    founding: {
      early: { forPct: earlyForPct, total: earlyVotes.length },
      late:  { forPct: lateForPct,  total: lateVotes.length },
      shiftPts,
      trend,
      trendLabel,
      trendDescription,
    },
    segments,
    totalWithArchetype,
    decisiveFor,
    decisiveAgainst,
    mandate,
  }

  return NextResponse.json(response)
}
