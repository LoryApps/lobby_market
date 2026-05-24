import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BreakingLevel = 'breaking' | 'developing' | 'alert' | 'watch'

export type BreakingEventKind =
  | 'vote_surge'       // >3× vote rate in last 2h vs prior 2h
  | 'law_imminent'     // blue_pct crossed 60% in last 2h
  | 'law_established'  // topic became law in last 2h
  | 'topic_failed'     // topic failed in last 2h
  | 'flip'             // majority side flipped in last 2h (e.g. was >50% FOR, now <50%)
  | 'debate_surge'     // >5 new arguments in last 1h on a topic
  | 'deadlock'         // topic at exactly 50±1% after 1000+ votes

export interface BreakingEvent {
  id: string           // unique event id
  topic_id: string
  topic_statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  kind: BreakingEventKind
  level: BreakingLevel
  headline: string
  subline: string
  votes_2h: number
  votes_prev_2h: number
  surge_ratio: number
  occurred_at: string
}

export interface BreakingResponse {
  events: BreakingEvent[]
  generated_at: string
  platform_votes_2h: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _level(kind: BreakingEventKind): BreakingLevel {
  if (kind === 'law_established' || kind === 'flip' || kind === 'vote_surge') return 'breaking'
  if (kind === 'law_imminent' || kind === 'topic_failed') return 'developing'
  if (kind === 'debate_surge') return 'alert'
  return 'watch'
}

function headline(kind: BreakingEventKind, topic: string, pct: number, ratio: number): string {
  const forPct = Math.round(pct)
  switch (kind) {
    case 'vote_surge':
      return `Vote surge: ${Math.round(ratio)}× spike in the last 2 hours`
    case 'law_imminent':
      return `Approaching consensus — ${forPct}% FOR and climbing`
    case 'law_established':
      return `Community consensus reached — now an established law`
    case 'topic_failed':
      return `Debate concluded — majority voted AGAINST`
    case 'flip':
      return forPct >= 50
        ? `Majority FLIPPED — now ${forPct}% FOR after recent surge`
        : `Majority FLIPPED — now ${100 - forPct}% AGAINST after pushback`
    case 'debate_surge':
      return `Argument explosion — debate heating up fast`
    case 'deadlock':
      return `Perfect deadlock — ${forPct}% FOR with ${Math.round(0)} votes to break the tie`
  }
}

function subline(kind: BreakingEventKind, votes2h: number, prevVotes: number, args2h?: number): string {
  switch (kind) {
    case 'vote_surge':
      return `${votes2h.toLocaleString()} votes in the last 2 hours vs ${prevVotes.toLocaleString()} in the prior 2 hours`
    case 'law_imminent':
      return `${votes2h.toLocaleString()} votes cast in the last 2 hours pushing toward law status`
    case 'law_established':
      return `The community reached a supermajority — this topic has become law`
    case 'topic_failed':
      return `Voting concluded with the AGAINST side prevailing`
    case 'flip':
      return `${votes2h.toLocaleString()} new votes in the last 2 hours reversed the previous majority`
    case 'debate_surge':
      return `${args2h ?? 0} new arguments posted in the last hour as debaters pile in`
    case 'deadlock':
      return `Perfectly split after thousands of votes — neither side can break the tie`
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = Date.now()
  const ms2h = 2 * 60 * 60 * 1000
  const ms1h = 1 * 60 * 60 * 1000

  const since2h   = new Date(now - ms2h).toISOString()
  const since4h   = new Date(now - ms2h * 2).toISOString()
  const since1h   = new Date(now - ms1h).toISOString()

  // ── 1. Fetch recent votes (last 4h) ───────────────────────────────────────
  const { data: recentVotes } = await supabase
    .from('votes')
    .select('topic_id, created_at, vote_value')
    .gte('created_at', since4h)
    .limit(30000)

  const votes = recentVotes ?? []

  // Count per topic: 2h vs prev-2h
  const counts2h     = new Map<string, number>()
  const countsPrev2h = new Map<string, number>()
  // For flip detection: collect recent vote values
  const recentVoteValues = new Map<string, number[]>()
  const prevVoteValues   = new Map<string, number[]>()

  for (const v of votes) {
    const tid = v.topic_id
    if (v.created_at >= since2h) {
      counts2h.set(tid, (counts2h.get(tid) ?? 0) + 1)
      if (!recentVoteValues.has(tid)) recentVoteValues.set(tid, [])
      recentVoteValues.get(tid)!.push(Number(v.vote_value))
    } else {
      countsPrev2h.set(tid, (countsPrev2h.get(tid) ?? 0) + 1)
      if (!prevVoteValues.has(tid)) prevVoteValues.set(tid, [])
      prevVoteValues.get(tid)!.push(Number(v.vote_value))
    }
  }

  const platform_votes_2h = [...counts2h.values()].reduce((s, n) => s + n, 0)

  // ── 2. Fetch topics with activity ─────────────────────────────────────────
  const activeTopicIds = [...new Set(votes.map(v => v.topic_id))]
  if (activeTopicIds.length === 0) {
    return NextResponse.json({
      events: [],
      generated_at: new Date().toISOString(),
      platform_votes_2h: 0,
    } satisfies BreakingResponse)
  }

  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, updated_at')
    .in('id', activeTopicIds.slice(0, 200))

  // Also grab recently transitioned topics (law/failed in last 2h)
  const { data: transitionedRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, updated_at')
    .in('status', ['law', 'failed'])
    .gte('updated_at', since2h)
    .limit(20)

  const topicMap = new Map<string, (typeof topicRows)[number]>()
  for (const t of [...(topicRows ?? []), ...(transitionedRows ?? [])]) {
    if (t) topicMap.set(t.id, t)
  }

  // ── 3. Fetch recent arguments per topic (last 1h) ─────────────────────────
  const { data: recentArgs } = await supabase
    .from('arguments')
    .select('topic_id')
    .gte('created_at', since1h)
    .limit(5000)

  const argCounts1h = new Map<string, number>()
  for (const a of recentArgs ?? []) {
    argCounts1h.set(a.topic_id, (argCounts1h.get(a.topic_id) ?? 0) + 1)
  }

  // ── 4. Classify events ────────────────────────────────────────────────────
  const events: BreakingEvent[] = []
  const seen = new Set<string>() // one event per topic

  for (const [topicId, topic] of topicMap.entries()) {
    if (!topic) continue
    if (seen.has(topicId)) continue

    const v2h   = counts2h.get(topicId)     ?? 0
    const vPrev = countsPrev2h.get(topicId) ?? 0
    const forPct = typeof topic.blue_pct === 'number' ? topic.blue_pct : 50
    const argsThisHour = argCounts1h.get(topicId) ?? 0

    // Law/failed transitions (highest priority)
    if (topic.status === 'law' && topic.updated_at >= since2h) {
      events.push({
        id: `law-${topicId}`,
        topic_id: topicId,
        topic_statement: topic.statement,
        category: topic.category ?? null,
        status: topic.status,
        blue_pct: forPct,
        total_votes: topic.total_votes,
        kind: 'law_established',
        level: 'breaking',
        headline: headline('law_established', topic.statement, forPct, 1),
        subline: subline('law_established', v2h, vPrev),
        votes_2h: v2h,
        votes_prev_2h: vPrev,
        surge_ratio: 1,
        occurred_at: topic.updated_at,
      })
      seen.add(topicId)
      continue
    }

    if (topic.status === 'failed' && topic.updated_at >= since2h) {
      events.push({
        id: `failed-${topicId}`,
        topic_id: topicId,
        topic_statement: topic.statement,
        category: topic.category ?? null,
        status: topic.status,
        blue_pct: forPct,
        total_votes: topic.total_votes,
        kind: 'topic_failed',
        level: 'developing',
        headline: headline('topic_failed', topic.statement, forPct, 1),
        subline: subline('topic_failed', v2h, vPrev),
        votes_2h: v2h,
        votes_prev_2h: vPrev,
        surge_ratio: 1,
        occurred_at: topic.updated_at,
      })
      seen.add(topicId)
      continue
    }

    // Vote surge: ≥3× and at least 10 votes in last 2h
    const surgeRatio = vPrev > 0 ? v2h / vPrev : v2h >= 10 ? 10 : 0
    if (surgeRatio >= 3 && v2h >= 10) {
      events.push({
        id: `surge-${topicId}`,
        topic_id: topicId,
        topic_statement: topic.statement,
        category: topic.category ?? null,
        status: topic.status,
        blue_pct: forPct,
        total_votes: topic.total_votes,
        kind: 'vote_surge',
        level: 'breaking',
        headline: headline('vote_surge', topic.statement, forPct, surgeRatio),
        subline: subline('vote_surge', v2h, vPrev),
        votes_2h: v2h,
        votes_prev_2h: vPrev,
        surge_ratio: surgeRatio,
        occurred_at: new Date(now - ms1h).toISOString(),
      })
      seen.add(topicId)
      continue
    }

    // Majority flip detection
    const recentFor = recentVoteValues.get(topicId) ?? []
    const prevFor   = prevVoteValues.get(topicId) ?? []
    if (recentFor.length >= 5 && prevFor.length >= 5) {
      const recentForPct = recentFor.reduce((s, v) => s + (v > 0 ? 1 : 0), 0) / recentFor.length * 100
      const prevForPct   = prevFor.reduce((s, v) => s + (v > 0 ? 1 : 0), 0) / prevFor.length * 100
      const flipped = (recentForPct >= 50 && prevForPct < 50) || (recentForPct < 50 && prevForPct >= 50)
      if (flipped) {
        events.push({
          id: `flip-${topicId}`,
          topic_id: topicId,
          topic_statement: topic.statement,
          category: topic.category ?? null,
          status: topic.status,
          blue_pct: forPct,
          total_votes: topic.total_votes,
          kind: 'flip',
          level: 'breaking',
          headline: headline('flip', topic.statement, forPct, surgeRatio),
          subline: subline('flip', v2h, vPrev),
          votes_2h: v2h,
          votes_prev_2h: vPrev,
          surge_ratio: surgeRatio,
          occurred_at: new Date(now - ms1h).toISOString(),
        })
        seen.add(topicId)
        continue
      }
    }

    // Law imminent: blue_pct >= 62 and still active/voting + recent activity
    if ((topic.status === 'active' || topic.status === 'voting') && forPct >= 62 && v2h >= 5) {
      events.push({
        id: `imminent-${topicId}`,
        topic_id: topicId,
        topic_statement: topic.statement,
        category: topic.category ?? null,
        status: topic.status,
        blue_pct: forPct,
        total_votes: topic.total_votes,
        kind: 'law_imminent',
        level: 'developing',
        headline: headline('law_imminent', topic.statement, forPct, surgeRatio),
        subline: subline('law_imminent', v2h, vPrev),
        votes_2h: v2h,
        votes_prev_2h: vPrev,
        surge_ratio: surgeRatio,
        occurred_at: new Date(now - ms1h).toISOString(),
      })
      seen.add(topicId)
      continue
    }

    // Debate surge: >5 new arguments in last 1h
    if (argsThisHour >= 5) {
      events.push({
        id: `args-${topicId}`,
        topic_id: topicId,
        topic_statement: topic.statement,
        category: topic.category ?? null,
        status: topic.status,
        blue_pct: forPct,
        total_votes: topic.total_votes,
        kind: 'debate_surge',
        level: 'alert',
        headline: headline('debate_surge', topic.statement, forPct, surgeRatio),
        subline: subline('debate_surge', v2h, vPrev, argsThisHour),
        votes_2h: v2h,
        votes_prev_2h: vPrev,
        surge_ratio: surgeRatio,
        occurred_at: new Date(now - 30 * 60 * 1000).toISOString(),
      })
      seen.add(topicId)
      continue
    }

    // Deadlock: 49–51% with 1000+ votes and recent activity
    if (Math.abs(forPct - 50) <= 1 && topic.total_votes >= 1000 && v2h >= 5) {
      events.push({
        id: `deadlock-${topicId}`,
        topic_id: topicId,
        topic_statement: topic.statement,
        category: topic.category ?? null,
        status: topic.status,
        blue_pct: forPct,
        total_votes: topic.total_votes,
        kind: 'deadlock',
        level: 'watch',
        headline: headline('deadlock', topic.statement, forPct, surgeRatio),
        subline: subline('deadlock', v2h, vPrev),
        votes_2h: v2h,
        votes_prev_2h: vPrev,
        surge_ratio: surgeRatio,
        occurred_at: new Date(now - 30 * 60 * 1000).toISOString(),
      })
      seen.add(topicId)
    }
  }

  // Sort: breaking first, then developing, then alert, then watch; within level by recency/surge
  const LEVEL_ORDER: Record<BreakingLevel, number> = { breaking: 0, developing: 1, alert: 2, watch: 3 }
  events.sort((a, b) => {
    const levelDiff = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]
    if (levelDiff !== 0) return levelDiff
    return b.surge_ratio - a.surge_ratio
  })

  return NextResponse.json({
    events: events.slice(0, 20),
    generated_at: new Date().toISOString(),
    platform_votes_2h,
  } satisfies BreakingResponse)
}
