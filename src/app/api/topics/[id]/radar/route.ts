import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RadarDimension {
  key: string
  label: string
  score: number       // 0–100
  raw: string         // human-readable value
  description: string
  color: string       // tailwind color token
}

export interface RadarResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  dimensions: RadarDimension[]
  overall: number            // 0–100 average of all dimensions
  insight: string            // single-sentence synthesis
}

// ─── Dimension calculators ────────────────────────────────────────────────────

function calcParticipation(totalVotes: number, totalArgs: number): { score: number; raw: string } {
  const vScore = Math.min(60, (Math.log1p(totalVotes) / Math.log1p(5000)) * 60)
  const aScore = Math.min(40, (Math.log1p(totalArgs) / Math.log1p(80)) * 40)
  return {
    score: Math.round(vScore + aScore),
    raw: `${totalVotes.toLocaleString()} votes · ${totalArgs} arguments`,
  }
}

function calcConsensus(bluePct: number): { score: number; raw: string } {
  // High score = strong consensus in either direction (far from 50/50)
  const distance = Math.abs(bluePct - 50)   // 0 = tied, 50 = unanimous
  const score = Math.round((distance / 50) * 100)
  const label = distance < 5 ? 'Deadlocked' : distance < 15 ? 'Contested' : distance < 30 ? 'Leaning' : distance < 42 ? 'Clear' : 'Decisive'
  return { score, raw: `${label} (${Math.round(bluePct)}% For)` }
}

function calcPolarization(bluePct: number): { score: number; raw: string } {
  // Polarization = closeness to 50/50; inverse of consensus
  const distance = Math.abs(bluePct - 50)
  const score = Math.round((1 - distance / 50) * 100)
  const label = score > 80 ? 'Highly polarized' : score > 60 ? 'Polarized' : score > 40 ? 'Moderate' : score > 20 ? 'Low tension' : 'Near-unanimous'
  return { score, raw: `${label}` }
}

function calcVelocity(recentVotes: number, oldVotes: number): { score: number; raw: string } {
  // Compare last 24h vs prior 24h
  if (recentVotes + oldVotes === 0) return { score: 0, raw: 'No recent activity' }
  const growth = oldVotes === 0 ? (recentVotes > 0 ? 100 : 0) : Math.min(200, (recentVotes / Math.max(oldVotes, 1)) * 50)
  const score = Math.min(100, Math.round(Math.log1p(recentVotes) / Math.log1p(200) * 80 + growth * 0.1))
  const label = recentVotes === 0 ? 'Quiet' : recentVotes < 10 ? 'Slow' : recentVotes < 50 ? 'Active' : recentVotes < 200 ? 'Hot' : 'Viral'
  return { score, raw: `${recentVotes} votes (24h) · ${label}` }
}

function calcArgumentQuality(avgScore: number | null, gradeCount: number): { score: number; raw: string } {
  if (avgScore === null || gradeCount === 0) return { score: 0, raw: 'No AI-graded arguments yet' }
  const qualScore = Math.round((avgScore / 10) * 80)
  const volumeBonus = Math.min(20, Math.round((gradeCount / 20) * 20))
  return {
    score: Math.min(100, qualScore + volumeBonus),
    raw: `Avg ${avgScore.toFixed(1)}/10 · ${gradeCount} graded`,
  }
}

function calcEngagement(reactions: number, bookmarks: number, sources: number): { score: number; raw: string } {
  const reactScore    = Math.min(40, Math.log1p(reactions)  / Math.log1p(200) * 40)
  const bookmarkScore = Math.min(30, Math.log1p(bookmarks)  / Math.log1p(100) * 30)
  const sourceScore   = Math.min(30, Math.log1p(sources)    / Math.log1p(20)  * 30)
  return {
    score: Math.round(reactScore + bookmarkScore + sourceScore),
    raw: `${reactions} reactions · ${bookmarks} bookmarks · ${sources} sources`,
  }
}

// ─── Insight generator ─────────────────────────────────────────────────────────

function buildInsight(dims: RadarDimension[], status: string): string {
  const sorted = [...dims].sort((a, b) => b.score - a.score)
  const top = sorted[0]
  const bottom = sorted[sorted.length - 1]
  const overall = Math.round(dims.reduce((s, d) => s + d.score, 0) / dims.length)

  if (status === 'law') return 'This topic has been resolved into law — its debate record is preserved.'
  if (status === 'failed') return 'This topic failed to achieve consensus — its debate record is preserved.'

  if (overall >= 75) return `High-performing debate — especially strong on ${top.label.toLowerCase()}.`
  if (overall >= 50) return `Solid debate activity. ${top.label} is the standout dimension; ${bottom.label} has room to grow.`
  if (overall >= 25) return `Early-stage debate with most activity around ${top.label}. Needs more ${bottom.label}.`
  return `Low engagement so far. Boost ${bottom.label} to unlock a richer civic debate.`
}

