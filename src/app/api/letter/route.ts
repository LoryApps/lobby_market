import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LetterType = 'representative' | 'opEd' | 'petition' | 'social'
export type LetterPosition = 'for' | 'against'

export interface LetterRequest {
  topic_id: string
  topic_statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  position: LetterPosition
  letter_type: LetterType
  recipient_name?: string
  recipient_title?: string
}

export interface LetterResult {
  subject: string
  salutation: string
  body: string[]
  closing: string
  signature_block: string
  word_count: number
  tone: string
  call_to_action: string
  generated_at: string
  unavailable?: boolean
  insufficient_data?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampStr(s: unknown, max: number, fallback: string): string {
  if (typeof s !== 'string' || !s.trim()) return fallback
  return s.slice(0, max)
}

function ensureStrArray(val: unknown, fallback: string[]): string[] {
  if (!Array.isArray(val)) return fallback
  return val
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .slice(0, 10)
    .map((s) => s.slice(0, 500))
}

const LETTER_TYPE_LABELS: Record<LetterType, string> = {
  representative: 'formal letter to an elected representative',
  opEd: 'op-ed or letter to the editor for a newspaper',
  petition: 'public petition statement or open letter',
  social: 'persuasive social media thread (3-5 connected posts)',
}

const TONE_MAP: Record<LetterType, string> = {
  representative: 'formal and respectful, citing community consensus data',
  opEd: 'journalistic and compelling, accessible to a general audience',
  petition: 'urgent and inclusive, inviting co-signers',
  social: 'engaging and shareable, with hook-driven opening',
}

const SYSTEM_PROMPT = `You are a skilled civic communications writer for Lobby Market, a consensus-driven democracy platform. You help citizens craft compelling, well-structured civic letters grounded in community evidence and democratic values.

Guidelines:
- Be specific and evidence-based, referencing the community vote data
- Write in an authentic citizen's voice — not corporate or academic
- Match the tone exactly to the letter type requested
- Include a clear, actionable call to action
- Avoid partisan rhetoric — focus on the civic argument
- Reference the platform consensus data to lend credibility
- Keep paragraphs concise (3-4 sentences max)
- For social threads, format each post as a separate paragraph starting with a number`

// ─── POST /api/letter ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { unavailable: true } satisfies Partial<LetterResult>,
      { status: 200 },
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: LetterRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    topic_statement,
    category,
    blue_pct,
    total_votes,
    position,
    letter_type,
    recipient_name,
    recipient_title,
  } = body

  if (!topic_statement || !position || !letter_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const positionLabel = position === 'for' ? 'FOR (supporting)' : 'AGAINST (opposing)'
  const forPct = Math.round(blue_pct)
  const againstPct = 100 - forPct
  const letterTypeLabel = LETTER_TYPE_LABELS[letter_type]
  const toneLabel = TONE_MAP[letter_type]
  const recipientLine = recipient_name
    ? `Addressed to: ${recipient_name}${recipient_title ? `, ${recipient_title}` : ''}`
    : ''

  const userPrompt = `Write a ${letterTypeLabel} arguing the ${positionLabel} position on this civic topic:

"${topic_statement}"

${category ? `Policy category: ${category}` : ''}
${recipientLine}

Community consensus data:
- ${forPct}% of the Lobby Market community is FOR this
- ${againstPct}% of the Lobby Market community is AGAINST this
- ${total_votes.toLocaleString()} votes cast by engaged citizens

Tone: ${toneLabel}

Respond with ONLY valid JSON (no markdown fences, no preamble):

{
  "subject": "<Email/letter subject line — clear and action-oriented, under 80 chars>",
  "salutation": "<Opening greeting, e.g. 'Dear Congresswoman Smith,' or 'To the Editor:' or for social omit this>",
  "body": [
    "<First paragraph — hook, introduce the issue, and your position>",
    "<Second paragraph — strongest argument with evidence / community data>",
    "<Third paragraph — address the counterargument honestly>",
    "<Fourth paragraph — consequences if action not taken / why this matters now>"
  ],
  "closing": "<Final closing statement reinforcing the call to action>",
  "signature_block": "<Appropriate sign-off line, e.g. 'Respectfully,' or 'Sincerely,' — single word or short phrase only>",
  "tone": "<One-sentence description of the letter's overall tone>",
  "call_to_action": "<One specific, concrete action you want the recipient to take>"
}`

  const client = new Anthropic()

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''

    let parsed: Record<string, unknown>
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    const bodyParagraphs = ensureStrArray(parsed.body, [
      'I am writing to express my civic position on an important policy matter.',
      'The Lobby Market community has spoken — this issue demands attention.',
      'I urge you to consider the weight of civic consensus.',
      'The time for action is now.',
    ])

    const wordCount = bodyParagraphs.join(' ').split(/\s+/).length

    const result: LetterResult = {
      subject: clampStr(parsed.subject, 120, `Civic Position: ${topic_statement.slice(0, 60)}`),
      salutation: clampStr(parsed.salutation, 100, letter_type === 'social' ? '' : 'To Whom It May Concern,'),
      body: bodyParagraphs,
      closing: clampStr(parsed.closing, 300, 'I appreciate your consideration of this important civic matter.'),
      signature_block: clampStr(parsed.signature_block, 50, 'Respectfully,'),
      word_count: wordCount,
      tone: clampStr(parsed.tone, 200, toneLabel),
      call_to_action: clampStr(parsed.call_to_action, 200, 'Take action on this civic issue today.'),
      generated_at: new Date().toISOString(),
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/letter]', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
