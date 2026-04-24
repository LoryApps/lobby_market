import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIBriefResponse {
  brief: string | null
  generated_at: string | null
  /** true when no ANTHROPIC_API_KEY is configured */
  unavailable?: boolean
  /** true when topic has too few arguments to summarize */
  insufficient_data?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Simple, fast fingerprint for a set of argument texts.
 * We use a sum of char codes modulo a large prime — not cryptographic,
 * but good enough to detect when the argument pool has changed.
 */
function argumentHash(args: Array<{ content: string }>): string {
  let hash = 0
  for (const arg of args) {
    for (let i = 0; i < arg.content.length; i++) {
      hash = (hash * 31 + arg.content.charCodeAt(i)) >>> 0
    }
  }
  return hash.toString(16).padStart(8, '0')
}

const MIN_ARGS_REQUIRED = 4

// ─── GET /api/topics/[id]/ai-brief ───────────────────────────────────────────
// Returns the cached AI brief for a topic, or a flag indicating it needs to
// be generated.

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const topicId = params.id

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ brief: null, generated_at: null, unavailable: true } satisfies AIBriefResponse)
  }

  const supabase = await createClient()

  const { data: cached } = await supabase
    .from('topic_ai_briefs')
    .select('brief_text, generated_at')
    .eq('topic_id', topicId)
    .maybeSingle()

  if (cached) {
    return NextResponse.json({
      brief: cached.brief_text,
      generated_at: cached.generated_at,
    } satisfies AIBriefResponse)
  }

  return NextResponse.json({ brief: null, generated_at: null } satisfies AIBriefResponse)
}

// ─── POST /api/topics/[id]/ai-brief ──────────────────────────────────────────
// Triggers (re-)generation of the AI brief for this topic.
// Authenticated users only; rate-limited per topic by argument_hash.

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const topicId = params.id

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'AI brief generation is not configured on this deployment.' },
      { status: 503 }
    )
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch topic
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', topicId)
    .single()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Fetch top FOR and AGAINST arguments
  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select('content, side, upvotes, source_url')
    .eq('topic_id', topicId)
    .order('upvotes', { ascending: false })
    .limit(20)

  const args = rawArgs ?? []

  if (args.length < MIN_ARGS_REQUIRED) {
    return NextResponse.json(
      { error: 'insufficient_data', brief: null, generated_at: null, insufficient_data: true } satisfies AIBriefResponse & { error: string },
      { status: 422 }
    )
  }

  const hash = argumentHash(args as Array<{ content: string }>)

  // Check if cached brief is already fresh for this argument set
  const { data: existing } = await supabase
    .from('topic_ai_briefs')
    .select('argument_hash, generated_at')
    .eq('topic_id', topicId)
    .maybeSingle()

  if (existing?.argument_hash === hash) {
    // Already up to date — return existing
    const { data: fresh } = await supabase
      .from('topic_ai_briefs')
      .select('brief_text, generated_at')
      .eq('topic_id', topicId)
      .single()

    return NextResponse.json({
      brief: fresh?.brief_text ?? null,
      generated_at: fresh?.generated_at ?? null,
    } satisfies AIBriefResponse)
  }

  // Build Claude prompt
  const forArgs = args.filter((a) => a.side === 'blue').slice(0, 8)
  const againstArgs = args.filter((a) => a.side === 'red').slice(0, 8)

  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  const statusLabels: Record<string, string> = {
    proposed: 'Proposed',
    active: 'Active — open for debate and voting',
    voting: 'In Voting Phase',
    law: 'Established as Law',
    failed: 'Failed to pass',
  }

  const prompt = `You are a neutral civic analyst summarizing a community debate for Lobby Market, a civic consensus platform.

TOPIC: "${topic.statement}"
STATUS: ${statusLabels[topic.status] ?? topic.status}
CATEGORY: ${topic.category ?? 'General'}
CURRENT VOTE: ${forPct}% FOR / ${againstPct}% AGAINST (${topic.total_votes ?? 0} votes cast)

TOP ARGUMENTS FOR (${forArgs.length} shown):
${forArgs.map((a, i) => `${i + 1}. [${a.upvotes} upvotes] ${a.content}`).join('\n')}

TOP ARGUMENTS AGAINST (${againstArgs.length} shown):
${againstArgs.map((a, i) => `${i + 1}. [${a.upvotes} upvotes] ${a.content}`).join('\n')}

Write a concise, balanced debate brief (3 short paragraphs) for someone who wants to understand this topic before voting:
1. Opening paragraph: What this debate is fundamentally about (2-3 sentences, factual/neutral).
2. The case FOR: Synthesize the strongest FOR arguments without advocating (2-3 sentences).
3. The case AGAINST: Synthesize the strongest AGAINST arguments without advocating (2-3 sentences).

Rules:
- Be strictly neutral — do not imply which side is right
- Write in plain English, avoid jargon
- Do not repeat the topic statement verbatim in the opening
- Do not include any preamble, headers, or labels — just the three paragraphs of prose
- Each paragraph should be 2-4 sentences
- Total length: 120-200 words`

  const client = new Anthropic()

  let brief: string
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text in response')
    }
    brief = textBlock.text.trim()
  } catch (err) {
    console.error('[ai-brief] Claude error:', err)
    return NextResponse.json({ error: 'AI generation failed' }, { status: 502 })
  }

  // Upsert into cache
  const now = new Date().toISOString()
  await supabase.from('topic_ai_briefs').upsert(
    {
      topic_id: topicId,
      brief_text: brief,
      argument_hash: hash,
      model: 'claude-sonnet-4-6',
      generated_at: now,
    },
    { onConflict: 'topic_id' }
  )

  return NextResponse.json({
    brief,
    generated_at: now,
  } satisfies AIBriefResponse)
}
