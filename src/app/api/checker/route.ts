import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Verdict = 'SUPPORTED' | 'CONTRADICTED' | 'MIXED' | 'NOT_COVERED'

export interface RelevantLaw {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  relation: 'supports' | 'contradicts' | 'neutral'
  explanation: string
}

export interface CheckerResult {
  claim: string
  verdict: Verdict
  confidence: number
  summary: string
  relevant_laws: RelevantLaw[]
  laws_checked: number
  unavailable?: boolean
  error?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeStr(val: unknown, max: number, fallback: string): string {
  if (typeof val !== 'string' || !val.trim()) return fallback
  return val.slice(0, max)
}

function safeVerdict(val: unknown): Verdict {
  if (val === 'SUPPORTED' || val === 'CONTRADICTED' || val === 'MIXED' || val === 'NOT_COVERED') {
    return val
  }
  return 'NOT_COVERED'
}

function safeRelation(val: unknown): 'supports' | 'contradicts' | 'neutral' {
  if (val === 'supports' || val === 'contradicts' || val === 'neutral') return val
  return 'neutral'
}

function safeNumber(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' ? val : parseFloat(String(val))
  if (isNaN(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

// ─── POST /api/checker ────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ unavailable: true } satisfies Partial<CheckerResult>, { status: 200 })
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { claim?: string; category?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const claim = (body.claim ?? '').trim()
  if (!claim || claim.length < 10) {
    return NextResponse.json({ error: 'Claim too short' }, { status: 400 })
  }
  if (claim.length > 500) {
    return NextResponse.json({ error: 'Claim too long (max 500 chars)' }, { status: 400 })
  }

  // ── 1. Fetch established laws from Codex ───────────────────────────────────
  let lawQuery = supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes')
    .eq('status', 'law')
    .order('total_votes', { ascending: false })
    .limit(60)

  if (body.category && body.category !== 'All') {
    lawQuery = supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes')
      .eq('status', 'law')
      .eq('category', body.category)
      .order('total_votes', { ascending: false })
      .limit(60)
  }

  const { data: laws } = await lawQuery

  if (!laws || laws.length === 0) {
    const result: CheckerResult = {
      claim,
      verdict: 'NOT_COVERED',
      confidence: 0,
      summary: 'No established laws found in the Codex to check this claim against.',
      relevant_laws: [],
      laws_checked: 0,
    }
    return NextResponse.json(result)
  }

  // ── 2. Call Claude ─────────────────────────────────────────────────────────
  const client = new Anthropic()

  const lawList = laws
    .map((l, i) => `[LAW-${i + 1}] (${l.category ?? 'General'}, ${l.blue_pct ?? 50}% For, ${l.total_votes ?? 0} votes): "${l.statement}"`)
    .join('\n')

  const prompt = `You are a civic fact-checker for Lobby Market. Check the following CLAIM against the established LAWS in the Codex (laws the community voted into consensus).

CLAIM: "${claim}"

ESTABLISHED LAWS (${laws.length}):
${lawList}

Your task:
1. Determine the overall VERDICT:
   - SUPPORTED: The claim aligns with or is backed by multiple laws
   - CONTRADICTED: The claim directly conflicts with established laws
   - MIXED: Some laws support it, others contradict it
   - NOT_COVERED: The Codex has no relevant laws on this topic

2. Identify up to 5 most relevant laws and explain each one's relation to the claim.

3. Assign a confidence score (0-100) reflecting how strongly the laws support your verdict.

Return ONLY valid JSON with exactly this shape:
{
  "verdict": "SUPPORTED" | "CONTRADICTED" | "MIXED" | "NOT_COVERED",
  "confidence": <integer 0-100>,
  "summary": "<2-3 sentence neutral explanation of the verdict, citing specific law themes> (max 300 chars)",
  "relevant_laws": [
    {
      "law_index": <1-based index from the law list>,
      "relation": "supports" | "contradicts" | "neutral",
      "explanation": "<1-2 sentences explaining the connection> (max 200 chars)"
    }
  ]
}

Be objective and neutral. Focus on what the community has actually voted on, not your own opinions.`

  let raw: string
  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    raw = message.content[0].type === 'text' ? message.content[0].text : ''
  } catch {
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 })
  }

  // ── 3. Parse Claude's response ─────────────────────────────────────────────
  let parsed: {
    verdict?: unknown
    confidence?: unknown
    summary?: unknown
    relevant_laws?: Array<{
      law_index?: unknown
      relation?: unknown
      explanation?: unknown
    }>
  }

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
  } catch {
    parsed = {}
  }

  const verdict = safeVerdict(parsed.verdict)
  const confidence = safeNumber(parsed.confidence, 0, 100, 0)
  const summary = safeStr(parsed.summary, 300, 'Unable to determine a verdict from the available laws.')

  const relevantLaws: RelevantLaw[] = []
  if (Array.isArray(parsed.relevant_laws)) {
    for (const item of parsed.relevant_laws.slice(0, 5)) {
      const idx = typeof item?.law_index === 'number' ? item.law_index - 1 : -1
      const law = laws[idx]
      if (!law) continue
      relevantLaws.push({
        id: law.id,
        statement: law.statement,
        category: law.category ?? null,
        blue_pct: law.blue_pct ?? 50,
        total_votes: law.total_votes ?? 0,
        relation: safeRelation(item?.relation),
        explanation: safeStr(item?.explanation, 200, ''),
      })
    }
  }

  const result: CheckerResult = {
    claim,
    verdict,
    confidence,
    summary,
    relevant_laws: relevantLaws,
    laws_checked: laws.length,
  }

  return NextResponse.json(result)
}
