import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PrepArgument {
  id: string
  content: string
  upvotes: number
  source_url: string | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface TalkingPoints {
  opening_hook: string
  core_arguments: string[]
  counter_prep: string[]
  key_stat: string | null
  closing_line: string
  unavailable?: boolean
}

export interface PrepResponse {
  topic: {
    id: string
    statement: string
    description: string | null
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    created_at: string
  }
  side: 'for' | 'against'
  your_arguments: PrepArgument[]
  counter_arguments: PrepArgument[]
  talking_points: TalkingPoints | null
  consensus_note: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTalkingPointsPrompt(
  statement: string,
  category: string | null,
  side: 'for' | 'against',
  yourArgs: PrepArgument[],
  counterArgs: PrepArgument[],
  forPct: number,
  totalVotes: number,
): string {
  const sideLabel = side === 'for' ? 'FOR (in favour of)' : 'AGAINST'
  const consensusLabel =
    forPct >= 60
      ? 'the community leans FOR this'
      : forPct <= 40
      ? 'the community leans AGAINST this'
      : 'the community is deeply divided on this'

  const topYours = yourArgs
    .slice(0, 3)
    .map((a, i) => `${i + 1}. "${a.content.slice(0, 200)}"`)
    .join('\n')

  const topCounters = counterArgs
    .slice(0, 3)
    .map((a, i) => `${i + 1}. "${a.content.slice(0, 200)}"`)
    .join('\n')

  return `You are a debate coach preparing a civic debater for Lobby Market, a democratic consensus platform.

TOPIC: "${statement}"
${category ? `CATEGORY: ${category}` : ''}
THEIR STANCE: ${sideLabel}
PLATFORM CONSENSUS: ${forPct}% FOR, ${100 - forPct}% AGAINST (${totalVotes.toLocaleString()} votes) — ${consensusLabel}.

TOP ARGUMENTS FOR THEIR SIDE (from platform):
${topYours || '(none yet)'}

TOP COUNTERARGUMENTS THEY WILL FACE:
${topCounters || '(none yet)'}

Generate a debate prep dossier. Respond with ONLY valid JSON (no markdown, no code fences):

{
  "opening_hook": "<1 punchy sentence to open the debate with — memorable, confident>",
  "core_arguments": ["<strongest point 1>", "<strongest point 2>", "<strongest point 3>"],
  "counter_prep": ["<how to rebut counter-arg 1>", "<how to rebut counter-arg 2>"],
  "key_stat": "<one powerful statistic or data point to cite, or null if none>",
  "closing_line": "<1 sentence closing statement — resonant and clear>"
}`
}

// ─── GET /api/prep?topic_id=<id>&side=<for|against> ──────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const topicId = searchParams.get('topic_id')?.trim()
  const side = searchParams.get('side') as 'for' | 'against' | null

  if (!topicId) {
    return NextResponse.json({ error: 'topic_id required' }, { status: 400 })
  }
  if (side !== 'for' && side !== 'against') {
    return NextResponse.json({ error: 'side must be "for" or "against"' }, { status: 400 })
  }

  const supabase = await createClient()

  // ── Fetch topic ──────────────────────────────────────────────────────────
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('id, statement, description, category, status, blue_pct, total_votes, created_at')
    .eq('id', topicId)
    .maybeSingle()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // ── Fetch top arguments from DB ──────────────────────────────────────────
  const yourSide = side === 'for' ? 'blue' : 'red'
  const theirSide = side === 'for' ? 'red' : 'blue'

  const [yourRes, counterRes] = await Promise.all([
    supabase
      .from('topic_arguments')
      .select(`
        id, content, upvotes, source_url, created_at,
        author:profiles!topic_arguments_user_id_fkey(id, username, display_name, avatar_url, role)
      `)
      .eq('topic_id', topicId)
      .eq('side', yourSide)
      .order('upvotes', { ascending: false })
      .limit(6),
    supabase
      .from('topic_arguments')
      .select(`
        id, content, upvotes, source_url, created_at,
        author:profiles!topic_arguments_user_id_fkey(id, username, display_name, avatar_url, role)
      `)
      .eq('topic_id', topicId)
      .eq('side', theirSide)
      .order('upvotes', { ascending: false })
      .limit(6),
  ])

  type RawArg = {
    id: string
    content: string
    upvotes: number
    source_url: string | null
    created_at: string
    author: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string } | null
  }

  const yourArguments = ((yourRes.data ?? []) as RawArg[]).map((a) => ({
    id: a.id,
    content: a.content,
    upvotes: a.upvotes,
    source_url: a.source_url,
    created_at: a.created_at,
    author: a.author ?? null,
  })) satisfies PrepArgument[]

  const counterArguments = ((counterRes.data ?? []) as RawArg[]).map((a) => ({
    id: a.id,
    content: a.content,
    upvotes: a.upvotes,
    source_url: a.source_url,
    created_at: a.created_at,
    author: a.author ?? null,
  })) satisfies PrepArgument[]

  // ── Consensus note ───────────────────────────────────────────────────────
  const forPct = Math.round(topic.blue_pct ?? 50)
  let consensusNote = ''
  if (side === 'for') {
    consensusNote =
      forPct >= 60
        ? `You are on the majority side — ${forPct}% of ${(topic.total_votes ?? 0).toLocaleString()} voters agree with you.`
        : forPct <= 40
        ? `You are on the minority side — only ${forPct}% currently support this. Your job is to shift consensus.`
        : `The platform is split: ${forPct}% FOR vs ${100 - forPct}% AGAINST. Every argument counts.`
  } else {
    consensusNote =
      forPct <= 40
        ? `You are on the majority side — ${100 - forPct}% of ${(topic.total_votes ?? 0).toLocaleString()} voters agree with you.`
        : forPct >= 60
        ? `You are the dissenting voice — ${100 - forPct}% oppose this. You need to make a compelling case.`
        : `The platform is split: ${forPct}% FOR vs ${100 - forPct}% AGAINST. Every argument counts.`
  }

  // ── AI talking points ────────────────────────────────────────────────────
  let talkingPoints: TalkingPoints | null = null

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic()
      const prompt = buildTalkingPointsPrompt(
        topic.statement,
        topic.category ?? null,
        side,
        yourArguments,
        counterArguments,
        forPct,
        topic.total_votes ?? 0,
      )

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      })

      const raw =
        message.content[0].type === 'text' ? message.content[0].text.trim() : ''

      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Partial<TalkingPoints>
        talkingPoints = {
          opening_hook: parsed.opening_hook ?? '',
          core_arguments: parsed.core_arguments ?? [],
          counter_prep: parsed.counter_prep ?? [],
          key_stat: parsed.key_stat ?? null,
          closing_line: parsed.closing_line ?? '',
        }
      }
    } catch {
      // graceful degradation — talking points remain null
    }
  }

  const response: PrepResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      description: topic.description ?? null,
      category: topic.category ?? null,
      status: topic.status,
      blue_pct: forPct,
      total_votes: topic.total_votes ?? 0,
      created_at: topic.created_at,
    },
    side,
    your_arguments: yourArguments,
    counter_arguments: counterArguments,
    talking_points: talkingPoints,
    consensus_note: consensusNote,
  }

  return NextResponse.json(response)
}
