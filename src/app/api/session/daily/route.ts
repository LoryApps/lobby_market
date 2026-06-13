import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  feed_score: number
  voting_ends_at: string | null
  created_at: string
  /** Reason this topic was picked for today's session */
  pick_reason: 'urgent' | 'close' | 'rising' | 'active' | 'new'
  /** Whether the current user has already voted on this topic */
  voted: boolean
  /** Which side the user voted (if voted) */
  vote_side: 'blue' | 'red' | null
}

export interface SessionResponse {
  date: string           // YYYY-MM-DD UTC
  topics: SessionTopic[]
  is_authenticated: boolean
  voted_count: number
  is_complete: boolean
  session_clout_bonus: number
}

// ─── Deterministic daily seed from date ──────────────────────────────────────

function dateKey(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC
}

// Seeded pseudo-random shuffle so all users get the same 5 topics on the same day
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  }
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) | 0
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) | 0
    h ^= h >>> 16
    const j = Math.abs(h) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const SESSION_SIZE = 5
const CLOUT_BONUS = 20

// ─── GET /api/session/daily ───────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today = dateKey()

  // ── 1. Fetch candidate topics ──────────────────────────────────────────────

  const { data: rawTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, feed_score, voting_ends_at, created_at')
    .in('status', ['active', 'voting'])
    .gte('total_votes', 3)
    .order('feed_score', { ascending: false })
    .limit(80)

  const topics = rawTopics ?? []

  if (topics.length === 0) {
    return NextResponse.json({
      date: today,
      topics: [],
      is_authenticated: !!user,
      voted_count: 0,
      is_complete: false,
      session_clout_bonus: CLOUT_BONUS,
    } satisfies SessionResponse)
  }

  // ── 2. Tag each topic with a pick_reason ──────────────────────────────────

  const now = Date.now()

  const tagged = topics.map((t) => {
    const expiresIn = t.voting_ends_at
      ? new Date(t.voting_ends_at).getTime() - now
      : Infinity
    const pct = t.blue_pct ?? 50
    const balance = Math.abs(50 - pct)

    let pick_reason: SessionTopic['pick_reason'] = 'active'

    if (expiresIn > 0 && expiresIn < 3 * 24 * 60 * 60 * 1000) {
      pick_reason = 'urgent'
    } else if (balance <= 8) {
      pick_reason = 'close'
    } else if ((now - new Date(t.created_at).getTime()) < 48 * 60 * 60 * 1000) {
      pick_reason = 'new'
    } else if (t.feed_score > 0.7) {
      pick_reason = 'rising'
    }

    return { ...t, pick_reason }
  })

  // ── 3. Select a balanced 5-topic session ─────────────────────────────────

  // Prefer diversity: at most 2 from same category, at least 1 urgent or close
  const buckets: Record<string, typeof tagged> = {}
  for (const t of tagged) {
    const cat = t.category ?? 'Other'
    if (!buckets[cat]) buckets[cat] = []
    buckets[cat].push(t)
  }

  // Shuffle within each bucket using today's seed for determinism
  const shuffled = Object.values(buckets).flatMap((b) =>
    seededShuffle(b, today + (b[0]?.category ?? ''))
  )

  // Pick greedily: track category counts
  const selected: typeof tagged = []
  const catCount: Record<string, number> = {}

  // First pass: one per pick_reason type we want to represent
  for (const reason of ['urgent', 'close', 'new', 'rising', 'active'] as const) {
    if (selected.length >= SESSION_SIZE) break
    const candidate = shuffled.find(
      (t) =>
        t.pick_reason === reason &&
        !selected.includes(t) &&
        (catCount[t.category ?? 'Other'] ?? 0) < 2
    )
    if (candidate) {
      selected.push(candidate)
      catCount[candidate.category ?? 'Other'] = (catCount[candidate.category ?? 'Other'] ?? 0) + 1
    }
  }

  // Second pass: fill remaining slots with highest-score topics
  const remaining = seededShuffle(
    shuffled.filter((t) => !selected.includes(t)),
    today
  )
  for (const t of remaining) {
    if (selected.length >= SESSION_SIZE) break
    if ((catCount[t.category ?? 'Other'] ?? 0) >= 2) continue
    selected.push(t)
    catCount[t.category ?? 'Other'] = (catCount[t.category ?? 'Other'] ?? 0) + 1
  }

  // ── 4. Check user's existing votes ────────────────────────────────────────

  const topicIds = selected.map((t) => t.id)
  const voteMap: Record<string, 'blue' | 'red'> = {}

  if (user && topicIds.length > 0) {
    const { data: votes } = await supabase
      .from('votes')
      .select('topic_id, side')
      .eq('user_id', user.id)
      .in('topic_id', topicIds)

    for (const v of votes ?? []) {
      voteMap[v.topic_id] = v.side as 'blue' | 'red'
    }
  }

  // ── 5. Build response ─────────────────────────────────────────────────────

  const sessionTopics: SessionTopic[] = selected.map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category,
    status: t.status,
    blue_pct: t.blue_pct,
    total_votes: t.total_votes,
    feed_score: t.feed_score,
    voting_ends_at: t.voting_ends_at,
    created_at: t.created_at,
    pick_reason: t.pick_reason as SessionTopic['pick_reason'],
    voted: !!voteMap[t.id],
    vote_side: voteMap[t.id] ?? null,
  }))

  const voted_count = sessionTopics.filter((t) => t.voted).length
  const is_complete = voted_count >= SESSION_SIZE

  return NextResponse.json({
    date: today,
    topics: sessionTopics,
    is_authenticated: !!user,
    voted_count,
    is_complete,
    session_clout_bonus: CLOUT_BONUS,
  } satisfies SessionResponse)
}
