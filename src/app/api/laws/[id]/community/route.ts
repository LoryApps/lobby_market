import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommunityAmendment {
  id: string
  title: string
  body: string
  status: 'pending' | 'ratified' | 'rejected'
  for_count: number
  against_count: number
  created_at: string
  expires_at: string
  user_vote: boolean | null
  proposer: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface CommunityNote {
  id: string
  content: string
  aspect: string
  upvotes: number
  has_upvoted: boolean
  created_at: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface RelatedTopic {
  id: string
  statement: string
  status: string
  blue_pct: number
  total_votes: number
  category: string | null
}

export interface LawCommunityData {
  law: {
    id: string
    topic_id: string
    statement: string
    category: string | null
    scope: string | null
    established_at: string
    total_votes: number
    blue_pct: number
    body_markdown: string | null
  }
  amendments: {
    total: number
    pending: number
    ratified: number
    rejected: number
    recent: CommunityAmendment[]
  }
  notes: {
    total: number
    has_blueprint: boolean
    by_aspect: Record<string, number>
    top_notes: CommunityNote[]
  }
  related: RelatedTopic[]
  community_score: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeScore(
  bluePct: number,
  pendingAmendments: number,
  ratifiedAmendments: number,
  noteCount: number
): number {
  let score = 50
  // Strong original consensus adds to health
  if (bluePct >= 75) score += 20
  else if (bluePct >= 65) score += 10
  else if (bluePct >= 55) score += 5
  // Pending amendments signal community wants changes
  score -= Math.min(pendingAmendments * 8, 30)
  // Ratified amendments show democratic improvement
  score += Math.min(ratifiedAmendments * 5, 15)
  // Community notes show ongoing engagement
  score += Math.min(noteCount * 2, 15)
  return Math.max(10, Math.min(100, Math.round(score)))
}

// ─── GET /api/laws/[id]/community ────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const lawId = params.id

  // ── Fetch law ─────────────────────────────────────────────────────────────
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select('id, topic_id, body_markdown, established_at')
    .eq('id', lawId)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // ── Fetch topic ───────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, scope, total_votes, blue_pct')
    .eq('id', law.topic_id)
    .maybeSingle()

  // ── Parallel fetches ──────────────────────────────────────────────────────
  const [amendmentsRes, notesRes, userAmendVotesRes, userNoteUpvotesRes, blueprintRes, relatedRes] = await Promise.all([
    // All amendments for this law
    supabase
      .from('law_amendments')
      .select('id, title, body, status, for_count, against_count, created_at, expires_at, proposer_id')
      .eq('law_id', lawId)
      .order('created_at', { ascending: false })
      .limit(20),

    // Blueprint notes
    supabase
      .from('blueprint_notes')
      .select(`
        id, user_id, content, aspect, upvotes, created_at,
        profiles:user_id ( username, display_name, avatar_url, role )
      `)
      .eq('law_id', lawId)
      .order('upvotes', { ascending: false })
      .limit(5),

    // Current user's amendment votes (if logged in)
    user
      ? supabase
          .from('law_amendment_votes')
          .select('amendment_id, vote')
          .eq('user_id', user.id)
      : Promise.resolve({ data: [] }),

    // Current user's note upvotes
    user
      ? supabase
          .from('blueprint_note_upvotes')
          .select('note_id')
          .eq('user_id', user.id)
      : Promise.resolve({ data: [] }),

    // Check if blueprint exists
    supabase
      .from('law_blueprints')
      .select('id')
      .eq('law_id', lawId)
      .maybeSingle(),

    // Related active topics in same category
    topic?.category
      ? supabase
          .from('topics')
          .select('id, statement, status, blue_pct, total_votes, category')
          .eq('category', topic.category)
          .in('status', ['active', 'voting'])
          .neq('id', law.topic_id)
          .order('total_votes', { ascending: false })
          .limit(4)
      : Promise.resolve({ data: [] }),
  ])

  // ── Hydrate amendment proposers ───────────────────────────────────────────
  const rawAmendments = amendmentsRes.data ?? []
  const proposerIds = [...new Set(rawAmendments.map((a) => a.proposer_id).filter(Boolean))]
  const proposerMap: Record<string, { username: string; display_name: string | null; avatar_url: string | null; role: string }> = {}

  if (proposerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', proposerIds)
    for (const p of profiles ?? []) proposerMap[p.id] = p
  }

  // ── Build vote maps ───────────────────────────────────────────────────────
  const userAmendVoteMap: Record<string, boolean> = {}
  for (const v of userAmendVotesRes.data ?? []) {
    userAmendVoteMap[(v as { amendment_id: string; vote: boolean }).amendment_id] = (v as { amendment_id: string; vote: boolean }).vote
  }
  const userUpvotedNotes = new Set((userNoteUpvotesRes.data ?? []).map((r) => (r as { note_id: string }).note_id))

  // ── Shape amendments ──────────────────────────────────────────────────────
  const amendments: CommunityAmendment[] = rawAmendments.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    status: a.status as CommunityAmendment['status'],
    for_count: a.for_count,
    against_count: a.against_count,
    created_at: a.created_at,
    expires_at: a.expires_at,
    user_vote: userAmendVoteMap[a.id] !== undefined ? userAmendVoteMap[a.id] : null,
    proposer: proposerMap[a.proposer_id] ?? null,
  }))

  const pending = amendments.filter((a) => a.status === 'pending').length
  const ratified = amendments.filter((a) => a.status === 'ratified').length
  const rejected = amendments.filter((a) => a.status === 'rejected').length

  // ── Shape notes ───────────────────────────────────────────────────────────
  const rawNotes = notesRes.data ?? []
  const byAspect: Record<string, number> = {}
  const topNotes: CommunityNote[] = rawNotes.slice(0, 3).map((n) => {
    byAspect[n.aspect] = (byAspect[n.aspect] ?? 0) + 1
    const p = Array.isArray(n.profiles) ? n.profiles[0] : n.profiles
    return {
      id: n.id,
      content: n.content,
      aspect: n.aspect,
      upvotes: n.upvotes,
      has_upvoted: userUpvotedNotes.has(n.id),
      created_at: n.created_at,
      author: p ?? null,
    }
  })

  // Remaining notes just counted for by_aspect
  for (const n of rawNotes.slice(3)) {
    byAspect[n.aspect] = (byAspect[n.aspect] ?? 0) + 1
  }

  // ── Note total via count query ────────────────────────────────────────────
  const { count: noteTotal } = await supabase
    .from('blueprint_notes')
    .select('id', { count: 'exact', head: true })
    .eq('law_id', lawId)

  const communityScore = computeScore(
    topic?.blue_pct ?? 50,
    pending,
    ratified,
    noteTotal ?? 0
  )

  return NextResponse.json({
    law: {
      id: law.id,
      topic_id: law.topic_id,
      statement: topic?.statement ?? '',
      category: topic?.category ?? null,
      scope: topic?.scope ?? null,
      established_at: law.established_at,
      total_votes: topic?.total_votes ?? 0,
      blue_pct: topic?.blue_pct ?? 50,
      body_markdown: law.body_markdown ?? null,
    },
    amendments: {
      total: amendments.length,
      pending,
      ratified,
      rejected,
      recent: amendments.slice(0, 5),
    },
    notes: {
      total: noteTotal ?? 0,
      has_blueprint: !!blueprintRes.data,
      by_aspect: byAspect,
      top_notes: topNotes,
    },
    related: (relatedRes.data ?? []) as RelatedTopic[],
    community_score: communityScore,
  } satisfies LawCommunityData)
}
