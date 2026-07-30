import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PulseEventKind =
  | 'review'
  | 'chat'
  | 'wiki_edit'
  | 'challenge'
  | 'amendment'

export interface PulseEvent {
  id: string
  kind: PulseEventKind
  created_at: string
  body: string | null
  actor: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
  // kind-specific extras
  stars?: number          // review
  grounds?: string        // challenge
  status?: string         // challenge | amendment
  title?: string          // challenge | amendment
}

export interface LawPulseData {
  law: {
    id: string
    statement: string
    category: string | null
    is_active: boolean
    total_votes: number | null
    blue_pct: number | null
    established_at: string | null
  }
  events: PulseEvent[]
  engagement_score: number  // 0–100
  engagement_label: 'thriving' | 'active' | 'quiet' | 'dormant'
  review_avg: number | null
  review_count: number
  open_challenges: number
  pending_amendments: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function engagementLabel(score: number): LawPulseData['engagement_label'] {
  if (score >= 75) return 'thriving'
  if (score >= 40) return 'active'
  if (score >= 15) return 'quiet'
  return 'dormant'
}

// ─── GET /api/laws/[id]/pulse ─────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const supabase = await createClient()

  // ── Law info ──────────────────────────────────────────────────────────────
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select('id, statement, category, is_active, total_votes, blue_pct, established_at')
    .eq('id', id)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // ── Parallel data fetch ────────────────────────────────────────────────────
  const [
    reviewsRes,
    chatRes,
    wikiRes,
    challengesRes,
    amendmentsRes,
    statsRes,
  ] = await Promise.all([
    // Reviews
    supabase
      .from('law_reviews')
      .select('id, stars, body, created_at, user_id')
      .eq('law_id', id)
      .order('created_at', { ascending: false })
      .limit(8),

    // Chat messages
    supabase
      .from('law_chat_messages')
      .select('id, content, created_at, user_id')
      .eq('law_id', id)
      .order('created_at', { ascending: false })
      .limit(8),

    // Wiki edits
    supabase
      .from('law_wiki_history')
      .select('id, created_at, editor_id, char_delta')
      .eq('law_id', id)
      .order('created_at', { ascending: false })
      .limit(5),

    // Challenges
    supabase
      .from('law_challenges')
      .select('id, title, grounds, status, created_at, user_id')
      .eq('law_id', id)
      .order('created_at', { ascending: false })
      .limit(5),

    // Amendments
    supabase
      .from('law_amendments')
      .select('id, title, status, created_at, proposer_id')
      .eq('law_id', id)
      .order('created_at', { ascending: false })
      .limit(5),

    // Aggregate review stats
    supabase
      .from('law_reviews')
      .select('stars')
      .eq('law_id', id),
  ])

  // ── Collect all unique user IDs ───────────────────────────────────────────
  const userIds = new Set<string>()
  for (const r of reviewsRes.data ?? [])    if (r.user_id)     userIds.add(r.user_id)
  for (const c of chatRes.data ?? [])       if (c.user_id)     userIds.add(c.user_id)
  for (const w of wikiRes.data ?? [])       if (w.editor_id)   userIds.add(w.editor_id)
  for (const ch of challengesRes.data ?? []) if (ch.user_id)   userIds.add(ch.user_id)
  for (const a of amendmentsRes.data ?? []) if (a.proposer_id) userIds.add(a.proposer_id)

  // ── Fetch profiles ────────────────────────────────────────────────────────
  const profilesMap = new Map<string, {
    id: string; username: string; display_name: string | null; avatar_url: string | null
  }>()
  if (userIds.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', Array.from(userIds))
    for (const p of profiles ?? []) profilesMap.set(p.id, p)
  }

  const actor = (uid: string | null) => (uid ? (profilesMap.get(uid) ?? null) : null)

  // ── Build event list ──────────────────────────────────────────────────────
  const events: PulseEvent[] = []

  for (const r of reviewsRes.data ?? []) {
    events.push({
      id: `review-${r.id}`,
      kind: 'review',
      created_at: r.created_at,
      body: r.body ?? null,
      actor: actor(r.user_id),
      stars: r.stars,
    })
  }

  for (const c of chatRes.data ?? []) {
    events.push({
      id: `chat-${c.id}`,
      kind: 'chat',
      created_at: c.created_at,
      body: c.content,
      actor: actor(c.user_id),
    })
  }

  for (const w of wikiRes.data ?? []) {
    const delta: number = (w as { char_delta?: number }).char_delta ?? 0
    const sign = delta > 0 ? '+' : ''
    events.push({
      id: `wiki-${w.id}`,
      kind: 'wiki_edit',
      created_at: w.created_at,
      body: delta !== 0 ? `${sign}${delta} chars` : 'Wiki updated',
      actor: actor((w as { editor_id?: string | null }).editor_id ?? null),
    })
  }

  for (const ch of challengesRes.data ?? []) {
    events.push({
      id: `challenge-${ch.id}`,
      kind: 'challenge',
      created_at: ch.created_at,
      body: ch.title,
      actor: actor(ch.user_id),
      grounds: ch.grounds,
      status: ch.status,
      title: ch.title,
    })
  }

  for (const a of amendmentsRes.data ?? []) {
    events.push({
      id: `amendment-${a.id}`,
      kind: 'amendment',
      created_at: a.created_at,
      body: a.title,
      actor: actor(a.proposer_id),
      status: a.status,
      title: a.title,
    })
  }

  // Sort newest first
  events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // ── Engagement score ──────────────────────────────────────────────────────
  // Count events in the last 7 days, weight by type
  const cutoff7d = Date.now() - 7 * 24 * 60 * 60 * 1000
  const weights: Record<PulseEventKind, number> = {
    challenge:  5,
    amendment:  4,
    review:     3,
    wiki_edit:  3,
    chat:       1,
  }
  let rawScore = 0
  for (const e of events) {
    if (new Date(e.created_at).getTime() >= cutoff7d) {
      rawScore += weights[e.kind] ?? 1
    }
  }
  const engagement_score = Math.min(100, Math.round(rawScore * 5))

  // ── Review stats ──────────────────────────────────────────────────────────
  const allStars = (statsRes.data ?? []).map((r) => r.stars).filter(Boolean)
  const review_avg = allStars.length > 0
    ? Math.round((allStars.reduce((s, v) => s + v, 0) / allStars.length) * 10) / 10
    : null
  const review_count = allStars.length

  const open_challenges = (challengesRes.data ?? []).filter((c) => c.status === 'open').length
  const pending_amendments = (amendmentsRes.data ?? []).filter((a) => a.status === 'pending').length

  const payload: LawPulseData = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category ?? null,
      is_active: law.is_active ?? true,
      total_votes: law.total_votes ?? null,
      blue_pct: law.blue_pct ?? null,
      established_at: law.established_at ?? null,
    },
    events: events.slice(0, 30),
    engagement_score,
    engagement_label: engagementLabel(engagement_score),
    review_avg,
    review_count,
    open_challenges,
    pending_amendments,
  }

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
