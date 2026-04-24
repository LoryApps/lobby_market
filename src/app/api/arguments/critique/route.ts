import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CritiqueRequest {
  topic_statement: string
  category: string | null
  side: 'for' | 'against'
  argument_text: string
}

export interface CritiqueDimension {
  name: string
  score: number
  feedback: string
}

export interface CritiqueResponse {
  score: number
  grade: string
  summary: string
  dimensions: CritiqueDimension[]
  suggestions: string[]
  strong_point: string
  unavailable?: boolean
}

// ─── POST /api/arguments/critique ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { unavailable: true } satisfies Partial<CritiqueResponse>,
      { status: 200 },
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CritiqueRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { topic_statement, category, side, argument_text } = body

  if (!topic_statement || !side || !argument_text?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (argument_text.trim().length < 10) {
    return NextResponse.json({ error: 'Argument too short' }, { status: 400 })
  }

  const sideLabel = side === 'for' ? 'FOR (in favour of)' : 'AGAINST'

  const prompt = `You are an expert debate coach on Lobby Market, a civic consensus platform.

TOPIC: "${topic_statement}"${category ? `\nCATEGORY: ${category}` : ''}
STANCE: The user argues ${sideLabel} this topic.

ARGUMENT TO EVALUATE:
"${argument_text.trim()}"

Evaluate this argument. Respond with ONLY valid JSON (no markdown, no code fences, no preamble):

{
  "score": <overall 1-10 integer>,
  "grade": "<A|B|C|D|F>",
  "summary": "<1 sentence overall verdict, direct and specific>",
  "dimensions": [
    { "name": "Clarity", "score": <1-10>, "feedback": "<1-2 sentences on how clearly the point is expressed>" },
    { "name": "Evidence", "score": <1-10>, "feedback": "<1-2 sentences on supporting evidence or lack thereof>" },
    { "name": "Logic", "score": <1-10>, "feedback": "<1-2 sentences on the soundness of the reasoning>" },
    { "name": "Persuasion", "score": <1-10>, "feedback": "<1-2 sentences on how convincing this would be to an undecided voter>" }
  ],
  "suggestions": ["<concrete improvement 1, specific and actionable>", "<concrete improvement 2>"],
  "strong_point": "<what this argument does best in one sentence>"
}

Scoring:
- 9-10: Exceptional — compelling, specific, well-evidenced
- 7-8: Good — clear and reasoned, minor gaps
- 5-6: Fair — makes a point but lacks depth or evidence
- 3-4: Weak — vague assertion, logical gaps
- 1-2: Very weak — unsupported, unclear, or fallacious

Be honest and constructive. Match the grade to the score: 9-10=A, 7-8=B, 5-6=C, 3-4=D, 1-2=F.`

  const client = new Anthropic()

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text in response')
    }

    // Strip any accidental markdown fences
    const raw = textBlock.text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const parsed: CritiqueResponse = JSON.parse(raw)

    // Validate required fields
    if (
      typeof parsed.score !== 'number' ||
      !parsed.grade ||
      !parsed.summary ||
      !Array.isArray(parsed.dimensions) ||
      !Array.isArray(parsed.suggestions)
    ) {
      throw new Error('Invalid response shape')
    }

    return NextResponse.json(parsed satisfies CritiqueResponse)
  } catch (err) {
    console.error('[critique] Claude error:', err)
    return NextResponse.json({ error: 'AI evaluation failed' }, { status: 502 })
  }
}
