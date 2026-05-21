import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityEventType = 'vote' | 'argument' | 'upvote' | 'support' | 'status'

export interface ActivityVote {
  type: 'vote'
  id: string
  side: 'blue' | 'red'
  reason: string | null
  created_at: string
  actor: ActivityActor | null
}

export interface ActivityArgument {
  type: 'argument'
  id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  created_at: string
  actor: ActivityActor | null
}

export interface ActivityUpvote {
  type: 'upvote'
  id: string
  argument_id: string
  argument_content: string
  argument_side: 'blue' | 'red'
  created_at: string
  actor: ActivityActor | null
}

export interface ActivitySupport {
  type: 'support'
  id: string
  created_at: string
  actor: ActivityActor | null
}

export interface ActivityActor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export type ActivityEvent =
  | ActivityVote
  | ActivityArgument
  | ActivityUpvote
  | ActivitySupport

export interface ActivityResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  events: ActivityEvent[]
  has_more: boolean
}

// ─── GET /api/topics/[id]/activity ───────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') ?? 'all' // all | votes | arguments | upvotes | support
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)

  // ── Verify topic exists ────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const events: ActivityEvent[] = []

  // ── Fetch recent votes ─────────────────────────────────────────────────────
  if (filter === 'all' || filter === 'votes') {
    const { data: voteRows } = await supabase
      .from('votes')
      .select('id, user_id, side, reason, created_at')
      .eq('topic_id', params.id)
      .order('created_at', { ascending: false })
      .limit(filter === 'votes' ? limit : 30)

    if (voteRows && voteRows.length > 0) {
      const userIds = Array.from(new Set(voteRows.map((v) => v.user_id)))
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', userIds)

      const profileMap = new Map<string, ActivityActor>()
      for (const p of profiles ?? []) {
        profileMap.set(p.id, p as ActivityActor)
      }

      for (const v of voteRows) {
        events.push({
          type: 'vote',
          id: v.id,
          side: v.side as 'blue' | 'red',
          reason: v.reason ?? null,
          created_at: v.created_at,
          actor: profileMap.get(v.user_id) ?? null,
        })
      }
    }
  }

  // ── Fetch recent arguments ─────────────────────────────────────────────────
  if (filter === 'all' || filter === 'arguments') {
    const { data: argRows } = await supabase
      .from('topic_arguments')
      .select('id, user_id, side, content, upvotes, created_at')
      .eq('topic_id', params.id)
      .order('created_at', { ascending: false })
      .limit(filter === 'arguments' ? limit : 20)

    if (argRows && argRows.length > 0) {
      const userIds = Array.from(new Set(argRows.map((a) => a.user_id)))
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', userIds)

      const profileMap = new Map<string, ActivityActor>()
      for (const p of profiles ?? []) {
        profileMap.set(p.id, p as ActivityActor)
      }

      for (const a of argRows) {
        events.push({
          type: 'argument',
          id: a.id,
          side: a.side as 'blue' | 'red',
          content: a.content,
          upvotes: a.upvotes ?? 0,
          created_at: a.created_at,
          actor: profileMap.get(a.user_id) ?? null,
        })
      }
    }
  }

  // ── Fetch recent upvotes ───────────────────────────────────────────────────
  if (filter === 'all' || filter === 'upvotes') {
    const { data: upvoteRows } = await supabase
      .from('topic_argument_votes')
      .select('id, user_id, argument_id, created_at')
      .order('created_at', { ascending: false })
      .limit(filter === 'upvotes' ? limit : 20)

    if (upvoteRows && upvoteRows.length > 0) {
      const argIds = Array.from(new Set(upvoteRows.map((u) => u.argument_id)))
      const userIds = Array.from(new Set(upvoteRows.map((u) => u.user_id)))

      const [{ data: argData }, { data: profiles }] = await Promise.all([
        supabase
          .from('topic_arguments')
          .select('id, content, side, topic_id')
          .in('id', argIds)
          .eq('topic_id', params.id),
        supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .in('id', userIds),
      ])

      const argMap = new Map<string, { content: string; side: string; topic_id: string }>()
      for (const a of argData ?? []) {
        argMap.set(a.id, { content: a.content, side: a.side, topic_id: a.topic_id })
      }

      const profileMap = new Map<string, ActivityActor>()
      for (const p of profiles ?? []) {
        profileMap.set(p.id, p as ActivityActor)
      }

      for (const u of upvoteRows) {
        const arg = argMap.get(u.argument_id)
        if (!arg) continue
        events.push({
          type: 'upvote',
          id: u.id,
          argument_id: u.argument_id,
          argument_content: arg.content,
          argument_side: arg.side as 'blue' | 'red',
          created_at: u.created_at,
          actor: profileMap.get(u.user_id) ?? null,
        })
      }
    }
  }

  // ── Fetch topic supports ───────────────────────────────────────────────────
  if ((filter === 'all' || filter === 'support') && topic.status === 'proposed') {
    const { data: supportRows } = await supabase
      .from('topic_supports')
      .select('id, user_id, created_at')
      .eq('topic_id', params.id)
      .order('created_at', { ascending: false })
      .limit(filter === 'support' ? limit : 15)

    if (supportRows && supportRows.length > 0) {
      const userIds = Array.from(new Set(supportRows.map((s) => s.user_id)))
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', userIds)

      const profileMap = new Map<string, ActivityActor>()
      for (const p of profiles ?? []) {
        profileMap.set(p.id, p as ActivityActor)
      }

      for (const s of supportRows) {
        events.push({
          type: 'support',
          id: s.id,
          created_at: s.created_at,
          actor: profileMap.get(s.user_id) ?? null,
        })
      }
    }
  }

  // ── Sort all events by created_at desc ─────────────────────────────────────
  events.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const trimmed = events.slice(0, limit)

  return NextResponse.json({
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct,
      total_votes: topic.total_votes,
    },
    events: trimmed,
    has_more: events.length > limit,
  } satisfies ActivityResponse)
}
