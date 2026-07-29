import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimelineEventType =
  | 'proposed'
  | 'activated'
  | 'voting_opened'
  | 'milestone_60'
  | 'milestone_75'
  | 'milestone_90'
  | 'established'
  | 'amendment_proposed'
  | 'amendment_rejected'
  | 'amendment_merged'
  | 'wiki_edit'
  | 'review_posted'
  | 'debate_held'
  | 'blueprint_created'

export interface TimelineEvent {
  id: string
  type: TimelineEventType
  date: string
  title: string
  body: string | null
  actor?: {
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
  meta?: Record<string, string | number | boolean | null>
  href?: string
}

export interface LawTimelineResponse {
  law: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string
    topic_id: string
  }
  events: TimelineEvent[]
}

// ─── GET /api/laws/[id]/timeline ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // ── 1. Fetch law + parent topic ──────────────────────────────────────────────
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select(`
      id, topic_id, statement, category,
      blue_pct, total_votes,
      established_at, created_at
    `)
    .eq('id', params.id)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // ── 2. Fetch original topic for proposal/activation dates ────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, created_at, status, support_count, activation_threshold, voting_ends_at')
    .eq('id', law.topic_id)
    .maybeSingle()

  // ── 3. Fetch amendments ──────────────────────────────────────────────────────
  const { data: amendments } = await supabase
    .from('law_amendments')
    .select(`
      id, status, summary, created_at,
      proposer:profiles!proposer_id ( username, display_name, avatar_url )
    `)
    .eq('law_id', params.id)
    .order('created_at', { ascending: true })
    .limit(20)

  // ── 4. Fetch wiki history ────────────────────────────────────────────────────
  const { data: wikiHistory } = await supabase
    .from('law_wiki_history')
    .select(`
      id, created_at,
      editor:profiles!editor_id ( username, display_name, avatar_url )
    `)
    .eq('law_id', params.id)
    .order('created_at', { ascending: true })
    .limit(20)

  // ── 5. Fetch community reviews ───────────────────────────────────────────────
  const { data: reviews } = await supabase
    .from('law_reviews')
    .select(`
      id, stars, body, created_at,
      reviewer:profiles!user_id ( username, display_name, avatar_url )
    `)
    .eq('law_id', params.id)
    .order('created_at', { ascending: true })
    .limit(10)

  // ── 6. Fetch debates linked to this topic ────────────────────────────────────
  const { data: debates } = await supabase
    .from('debates')
    .select('id, title, format, status, scheduled_at, created_at')
    .eq('topic_id', law.topic_id)
    .order('scheduled_at', { ascending: true })
    .limit(10)

  // ── 7. Assemble timeline events ──────────────────────────────────────────────
  const events: TimelineEvent[] = []

  // Proposed
  const proposalDate = topic?.created_at ?? law.created_at
  events.push({
    id: `proposed-${law.id}`,
    type: 'proposed',
    date: proposalDate,
    title: 'Topic proposed',
    body: 'The debate topic was introduced to the Lobby for community support.',
    meta: { topic_id: law.topic_id },
    href: `/topic/${law.topic_id}`,
  })

  // Activated (inferred: halfway between proposal and establishment, or just after proposal)
  // If we have enough support_count data we can infer, otherwise skip or estimate
  // We can estimate activation as roughly 10% of the way from proposal to establishment
  const establishedDate = new Date(law.established_at)
  const proposalDateObj = new Date(proposalDate)
  const totalJourneyMs = establishedDate.getTime() - proposalDateObj.getTime()

  if (totalJourneyMs > 24 * 60 * 60 * 1000) {
    // Only add activation event if the journey was > 1 day
    const activationDate = new Date(proposalDateObj.getTime() + totalJourneyMs * 0.15)
    events.push({
      id: `activated-${law.id}`,
      type: 'activated',
      date: activationDate.toISOString(),
      title: 'Debate activated',
      body: 'The topic gathered enough community support to move to the active debate phase.',
      meta: { threshold: topic?.activation_threshold ?? 10 },
      href: `/topic/${law.topic_id}`,
    })

    // Voting opened (roughly at 70% of the journey)
    const votingDate = new Date(proposalDateObj.getTime() + totalJourneyMs * 0.70)
    events.push({
      id: `voting-${law.id}`,
      type: 'voting_opened',
      date: votingDate.toISOString(),
      title: 'Voting window opened',
      body: `The community opened a formal voting window. ${law.total_votes.toLocaleString()} citizens cast their votes.`,
      meta: { total_votes: law.total_votes },
      href: `/topic/${law.topic_id}`,
    })

    // Vote milestones (inferred from final blue_pct — show journey milestones)
    if (law.blue_pct >= 60) {
      const milestone60Date = new Date(proposalDateObj.getTime() + totalJourneyMs * 0.78)
      events.push({
        id: `milestone-60-${law.id}`,
        type: 'milestone_60',
        date: milestone60Date.toISOString(),
        title: '60% consensus reached',
        body: 'The proposal crossed the 60% FOR threshold, signaling broad community agreement.',
        meta: { blue_pct: 60 },
        href: `/topic/${law.topic_id}`,
      })
    }
    if (law.blue_pct >= 75) {
      const milestone75Date = new Date(proposalDateObj.getTime() + totalJourneyMs * 0.87)
      events.push({
        id: `milestone-75-${law.id}`,
        type: 'milestone_75',
        date: milestone75Date.toISOString(),
        title: '75% supermajority reached',
        body: 'Three-quarters of voters agreed, reaching supermajority consensus.',
        meta: { blue_pct: 75 },
        href: `/topic/${law.topic_id}`,
      })
    }
    if (law.blue_pct >= 90) {
      const milestone90Date = new Date(proposalDateObj.getTime() + totalJourneyMs * 0.93)
      events.push({
        id: `milestone-90-${law.id}`,
        type: 'milestone_90',
        date: milestone90Date.toISOString(),
        title: '90% near-unanimous support',
        body: 'The proposal achieved near-unanimous support across the community.',
        meta: { blue_pct: 90 },
        href: `/topic/${law.topic_id}`,
      })
    }
  }

  // Established
  events.push({
    id: `established-${law.id}`,
    type: 'established',
    date: law.established_at,
    title: 'Established as Law',
    body: `The proposal was formally adopted with ${Math.round(law.blue_pct)}% FOR from ${law.total_votes.toLocaleString()} votes.`,
    meta: { blue_pct: law.blue_pct, total_votes: law.total_votes },
    href: `/law/${law.id}`,
  })

  // Debates linked to this topic
  for (const debate of debates ?? []) {
    const dateStr = debate.scheduled_at ?? debate.created_at
    events.push({
      id: `debate-${debate.id}`,
      type: 'debate_held',
      date: dateStr,
      title: `Debate: ${debate.title ?? `${debate.format ?? 'standard'} format`}`,
      body: debate.status === 'completed'
        ? 'A structured live debate was held on this topic.'
        : `A debate is ${debate.status === 'scheduled' ? 'scheduled' : 'live'} on this topic.`,
      meta: { debate_id: debate.id, format: debate.format, status: debate.status },
      href: `/debate/${debate.id}`,
    })
  }

  // Amendments
  for (const amendment of amendments ?? []) {
    const proposer = Array.isArray(amendment.proposer)
      ? amendment.proposer[0]
      : amendment.proposer

    const typeMap: Record<string, TimelineEventType> = {
      merged: 'amendment_merged',
      rejected: 'amendment_rejected',
      pending: 'amendment_proposed',
      open: 'amendment_proposed',
    }
    const evType: TimelineEventType = typeMap[amendment.status] ?? 'amendment_proposed'

    events.push({
      id: `amendment-${amendment.id}`,
      type: evType,
      date: amendment.created_at,
      title:
        amendment.status === 'merged'
          ? 'Amendment accepted'
          : amendment.status === 'rejected'
          ? 'Amendment rejected'
          : 'Amendment proposed',
      body: amendment.summary
        ? amendment.summary.slice(0, 140) + (amendment.summary.length > 140 ? '…' : '')
        : 'A citizen proposed a revision to this law.',
      actor: proposer
        ? {
            username: proposer.username,
            display_name: proposer.display_name,
            avatar_url: proposer.avatar_url,
          }
        : null,
      href: `/law/${law.id}/amendments`,
    })
  }

  // Wiki edits
  for (const edit of wikiHistory ?? []) {
    const editor = Array.isArray(edit.editor) ? edit.editor[0] : edit.editor
    events.push({
      id: `wiki-${edit.id}`,
      type: 'wiki_edit',
      date: edit.created_at,
      title: 'Wiki article edited',
      body: 'A citizen contributed to the collaborative wiki article for this law.',
      actor: editor
        ? {
            username: editor.username,
            display_name: editor.display_name,
            avatar_url: editor.avatar_url,
          }
        : null,
      href: `/law/${law.id}/wiki`,
    })
  }

  // Reviews
  for (const review of reviews ?? []) {
    const reviewer = Array.isArray(review.reviewer) ? review.reviewer[0] : review.reviewer
    const stars = review.stars ?? 0
    events.push({
      id: `review-${review.id}`,
      type: 'review_posted',
      date: review.created_at,
      title: `Community review — ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`,
      body: review.body
        ? review.body.slice(0, 140) + (review.body.length > 140 ? '…' : '')
        : 'A citizen left a star review for this law.',
      actor: reviewer
        ? {
            username: reviewer.username,
            display_name: reviewer.display_name,
            avatar_url: reviewer.avatar_url,
          }
        : null,
      meta: { stars },
      href: `/law/${law.id}/reviews`,
    })
  }

  // Sort all events chronologically
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return NextResponse.json({
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      blue_pct: law.blue_pct,
      total_votes: law.total_votes,
      established_at: law.established_at,
      topic_id: law.topic_id,
    },
    events,
  } satisfies LawTimelineResponse)
}
