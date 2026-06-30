import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Archetype metadata ────────────────────────────────────────────────────────

const ARCHETYPE_META: Record<string, { label: string; icon: string; description: string }> = {
  pragmatist:     { label: 'Pragmatist',     icon: '⚖️',  description: 'Evidence-driven, outcome-focused' },
  idealist:       { label: 'Idealist',       icon: '🌟', description: 'Values and long-term vision' },
  guardian:       { label: 'Guardian',       icon: '🛡️', description: 'Stability-first, skeptical of change' },
  reformer:       { label: 'Reformer',       icon: '🔧', description: 'Structural change and social progress' },
  libertarian:    { label: 'Libertarian',    icon: '🗽', description: 'Individual freedom, limited government' },
  communitarian:  { label: 'Communitarian', icon: '🤝', description: 'Community bonds and shared responsibility' },
  technocrat:     { label: 'Technocrat',     icon: '💻', description: 'Data-led expert analysis' },
  democrat:       { label: 'Democrat',       icon: '🗳️', description: 'Participation, transparency, civic voice' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SwingSegment {
  archetype: string
  label: string
  icon: string
  description: string
  forVotes: number
  againstVotes: number
  total: number
  forPct: number
  swingScore: number       // 0–100, higher = more contested (closer to 50/50)
  votesNeededToFlip: number // votes that need to flip to change overall outcome
}

export interface SwingArgument {
  id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  aiScore: number | null
  persuasionPotential: number  // 0–100 composite
  authorUsername: string | null
  authorArchetype: string | null
}

export interface MomentumPeriod {
  label: string
  forPct: number
  total: number
}

export interface SwingResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  persuasionGap: {
    dominantSide: 'for' | 'against' | 'tied'
    dominantPct: number
    votesToFlip: number
    lawThreshold: number
  }
  segments: SwingSegment[]
  topPersuasiveFor: SwingArgument[]
  topPersuasiveAgainst: SwingArgument[]
  momentum: {
    early: MomentumPeriod
    recent: MomentumPeriod
    swingDirection: 'toward_for' | 'toward_against' | 'stable'
    shiftPts: number
  }
  totalWithArchetype: number
}

// ─── GET /api/topics/[id]/swing ──────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const topicId = params.id
  if (!topicId) {
    return NextResponse.json({ error: 'Missing topic id' }, { status: 400 })
  }

  const supabase = await createClient()

  // 1. Topic metadata
  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', topicId)
    .single()

  if (topicErr || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // 2. Votes joined with profile archetype — cap at 5k for performance
  const { data: rawVotes } = await supabase
    .from('votes')
    .select('side, created_at, user_id, profiles(civic_archetype)')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true })
    .limit(5000)

  const allVotes = (rawVotes ?? []) as Array<{
    side: string
    created_at: string
    user_id: string
    profiles: { civic_archetype: string | null } | null
  }>

  // 3. Persuasion gap
  const totalVotes = allVotes.length || topic.total_votes || 0
  const forCount = allVotes.filter(v => v.side === 'blue').length
  const againstCount = allVotes.length - forCount
  const forPct = totalVotes > 0 ? (forCount / totalVotes) * 100 : topic.blue_pct ?? 50
  const againstPct = 100 - forPct

  const LAW_THRESHOLD = 60
  let dominantSide: 'for' | 'against' | 'tied'
  let dominantPct: number
  let votesToFlip: number

  if (Math.abs(forPct - 50) < 1) {
    dominantSide = 'tied'
    dominantPct = 50
    votesToFlip = 0
  } else if (forPct > againstPct) {
    dominantSide = 'for'
    dominantPct = forPct
    // To flip, need enough AGAINST votes to push total to >50% AGAINST
    // If we flip X votes: (against + X) / total > 0.5 → X > total * 0.5 - against
    votesToFlip = Math.max(1, Math.ceil(totalVotes * 0.5 - againstCount + 1))
  } else {
    dominantSide = 'against'
    dominantPct = againstPct
    votesToFlip = Math.max(1, Math.ceil(totalVotes * 0.5 - forCount + 1))
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

  const segments: SwingSegment[] = Object.entries(archetypeMap)
    .filter(([, counts]) => counts.for + counts.against >= 2)
    .map(([arch, counts]) => {
      const meta = ARCHETYPE_META[arch] ?? { label: arch, icon: '👤', description: '' }
      const total = counts.for + counts.against
      const segForPct = (counts.for / total) * 100
      // Swing score: 100 at 50/50, 0 at 100/0
      const swingScore = 100 - Math.abs(segForPct - 50) * 2

      // Votes this segment would need to flip to change overall outcome
      // Approximate: if this segment flipped all its minority-side voters
      const segVotesToFlip = dominantSide === 'for'
        ? Math.min(counts.for, votesToFlip)
        : Math.min(counts.against, votesToFlip)

      return {
        archetype: arch,
        label: meta.label,
        icon: meta.icon,
        description: meta.description,
        forVotes: counts.for,
        againstVotes: counts.against,
        total,
        forPct: Math.round(segForPct),
        swingScore: Math.round(swingScore),
        votesNeededToFlip: segVotesToFlip,
      }
    })
    .sort((a, b) => b.swingScore - a.swingScore) // most contested first

  // 5. Momentum — compare first 20% vs last 20% of votes
  const bucketSize = Math.max(5, Math.floor(allVotes.length * 0.2))
  const earlyVotes = allVotes.slice(0, bucketSize)
  const recentVotes = allVotes.slice(-bucketSize)

  function bucketForPct(bucket: typeof allVotes): number {
    if (!bucket.length) return 50
    const f = bucket.filter(v => v.side === 'blue').length
    return Math.round((f / bucket.length) * 100)
  }

  const earlyForPct = bucketForPct(earlyVotes)
  const recentForPct = bucketForPct(recentVotes)
  const shiftPts = recentForPct - earlyForPct

  let swingDirection: 'toward_for' | 'toward_against' | 'stable'
  if (shiftPts > 3) swingDirection = 'toward_for'
  else if (shiftPts < -3) swingDirection = 'toward_against'
  else swingDirection = 'stable'

  // 6. Top persuasive arguments — high upvotes + ai_score, cross-side resonance
  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select('id, side, content, upvotes, ai_score, user_id, profiles(username, civic_archetype)')
    .eq('topic_id', topicId)
    .order('upvotes', { ascending: false })
    .limit(40)

  const allArgs = (rawArgs ?? []) as Array<{
    id: string
    side: string
    content: string
    upvotes: number
    ai_score: number | null
    user_id: string
    profiles: { username: string; civic_archetype: string | null } | null
  }>

  function toSwingArg(arg: typeof allArgs[number]): SwingArgument {
    // Persuasion potential: weighted upvotes + AI score, normalized
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

  const forArgs = allArgs
    .filter(a => a.side === 'blue')
    .slice(0, 5)
    .map(toSwingArg)

  const againstArgs = allArgs
    .filter(a => a.side === 'red')
    .slice(0, 5)
    .map(toSwingArg)

  const response: SwingResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: Math.round(forPct * 10) / 10,
      total_votes: totalVotes,
    },
    persuasionGap: {
      dominantSide,
      dominantPct: Math.round(dominantPct * 10) / 10,
      votesToFlip,
      lawThreshold: LAW_THRESHOLD,
    },
    segments,
    topPersuasiveFor: forArgs,
    topPersuasiveAgainst: againstArgs,
    momentum: {
      early: { label: `First ${bucketSize} votes`, forPct: earlyForPct, total: earlyVotes.length },
      recent: { label: `Last ${bucketSize} votes`, forPct: recentForPct, total: recentVotes.length },
      swingDirection,
      shiftPts,
    },
    totalWithArchetype,
  }

  return NextResponse.json(response)
}
