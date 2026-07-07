import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArgumentStarter {
  text: string
  angle: string
}

export interface ArgumentStartersResponse {
  topic_id: string
  statement: string
  category: string | null
  starters: {
    for: ArgumentStarter[]
    against: ArgumentStarter[]
  }
  unavailable?: boolean
}

// ─── POST /api/topics/[id]/argument-starters ─────────────────────────────────
// Generates AI-powered argument starters for both sides of a topic.
// Requires authentication. No caching — each call is fresh.

type ArgFormat = 'free' | 'peel' | 'toulmin' | 'narrative'

const FORMAT_INSTRUCTIONS: Record<ArgFormat, string> = {
  free: '',
  peel: 'Each starter should read as the opening "Point" in a PEEL-structured argument (Point → Evidence → Explanation → Link), setting up a clear claim that evidence can follow.',
  toulmin: 'Each starter should serve as the opening "Claim" in a Toulmin-structured argument (Claim → Data → Warrant → Rebuttal) — a clear, debatable assertion that calls for evidence.',
  narrative: 'Each starter should work as the opening "Hook" in a narrative argument (Hook → Stakes → Case → Call to Action) — vivid, story-driven, and emotionally engaging.',
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        topic_id: params.id,
        statement: '',
        category: null,
        starters: { for: [], against: [] },
        unavailable: true,
      } satisfies ArgumentStartersResponse,
      { status: 200 }
    )
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let requestFormat: ArgFormat = 'free'
  try {
    const body = await req.json()
    if (body.format && ['free', 'peel', 'toulmin', 'narrative'].includes(body.format)) {
      requestFormat = body.format as ArgFormat
    }
  } catch {
    // body parse error — use default
  }

  // Fetch topic
  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (topicErr || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Fetch top existing arguments for context (so Claude doesn't repeat them)
  const { data: existing } = await supabase
    .from('topic_arguments')
    .select('side, content')
    .eq('topic_id', params.id)
    .order('upvotes', { ascending: false })
    .limit(6)

  const existingFor = (existing ?? [])
    .filter((a) => a.side === 'blue')
    .map((a) => a.content)
    .slice(0, 3)

  const existingAgainst = (existing ?? [])
    .filter((a) => a.side === 'red')
    .map((a) => a.content)
    .slice(0, 3)

  const formatInstruction = FORMAT_INSTRUCTIONS[requestFormat]

  const prompt = `You are helping citizens engage in civic debate on Lobby Market, a democratic consensus platform.

Topic: "${topic.statement}"
Category: ${topic.category ?? 'General'}

${existingFor.length > 0 ? `Existing FOR arguments (avoid repeating these angles):\n${existingFor.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n` : ''}
${existingAgainst.length > 0 ? `Existing AGAINST arguments (avoid repeating these angles):\n${existingAgainst.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n` : ''}

Generate 3 FOR (supporting) and 3 AGAINST (opposing) argument starters for this topic. Each starter should be:
- A complete, compelling opening sentence or two (80–200 characters)
- Distinct in angle (e.g., economic, moral, practical, rights-based, evidence-based)
- Written as a citizen arguing their position, not as a neutral summary
- Fresh and not duplicating the existing arguments listed above
${formatInstruction ? `- ${formatInstruction}` : ''}

Respond with ONLY valid JSON in this exact format:
{
  "for": [
    { "text": "...", "angle": "Economic" },
    { "text": "...", "angle": "Rights-based" },
    { "text": "...", "angle": "Practical" }
  ],
  "against": [
    { "text": "...", "angle": "..." },
    { "text": "...", "angle": "..." },
    { "text": "...", "angle": "..." }
  ]
}`

  let starters: { for: ArgumentStarter[]; against: ArgumentStarter[] }

  try {
    const client = new Anthropic()
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text block in response')
    }

    // Extract JSON — strip markdown fences if present
    const raw = textBlock.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed.for) || !Array.isArray(parsed.against)) {
      throw new Error('Invalid response shape')
    }

    starters = {
      for: (parsed.for as ArgumentStarter[]).slice(0, 3),
      against: (parsed.against as ArgumentStarter[]).slice(0, 3),
    }
  } catch (err) {
    console.error('[argument-starters] Claude error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }

  return NextResponse.json({
    topic_id: topic.id,
    statement: topic.statement,
    category: topic.category,
    starters,
  } satisfies ArgumentStartersResponse)
}
