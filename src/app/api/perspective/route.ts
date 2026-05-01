import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PerspectiveRequest {
  topic_id: string
  topic_statement: string
  category: string | null
  user_side: 'for' | 'against'
  community_for_pct: number
  total_votes: number
}

export interface PerspectiveKeyPoint {
  point: string
  explanation: string
}

export interface PerspectiveResponse {
  opposing_side: 'for' | 'against'
  steel_man: string
  key_points: PerspectiveKeyPoint[]
  factual_claims: string[]
  common_ground: string
  blind_spot: string
  strength_rating: number
  unavailable?: boolean
}

// ─── POST /api/perspective ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { unavailable: true } satisfies Partial<PerspectiveResponse>,
      { status: 200 },
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: PerspectiveRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { topic_statement, category, user_side, community_for_pct, total_votes } = body

  if (!topic_statement || !user_side) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const opposingSide = user_side === 'for' ? 'AGAINST' : 'FOR'
  const userSideLabel = user_side === 'for' ? 'FOR (supporting)' : 'AGAINST (opposing)'
  const communityAgainstPct = 100 - community_for_pct

  const prompt = `You are a Socratic civic philosopher on Lobby Market, a platform dedicated to reducing political echo chambers.

A user voted ${userSideLabel} this civic topic:
"${topic_statement}"${category ? `\nCategory: ${category}` : ''}

Community split: ${Math.round(community_for_pct)}% FOR / ${Math.round(communityAgainstPct)}% AGAINST (${total_votes.toLocaleString()} total votes)

Your task: Generate the most HONEST and COMPELLING case for the ${opposingSide} position. This should be the best possible argument someone who holds that view would make — not a strawman, but a genuine steel-man.

Respond with ONLY valid JSON (no markdown, no code fences, no preamble):

{
  "steel_man": "<The strongest 2-3 sentence articulation of the ${opposingSide} position — what a thoughtful, well-informed opponent would say. Avoid dismissive framing; make it genuinely persuasive.>",
  "key_points": [
    { "point": "<short title for key argument 1>", "explanation": "<1-2 sentence elaboration>" },
    { "point": "<short title for key argument 2>", "explanation": "<1-2 sentence elaboration>" },
    { "point": "<short title for key argument 3>", "explanation": "<1-2 sentence elaboration>" }
  ],
  "factual_claims": [
    "<A verifiable claim or evidence type the ${opposingSide} side would cite>",
    "<Another factual basis the opposition uses>",
    "<A third factual or empirical argument they would make>"
  ],
  "common_ground": "<1-2 sentences on what BOTH sides actually agree on beneath the disagreement — shared values or goals, even if methods differ>",
  "blind_spot": "<1-2 sentences on what someone voting ${userSideLabel} might be missing, underweighting, or not fully considering — be specific and honest, not condescending>",
  "strength_rating": <integer 1-10, how strong the ${opposingSide} case genuinely is on its merits>
}

Be intellectually honest. If the opposing case is genuinely strong (8-10), say so. If it is weak (1-4), still present the best version of it.`

  const client = new Anthropic()

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text in response')
    }

    const raw = textBlock.text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(raw) as Omit<PerspectiveResponse, 'opposing_side'>

    if (
      !parsed.steel_man ||
      !Array.isArray(parsed.key_points) ||
      !Array.isArray(parsed.factual_claims) ||
      !parsed.common_ground ||
      !parsed.blind_spot ||
      typeof parsed.strength_rating !== 'number'
    ) {
      throw new Error('Invalid response shape')
    }

    const response: PerspectiveResponse = {
      opposing_side: user_side === 'for' ? 'against' : 'for',
      ...parsed,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[perspective] Claude error:', err)
    return NextResponse.json({ error: 'AI generation failed' }, { status: 502 })
  }
}
