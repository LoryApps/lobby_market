import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CivicValue {
  id: string
  name: string
  tagline: string
  description: string
  principle: string
  strength: 'foundational' | 'strong' | 'emerging'
  law_count: number
  supporting_laws: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
  }[]
  categories: string[]
  spectrum: 'individual' | 'collective' | 'institutional' | 'procedural'
}

export interface ValuesResult {
  values: CivicValue[]
  total_laws_analyzed: number
  generated_at: string
  summary: string
  unavailable?: boolean
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a political philosopher analyzing a democratic community's established laws to identify the underlying civic values they collectively express.

Your task: given a list of laws that a civic platform community has passed by democratic vote, identify 6–8 core civic values that pattern through them. Each value should be grounded in multiple laws, not invented.

Return a JSON object with this exact structure:
{
  "values": [
    {
      "name": "Value Name (2-3 words, title case)",
      "tagline": "A single punchy sentence of 8-12 words",
      "description": "2-3 sentences explaining this value as expressed in community law",
      "principle": "A single declarative sentence starting with 'The community believes...'",
      "strength": "foundational | strong | emerging",
      "law_indices": [1, 3, 7],
      "categories": ["Economics", "Politics"],
      "spectrum": "individual | collective | institutional | procedural"
    }
  ],
  "summary": "2-3 sentence synthesis of the community's overall civic identity"
}

Guidelines:
- Name values as political/civic concepts (e.g. "Democratic Accountability", "Individual Liberty", "Public Welfare", "Transparent Governance")
- "foundational" = supported by 5+ laws or spans 3+ categories
- "strong" = 3-4 laws or 2 categories
- "emerging" = 1-2 laws, limited category spread
- law_indices are 1-based references to the laws list provided
- Limit to 5 law_indices per value (the most representative)
- spectrum: "individual" = rights/freedoms, "collective" = shared interests, "institutional" = governance/process, "procedural" = fairness/rules
- Be analytical, not prescriptive — report what the laws REVEAL, not what they should say`

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Fetch established laws — prefer high-consensus, high-vote laws for richer signal
  const { data: laws, error } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at')
    .eq('is_active', true)
    .order('total_votes', { ascending: false })
    .limit(60)

  if (error || !laws || laws.length === 0) {
    return NextResponse.json({ unavailable: true } satisfies Partial<ValuesResult>, { status: 200 })
  }

  // Build numbered law list for prompt
  const lawList = laws
    .map(
      (l, i) =>
        `${i + 1}. [${l.category ?? 'General'}] "${l.statement}" (${Math.round(l.blue_pct ?? 50)}% for, ${l.total_votes ?? 0} votes)`,
    )
    .join('\n')

  const userPrompt = `Analyze these ${laws.length} democratically-established civic laws and identify the underlying values they express:\n\n${lawList}\n\nReturn the JSON analysis.`

  const client = new Anthropic()

  let raw: string
  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })
    raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  } catch {
    return NextResponse.json({ unavailable: true } satisfies Partial<ValuesResult>, { status: 200 })
  }

  // Strip markdown fences
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  let parsed: {
    values?: Array<{
      name?: unknown
      tagline?: unknown
      description?: unknown
      principle?: unknown
      strength?: unknown
      law_indices?: unknown[]
      categories?: unknown[]
      spectrum?: unknown
    }>
    summary?: unknown
  }

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
  } catch {
    return NextResponse.json({ unavailable: true } satisfies Partial<ValuesResult>, { status: 200 })
  }

  function safeStr(v: unknown, max = 500, fallback = ''): string {
    return typeof v === 'string' ? v.slice(0, max) : fallback
  }

  function safeStrength(v: unknown): CivicValue['strength'] {
    return v === 'foundational' || v === 'strong' || v === 'emerging' ? v : 'emerging'
  }

  function safeSpectrum(v: unknown): CivicValue['spectrum'] {
    return v === 'individual' || v === 'collective' || v === 'institutional' || v === 'procedural'
      ? v
      : 'collective'
  }

  const values: CivicValue[] = []
  const rawValues = Array.isArray(parsed.values) ? parsed.values : []

  for (const rv of rawValues.slice(0, 8)) {
    const indices: number[] = Array.isArray(rv.law_indices)
      ? rv.law_indices
          .filter((x) => typeof x === 'number')
          .map((x) => Number(x) - 1) // convert to 0-based
          .filter((x) => x >= 0 && x < laws.length)
          .slice(0, 5)
      : []

    const supportingLaws = indices.map((i) => ({
      id: laws[i].id,
      statement: laws[i].statement.slice(0, 150),
      category: laws[i].category ?? null,
      blue_pct: laws[i].blue_pct ?? 50,
    }))

    const cats: string[] = Array.isArray(rv.categories)
      ? rv.categories.filter((c) => typeof c === 'string').map((c) => String(c))
      : []

    values.push({
      id: String(values.length + 1),
      name: safeStr(rv.name, 40, 'Civic Value'),
      tagline: safeStr(rv.tagline, 100, ''),
      description: safeStr(rv.description, 600, ''),
      principle: safeStr(rv.principle, 300, ''),
      strength: safeStrength(rv.strength),
      law_count: supportingLaws.length,
      supporting_laws: supportingLaws,
      categories: cats.slice(0, 4),
      spectrum: safeSpectrum(rv.spectrum),
    })
  }

  const result: ValuesResult = {
    values,
    total_laws_analyzed: laws.length,
    generated_at: new Date().toISOString(),
    summary: safeStr(parsed.summary, 600, 'The community\'s laws reflect a complex civic identity spanning multiple value traditions.'),
  }

  return NextResponse.json(result)
}
