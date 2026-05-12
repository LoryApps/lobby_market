import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ArgumentCritiqueData {
  argument_id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  created_at: string
  ai_score: number | null
  ai_grade: string | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface CritiqueDimension {
  name: string
  score: number
  feedback: string
}

export interface ArgumentCritiqueResponse {
  argument: ArgumentCritiqueData
  critique: {
    score: number
    grade: string
    summary: string
    dimensions: CritiqueDimension[]
    suggestions: string[]
    strong_point: string
  } | null
  percentile: number | null
  unavailable?: boolean
  error?: string
}

// ─── GET /api/arguments/[id]/critique — load argument + existing grade ─────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid argument ID' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: arg } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, created_at, user_id, topic_id, ai_score, ai_grade')
    .eq('id', id)
    .single()

  if (!arg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [topicRes, profileRes, rankRes, totalRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', arg.topic_id)
      .single(),
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .eq('id', arg.user_id)
      .maybeSingle(),
    arg.ai_score !== null
      ? supabase
          .from('topic_arguments')
          .select('id', { count: 'exact', head: true })
          .not('ai_score', 'is', null)
          .gt('ai_score', arg.ai_score)
      : Promise.resolve({ count: null }),
    arg.ai_score !== null
      ? supabase
          .from('topic_arguments')
          .select('id', { count: 'exact', head: true })
          .not('ai_score', 'is', null)
      : Promise.resolve({ count: null }),
  ])

  if (!topicRes.data) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

  let percentile: number | null = null
  if (
    arg.ai_score !== null &&
    rankRes.count !== null &&
    totalRes.count !== null &&
    totalRes.count > 0
  ) {
    const rank = (rankRes.count ?? 0) + 1
    percentile = Math.max(0, Math.round(((totalRes.count - rank) / totalRes.count) * 100))
  }

  const argumentData: ArgumentCritiqueData = {
    argument_id: arg.id,
    content: arg.content,
    side: arg.side as 'blue' | 'red',
    upvotes: arg.upvotes,
    created_at: arg.created_at,
    ai_score: arg.ai_score as number | null,
    ai_grade: arg.ai_grade as string | null,
    topic: topicRes.data,
    author: profileRes.data ?? null,
  }

  return NextResponse.json({ argument: argumentData, critique: null, percentile } satisfies ArgumentCritiqueResponse)
}

// ─── POST /api/arguments/[id]/critique — generate AI critique ─────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid argument ID' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ unavailable: true } satisfies Partial<ArgumentCritiqueResponse>, { status: 200 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: arg } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, created_at, user_id, topic_id, ai_score, ai_grade')
    .eq('id', id)
    .single()

  if (!arg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [topicRes, profileRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', arg.topic_id)
      .single(),
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .eq('id', arg.user_id)
      .maybeSingle(),
  ])

  if (!topicRes.data) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

  const topic = topicRes.data
  const sideLabel = arg.side === 'blue' ? 'FOR (in favour of)' : 'AGAINST'

  const prompt = `You are an expert debate coach on Lobby Market, a civic consensus platform.

TOPIC: "${topic.statement}"${topic.category ? `\nCATEGORY: ${topic.category}` : ''}
STANCE: The argument is ${sideLabel} this topic.

ARGUMENT TO EVALUATE:
"${arg.content.trim()}"

Evaluate this argument across four dimensions. Respond with ONLY valid JSON (no markdown, no code fences, no preamble):

{
  "score": <overall 1-10 integer>,
  "grade": "<A|B|C|D|F>",
  "summary": "<1 sentence overall verdict, direct and specific>",
  "dimensions": [
    { "name": "Clarity", "score": <1-10>, "feedback": "<1-2 sentences on how clearly the point is expressed>" },
    { "name": "Evidence", "score": <1-10>, "feedback": "<1-2 sentences on supporting evidence or lack thereof>" },
    { "name": "Logic", "score": <1-10>, "feedback": "<1-2 sentences on the soundness of the reasoning>" },
    { "name": "Persuasion", "score": <1-10>, "feedback": "<1-2 sentences on how convincing this would be to an undecided voter>" }
  ],
  "suggestions": ["<concrete improvement 1, specific and actionable>", "<concrete improvement 2>", "<concrete improvement 3 if needed, or omit>"],
  "strong_point": "<what this argument does best in one sentence>"
}

Scoring guide: 9-10=A (exceptional), 7-8=B (good), 5-6=C (fair), 3-4=D (weak), 1-2=F (very weak).
Match grade to score. Be honest and constructive.`

  const client = new Anthropic()

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No text block')

    const raw = textBlock.text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    const parsed = JSON.parse(raw) as {
      score: number
      grade: string
      summary: string
      dimensions: CritiqueDimension[]
      suggestions: string[]
      strong_point: string
    }

    if (!parsed.score || !parsed.grade || !parsed.summary || !Array.isArray(parsed.dimensions)) {
      throw new Error('Invalid response shape')
    }

    // Persist score/grade back (best-effort)
    supabase
      .from('topic_arguments')
      .update({ ai_score: parsed.score, ai_grade: parsed.grade })
      .eq('id', id)
      .then(() => {})

    // Compute updated percentile
    const [rankRes, totalRes] = await Promise.all([
      supabase
        .from('topic_arguments')
        .select('id', { count: 'exact', head: true })
        .not('ai_score', 'is', null)
        .gt('ai_score', parsed.score),
      supabase
        .from('topic_arguments')
        .select('id', { count: 'exact', head: true })
        .not('ai_score', 'is', null),
    ])

    let percentile: number | null = null
    if (rankRes.count !== null && totalRes.count !== null && totalRes.count > 0) {
      percentile = Math.max(0, Math.round(((totalRes.count - (rankRes.count + 1)) / totalRes.count) * 100))
    }

    const argumentData: ArgumentCritiqueData = {
      argument_id: arg.id,
      content: arg.content,
      side: arg.side as 'blue' | 'red',
      upvotes: arg.upvotes,
      created_at: arg.created_at,
      ai_score: parsed.score,
      ai_grade: parsed.grade,
      topic,
      author: profileRes.data ?? null,
    }

    return NextResponse.json({
      argument: argumentData,
      critique: parsed,
      percentile,
    } satisfies ArgumentCritiqueResponse)
  } catch (err) {
    console.error('[arg-critique]', err)
    return NextResponse.json({ error: 'AI evaluation failed' }, { status: 502 })
  }
}
