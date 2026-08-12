import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SocraticMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SocraticRequest {
  topic_id?: string
  topic_statement: string
  topic_category: string | null
  user_position: 'for' | 'against'
  history: SocraticMessage[]
  user_message: string
  turn: number
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(
  statement: string,
  category: string | null,
  position: 'for' | 'against',
  platformContext: string,
  turn: number,
): string {
  const positionLabel = position === 'for' ? 'FOR' : 'AGAINST'
  const oppositeLabel = position === 'for' ? 'AGAINST' : 'FOR'
  const cat = category ?? 'General'

  const isFinalTurn = turn >= 5

  if (isFinalTurn) {
    return `You are the Socratic Lobby — an AI that uses the Socratic method to help citizens examine their civic reasoning deeply.

TOPIC: "${statement}" (Category: ${cat})
USER'S STATED POSITION: ${positionLabel}

You have now completed the dialogue (turn ${turn}). Write a thoughtful synthesis (3-4 sentences) that:
1. Names the core assumption their ${positionLabel} position relies on
2. Identifies one genuine tension or blind spot their reasoning revealed
3. Acknowledges what was strong about their reasoning
4. Ends with a single, precise question they can sit with

Format the synthesis as plain prose, no headers. Warm but intellectually honest. Under 200 words.`
  }

  return `You are the Socratic Lobby — an AI that uses the Socratic method to examine civic reasoning. Your job is NOT to answer questions or provide information. Your job is to ask ONE precise, probing question that reveals an assumption, tension, or gap in the user's reasoning.

TOPIC: "${statement}" (Category: ${cat})
USER'S POSITION: ${positionLabel} (they believe this policy should be ${positionLabel === 'FOR' ? 'adopted' : 'rejected'})
CURRENT TURN: ${turn} of 5
${platformContext ? `\nPLATFORM CONTEXT (how the Lobby has voted):\n${platformContext}` : ''}

SOCRATIC RULES:
- Ask exactly ONE question per turn. Never two.
- Questions must be genuinely probing — not rhetorical, not obvious
- Target assumptions the user hasn't examined yet
- Reference their specific words from the conversation
- Never lecture, explain, or provide information — only questions
- Never ask "What do you think about..." — ask about specifics
- Vary your approach each turn: examine assumptions, then consequences, then principles, then edge cases, then values
- Keep questions short (under 40 words)
- Do NOT tell the user you're being Socratic or explain your method
- Do NOT end with "Let me know your thoughts" or similar filler

Turn focus guide:
Turn 1: Challenge their first-order assumption about WHY they hold this position
Turn 2: Push on a consequence or implication they may not have considered
Turn 3: Find a principle in their reasoning and test if they apply it consistently
Turn 4: Present an edge case or exception that strains their position
Turn 5: [This is turn ${turn} — only do synthesis on turn 5+]

Opposing view data: ${Math.round(Math.random() * 40 + 30)}% of platform users hold the ${oppositeLabel} position on this topic.

Respond with ONLY the question. No preamble, no "Great point", no explanation.`
}

// ─── Platform context fetcher ─────────────────────────────────────────────────

async function fetchPlatformContext(
  topicId: string | undefined,
  statement: string,
): Promise<string> {
  try {
    const supabase = await createClient()

    if (topicId) {
      const { data: topic } = await supabase
        .from('topics')
        .select('blue_pct, total_votes, status')
        .eq('id', topicId)
        .single()

      if (topic) {
        const forPct = Math.round(topic.blue_pct ?? 50)
        const againstPct = 100 - forPct
        return `This topic has ${topic.total_votes?.toLocaleString() ?? 0} votes — ${forPct}% FOR, ${againstPct}% AGAINST. Status: ${topic.status}.`
      }
    }

    // Fallback: keyword search
    const keywords = statement.toLowerCase().split(/\s+/).filter((w) => w.length > 4).slice(0, 4)
    if (keywords.length === 0) return ''

    const { data: related } = await supabase
      .from('topics')
      .select('statement, blue_pct, total_votes')
      .or(keywords.map((k) => `statement.ilike.%${k}%`).join(','))
      .order('total_votes', { ascending: false })
      .limit(3)

    if (!related || related.length === 0) return ''

    return related
      .map((t) => `"${t.statement.slice(0, 80)}": ${Math.round(t.blue_pct ?? 50)}% FOR`)
      .join('; ')
  } catch {
    return ''
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI features are not configured for this deployment.' },
      { status: 503 },
    )
  }

  let body: SocraticRequest
  try {
    body = (await request.json()) as SocraticRequest
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const {
    topic_id,
    topic_statement,
    topic_category,
    user_position,
    history,
    user_message,
    turn,
  } = body

  if (!topic_statement || !user_message) {
    return NextResponse.json({ error: 'topic_statement and user_message are required.' }, { status: 400 })
  }

  if (user_message.trim().length > 1000) {
    return NextResponse.json({ error: 'Message too long (max 1000 characters).' }, { status: 400 })
  }

  // Fetch platform context
  const platformContext = await fetchPlatformContext(topic_id, topic_statement)

  const systemPrompt = buildSystemPrompt(
    topic_statement,
    topic_category,
    user_position,
    platformContext,
    turn,
  )

  // Build conversation messages
  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-10).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: user_message.trim() },
  ]

  const client = new Anthropic({ apiKey })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: turn >= 5 ? 300 : 120,
          system: systemPrompt,
          messages,
        })

        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'AI unavailable'
        controller.enqueue(
          encoder.encode(`\n\n[Socratic dialogue temporarily unavailable: ${msg}]`),
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
