import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategorizeRequest {
  statement: string
}

export interface CategorizeResponse {
  category: string
  scope: string
  description: string
  unavailable?: boolean
}

const CATEGORIES = [
  'Politics',
  'Technology',
  'Ethics',
  'Culture',
  'Economics',
  'Science',
  'Philosophy',
  'Health',
  'Environment',
  'Education',
  'Other',
] as const

const SCOPES = ['Global', 'National', 'Regional', 'Local'] as const

// ─── POST /api/topics/categorize ──────────────────────────────────────────────
// Analyzes a topic statement via Claude and returns a suggested category,
// geographic scope, and 2-3 sentence neutral context description.

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { category: '', scope: '', description: '', unavailable: true } satisfies CategorizeResponse,
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CategorizeRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { statement } = body

  if (!statement || statement.trim().length < 10) {
    return NextResponse.json({ error: 'Statement too short' }, { status: 400 })
  }

  if (statement.trim().length > 500) {
    return NextResponse.json({ error: 'Statement too long' }, { status: 400 })
  }

  const prompt = `You are an expert at categorizing civic policy statements for the Lobby Market debate platform.

Analyze this statement and respond with ONLY a JSON object — no markdown, no code fences:

Statement: "${statement.trim()}"

{
  "category": "<exactly one of: ${CATEGORIES.join(' | ')}>",
  "scope": "<exactly one of: ${SCOPES.join(' | ')}>",
  "description": "<2–3 sentences of objective, neutral background context. State what the topic concerns, why it is debated, and what key tradeoffs or considerations voters should know. Do NOT take a side.>"
}

Category guide:
- Politics: government structure, elections, parties, democracy, public administration
- Economics: markets, trade, taxation, finance, wages, employment, inequality
- Technology: AI, internet, digital rights, platforms, automation, data privacy
- Science: research funding, climate science, medical discoveries, space, evidence-based policy
- Ethics: moral obligations, human rights, justice, fairness principles, bioethics
- Philosophy: foundational values, social contract, liberty vs collective good, meaning
- Culture: arts, media, social norms, identity, religion in public life, language
- Health: public health systems, healthcare access, medicine, mental health, nutrition
- Environment: climate action, biodiversity, pollution, natural resources, sustainability
- Education: schools, universities, curricula, access, student debt, teacher standards
- Other: only if genuinely cross-cutting across 3+ categories with no clear primary

Scope guide:
- Global: concerns all nations or international institutions
- National: concerns one country as a whole
- Regional: concerns a specific region, state, province, or city
- Local: concerns a specific neighbourhood or community`

  const client = new Anthropic()

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text block in Claude response')
    }

    const raw = textBlock.text.trim()
    // Strip optional code fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    const parsed = JSON.parse(cleaned) as { category: string; scope: string; description: string }

    const category = (CATEGORIES as readonly string[]).includes(parsed.category)
      ? parsed.category
      : 'Other'
    const scope = (SCOPES as readonly string[]).includes(parsed.scope) ? parsed.scope : 'Global'
    const description =
      typeof parsed.description === 'string' ? parsed.description.slice(0, 1500).trim() : ''

    return NextResponse.json({ category, scope, description } satisfies CategorizeResponse)
  } catch (err) {
    console.error('[categorize] Claude error:', err)
    return NextResponse.json({ error: 'AI categorization failed' }, { status: 502 })
  }
}
