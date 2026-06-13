import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeeklySummitTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  feed_score: number
  voting_ends_at: string | null
  created_at: string
  pick_reason: 'week_top' | 'contested' | 'near_law' | 'viral' | 'diverse' | 'new_law'
  voted: boolean
  vote_side: 'blue' | 'red' | null
}

export interface WeeklySummitResponse {
  /** ISO week key: YYYY-Www */
  week: string
  topics: WeeklySummitTopic[]
  is_authenticated: boolean
  voted_count: number
  is_complete: boolean
  clout_bonus: number
  week_start: string   // Monday YYYY-MM-DD
  week_end: string     // Sunday YYYY-MM-DD
}

// ─── Week helpers ─────────────────────────────────────────────────────────────

function isoWeekKey(d: Date): string {
  // ISO 8601 week — Monday-based
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function weekBounds(d: Date): { start: Date; end: Date } {
  const day = d.getUTCDay() || 7 // 1=Mon … 7=Sun
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - (day - 1)))
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return { start: monday, end: sunday }
}

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

const SUMMIT_SIZE = 10
const CLOUT_BONUS = 75

// ─── GET /api/session/weekly ──────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now = new Date()
  const week = isoWeekKey(now)
  const { start, end } = weekBounds(now)
  const weekStart = start.toISOString().slice(0, 10)
  const weekEnd = end.toISOString().slice(0, 10)

  // ── 1. Top-engagement topics (week's most voted active/voting) ────────────

  const { data: topVoted } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, feed_score, voting_ends_at, created_at')
    .in('status', ['active', 'voting'])
    .gte('total_votes', 5)
    .order('total_votes', { ascending: false })
    .limit(60)

  // ── 2. Most contested (closest to 50/50 with enough votes) ───────────────

  const { data: allContested } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, feed_score, voting_ends_at, created_at')
    .in('status', ['active', 'voting'])
    .gte('total_votes', 20)
    .gte('blue_pct', 35)
    .lte('blue_pct', 65)
    .order('total_votes', { ascending: false })
    .limit(30)

  // ── 3. Near-law topics (active with support close to threshold) ───────────

  const { data: nearLaw } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, feed_score, voting_ends_at, created_at, support_count, activation_threshold')
    .in('status', ['active', 'voting'])
    .gte('total_votes', 10)
    .gte('blue_pct', 60)
    .order('blue_pct', { ascending: false })
    .limit(20)

  // ── 4. Newest laws this week ──────────────────────────────────────────────

  const { data: recentLaws } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, feed_score, voting_ends_at, created_at')
    .eq('status', 'law')
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: false })
    .limit(10)

  // ── 5. High feed_score topics (viral) ────────────────────────────────────

  const { data: viral } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, feed_score, voting_ends_at, created_at')
    .in('status', ['active', 'voting'])
    .gte('feed_score', 0.6)
    .order('feed_score', { ascending: false })
    .limit(30)

  // ── 6. Tag every candidate with its pick_reason ───────────────────────────

  type Candidate = {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    feed_score: number
    voting_ends_at: string | null
    created_at: string
    pick_reason: WeeklySummitTopic['pick_reason']
  }

  const candidates: Map<string, Candidate> = new Map()

  for (const t of topVoted ?? []) {
    if (!candidates.has(t.id)) candidates.set(t.id, { ...t, pick_reason: 'week_top' })
  }
  for (const t of allContested ?? []) {
    if (!candidates.has(t.id)) candidates.set(t.id, { ...t, pick_reason: 'contested' })
  }
  for (const t of nearLaw ?? []) {
    if (!candidates.has(t.id)) candidates.set(t.id, { ...t, pick_reason: 'near_law' })
  }
  for (const t of recentLaws ?? []) {
    if (!candidates.has(t.id)) candidates.set(t.id, { ...t, pick_reason: 'new_law' })
  }
  for (const t of viral ?? []) {
    if (!candidates.has(t.id)) candidates.set(t.id, { ...t, pick_reason: 'viral' })
  }

  const pool = Array.from(candidates.values())

  if (pool.length === 0) {
    return NextResponse.json({
      week,
      topics: [],
      is_authenticated: !!user,
      voted_count: 0,
      is_complete: false,
      clout_bonus: CLOUT_BONUS,
      week_start: weekStart,
      week_end: weekEnd,
    } satisfies WeeklySummitResponse)
  }

  // ── 7. Select 10 balanced topics ──────────────────────────────────────────

  // Bucket by pick_reason priority; shuffle within buckets for determinism
  const byReason: Record<WeeklySummitTopic['pick_reason'], Candidate[]> = {
    week_top: [],
    contested: [],
    near_law: [],
    viral: [],
    diverse: [],
    new_law: [],
  }
  for (const c of pool) byReason[c.pick_reason].push(c)
  for (const key of Object.keys(byReason) as Array<keyof typeof byReason>) {
    byReason[key] = seededShuffle(byReason[key], week + key)
  }

  const selected: Candidate[] = []
  const catCount: Record<string, number> = {}
  const reasonTarget: Record<WeeklySummitTopic['pick_reason'], number> = {
    week_top: 3,
    contested: 2,
    near_law: 2,
    viral: 1,
    new_law: 1,
    diverse: 1,
  }

  // First pass: fill by reason targets, cap 2 per category
  for (const [reason, target] of Object.entries(reasonTarget) as Array<[WeeklySummitTopic['pick_reason'], number]>) {
    let filled = 0
    for (const c of byReason[reason]) {
      if (filled >= target) break
      if (selected.length >= SUMMIT_SIZE) break
      const cat = c.category ?? 'Other'
      if ((catCount[cat] ?? 0) >= 2) continue
      selected.push(c)
      catCount[cat] = (catCount[cat] ?? 0) + 1
      filled++
    }
  }

  // Second pass: fill remaining with whatever is left
  if (selected.length < SUMMIT_SIZE) {
    const selected_ids = new Set(selected.map((s) => s.id))
    const remaining = seededShuffle(pool.filter((c) => !selected_ids.has(c.id)), week)
    for (const c of remaining) {
      if (selected.length >= SUMMIT_SIZE) break
      const cat = c.category ?? 'Other'
      if ((catCount[cat] ?? 0) >= 3) continue // relax cap to 3 if needed
      selected.push(c)
      catCount[cat] = (catCount[cat] ?? 0) + 1
    }
  }

  // ── 8. Check user's votes ─────────────────────────────────────────────────

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

  // ── 9. Build response ─────────────────────────────────────────────────────

  const summitTopics: WeeklySummitTopic[] = selected.map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category,
    status: t.status,
    blue_pct: t.blue_pct,
    total_votes: t.total_votes,
    feed_score: t.feed_score,
    voting_ends_at: t.voting_ends_at,
    created_at: t.created_at,
    pick_reason: t.pick_reason,
    voted: !!voteMap[t.id],
    vote_side: voteMap[t.id] ?? null,
  }))

  const voted_count = summitTopics.filter((t) => t.voted).length
  const is_complete = voted_count >= SUMMIT_SIZE

  return NextResponse.json({
    week,
    topics: summitTopics,
    is_authenticated: !!user,
    voted_count,
    is_complete,
    clout_bonus: CLOUT_BONUS,
    week_start: weekStart,
    week_end: weekEnd,
  } satisfies WeeklySummitResponse)
}
