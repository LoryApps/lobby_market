import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // Re-seed exercises every hour

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GymExercise {
  type: 'steelman' | 'rebuttal' | 'cold_case'
  title: string
  instruction: string
  challenge: string
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  /** For rebuttal: the argument to counter */
  target_argument?: {
    id: string
    content: string
    side: 'blue' | 'red'
    upvotes: number
    author_username: string
    author_display_name: string | null
  }
  /** Which side the user should argue (for gym purposes) */
  assigned_side: 'blue' | 'red'
  clout_reward: number
}

export interface GymResponse {
  exercises: GymExercise[]
  date: string
  seed: number
}

// ─── Seeded pseudo-random (deterministic per date) ────────────────────────────

function seededRand(seed: number, index: number): number {
  const x = Math.sin(seed + index) * 10000
  return x - Math.floor(x)
}

function pickByDate<T>(arr: T[], seed: number, offset: number): T {
  if (!arr.length) throw new Error('empty array')
  const idx = Math.floor(seededRand(seed, offset) * arr.length)
  return arr[idx]
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Date-based seed so exercises are the same all day
  const today = new Date()
  const seed =
    today.getUTCFullYear() * 10000 +
    (today.getUTCMonth() + 1) * 100 +
    today.getUTCDate()
  const dateStr = today.toISOString().slice(0, 10)

  // ── Fetch source data ────────────────────────────────────────────────────

  // Active topics for steelman & rebuttal (need real vote splits)
  const { data: activeTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('status', 'active')
    .gte('total_votes', 20)
    .order('total_votes', { ascending: false })
    .limit(100)

  // Failed topics for cold case
  const { data: failedTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('status', 'failed')
    .order('total_votes', { ascending: false })
    .limit(50)

  if (!activeTopics?.length) {
    return NextResponse.json({ error: 'Not enough topics for gym' }, { status: 503 })
  }

  // ── Exercise 1: Steelman ─────────────────────────────────────────────────
  // Pick a contested topic (close to 50/50) — forces the user to argue the harder side
  const contestedTopics = activeTopics
    .filter((t) => t.blue_pct >= 35 && t.blue_pct <= 65)

  const steelmanPool = contestedTopics.length >= 5 ? contestedTopics : activeTopics
  const steelmanTopic = pickByDate(steelmanPool, seed, 1)
  // Assign the minority side (the underdog position)
  const steelmanSide: 'blue' | 'red' = steelmanTopic.blue_pct < 50 ? 'blue' : 'red'

  const steelmanExercise: GymExercise = {
    type: 'steelman',
    title: 'Steelman Challenge',
    instruction: 'Make the strongest possible case for the underdog position.',
    challenge: `Argue ${steelmanSide === 'blue' ? 'FOR' : 'AGAINST'} this topic — even if you personally disagree. Find the best evidence, most compelling logic, and most persuasive framing.`,
    topic: steelmanTopic,
    assigned_side: steelmanSide,
    clout_reward: 25,
  }

  // ── Exercise 2: Rebuttal ─────────────────────────────────────────────────
  // Pick a different active topic with a strong top argument to counter
  const rebuttalPool = activeTopics.filter((t) => t.id !== steelmanTopic.id)
  const rebuttalTopic = pickByDate(rebuttalPool, seed, 2)

  // Fetch the top argument on this topic
  const { data: topArgs } = await supabase
    .from('topic_arguments')
    .select(
      'id, content, side, upvotes, user_id'
    )
    .eq('topic_id', rebuttalTopic.id)
    .gte('upvotes', 1)
    .order('upvotes', { ascending: false })
    .limit(5)

  let targetArgument: GymExercise['target_argument'] | undefined
  if (topArgs?.length) {
    const argRow = topArgs[0]
    // Fetch author separately
    const { data: author } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', argRow.user_id)
      .maybeSingle()

    targetArgument = {
      id: argRow.id,
      content: argRow.content,
      side: argRow.side as 'blue' | 'red',
      upvotes: argRow.upvotes,
      author_username: author?.username ?? 'citizen',
      author_display_name: author?.display_name ?? null,
    }
  }

  const rebuttalSide: 'blue' | 'red' = targetArgument?.side === 'blue' ? 'red' : 'blue'

  const rebuttalExercise: GymExercise = {
    type: 'rebuttal',
    title: 'Rebuttal Room',
    instruction: 'Counter the strongest argument on this debate.',
    challenge: `A top-rated argument has been making the case ${targetArgument?.side === 'blue' ? 'FOR' : 'AGAINST'} this topic. Read it carefully, then write the sharpest counter-argument you can.`,
    topic: rebuttalTopic,
    target_argument: targetArgument,
    assigned_side: rebuttalSide,
    clout_reward: 30,
  }

  // ── Exercise 3: Cold Case ─────────────────────────────────────────────────
  // Revive a failed topic with a fresh argument
  const coldCaseTopic = failedTopics?.length
    ? pickByDate(failedTopics, seed, 3)
    : pickByDate(
        activeTopics.filter(
          (t) => t.id !== steelmanTopic.id && t.id !== rebuttalTopic.id
        ),
        seed,
        3
      )

  const coldCaseSide: 'blue' | 'red' =
    seededRand(seed, 4) > 0.5 ? 'blue' : 'red'

  const coldCaseExercise: GymExercise = {
    type: 'cold_case',
    title: 'Cold Case',
    instruction:
      coldCaseTopic.status === 'failed'
        ? 'This debate failed. Can you find the argument that would have changed the outcome?'
        : 'This debate needs a fresh angle. Write the argument that reignites the conversation.',
    challenge:
      coldCaseTopic.status === 'failed'
        ? 'Write the argument that, if posted at the time, might have turned the tide. Be specific, cite evidence, and imagine the context.'
        : 'Find a new angle nobody has argued yet. Be surprising, be specific, be persuasive.',
    topic: coldCaseTopic,
    assigned_side: coldCaseSide,
    clout_reward: 20,
  }

  const response: GymResponse = {
    exercises: [steelmanExercise, rebuttalExercise, coldCaseExercise],
    date: dateStr,
    seed,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
  })
}
