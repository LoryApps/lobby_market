import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SparMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SparRequest {
  topic_id: string
  topic_statement: string
  category: string | null
  user_side: 'for' | 'against'
  history: SparMessage[]
  mode: 'debate' | 'feedback'
}

export interface SparResponse {
  response: string
  unavailable?: boolean
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildDebateSystemPrompt(
  statement: string,
  category: string | null,
  aiSide: 'for' | 'against',
): string {
  const aiStance = aiSide === 'for' ? 'FOR (in favour of)' : 'AGAINST'
  const userStance = aiSide === 'for' ? 'AGAINST' : 'FOR (in favour of)'
  return `You are a skilled debate opponent on Lobby Market, a civic consensus platform.

TOPIC: "${statement}"
${category ? `CATEGORY: ${category}` : ''}

Your role: Argue ${aiStance} this topic.
The user argues ${userStance}.

Rules:
- Present compelling, evidence-based arguments strictly for your assigned side
- Directly but respectfully challenge the user's reasoning
- Keep each response to 2–4 sentences — be punchy, not verbose
- Build on the conversation history; don't repeat yourself
- Ask one pointed follow-up question at the end of each response to keep the debate moving
- Never concede your position; you are committed to arguing ${aiStance}
- No preambles like "Great point!" — get straight to the argument`
}

function buildFeedbackSystemPrompt(
  statement: string,
  userSide: 'for' | 'against',
): string {
  const stance = userSide === 'for' ? 'FOR' : 'AGAINST'
  return `You are a debate coach reviewing a practice debate on Lobby Market.

The user argued ${stance} the following topic: "${statement}"

Review the full conversation and give brief coaching feedback covering:
1. One thing they argued well
2. One concrete way to improve
3. A score out of 10

Keep the feedback under 80 words. Be honest, encouraging, and specific. Use plain English.
Do not repeat the topic statement. Go straight to the feedback — no preamble.`
}

// ─── POST /api/spar ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { response: '', unavailable: true } satisfies SparResponse,
      { status: 200 },
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: SparRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { topic_statement, category, user_side, history, mode } = body

  if (!topic_statement || !user_side || !Array.isArray(history)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Guard: max 12 history messages (6 rounds) to keep context reasonable
  const cappedHistory = history.slice(-12)

  const client = new Anthropic()

  const aiSide: 'for' | 'against' = user_side === 'for' ? 'against' : 'for'

  const systemPrompt =
    mode === 'feedback'
      ? buildFeedbackSystemPrompt(topic_statement, user_side)
      : buildDebateSystemPrompt(topic_statement, category, aiSide)

  const messages: Anthropic.MessageParam[] =
    mode === 'feedback'
      ? [
          {
            role: 'user',
            content: `Here is the debate transcript:\n\n${cappedHistory
              .map((m) => `${m.role === 'user' ? 'USER' : 'AI'}: ${m.content}`)
              .join('\n\n')}\n\nPlease provide your coaching feedback.`,
          },
        ]
      : cappedHistory.map((m) => ({
          role: m.role,
          content: m.content,
        }))

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: mode === 'feedback' ? 256 : 512,
      system: systemPrompt,
      messages,
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text in response')
    }

    return NextResponse.json({ response: textBlock.text.trim() } satisfies SparResponse)
  } catch (err) {
    console.error('[spar] Claude error:', err)
    return NextResponse.json({ error: 'AI service failed' }, { status: 502 })
  }
}
