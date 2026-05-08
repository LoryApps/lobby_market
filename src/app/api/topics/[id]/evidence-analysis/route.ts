import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MIN_EVIDENCE_REQUIRED = 3

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvidenceAnalysisResponse {
  quality_score: number | null
  bias_score: number | null
  evidence_count: number
  for_count: number
  against_count: number
  neutral_count: number
  strongest_for: string | null
  strongest_against: string | null
  missing_perspective: string | null
  key_claim: string | null
  summary: string | null
  generated_at: string | null
  unavailable?: boolean
  insufficient_data?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface EvidenceRow {
  title: string
  url: string
  domain: string | null
  side: string
  upvotes: number
  description: string | null
}

function evidenceHash(items: EvidenceRow[]): string {
  let h = 0
  for (const e of items) {
    const s = `${e.title}${e.url}${e.side}${e.upvotes}`
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0
    }
  }
  return h.toString(16).padStart(8, '0')
}

// ─── GET — return cached analysis ────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      quality_score: null, bias_score: null,
      evidence_count: 0, for_count: 0, against_count: 0, neutral_count: 0,
      strongest_for: null, strongest_against: null,
      missing_perspective: null, key_claim: null, summary: null,
      generated_at: null, unavailable: true,
    } satisfies EvidenceAnalysisResponse)
  }

  const supabase = await createClient()

  const { data: cached } = await supabase
    .from('topic_evidence_analysis')
    .select('*')
    .eq('topic_id', params.id)
    .maybeSingle()

  if (!cached) {
    return NextResponse.json({
      quality_score: null, bias_score: null,
      evidence_count: 0, for_count: 0, against_count: 0, neutral_count: 0,
      strongest_for: null, strongest_against: null,
      missing_perspective: null, key_claim: null, summary: null,
      generated_at: null,
    } satisfies EvidenceAnalysisResponse)
  }

  return NextResponse.json({
    quality_score: cached.quality_score,
    bias_score: cached.bias_score,
    evidence_count: cached.evidence_count,
    for_count: cached.for_count,
    against_count: cached.against_count,
    neutral_count: cached.neutral_count,
    strongest_for: cached.strongest_for ?? null,
    strongest_against: cached.strongest_against ?? null,
    missing_perspective: cached.missing_perspective,
    key_claim: cached.key_claim,
    summary: cached.summary,
    generated_at: cached.generated_at,
  } satisfies EvidenceAnalysisResponse)
}

