import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SuggestResponse {
  suggestions: Suggestion[]
  argument_side: 'blue' | 'red'
  topic_statement: string
  unavailable?: boolean
}

export interface Suggestion {
  type: 'reinforce' | 'counter' | 'extend'
  label: string
  point: string
  starter: string
}

// ─── POST /api/arguments/[id]/suggest ────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ unavailable: true } as SuggestResponse, { status: 200 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: arg } = await supabase
    .from('topic_arguments')
    .select('id, content, side, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!arg) {
    return NextResponse.json({ error: 'Argument not found' }, { status: 404 })
  }

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category')
    .eq('id', arg.topic_id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const side = arg.side as 'blue' | 'red'
  const sideLabel = side === 'blue' ? 'FOR' : 'AGAINST'
  const oppSideLabel = side === 'blue' ? 'AGAINST' : 'FOR'

  const prompt = `You are a civic debate strategist on Lobby Market. A user wants help responding to this argument.

TOPIC: "${topic.statement}"${topic.category ? `\nCATEGORY: ${topic.category}` : ''}

ARGUMENT TO RESPOND TO (${sideLabel} side):
"${arg.content}"

Generate exactly 3 response strategies for someone on the ${oppSideLabel} side who wants to write a reply argument. Each strategy must be distinct and actionable.

Respond with ONLY valid JSON (no markdown, no code fences):
{
  "suggestions": [
    {
      "type": "counter",
      "label": "Challenge the premise",
      "point": "<One clear, concrete point that directly challenges the core claim — 1–2 sentences>",
      "starter": "<A 10–15 word opening sentence they could use to start their argument>"
    },
    {
      "type": "extend",
      "label": "Introduce new evidence",
      "point": "<A distinct angle or piece of evidence they could bring in — 1–2 sentences>",
      "starter": "<A 10–15 word opening sentence>"
    },
    {
      "type": "reinforce",
      "label": "Reframe the stakes",
      "point": "<A reframing of why the ${oppSideLabel} position matters more for society — 1–2 sentences>",
      "starter": "<A 10–15 word opening sentence>"
    }
  ]
}`

  try {
    const client = new Anthropic()
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const parsed = JSON.parse(raw) as { suggestions: Suggestion[] }

    return NextResponse.json({
      suggestions: parsed.suggestions,
      argument_side: side,
      topic_statement: topic.statement,
    } satisfies SuggestResponse)
  } catch {
    return NextResponse.json(
      { unavailable: true } as SuggestResponse,
      { status: 200 }
    )
  }
}