// ─── GET /api/topics/[id]/radar ───────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const topicId = params.id

  // ── Topic basics ──────────────────────────────────────────────────────────
  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_votes, total_votes, created_at')
    .eq('id', topicId)
    .single()

  if (topicErr || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const totalVotes = topic.total_votes ?? 0
  const blueVotes  = topic.blue_votes ?? 0
  const bluePct    = totalVotes > 0 ? (blueVotes / totalVotes) * 100 : 50

  // ── Argument count ────────────────────────────────────────────────────────
  const { count: argCount } = await supabase
    .from('topic_arguments')
    .select('*', { count: 'exact', head: true })
    .eq('topic_id', topicId)

  // ── AI argument scores ────────────────────────────────────────────────────
  const { data: scoreRows } = await supabase
    .from('argument_ai_scores')
    .select('score')
    .eq('topic_id', topicId)

  const scores   = (scoreRows ?? []).map((r) => r.score as number).filter((s) => typeof s === 'number')
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null

  // ── Recent velocity (last 48h split into two 24h windows) ─────────────────
  const now    = new Date()
  const h24ago = new Date(now.getTime() - 24 * 3600 * 1000).toISOString()
  const h48ago = new Date(now.getTime() - 48 * 3600 * 1000).toISOString()

  const { count: recentVotes } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('topic_id', topicId)
    .gte('created_at', h24ago)

  const { count: priorVotes } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('topic_id', topicId)
    .gte('created_at', h48ago)
    .lt('created_at', h24ago)

  // ── Reactions ─────────────────────────────────────────────────────────────
  const { count: reactionCount } = await supabase
    .from('topic_reactions')
    .select('*', { count: 'exact', head: true })
    .eq('topic_id', topicId)

  // ── Bookmarks ─────────────────────────────────────────────────────────────
  const { count: bookmarkCount } = await supabase
    .from('topic_bookmarks')
    .select('*', { count: 'exact', head: true })
    .eq('topic_id', topicId)

  // ── Sources ───────────────────────────────────────────────────────────────
  const { count: sourceCount } = await supabase
    .from('topic_sources')
    .select('*', { count: 'exact', head: true })
    .eq('topic_id', topicId)

  // ── Build dimensions ──────────────────────────────────────────────────────
  const p = calcParticipation(totalVotes, argCount ?? 0)
  const c = calcConsensus(bluePct)
  const pol = calcPolarization(bluePct)
  const v = calcVelocity(recentVotes ?? 0, priorVotes ?? 0)
  const q = calcArgumentQuality(avgScore, scores.length)
  const e = calcEngagement(reactionCount ?? 0, bookmarkCount ?? 0, sourceCount ?? 0)

  const dimensions: RadarDimension[] = [
    {
      key: 'participation',
      label: 'Participation',
      score: p.score,
      raw: p.raw,
      description: 'How many citizens have voted and argued',
      color: 'text-for-400',
    },
    {
      key: 'consensus',
      label: 'Consensus',
      score: c.score,
      raw: c.raw,
      description: 'How decisively the community leans one way',
      color: 'text-emerald',
    },
    {
      key: 'polarization',
      label: 'Polarization',
      score: pol.score,
      raw: pol.raw,
      description: 'How evenly split the debate is',
      color: 'text-against-400',
    },
    {
      key: 'velocity',
      label: 'Velocity',
      score: v.score,
      raw: v.raw,
      description: 'Rate of new votes in the last 24 hours',
      color: 'text-purple',
    },
    {
      key: 'quality',
      label: 'Argument Quality',
      score: q.score,
      raw: q.raw,
      description: 'Average AI-graded argument score',
      color: 'text-gold',
    },
    {
      key: 'engagement',
      label: 'Engagement',
      score: e.score,
      raw: e.raw,
      description: 'Reactions, bookmarks, and cited sources',
      color: 'text-for-300',
    },
  ]

  const overall = Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length)
  const insight = buildInsight(dimensions, topic.status as string)

  const response: RadarResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: (topic as { category?: string | null }).category ?? null,
      status: topic.status as string,
      blue_pct: Math.round(bluePct),
      total_votes: totalVotes,
    },
    dimensions,
    overall,
    insight,
  }

  return NextResponse.json(response)
}
