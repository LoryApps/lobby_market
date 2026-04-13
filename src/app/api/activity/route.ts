import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActivityEventType =
  | 'topic_proposed'
  | 'topic_active'
  | 'topic_voting'
  | 'law_established'
  | 'debate_scheduled'
  | 'debate_live'

export interface ActivityEvent {
  id: string
  type: ActivityEventType
  timestamp: string
  statement: string
  category: string | null
  href: string
  extra: string | null
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // Look back 14 days
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

    // Parallel fetches
    const [topicsRes, lawsRes, debatesRes] = await Promise.all([
      supabase
        .from('topics')
        .select('id, statement, category, status, author_id, created_at, updated_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('laws')
        .select('id, statement, category, topic_id, established_at, total_votes')
        .gte('established_at', since)
        .order('established_at', { ascending: false })
        .limit(30),
      supabase
        .from('debates')
        .select('id, topic_id, status, scheduled_at, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    const topics = topicsRes.data ?? []
    const laws = lawsRes.data ?? []
    const rawDebates = debatesRes.data ?? []

    // ── Enrich topics with author profiles ──────────────────────────────────
    const authorIds = Array.from(new Set(topics.map((t) => t.author_id).filter(Boolean)))
    const { data: profileRows } = authorIds.length
      ? await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', authorIds)
      : { data: [] }

    const profileMap = new Map(
      (profileRows ?? []).map((p) => [p.id, p])
    )

    // ── Enrich debates with topic statements ────────────────────────────────
    const debateTopicIds = Array.from(
      new Set(rawDebates.map((d) => d.topic_id).filter(Boolean))
    )
    const { data: debateTopicRows } = debateTopicIds.length
      ? await supabase
          .from('topics')
          .select('id, statement, category')
          .in('id', debateTopicIds)
      : { data: [] }

    const debateTopicMap = new Map(
      (debateTopicRows ?? []).map((t) => [t.id, t])
    )

    // ── Build event list ────────────────────────────────────────────────────
    const events: ActivityEvent[] = []

    // New topics proposed
    for (const t of topics) {
      const author = profileMap.get(t.author_id) ?? null
      events.push({
        id: `topic-${t.id}`,
        type: 'topic_proposed',
        timestamp: t.created_at,
        statement: t.statement,
        category: t.category,
        href: `/topic/${t.id}`,
        extra: t.category ?? null,
        author: author
          ? {
              username: author.username,
              display_name: author.display_name,
              avatar_url: author.avatar_url,
            }
          : null,
      })

      // Topics that recently moved to active / voting — inferred from status
      // We use updated_at as the event time, but only if it differs from created_at
      // (i.e. it was actually transitioned, not just created in that state)
      const updatedLater =
        t.updated_at &&
        Math.abs(
          new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()
        ) > 60_000 // more than 1 minute difference

      if (updatedLater && t.status === 'active') {
        events.push({
          id: `topic-active-${t.id}`,
          type: 'topic_active',
          timestamp: t.updated_at,
          statement: t.statement,
          category: t.category,
          href: `/topic/${t.id}`,
          extra: null,
          author: null,
        })
      }

      if (updatedLater && t.status === 'voting') {
        events.push({
          id: `topic-voting-${t.id}`,
          type: 'topic_voting',
          timestamp: t.updated_at,
          statement: t.statement,
          category: t.category,
          href: `/topic/${t.id}`,
          extra: null,
          author: null,
        })
      }
    }

    // Laws established
    for (const l of laws) {
      events.push({
        id: `law-${l.id}`,
        type: 'law_established',
        timestamp: l.established_at,
        statement: l.statement,
        category: l.category,
        href: `/law/${l.id}`,
        extra:
          l.total_votes != null
            ? `${Number(l.total_votes).toLocaleString()} votes`
            : null,
        author: null,
      })
    }

    // Debates (scheduled or live)
    for (const d of rawDebates) {
      const topic = debateTopicMap.get(d.topic_id)
      if (!topic) continue

      const isLive = d.status === 'live'
      let extra: string | null = null
      if (isLive) {
        extra = 'Live now'
      } else if (d.scheduled_at) {
        const dt = new Date(d.scheduled_at)
        const now = Date.now()
        const diff = dt.getTime() - now
        if (diff > 0) {
          const h = Math.round(diff / 3_600_000)
          const d_ = Math.round(diff / 86_400_000)
          extra =
            h < 24
              ? `Starts in ${h}h`
              : `Starts in ${d_}d`
        } else {
          extra = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }
      }

      events.push({
        id: `debate-${d.id}`,
        type: isLive ? 'debate_live' : 'debate_scheduled',
        timestamp: d.created_at,
        statement: topic.statement,
        category: topic.category,
        href: `/debate/${d.id}`,
        extra,
        author: null,
      })
    }

    // ── Sort by timestamp desc, deduplicate by id ──────────────────────────
    events.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    // Keep only the 60 most recent events
    const trimmed = events.slice(0, 60)

    return NextResponse.json({ events: trimmed })
  } catch (err) {
    console.error('[/api/activity]', err)
    return NextResponse.json({ events: [] }, { status: 500 })
  }
}
