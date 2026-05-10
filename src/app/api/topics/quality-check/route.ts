import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QualityCheckRequest {
  statement: string
  category?: string | null
}

export interface QualityDimension {
  name: string
  score: number    // 1–10
  feedback: string
}

export type QualityTier = 'excellent' | 'good' | 'needs-work' | 'poor'

export interface QualityCheckResponse {
  score: number          // 1–10 overall
  tier: QualityTier
  summary: string
  dimensions: QualityDimension[]
  improvements: string[]
  improved_statement: string | null
  unavailable?: boolean
}

// ─── Tier helper ──────────────────────────────────────────────────────────────

function scoreToTier(score: number): QualityTier {
  if (score >= 8) return 'excellent'
  if (score >= 6) return 'good'
  if (score >= 4) return 'needs-work'
  return 'poor'
}

// ─── POST /api/topics/quality-check ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { unavailable: true } satisfies Partial<QualityCheckResponse>,
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

  let body: QualityCheckRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { statement, category } = body

  if (!statement?.trim()) {
    return NextResponse.json({ error: 'Missing statement' }, { status: 400 })
  }

  if (statement.trim().length < 10) {
    return NextResponse.json({ error: 'Statement too short' }, { status: 400 })
  }

  const client = new Anthropic()

  const prompt = `You are an expert editor for Lobby Market, a civic debate platform where binary topic statements are voted on by the community and the best ones become law.

TOPIC STATEMENT TO EVALUATE: "${statement.trim()}"${category ? `\nCATEGORY: ${category}` : ''}

A great topic statement on Lobby Market:
- Is a clear, binary claim (can be voted FOR or AGAINST)
- Is specific and falsifiable (not vague or overly broad)
- Has genuine civic or societal relevance
- Invites substantive debate from both sides
- Is actionable — a real decision-maker or policymaker could act on it

Evaluate this statement and respond with ONLY valid JSON (no markdown, no code fences):

{
  "score": <overall quality score 1–10 integer>,
  "summary": "<one punchy sentence: what makes this statement strong or weak>",
  "dimensions": [
    { "name": "Clarity", "score": <1-10>, "feedback": "<is it specific and unambiguous? 1-2 sentences>" },
    { "name": "Binary Feasibility", "score": <1-10>, "feedback": "<can it realistically be voted yes/no? 1-2 sentences>" },
    { "name": "Scope", "score": <1-10>, "feedback": "<is it appropriately scoped — not too broad, not too narrow? 1-2 sentences>" },
    { "name": "Debate Potential", "score": <1-10>, "feedback": "<will it generate genuine argument from both sides? 1-2 sentences>" },
    { "name": "Civic Impact", "score": <1-10>, "feedback": "<does it address something that actually matters to society? 1-2 sentences>" }
  ],
  "improvements": ["<specific, actionable improvement suggestion 1>", "<specific, actionable improvement suggestion 2>"],
  "improved_statement": "<a sharper version of the statement if the score is below 8, or null if it's already strong>"
}

Scoring guide:
- 9-10: Excellent — clear, binary, specific, and civically relevant. Ready to post.
- 7-8: Good — solid foundation, minor tweaks could sharpen it.
- 5-6: Needs Work — the idea is there but the phrasing needs improvement.
- 3-4: Poor — vague, not binary, or lacks civic relevance. Major revision needed.
- 1-2: Very Poor — not suitable as a civic topic statement.

Be honest but constructive. If the overall score is 8+, set improved_statement to null.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()

    // Strip any accidental markdown fences
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')

    let parsed: {
      score: number
      summary: string
      dimensions: QualityDimension[]
      improvements: string[]
      improved_statement: string | null
    }
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json({ unavailable: true }, { status: 200 })
    }

    const score = Math.max(1, Math.min(10, Math.round(parsed.score ?? 5)))

    const result: QualityCheckResponse = {
      score,
      tier: scoreToTier(score),
      summary: parsed.summary ?? '',
      dimensions: Array.isArray(parsed.dimensions) ? parsed.dimensions : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      improved_statement: parsed.improved_statement ?? null,
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ unavailable: true }, { status: 200 })
  }
}
