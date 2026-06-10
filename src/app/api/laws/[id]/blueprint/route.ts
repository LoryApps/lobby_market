import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlueprintStep {
  phase: string
  title: string
  actions: string[]
  duration: string
}

export interface BlueprintStakeholder {
  group: string
  impact: 'positive' | 'negative' | 'mixed' | 'neutral'
  description: string
}

export interface BlueprintComparison {
  jurisdiction: string
  policy: string
  outcome: string
}

export interface LawBlueprint {
  summary: string
  steps: BlueprintStep[]
  stakeholders: BlueprintStakeholder[]
  resources: string[]
  challenges: string[]
  metrics: string[]
  comparisons: BlueprintComparison[]
  feasibility_score: number
  feasibility_label: string
  overall_outlook: 'optimistic' | 'cautious' | 'challenging' | 'uncertain'
}

export interface BlueprintResponse {
  blueprint: LawBlueprint | null
  generated_at: string | null
  law: {
    id: string
    statement: string
    category: string | null
    total_votes: number
    blue_pct: number
    established_at: string
  } | null
  unavailable?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function feasibilityLabel(score: number): string {
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

function ensureStrArray(val: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(val)) return fallback
  return val.filter((x) => typeof x === 'string').slice(0, 8)
}

function ensureOutlook(val: unknown): LawBlueprint['overall_outlook'] {
  if (val === 'optimistic' || val === 'cautious' || val === 'challenging' || val === 'uncertain') {
    return val
  }
  return 'uncertain'
}

function parseBlueprint(raw: unknown): LawBlueprint | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  const stepsRaw = Array.isArray(obj.steps) ? obj.steps : []
  const steps: BlueprintStep[] = stepsRaw
    .filter((s): s is Record<string, unknown> => s && typeof s === 'object')
    .slice(0, 5)
    .map((s) => ({
      phase: typeof s.phase === 'string' ? s.phase : 'Phase',
      title: typeof s.title === 'string' ? s.title : '',
      actions: ensureStrArray(s.actions),
      duration: typeof s.duration === 'string' ? s.duration : '',
    }))

  const stakeholdersRaw = Array.isArray(obj.stakeholders) ? obj.stakeholders : []
  const stakeholders: BlueprintStakeholder[] = stakeholdersRaw
    .filter((s): s is Record<string, unknown> => s && typeof s === 'object')
    .slice(0, 6)
    .map((s) => {
      const imp = s.impact
      const impact: BlueprintStakeholder['impact'] =
        imp === 'positive' || imp === 'negative' || imp === 'mixed' || imp === 'neutral'
          ? imp
          : 'neutral'
      return {
        group: typeof s.group === 'string' ? s.group : '',
        impact,
        description: typeof s.description === 'string' ? s.description : '',
      }
    })

  const comparisonsRaw = Array.isArray(obj.comparisons) ? obj.comparisons : []
  const comparisons: BlueprintComparison[] = comparisonsRaw
    .filter((c): c is Record<string, unknown> => c && typeof c === 'object')
    .slice(0, 4)
    .map((c) => ({
      jurisdiction: typeof c.jurisdiction === 'string' ? c.jurisdiction : '',
      policy: typeof c.policy === 'string' ? c.policy : '',
      outcome: typeof c.outcome === 'string' ? c.outcome : '',
    }))

  const feasibility_score = clamp(obj.feasibility_score, 0, 100)

  return {
    summary: typeof obj.summary === 'string' ? obj.summary : '',
    steps,
    stakeholders,
    resources: ensureStrArray(obj.resources),
    challenges: ensureStrArray(obj.challenges),
    metrics: ensureStrArray(obj.metrics),
    comparisons,
    feasibility_score,
    feasibility_label: feasibilityLabel(feasibility_score),
    overall_outlook: ensureOutlook(obj.overall_outlook),
  }
}

const SYSTEM_PROMPT = `You are a neutral senior policy analyst for Lobby Market, a civic consensus platform.
You write clear, practical implementation blueprints for laws that have been passed by community consensus.
Your analysis is objective, thorough, and grounded in real-world governance experience.

Guidelines:
- Focus on HOW the law could be implemented, not WHETHER it should be
- Be specific about phases, timelines, and required resources
- Identify real stakeholder groups with concrete impacts
- Reference comparable real-world policies when relevant
- Acknowledge implementation challenges honestly
- Keep language accessible but precise
- Each action in a step should be a single concrete deliverable`

