import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 1800 // revalidate every 30 min

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PromptArchiveEntry {
  topic_id: string
  statement: string
  category: string | null
  status: string
  scope: string
  blue_pct: number
  total_votes: number
  description: string | null
  prompt_date: string   // YYYY-MM-DD — earliest date this topic was the prompt
  user_vote: 'blue' | 'red' | null
}

export interface PromptArchiveResponse {
  entries: PromptArchiveEntry[]
  today: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDailyTopicIndex(topicIds: string[], date: string): number {
  let hash = 0
  const str = date + topicIds.join('')
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff
  }
  return Math.abs(hash) % topicIds.length
}

function dateKey(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const today = dateKey(0)
  const DAYS = 60 // look back 60 days so we get at least 30 unique prompts

  // ── 1. Fetch candidate topics (same pool as daily-prompt) ─────────────────
  const { data: candidateRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes, description')
    .in('status', ['active', 'voting', 'law', 'failed']) // include concluded topics
    .gte('total_votes', 5)
    .order('feed_score', { ascending: false })
    .limit(200)

  const candidates = (candidateRows ?? []) as {
    id: string
    statement: string
    category: string | null
    status: string
    scope: string
    blue_pct: number
    total_votes: number
    description: string | null
  }[]

  if (candidates.length === 0) {
    return NextResponse.json({ entries: [], today } satisfies PromptArchiveResponse)
  }

  // Use only the topics that would qualify as the daily prompt
  // (relaxed range so historical prompts still appear even if they changed status)
  const qualified = candidates.filter(
    (t) => t.blue_pct >= 10 && t.blue_pct <= 90
  )

  if (qualified.length === 0) {
    return NextResponse.json({ entries: [], today } satisfies PromptArchiveResponse)
  }

  const ids = qualified.map((t) => t.id)

  // ── 2. Reconstruct which topic was the prompt for each past day ───────────
  // Collect unique topic selections, remembering the earliest date each appeared
  const seenTopicIds = new Set<string>()
  const entries: Array<{ topicId: string; promptDate: string }> = []

  for (let daysAgo = 0; daysAgo < DAYS; daysAgo++) {
    const date = dateKey(daysAgo)
    const idx = getDailyTopicIndex(ids, date)
    const topicId = ids[idx]

    if (!seenTopicIds.has(topicId)) {
      seenTopicIds.add(topicId)
      entries.push({ topicId, promptDate: date })
    }

    // Stop once we have 30 unique prompts
    if (entries.length >= 30) break
  }

  if (entries.length === 0) {
    return NextResponse.json({ entries: [], today } satisfies PromptArchiveResponse)
  }

  // ── 3. Fetch current user's votes on these topics ─────────────────────────
  const archiveTopicIds = entries.map((e) => e.topicId)
  const userVoteMap: Record<string, 'blue' | 'red'> = {}

  if (user && archiveTopicIds.length > 0) {
    const { data: myVotes } = await supabase
      .from('votes')
      .select('topic_id, side')
      .eq('user_id', user.id)
      .in('topic_id', archiveTopicIds)

    for (const v of myVotes ?? []) {
      userVoteMap[v.topic_id] = v.side as 'blue' | 'red'
    }
  }

  // ── 4. Build response ─────────────────────────────────────────────────────
  const topicMap = new Map(qualified.map((t) => [t.id, t]))

  const result: PromptArchiveEntry[] = entries
    .map(({ topicId, promptDate }) => {
      const t = topicMap.get(topicId)
      if (!t) return null
      return {
        topic_id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        scope: t.scope,
        blue_pct: t.blue_pct,
        total_votes: t.total_votes,
        description: t.description,
        prompt_date: promptDate,
        user_vote: userVoteMap[t.id] ?? null,
      } satisfies PromptArchiveEntry
    })
    .filter(Boolean) as PromptArchiveEntry[]

  return NextResponse.json({ entries: result, today } satisfies PromptArchiveResponse)
}
