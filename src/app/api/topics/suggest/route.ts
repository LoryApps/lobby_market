import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SuggestRequest {
  statement: string
  category?: string | null
}

export interface SuggestResponse {
  suggestions: string[]
  unavailable?: boolean
}

// ─── POST /api/topics/suggest ─────────────────────────────────────────────────
// Takes a rough topic statement and returns 3 improved phrasings via Claude.
// Requires authentication so we can't be freely rate-hammered.

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { suggestions: [], unavailable: true } satisfies SuggestResponse,
      { status: 200 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: SuggestRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { statement, category } = body

  if (!statement || statement.trim().length < 5) {
    return NextResponse.json({ error: 'Statement too short' }, { status: 400 })
  }

  if (statement.trim().length > 500) {
    return NextResponse.json({ error: 'Statement too long' }, { status: 400 })
  }

  const categoryContext = category ? `\nCategory: ${category}` : ''

  const prompt = `You are a civic debate curator for Lobby Market — a platform where citizens vote on binary policy topics that can become permanent laws.

A user wants to submit this topic idea:
"${statement.trim()}"${categoryContext}

Your task: Rephrase this into 3 distinct, high-quality civic debate statements. Each should be:
- A clear, falsifiable binary statement (the community will vote FOR or AGAINST it)
- Specific enough to have a clear meaning, but broad enough for genuine disagreement
- Phrased in present or future tense (not "should we discuss whether...")
- Neutral in framing — avoid loading the statement for one side
- Under 200 characters
- Interesting and debate-worthy (avoid both extremely obvious and extremely fringe statements)

The 3 suggestions should vary in:
1. Scope/strength (e.g., "all X" vs "most X", or a specific threshold)
2. Framing angle (focus on different aspect of the same underlying issue)
3. Policy specificity (one broad, one medium, one specific if possible)

Respond with ONLY a JSON array of 3 strings. No markdown, no code fences, no explanation, no numbering:
["statement 1", "statement 2", "statement 3"]`

  const client = new Anthropic()

  let suggestions: string[]
  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text in Claude response')
    }

    const raw = textBlock.text.trim()
    const parsed = JSON.parse(raw) as unknown

    if (
      !Array.isArray(parsed) ||
      parsed.length < 1 ||
      !parsed.every((s) => typeof s === 'string')
    ) {
      throw new Error('Unexpected response format')
    }

    suggestions = (parsed as string[])
      .slice(0, 3)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 280)
  } catch (err) {
    console.error('[suggest] Claude error:', err)
    return NextResponse.json({ error: 'AI generation failed' }, { status: 502 })
  }

  return NextResponse.json({ suggestions } satisfies SuggestResponse)
}
