import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SynthesisResponse {
  common_ground: string | null
  tensions: string | null
  synthesis: string | null
  generated_at: string | null
  unavailable?: boolean
  insufficient_data?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── GET /api/topics/[id]/synthesis ──────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      common_ground: null,
      tensions: null,
      synthesis: null,
      generated_at: null,
      unavailable: true,
    } satisfies SynthesisResponse)
  }

  const supabase = await createClient()

  const { data: cached } = await supabase
    .from('topic_synthesis')
    .select('common_ground, tensions, synthesis, generated_at')
    .eq('topic_id', params.id)
    .maybeSingle()

  if (cached) {
    return NextResponse.json({
      common_ground: cached.common_ground,
      tensions: cached.tensions,
      synthesis: cached.synthesis,
      generated_at: cached.generated_at,
    } satisfies SynthesisResponse)
  }

  return NextResponse.json({
    common_ground: null,
    tensions: null,
    synthesis: null,
    generated_at: null,
  } satisfies SynthesisResponse)
}

// ─── POST /api/topics/[id]/synthesis ─────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const topicId = params.id

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'AI synthesis is not configured on this deployment.' },
      { status: 503 }
    )
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch topic
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, blue_pct, total_votes')
    .eq('id', topicId)
    .single()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Fetch top arguments (up to 10 per side for synthesis)
  const { data: args } = await supabase
    .from('topic_arguments')
    .select('content, side, upvotes')
    .eq('topic_id', topicId)
    .order('upvotes', { ascending: false })
    .limit(20)

  const allArgs = args ?? []
  if (allArgs.length < MIN_ARGS_REQUIRED) {
    return NextResponse.json(
      { error: 'insufficient_data', message: 'Not enough arguments to synthesize.' },
      { status: 422 }
    )
  }

  const hash = argumentHash(allArgs)

  // Return cached result if argument pool hasn't changed
  const { data: existing } = await supabase
    .from('topic_synthesis')
    .select('argument_hash, common_ground, tensions, synthesis, generated_at')
    .eq('topic_id', topicId)
    .maybeSingle()

  if (existing?.argument_hash === hash) {
    return NextResponse.json({
      common_ground: existing.common_ground,
      tensions: existing.tensions,
      synthesis: existing.synthesis,
      generated_at: existing.generated_at,
    } satisfies SynthesisResponse)
  }

  const forArgs = allArgs.filter((a) => a.side === 'blue').slice(0, 10)
  const againstArgs = allArgs.filter((a) => a.side === 'red').slice(0, 10)
  const forPct = Math.round(topic.blue_pct ?? 50)

  const prompt = `You are a skilled political mediator tasked with synthesizing opposing viewpoints in a civic debate on Lobby Market.

TOPIC: "${topic.statement}"
CATEGORY: ${topic.category ?? 'General'}
CURRENT VOTE: ${forPct}% FOR / ${100 - forPct}% AGAINST (${topic.total_votes ?? 0} total votes)

ARGUMENTS FOR (top ${forArgs.length}):
${forArgs.map((a, i) => `${i + 1}. ${a.content}`).join('\n')}

ARGUMENTS AGAINST (top ${againstArgs.length}):
${againstArgs.map((a, i) => `${i + 1}. ${a.content}`).join('\n')}

Analyze both sides and respond with EXACTLY this JSON structure (no markdown, no extra text):
{
  "common_ground": "1-2 sentences identifying the underlying values or goals that BOTH sides actually share, even if they disagree on approach. Be specific and concrete.",
  "tensions": "1-2 sentences identifying the core value conflict or fundamental disagreement that makes this debate difficult to resolve. Name the competing values or priorities explicitly.",
  "synthesis": "2-3 sentences describing a nuanced position that acknowledges the strongest concerns from BOTH sides — a position a thoughtful person could hold that doesn't dismiss either side. This is not a 'split the difference' compromise but a genuine synthesis that addresses both sets of concerns."
}

Rules:
- Be genuinely analytical, not superficial
- Do not use the word "compromise" — think in terms of synthesis
- Do not take sides or imply which position is correct
- Keep each field concise but substantive
- Write in plain, direct English — no academic jargon`

  const client = new Anthropic()

  let parsed: { common_ground: string; tensions: string; synthesis: string }
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text in Claude response')
    }

    // Strip potential markdown code fences
    const raw = textBlock.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    parsed = JSON.parse(raw)

    if (!parsed.common_ground || !parsed.tensions || !parsed.synthesis) {
      throw new Error('Incomplete synthesis fields')
    }
  } catch (err) {
    console.error('[synthesis] Claude error:', err)
    return NextResponse.json({ error: 'AI generation failed' }, { status: 502 })
  }

  const now = new Date().toISOString()
  await supabase.from('topic_synthesis').upsert(
    {
      topic_id: topicId,
      common_ground: parsed.common_ground,
      tensions: parsed.tensions,
      synthesis: parsed.synthesis,
      argument_hash: hash,
      model: 'claude-sonnet-4-6',
      generated_at: now,
    },
    { onConflict: 'topic_id' }
  )

  return NextResponse.json({
    common_ground: parsed.common_ground,
    tensions: parsed.tensions,
    synthesis: parsed.synthesis,
    generated_at: now,
  } satisfies SynthesisResponse)
}
