import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopicContextResponse {
  context: string | null
  generated_at: string | null
  /** true when ANTHROPIC_API_KEY is not configured */
  unavailable?: boolean
}

// ─── GET — return cached context ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { context: null, generated_at: null, unavailable: true } satisfies TopicContextResponse
    )
  }

  const supabase = await createClient()

  const { data: cached } = await supabase
    .from('topic_contexts')
    .select('context_text, generated_at')
    .eq('topic_id', params.id)
    .maybeSingle()

  if (cached) {
    return NextResponse.json({
      context: cached.context_text,
      generated_at: cached.generated_at,
    } satisfies TopicContextResponse)
  }

  return NextResponse.json(
    { context: null, generated_at: null } satisfies TopicContextResponse
  )
}

// ─── POST — generate and cache ────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { context: null, generated_at: null, unavailable: true } satisfies TopicContextResponse,
      { status: 503 }
    )
  }

  const supabase = await createClient()

  // Auth gate — only signed-in users can trigger generation
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch the topic
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Return cached version if already generated (race condition guard)
  const { data: existing } = await supabase
    .from('topic_contexts')
    .select('context_text, generated_at')
    .eq('topic_id', params.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      context: existing.context_text,
      generated_at: existing.generated_at,
    } satisfies TopicContextResponse)
  }

  // Build prompt — uses Claude's world knowledge, NOT platform argument data
  const statusLabel: Record<string, string> = {
    proposed: 'a newly proposed topic',
    active: 'an active debate topic',
    voting: 'a topic currently in its final vote',
    law: 'an established community law',
    failed: 'a topic that failed to reach consensus',
  }

  const prompt = `You are a knowledgeable, neutral policy analyst providing real-world context for a civic debate topic.

TOPIC: "${topic.statement}"
CATEGORY: ${topic.category ?? 'General'}
STATUS: ${statusLabel[topic.status] ?? topic.status}

Write a structured "What's at stake?" brief using exactly this JSON format:

{
  "background": "2-3 sentence explanation of the real-world issue — what it is, why it's debated, and what makes it complex",
  "if_for": "1-2 sentences on the real-world implications if the FOR side wins — who benefits, what changes",
  "if_against": "1-2 sentences on the real-world implications if the AGAINST side wins — who benefits, what changes",
  "key_tension": "One sentence capturing the fundamental value trade-off at the heart of this debate",
  "examples": "1-2 real-world examples, case studies, or precedents relevant to this debate (optional — omit key if none obvious)"
}

Rules:
- Use your own knowledge of the real world, not platform-specific data
- Be scrupulously neutral — present both sides fairly
- Write in plain English; avoid jargon
- Focus on practical, tangible stakes
- Do not include political opinion or advocacy
- Output ONLY the JSON object — no preamble, no explanation`

  const client = new Anthropic()

  let contextText: string
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text in response')
    }

    // Validate that we got JSON
    contextText = textBlock.text.trim()
    JSON.parse(contextText) // throws if invalid
  } catch (err) {
    console.error('[topic-context] Claude error:', err)
    return NextResponse.json(
      { error: 'Generation failed' },
      { status: 500 }
    )
  }

  const now = new Date().toISOString()

  // Upsert to handle races
  const { error: upsertErr } = await supabase
    .from('topic_contexts')
    .upsert(
      {
        topic_id: params.id,
        context_text: contextText,
        model: 'claude-sonnet-4-6',
        generated_at: now,
      },
      { onConflict: 'topic_id' }
    )

  if (upsertErr) {
    console.error('[topic-context] DB error:', upsertErr)
  }

  return NextResponse.json({
    context: contextText,
    generated_at: now,
  } satisfies TopicContextResponse)
}
