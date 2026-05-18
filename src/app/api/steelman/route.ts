import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SteelmanRequest {
  topic_id?: string | null
  statement: string
  category?: string | null
}

export interface SteelmanArgument {
  thesis: string
  core_claims: string[]
  strongest_evidence: string
  moral_foundation: string
  rebuttal_to_opposition: string
}

export interface SteelmanResult {
  statement: string
  category: string | null
  for_steelman: SteelmanArgument
  against_steelman: SteelmanArgument
  synthesis: string
  philosophical_tension: string
  community_vote: { blue_pct: number; total_votes: number } | null
  unavailable?: boolean
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert in the "steelman" technique — the practice of constructing the strongest possible version of any argument, even one you disagree with. You work for Lobby Market, a civic consensus platform.

Your task is to steelman BOTH sides of any civic policy debate. A steelman is the opposite of a strawman: it represents the best, most charitable, most intellectually rigorous version of a position.

Principles:
- Charitably interpret the goal behind each position
- Use the strongest evidence and most credible reasoning available
- Acknowledge the real values and concerns underlying each side
- Avoid caricature — represent each side as its smartest proponent would
- Be concise but substantive (2-3 sentences per field)
- The synthesis should identify what both sides actually agree on at a deeper level`

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureStr(val: unknown, fallback: string): string {
  return typeof val === 'string' && val.trim().length > 0 ? val.trim() : fallback
}

function ensureStrArr(val: unknown, fallback: string[]): string[] {
  if (!Array.isArray(val)) return fallback
  const filtered = val.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  return filtered.length > 0 ? filtered.slice(0, 4) : fallback
}

function parseArg(val: unknown): SteelmanArgument {
  const obj = val && typeof val === 'object' && !Array.isArray(val) ? (val as Record<string, unknown>) : {}
  return {
    thesis: ensureStr(obj.thesis, 'Analysis unavailable'),
    core_claims: ensureStrArr(obj.core_claims, ['Claim unavailable']),
    strongest_evidence: ensureStr(obj.strongest_evidence, 'Evidence unavailable'),
    moral_foundation: ensureStr(obj.moral_foundation, 'Foundation unavailable'),
    rebuttal_to_opposition: ensureStr(obj.rebuttal_to_opposition, 'Rebuttal unavailable'),
  }
}

// ─── POST /api/steelman ───────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ unavailable: true } satisfies Partial<SteelmanResult>, { status: 200 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: SteelmanRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const statement = body.statement?.trim()
  if (!statement || statement.length < 5) {
    return NextResponse.json({ error: 'Statement required' }, { status: 400 })
  }

  const category = body.category ?? null

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

  const userPrompt = `Civic policy statement: "${statement}"${category ? `\nCategory: ${category}` : ''}
${communityVote ? `\nCommunity vote: ${communityVote.blue_pct}% FOR out of ${communityVote.total_votes.toLocaleString()} votes` : ''}

Return ONLY a JSON object with EXACTLY this structure — no markdown fences, no extra keys:
{
  "for_steelman": {
    "thesis": "One-sentence summary of the strongest FOR position",
    "core_claims": ["claim1", "claim2", "claim3"],
    "strongest_evidence": "The most compelling empirical or historical evidence supporting this side",
    "moral_foundation": "The core value or ethical principle that best justifies this position",
    "rebuttal_to_opposition": "The steelman response to the strongest against-argument"
  },
  "against_steelman": {
    "thesis": "One-sentence summary of the strongest AGAINST position",
    "core_claims": ["claim1", "claim2", "claim3"],
    "strongest_evidence": "The most compelling empirical or historical evidence supporting this side",
    "moral_foundation": "The core value or ethical principle that best justifies this position",
    "rebuttal_to_opposition": "The steelman response to the strongest for-argument"
  },
  "synthesis": "What both sides fundamentally agree on at a deeper level — the shared value beneath the disagreement",
  "philosophical_tension": "The core value trade-off this debate represents (e.g., liberty vs security, efficiency vs equity)"
}`

  const client = new Anthropic()

  let raw: string
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const block = msg.content[0]
    raw = block.type === 'text' ? block.text.trim() : ''
  } catch {
    return NextResponse.json({ unavailable: true }, { status: 200 })
  }

  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    return NextResponse.json({ unavailable: true }, { status: 200 })
  }

  const result: SteelmanResult = {
    statement,
    category,
    for_steelman: parseArg(parsed.for_steelman),
    against_steelman: parseArg(parsed.against_steelman),
    synthesis: ensureStr(parsed.synthesis, 'Both sides seek a better society — they disagree on the path.'),
    philosophical_tension: ensureStr(parsed.philosophical_tension, 'Competing values'),
    community_vote: communityVote,
  }

  return NextResponse.json(result)
}