// ─── GET — return cached blueprint ────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const lawId = params.id

  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, total_votes, blue_pct, established_at')
    .eq('id', lawId)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      blueprint: null,
      generated_at: null,
      law,
      unavailable: true,
    } satisfies BlueprintResponse)
  }

  const { data: cached } = await supabase
    .from('law_blueprints')
    .select('blueprint_json, generated_at')
    .eq('law_id', lawId)
    .maybeSingle()

  if (cached) {
    return NextResponse.json({
      blueprint: parseBlueprint(cached.blueprint_json),
      generated_at: cached.generated_at,
      law,
    } satisfies BlueprintResponse)
  }

  return NextResponse.json({
    blueprint: null,
    generated_at: null,
    law,
  } satisfies BlueprintResponse)
}

// ─── POST — generate blueprint ────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const lawId = params.id

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, total_votes, blue_pct, established_at')
    .eq('id', lawId)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // Fetch top arguments from the source topic for context
  const { data: topicRow } = await supabase
    .from('topics')
    .select('id, description')
    .eq('statement', law.statement)
    .maybeSingle()

  let topArguments: Array<{ content: string; side: string; upvotes: number }> = []
  if (topicRow?.id) {
    const { data: args } = await supabase
      .from('arguments')
      .select('content, side, upvotes')
      .eq('topic_id', topicRow.id)
      .order('upvotes', { ascending: false })
      .limit(8)
    topArguments = args ?? []
  }

  const forPct = Math.round(law.blue_pct ?? 66)
  const againstPct = 100 - forPct

  const argumentsBlock = topArguments.length > 0
    ? `\n\nTop community arguments:\n${topArguments
        .map((a) => `- [${a.side === 'blue' ? 'FOR' : 'AGAINST'}] ${a.content.slice(0, 200)}`)
        .join('\n')}`
    : ''

  const prompt = `Generate a detailed implementation blueprint for this civic law that was passed by community consensus.

LAW: "${law.statement}"
Category: ${law.category ?? 'General'}
Community vote: ${forPct}% FOR / ${againstPct}% AGAINST
Total votes: ${law.total_votes?.toLocaleString() ?? 'unknown'}
Established: ${new Date(law.established_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}${argumentsBlock}

Respond with a JSON object matching this exact structure:
{
  "summary": "2-3 sentence plain-English summary of what implementation would look like",
  "steps": [
    {
      "phase": "Phase 1",
      "title": "Short phase title",
      "actions": ["Specific concrete action 1", "Action 2", "Action 3"],
      "duration": "e.g. 3-6 months"
    }
  ],
  "stakeholders": [
    {
      "group": "Stakeholder group name",
      "impact": "positive|negative|mixed|neutral",
      "description": "Specific impact on this group"
    }
  ],
  "resources": ["Resource/requirement 1", "Resource 2"],
  "challenges": ["Challenge/obstacle 1", "Challenge 2"],
  "metrics": ["How to measure success 1", "Metric 2"],
  "comparisons": [
    {
      "jurisdiction": "Country/State name",
      "policy": "Name of comparable policy",
      "outcome": "What happened"
    }
  ],
  "feasibility_score": 0-100,
  "overall_outlook": "optimistic|cautious|challenging|uncertain"
}

Return ONLY the JSON object. No markdown, no explanation.`

  const client = new Anthropic()

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const rawText = message.content[0]?.type === 'text' ? message.content[0].text : ''

  let parsed: LawBlueprint | null = null
  try {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = parseBlueprint(JSON.parse(jsonMatch[0]))
    }
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }

  if (!parsed) {
    return NextResponse.json({ error: 'Invalid AI response' }, { status: 500 })
  }

  // Cache in DB (upsert)
  await supabase
    .from('law_blueprints')
    .upsert(
      {
        law_id: lawId,
        blueprint_json: parsed as unknown as Record<string, unknown>,
        model: 'claude-sonnet-4-6',
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'law_id' }
    )

  return NextResponse.json({
    blueprint: parsed,
    generated_at: new Date().toISOString(),
    law,
  } satisfies BlueprintResponse)
}
