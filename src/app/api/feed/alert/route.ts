import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertKind =
  | 'near_consensus'   // topic >= 78% FOR or <= 22% FOR and has enough votes
  | 'law_just_passed'  // law established in last 2 hours
  | 'debate_soon'      // debate starting within 45 minutes
  | 'final_voting'     // topic in voting phase ending in < 6 hours
  | 'surge'            // topic gained 10%+ votes in last hour

export interface FeedAlert {
  kind: AlertKind
  topicId: string | null
  lawId: string | null
  debateId: string | null
  headline: string
  subline: string
  href: string
  accentColor: 'blue' | 'red' | 'gold' | 'purple' | 'emerald'
  dismissKey: string  // localStorage key to suppress repeat alerts
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const now = new Date().toISOString()

  // 1. Law established in the last 2 hours
  const { data: recentLaw } = await supabase
    .from('laws')
    .select('id, statement, category, total_votes')
    .gte('established_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .order('established_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recentLaw) {
    return NextResponse.json({
      alert: {
        kind: 'law_just_passed' as AlertKind,
        topicId: null,
        lawId: recentLaw.id,
        debateId: null,
        headline: 'New law just established',
        subline: recentLaw.statement.length > 80
          ? recentLaw.statement.slice(0, 80) + '…'
          : recentLaw.statement,
        href: `/law/${recentLaw.id}`,
        accentColor: 'gold' as const,
        dismissKey: `lm_alert_law_${recentLaw.id}`,
      } satisfies FeedAlert,
    })
  }

  // 2. Debate starting in the next 45 minutes
  const in45 = new Date(Date.now() + 45 * 60 * 1000).toISOString()
  const { data: upcomingDebate } = await supabase
    .from('debates')
    .select('id, topic_id, scheduled_at, topics(statement)')
    .eq('status', 'scheduled')
    .gte('scheduled_at', now)
    .lte('scheduled_at', in45)
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (upcomingDebate) {
    const mins = Math.max(
      1,
      Math.round((new Date(upcomingDebate.scheduled_at!).getTime() - Date.now()) / 60_000)
    )
    const topicStatement =
      (upcomingDebate.topics as { statement: string } | null)?.statement ?? ''
    return NextResponse.json({
      alert: {
        kind: 'debate_soon' as AlertKind,
        topicId: upcomingDebate.topic_id ?? null,
        lawId: null,
        debateId: upcomingDebate.id,
        headline: `Debate starting in ${mins} min`,
        subline: topicStatement.length > 80
          ? topicStatement.slice(0, 80) + '…'
          : topicStatement,
        href: `/debate/${upcomingDebate.id}`,
        accentColor: 'purple' as const,
        dismissKey: `lm_alert_debate_${upcomingDebate.id}`,
      } satisfies FeedAlert,
    })
  }

  // 3. Topic in final-voting phase
  const in6h = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
  const { data: finalVoting } = await supabase
    .from('topics')
    .select('id, statement, blue_pct, total_votes, voting_ends_at')
    .eq('status', 'voting')
    .not('voting_ends_at', 'is', null)
    .lte('voting_ends_at', in6h)
    .gte('voting_ends_at', now)
    .gte('total_votes', 20)
    .order('total_votes', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (finalVoting) {
    const endMs = new Date(finalVoting.voting_ends_at!).getTime()
    const hrsLeft = Math.max(1, Math.round((endMs - Date.now()) / 3_600_000))
    const leading = finalVoting.blue_pct >= 50 ? 'FOR' : 'AGAINST'
    return NextResponse.json({
      alert: {
        kind: 'final_voting' as AlertKind,
        topicId: finalVoting.id,
        lawId: null,
        debateId: null,
        headline: `Final vote — ${hrsLeft}h left`,
        subline: `${leading} leads ${Math.round(Math.abs(finalVoting.blue_pct - 50) + 50)}% · ${finalVoting.statement.slice(0, 70)}…`,
        href: `/topic/${finalVoting.id}`,
        accentColor: finalVoting.blue_pct >= 50 ? 'blue' : 'red',
        dismissKey: `lm_alert_voting_${finalVoting.id}`,
      } satisfies FeedAlert,
    })
  }

  // 4. Topic nearing consensus (>= 78% or <= 22%) with decent vote count
  const { data: nearConsensus } = await supabase
    .from('topics')
    .select('id, statement, blue_pct, total_votes')
    .eq('status', 'active')
    .gte('total_votes', 30)
    .or('blue_pct.gte.78,blue_pct.lte.22')
    .order('total_votes', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (nearConsensus) {
    const isFor = nearConsensus.blue_pct >= 50
    const pct = isFor
      ? Math.round(nearConsensus.blue_pct)
      : Math.round(100 - nearConsensus.blue_pct)
    return NextResponse.json({
      alert: {
        kind: 'near_consensus' as AlertKind,
        topicId: nearConsensus.id,
        lawId: null,
        debateId: null,
        headline: `${pct}% ${isFor ? 'agree' : 'disagree'} — nearing consensus`,
        subline: nearConsensus.statement.length > 80
          ? nearConsensus.statement.slice(0, 80) + '…'
          : nearConsensus.statement,
        href: `/topic/${nearConsensus.id}`,
        accentColor: isFor ? 'blue' : 'red',
        dismissKey: `lm_alert_consensus_${nearConsensus.id}`,
      } satisfies FeedAlert,
    })
  }

  return NextResponse.json({ alert: null })
}