// ─── POST — generate (or refresh) analysis ────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI analysis not configured.' }, { status: 503 })
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes')
    .eq('id', params.id)
    .single()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const { data: evidenceRows } = await supabase
    .from('topic_evidence')
    .select('title, url, domain, side, upvotes, description')
    .eq('topic_id', params.id)
    .order('upvotes', { ascending: false })
    .limit(30)

  const items = (evidenceRows ?? []) as EvidenceRow[]

  if (items.length < MIN_EVIDENCE_REQUIRED) {
    return NextResponse.json(
      { error: 'insufficient_data', message: 'Not enough evidence items to analyze.' },
      { status: 422 }
    )
  }

  const hash = evidenceHash(items)

  const { data: existing } = await supabase
    .from('topic_evidence_analysis')
    .select('evidence_hash, quality_score, bias_score, evidence_count, for_count, against_count, neutral_count, strongest_for, strongest_against, missing_perspective, key_claim, summary, generated_at')
    .eq('topic_id', params.id)
    .maybeSingle()

  if (existing?.evidence_hash === hash) {
    return NextResponse.json({
      quality_score: existing.quality_score,
      bias_score: existing.bias_score,
      evidence_count: existing.evidence_count,
      for_count: existing.for_count,
      against_count: existing.against_count,
      neutral_count: existing.neutral_count,
      strongest_for: existing.strongest_for ?? null,
      strongest_against: existing.strongest_against ?? null,
      missing_perspective: existing.missing_perspective,
      key_claim: existing.key_claim,
      summary: existing.summary,
      generated_at: existing.generated_at,
    } satisfies EvidenceAnalysisResponse)
  }

  const forItems = items.filter((e) => e.side === 'for')
  const againstItems = items.filter((e) => e.side === 'against')
  const neutralItems = items.filter((e) => e.side === 'neutral')
  const forPct = Math.round(topic.blue_pct ?? 50)

  const formatItem = (e: EvidenceRow) =>
    `- "${e.title}" (${e.domain ?? 'unknown source'}, ${e.upvotes} upvotes${e.description ? ` — ${e.description}` : ''})`

  const prompt = `You are a civic fact-checker and research analyst evaluating the community evidence submitted for a debate.

TOPIC: "${topic.statement}"
CATEGORY: ${topic.category ?? 'General'}
CURRENT CONSENSUS: ${forPct}% FOR / ${100 - forPct}% AGAINST (${topic.total_votes ?? 0} votes)

EVIDENCE FOR (${forItems.length} items):
${forItems.length > 0 ? forItems.map(formatItem).join('\n') : '(none submitted)'}

EVIDENCE AGAINST (${againstItems.length} items):
${againstItems.length > 0 ? againstItems.map(formatItem).join('\n') : '(none submitted)'}

NEUTRAL EVIDENCE (${neutralItems.length} items):
${neutralItems.length > 0 ? neutralItems.map(formatItem).join('\n') : '(none submitted)'}

Analyze the evidence pool and respond with EXACTLY this JSON (no markdown, no extra text):
{
  "quality_score": <integer 0-10: overall evidence quality — 0 = all low-quality sources, 10 = all high-quality peer-reviewed/official sources>,
  "bias_score": <integer 0-10: how one-sided is the evidence pool? 0 = extremely one-sided, 10 = perfectly balanced>,
  "strongest_for": <string or null: title of the single most compelling FOR evidence item, or null if none>,
  "strongest_against": <string or null: title of the single most compelling AGAINST evidence item, or null if none>,
  "missing_perspective": <string: 1 sentence describing the most important type of evidence or viewpoint that is NOT yet represented>,
  "key_claim": <string: 1 sentence describing the most important factual claim that the evidence collectively supports or refutes>,
  "summary": <string: 2-3 sentences assessing the overall strength and balance of the evidence base — what does the community have, and what's missing?>
}

Scoring guidelines:
- quality_score: academic papers/gov data = 8-10; established news = 6-7; blogs/advocacy = 3-5; unreliable = 0-2
- bias_score: count items on each side; if FOR:AGAINST ratio is 1:1 = 10; 2:1 = 7; 3:1 = 4; all one side = 0
- Be specific and actionable in missing_perspective
- Do not take sides on the debate topic itself`

  const client = new Anthropic()

  let parsed: {
    quality_score: number
    bias_score: number
    strongest_for: string | null
    strongest_against: string | null
    missing_perspective: string
    key_claim: string
    summary: string
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No text in response')

    const raw = textBlock.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    parsed = JSON.parse(raw)

    if (
      typeof parsed.quality_score !== 'number' ||
      typeof parsed.bias_score !== 'number' ||
      !parsed.missing_perspective ||
      !parsed.key_claim ||
      !parsed.summary
    ) {
      throw new Error('Incomplete analysis fields')
    }

    // Clamp scores to valid range
    parsed.quality_score = Math.max(0, Math.min(10, Math.round(parsed.quality_score)))
    parsed.bias_score = Math.max(0, Math.min(10, Math.round(parsed.bias_score)))
  } catch (err) {
    console.error('[evidence-analysis] Claude error:', err)
    return NextResponse.json({ error: 'AI generation failed' }, { status: 502 })
  }

  const now = new Date().toISOString()
  await supabase.from('topic_evidence_analysis').upsert(
    {
      topic_id: params.id,
      quality_score: parsed.quality_score,
      bias_score: parsed.bias_score,
      evidence_count: items.length,
      for_count: forItems.length,
      against_count: againstItems.length,
      neutral_count: neutralItems.length,
      strongest_for: parsed.strongest_for ?? null,
      strongest_against: parsed.strongest_against ?? null,
      missing_perspective: parsed.missing_perspective,
      key_claim: parsed.key_claim,
      summary: parsed.summary,
      evidence_hash: hash,
      model: 'claude-sonnet-4-6',
      generated_at: now,
    },
    { onConflict: 'topic_id' }
  )

  return NextResponse.json({
    quality_score: parsed.quality_score,
    bias_score: parsed.bias_score,
    evidence_count: items.length,
    for_count: forItems.length,
    against_count: againstItems.length,
    neutral_count: neutralItems.length,
    strongest_for: parsed.strongest_for ?? null,
    strongest_against: parsed.strongest_against ?? null,
    missing_perspective: parsed.missing_perspective,
    key_claim: parsed.key_claim,
    summary: parsed.summary,
    generated_at: now,
  } satisfies EvidenceAnalysisResponse)
}
