import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SimulateRequest {
  statement: string
  category?: string | null
  topic_id?: string | null
}

export interface SimulationResult {
  statement: string
  short_term: string[]
  long_term: string[]
  beneficiaries: string[]
  harmed: string[]
  precedents: string[]
  risks: string[]
  viability_score: number
  viability_label: string
  overall_balance: 'positive' | 'mixed' | 'negative' | 'uncertain'
  community_vote?: { blue_pct: number; total_votes: number } | null
  unavailable?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function viabilityLabel(score: number): string {
  if (score >= 80) return 'Highly Feasible'
  if (score >= 60) return 'Moderately Feasible'
  if (score >= 40) return 'Challenging'
  if (score >= 20) return 'Very Difficult'
  return 'Near-Impossible'
}

function clamp(n: unknown, min: number, max: number): number {
  const num = typeof n === 'number' ? n : parseInt(String(n), 10)
  if (isNaN(num)) return min
  return Math.max(min, Math.min(max, num))
}

function ensureStrArray(val: unknown, fallback: string[]): string[] {
  if (!Array.isArray(val)) return fallback
  return val.filter((x) => typeof x === 'string').slice(0, 6)
}

function ensureBalance(val: unknown): SimulationResult['overall_balance'] {
  if (val === 'positive' || val === 'mixed' || val === 'negative' || val === 'uncertain') {
    return val
  }
  return 'uncertain'
}

const SYSTEM_PROMPT = `You are a neutral policy analyst for Lobby Market, a civic consensus platform. Your role is to analyze policy proposals objectively, exploring plausible real-world consequences without taking a political side.

Guidelines:
- Be specific and evidence-based, not vague or generic
- Acknowledge uncertainty where it exists
- Consider diverse stakeholders: workers, consumers, businesses, governments, communities
- Draw on real historical policy analogies when relevant
- Keep each bullet to 1-2 concise sentences
- Be honest about tradeoffs — no policy is purely beneficial or purely harmful
- Score viability based on political feasibility, implementation complexity, and resource requirements`

// ─── POST /api/simulate ────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { unavailable: true } satisfies Partial<SimulationResult>,
      { status: 200 },
    )
  }

  // Require authentication
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: SimulateRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const statement = body.statement?.trim()
  if (!statement || statement.length < 10) {
    return NextResponse.json({ error: 'Statement too short' }, { status: 400 })
  }
  if (statement.length > 500) {
    return NextResponse.json({ error: 'Statement too long' }, { status: 400 })
  }

  const category = body.category?.trim() || null

  // Optionally fetch community vote data if a real topic_id was provided
  let communityVote: { blue_pct: number; total_votes: number } | null = null
  if (body.topic_id) {
    const { data } = await supabase
      .from('topics')
      .select('blue_pct, total_votes')
      .eq('id', body.topic_id)
      .maybeSingle()
    if (data?.total_votes) {
      communityVote = { blue_pct: data.blue_pct ?? 50, total_votes: data.total_votes }
    }
  }

  const userPrompt = `Policy proposal: "${statement}"${category ? `\nCategory: ${category}` : ''}
${communityVote ? `\nCommunity sentiment: ${communityVote.blue_pct}% FOR out of ${communityVote.total_votes.toLocaleString()} votes` : ''}

Return a JSON object with EXACTLY this structure — no markdown, no extra keys, no explanation:
{
  "short_term": ["effect1", "effect2", "effect3"],
  "long_term": ["effect1", "effect2", "effect3"],
  "beneficiaries": ["group1", "group2", "group3"],
  "harmed": ["group1", "group2", "group3"],
  "precedents": ["example1", "example2"],
  "risks": ["risk1", "risk2", "risk3"],
  "viability_score": 65,
  "overall_balance": "mixed"
}

Rules:
- short_term: 3-5 effects likely within 0-2 years of implementation
- long_term: 3-5 effects likely after 2+ years
- beneficiaries: 3-5 specific groups that would gain, with brief why
- harmed: 3-5 specific groups that face challenges or costs, with brief why
- precedents: 2-4 real historical policies or programs with comparable effects (country + year if known)
- risks: 3-5 major implementation or unintended-consequence risks
- viability_score: integer 1-100 reflecting political & logistical feasibility
- overall_balance: one of "positive", "mixed", "negative", "uncertain"`

  const client = new Anthropic()

  let raw: string
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const block = msg.content[0]
    raw = block.type === 'text' ? block.text.trim() : ''
  } catch {
    return NextResponse.json({ unavailable: true }, { status: 200 })
  }

  // Strip optional markdown fences
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NextResponse.json({ unavailable: true }, { status: 200 })
  }

  const score = clamp(parsed.viability_score, 1, 100)

  const result: SimulationResult = {
    statement,
    short_term: ensureStrArray(parsed.short_term, ['Analysis unavailable']),
    long_term: ensureStrArray(parsed.long_term, ['Analysis unavailable']),
    beneficiaries: ensureStrArray(parsed.beneficiaries, []),
    harmed: ensureStrArray(parsed.harmed, []),
    precedents: ensureStrArray(parsed.precedents, []),
    risks: ensureStrArray(parsed.risks, []),
    viability_score: score,
    viability_label: viabilityLabel(score),
    overall_balance: ensureBalance(parsed.overall_balance),
    community_vote: communityVote,
  }

  return NextResponse.json(result)
}
