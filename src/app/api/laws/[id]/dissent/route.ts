import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Raw DB row shapes (for untyped tables) ───────────────────────────────────

interface RawArgRow {
  id: string
  content: string
  upvotes: number | null
  created_at: string
  author_id: string | null
}

interface RawVetoRow {
  id: string
  title: string
  grounds: string
  grounds_type: string
  status: string
  signature_count: number | null
  target_signatures: number | null
  closes_at: string
  created_at: string
  challenger_id: string | null
}

interface RawAmendmentRow {
  id: string
  title: string
  body: string
  status: string
  for_count: number | null
  against_count: number | null
  created_at: string
  proposer_id: string | null
}

interface RawDissenterRow {
  user_id: string
  created_at: string
  reason: string | null
}

interface RawProfileRow {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number | null
  reputation_score: number | null
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DissentArgument {
  id: string
  content: string
  upvotes: number
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface DissentVeto {
  id: string
  title: string
  grounds: string
  grounds_type: string
  status: 'open' | 'succeeded' | 'failed' | 'withdrawn'
  signature_count: number
  target_signatures: number
  pct_complete: number
  closes_at: string
  created_at: string
  challenger: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

export interface DissentAmendment {
  id: string
  title: string
  body: string
  status: 'pending' | 'ratified' | 'rejected'
  for_count: number
  against_count: number
  created_at: string
  proposer: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

export interface DissentVoter {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  voted_at: string
  reason: string | null
}

export interface LawDissentData {
  law: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string
    topic_id: string
  }
  stats: {
    against_pct: number
    against_votes: number
    for_votes: number
    veto_count: number
    amendment_count: number
    top_veto_pct: number
  }
  topArguments: DissentArgument[]
  vetoes: DissentVeto[]
  amendments: DissentAmendment[]
  topDissenters: DissentVoter[]
}

// ─── GET /api/laws/[id]/dissent ───────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // 1. Fetch law basics
  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
    .eq('id', id)
    .maybeSingle()

  if (!law) return NextResponse.json({ error: 'Law not found' }, { status: 404 })

  const topicId = law.topic_id

  // 2. Parallel fetch: arguments, vetoes, amendments
  const [argsResult, vetoesResult, amendmentsResult, dissentersResult] =
    await Promise.all([
      // Top AGAINST arguments from original topic debate
      supabase
        .from('arguments')
        .select('id, content, upvotes, created_at, author_id')
        .eq('topic_id', topicId)
        .eq('side', 'red')
        .order('upvotes', { ascending: false })
        .limit(6),

      // Civic veto challenges on this law
      supabase
        .from('civic_vetoes')
        .select(
          'id, title, grounds, grounds_type, status, signature_count, target_signatures, closes_at, created_at, challenger_id'
        )
        .eq('law_id', id)
        .order('created_at', { ascending: false })
        .limit(5),

      // Amendment proposals (dissent via change requests)
      supabase
        .from('law_amendments')
        .select(
          'id, title, body, status, for_count, against_count, created_at, proposer_id'
        )
        .eq('law_id', id)
        .order('created_at', { ascending: false })
        .limit(6),

      // Top AGAINST voters with high clout/reputation
      supabase
        .from('votes')
        .select('user_id, created_at, reason')
        .eq('topic_id', topicId)
        .eq('side', 'red')
        .order('created_at', { ascending: false })
        .limit(30),
    ])

  const rawArgs = (argsResult.data ?? []) as RawArgRow[]
  const rawVetoes = (vetoesResult.data ?? []) as RawVetoRow[]
  const rawAmendments = (amendmentsResult.data ?? []) as RawAmendmentRow[]
  const rawDissenters = (dissentersResult.data ?? []) as RawDissenterRow[]

  // 3. Batch-fetch profiles for arguments
  const argAuthorIds = rawArgs.map((a) => a.author_id).filter(Boolean) as string[]
  const vetoerIds = rawVetoes.map((v) => v.challenger_id).filter(Boolean) as string[]
  const amendProposerIds = rawAmendments.map((a) => a.proposer_id).filter(Boolean) as string[]
  const dissenterUserIds = rawDissenters.map((d) => d.user_id).filter(Boolean) as string[]

  const allProfileIds = [
    ...new Set([...argAuthorIds, ...vetoerIds, ...amendProposerIds, ...dissenterUserIds]),
  ]

  const profileMap: Record<string, RawProfileRow> = {}
  if (allProfileIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score')
      .in('id', allProfileIds.slice(0, 100))
    if (profiles) {
      for (const p of profiles as RawProfileRow[]) {
        profileMap[p.id] = p
      }
    }
  }

  // 4. Shape response

  const topArguments: DissentArgument[] = rawArgs.map((a) => ({
    id: a.id,
    content: a.content,
    upvotes: a.upvotes ?? 0,
    created_at: a.created_at,
    author: profileMap[a.author_id]
      ? {
          id: a.author_id,
          username: profileMap[a.author_id].username,
          display_name: profileMap[a.author_id].display_name,
          avatar_url: profileMap[a.author_id].avatar_url,
          role: profileMap[a.author_id].role,
        }
      : null,
  }))

  const vetoes: DissentVeto[] = rawVetoes.map((v) => ({
    id: v.id,
    title: v.title,
    grounds: v.grounds,
    grounds_type: v.grounds_type,
    status: v.status,
    signature_count: v.signature_count ?? 0,
    target_signatures: v.target_signatures ?? 50,
    pct_complete: Math.min(
      100,
      Math.round(((v.signature_count ?? 0) / Math.max(1, v.target_signatures ?? 50)) * 100)
    ),
    closes_at: v.closes_at,
    created_at: v.created_at,
    challenger: profileMap[v.challenger_id]
      ? {
          id: v.challenger_id,
          username: profileMap[v.challenger_id].username,
          display_name: profileMap[v.challenger_id].display_name,
          avatar_url: profileMap[v.challenger_id].avatar_url,
        }
      : null,
  }))

  const amendments: DissentAmendment[] = rawAmendments.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    status: a.status,
    for_count: a.for_count ?? 0,
    against_count: a.against_count ?? 0,
    created_at: a.created_at,
    proposer: profileMap[a.proposer_id]
      ? {
          id: a.proposer_id,
          username: profileMap[a.proposer_id].username,
          display_name: profileMap[a.proposer_id].display_name,
          avatar_url: profileMap[a.proposer_id].avatar_url,
        }
      : null,
  }))

  // Top dissenters: unique users, joined with profile, sorted by clout desc
  const seenIds = new Set<string>()
  const topDissenters: DissentVoter[] = []
  for (const d of rawDissenters) {
    if (seenIds.has(d.user_id)) continue
    seenIds.add(d.user_id)
    const p = profileMap[d.user_id]
    if (!p) continue
    topDissenters.push({
      id: d.user_id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      role: p.role,
      clout: p.clout ?? 0,
      voted_at: d.created_at,
      reason: d.reason ?? null,
    })
    if (topDissenters.length >= 8) break
  }

  // Sort top dissenters by clout
  topDissenters.sort((a, b) => b.clout - a.clout)

  const againstPct = Math.round(100 - (law.blue_pct ?? 50))
  const againstVotes = Math.round((law.total_votes ?? 0) * (againstPct / 100))
  const forVotes = (law.total_votes ?? 0) - againstVotes
  const topVetoPct = vetoes.length > 0 ? Math.max(...vetoes.map((v) => v.pct_complete)) : 0

  const response: LawDissentData = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      blue_pct: law.blue_pct,
      total_votes: law.total_votes,
      established_at: law.established_at,
      topic_id: law.topic_id,
    },
    stats: {
      against_pct: againstPct,
      against_votes: againstVotes,
      for_votes: forVotes,
      veto_count: vetoes.length,
      amendment_count: amendments.length,
      top_veto_pct: topVetoPct,
    },
    topArguments,
    vetoes,
    amendments,
    topDissenters,
  }

  return NextResponse.json(response)
}
