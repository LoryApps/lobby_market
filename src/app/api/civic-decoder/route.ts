import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DecoderOption {
  id: string
  statement: string
}

export interface DecoderRound {
  /** Three argument snippets (FOR or AGAINST) from the answer topic */
  snippets: Array<{ text: string; side: 'blue' | 'red' }>
  /** Four topic statement options (1 correct + 3 decoys) */
  options: DecoderOption[]
  /** Index in options[] of the correct answer */
  answer_index: number
  /** Category of the answer topic — shown as a hint */
  category: string | null
}

export interface DecoderPayload {
  rounds: DecoderRound[]
  date: string
}

// ─── Deterministic helpers ────────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function deterministicShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr]
  let rng = seed
  for (let i = out.length - 1; i > 0; i--) {
    rng = (rng * 1664525 + 1013904223) >>> 0
    const j = rng % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Route handler ────────────────────────────────────────────────────────────────

const ROUNDS = 5
const SNIPPETS_PER_ROUND = 3
const OPTIONS = 4

export async function GET() {
  const supabase = await createClient()

  const dateStr = todayStr()
  const seed = hashStr(dateStr)

  // Step 1: Fetch candidate topics (active/voting/law, with category)
  const { data: candidateTopics, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, category, status')
    .in('status', ['active', 'voting', 'law'])
    .not('category', 'is', null)
    .order('total_votes', { ascending: false })
    .limit(150)

  if (topicErr || !candidateTopics?.length) {
    return NextResponse.json({ error: 'Not enough topics' }, { status: 503 })
  }

  // Step 2: Fetch arguments for these topics (top by upvotes)
  const topicIds = candidateTopics.map((t) => t.id)
  const { data: allArgs, error: argErr } = await supabase
    .from('topic_arguments')
    .select('id, topic_id, content, side, upvotes')
    .in('topic_id', topicIds)
    .order('upvotes', { ascending: false })
    .limit(2000)

  if (argErr || !allArgs) {
    return NextResponse.json({ error: 'Could not load arguments' }, { status: 503 })
  }

  // Step 3: Group arguments by topic
  const argsByTopic = new Map<string, typeof allArgs>()
  for (const arg of allArgs) {
    const list = argsByTopic.get(arg.topic_id) ?? []
    list.push(arg)
    argsByTopic.set(arg.topic_id, list)
  }

  // Step 4: Filter to topics that have enough arguments
  const eligible = candidateTopics.filter(
    (t) => (argsByTopic.get(t.id)?.length ?? 0) >= SNIPPETS_PER_ROUND
  )

  if (eligible.length < ROUNDS + (OPTIONS - 1)) {
    return NextResponse.json({ error: 'Not enough data yet' }, { status: 503 })
  }

  // Step 5: Deterministically select answer topics and decoy pool
  const shuffled = deterministicShuffle(eligible, seed)
  const answerTopics = shuffled.slice(0, ROUNDS)
  const decoyPool = shuffled.slice(ROUNDS)

  // Step 6: Build rounds
  const rounds: DecoderRound[] = answerTopics.map((topic, i) => {
    const topicArgs = argsByTopic.get(topic.id) ?? []

    // Pick SNIPPETS_PER_ROUND arguments deterministically
    const pickedArgs = deterministicShuffle(topicArgs, seed + i)
      .slice(0, SNIPPETS_PER_ROUND)

    const snippets: DecoderRound['snippets'] = pickedArgs.map((arg) => {
      // Truncate to avoid quoting long chunks — keep first 120 chars
      const raw = arg.content.trim()
      const text = raw.length > 120 ? raw.slice(0, 120).trimEnd() + '…' : raw
      return { text, side: arg.side as 'blue' | 'red' }
    })

    // Pick 3 decoys — prefer same category
    const sameCat = decoyPool.filter(
      (d) => d.category === topic.category && d.id !== topic.id
    )
    const decoySource = sameCat.length >= OPTIONS - 1 ? sameCat : decoyPool
    const decoys = deterministicShuffle(decoySource, seed + i + 1000)
      .slice(0, OPTIONS - 1)
      .map((d) => ({ id: d.id, statement: d.statement }))

    // Build options array (correct + decoys), then shuffle
    const rawOptions: DecoderOption[] = [
      { id: topic.id, statement: topic.statement },
      ...decoys,
    ]
    const options = deterministicShuffle(rawOptions, seed + i + 2000)
    const answer_index = options.findIndex((o) => o.id === topic.id)

    return {
      snippets,
      options,
      answer_index,
      category: topic.category,
    }
  })

  return NextResponse.json({ rounds, date: dateStr } satisfies DecoderPayload)
}
