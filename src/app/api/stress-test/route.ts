import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Types ────────────────────────────────────────────────────────────────────

export type AttackVector =
  | 'empirical'
  | 'logical'
  | 'practical'
  | 'systemic'
  | 'alternatives'

export interface StressVector {
  type: AttackVector
  label: string
  icon: string
  counter: string
  vulnerability: number // 1-10: 1-3 resilient, 4-6 moderate, 7-10 vulnerable
  defense_tip: string
}

export interface StressTestRequest {
  argument: string
  topic_context?: string
}

export interface StressTestResponse {
  vectors: StressVector[]
  overall_score: number // 1-10: 1-3 fortress, 4-6 solid, 7-10 fragile
  summary: string
  strongest_attack: AttackVector
  weakest_point: string
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Civic Stress Test — an impartial analytical engine that rigorously probes civic arguments for vulnerabilities.

Your task: analyse a given argument across exactly five attack vectors and return a precise JSON assessment.

ATTACK VECTORS:
1. empirical — factual accuracy, data quality, evidence strength
2. logical — reasoning validity, fallacies, inferential leaps
3. practical — implementation feasibility, resource constraints, execution risks
4. systemic — unintended consequences, second-order effects, systemic knock-ons
5. alternatives — whether a competing solution or argument undermines this one's uniqueness

For each vector:
- counter: the strongest possible counter-argument from this angle (2-3 sentences, direct, no hedging)
- vulnerability: integer 1-10 (1=fortress, 10=exposed). Be honest — most arguments have at least one weak point ≥6.
- defense_tip: one concrete sentence on how to strengthen against this specific attack

Overall:
- overall_score: weighted average of the five vulnerability scores (integer 1-10)
- summary: 2-sentence plain-English verdict on the argument's core strength
- strongest_attack: which single vector deals the most damage
- weakest_point: one sentence naming the single most exploitable weakness

Return ONLY valid JSON matching the StressTestResponse schema. No preamble, no markdown fences.`

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI features are not configured for this deployment.' },
      { status: 503 },
    )
  }

  let body: StressTestRequest
  try {
    body = (await request.json()) as StressTestRequest
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { argument, topic_context } = body

  if (!argument || argument.trim().length < 20) {
    return NextResponse.json(
      { error: 'Argument must be at least 20 characters.' },
      { status: 400 },
    )
  }

  if (argument.trim().length > 2000) {
    return NextResponse.json(
      { error: 'Argument too long (max 2000 characters).' },
      { status: 400 },
    )
  }

  const userMessage = `ARGUMENT TO STRESS TEST:
"${argument.trim()}"

${topic_context ? `CIVIC CONTEXT: ${topic_context}` : ''}

Run all five attack vectors and return the JSON assessment.`

  const client = new Anthropic({ apiKey })

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    let parsed: StressTestResponse
    try {
      parsed = JSON.parse(raw) as StressTestResponse
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response.' }, { status: 500 })
    }

    // Attach labels and icons that the frontend uses
    const vectorMeta: Record<AttackVector, { label: string; icon: string }> = {
      empirical: { label: 'Empirical Attack', icon: '🔬' },
      logical: { label: 'Logical Attack', icon: '⚖️' },
      practical: { label: 'Practical Attack', icon: '🔧' },
      systemic: { label: 'Systemic Attack', icon: '🌐' },
      alternatives: { label: 'Alternatives Attack', icon: '💡' },
    }

    parsed.vectors = parsed.vectors.map((v) => ({
      ...v,
      ...vectorMeta[v.type],
    }))

    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: 'AI request failed. Please try again.' }, { status: 500 })
  }
}
