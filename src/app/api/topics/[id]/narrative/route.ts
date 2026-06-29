import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NarrativeChapter {
  title: string
  body: string
}

export interface NarrativeResponse {
  topic_id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  argument_count: number
  chapters: NarrativeChapter[]
  lede: string
  verdict: string
  generated_at: string
  unavailable?: boolean
  insufficient_data?: boolean
}

const MIN_ARGS = 3

// ─── GET /api/topics/[id]/narrative ──────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const topicId = params.id

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { unavailable: true } as Partial<NarrativeResponse>,
      { status: 200 }
    )
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .eq('id', topicId)
    .single()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const { data: rawArgs, count } = await supabase
    .from('topic_arguments')
    .select('content, side, upvotes, created_at, ai_score, ai_grade', { count: 'exact' })
    .eq('topic_id', topicId)
    .order('upvotes', { ascending: false })
    .limit(24)

  const args = rawArgs ?? []
  const argCount = count ?? args.length

  if (args.length < MIN_ARGS) {
    return NextResponse.json(
      { insufficient_data: true } as Partial<NarrativeResponse>,
      { status: 422 }
    )
  }

  const forArgs = args.filter((a) => a.side === 'blue').slice(0, 8)
  const againstArgs = args.filter((a) => a.side === 'red').slice(0, 8)
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  const statusLabel: Record<string, string> = {
    proposed: 'recently proposed and gathering early votes',
    active: 'actively debated with strong engagement',
    voting: 'entering its final voting phase',
    law: 'voted into law by community consensus',
    failed: 'rejected by the community after full deliberation',
  }

  const debateAge = Math.round(
    (Date.now() - new Date(topic.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  const prompt = `You are a civic journalist writing for Lobby Market — a democratic consensus platform where citizens debate real policy questions and vote them into law.

Write a compelling journalistic narrative about the following civic debate. Your tone should feel like a feature article in The Atlantic or The Economist: authoritative, engaging, and humane. Not dry — tell the STORY of this debate.

---
DEBATE: "${topic.statement}"
CATEGORY: ${topic.category ?? 'General'}
STATUS: ${statusLabel[topic.status] ?? topic.status}
CURRENT VOTE: ${forPct}% FOR / ${againstPct}% AGAINST
TOTAL VOTES CAST: ${(topic.total_votes ?? 0).toLocaleString()}
TOTAL ARGUMENTS: ${argCount}
DEBATE AGE: ${debateAge} day${debateAge !== 1 ? 's' : ''}

TOP ARGUMENTS IN FAVOUR (sorted by community upvotes):
${forArgs.map((a, i) => `${i + 1}. [${a.upvotes ?? 0} upvotes${a.ai_grade ? `, grade ${a.ai_grade}` : ''}] "${a.content}"`).join('\n')}

TOP ARGUMENTS AGAINST (sorted by community upvotes):
${againstArgs.map((a, i) => `${i + 1}. [${a.upvotes ?? 0} upvotes${a.ai_grade ? `, grade ${a.ai_grade}` : ''}] "${a.content}"`).join('\n')}
---

Write the narrative as a JSON object with EXACTLY these fields:
{
  "lede": "<One punchy opening sentence — the hook. What is the fundamental tension here? Max 30 words.>",
  "chapters": [
    {
      "title": "The Question",
      "body": "<2-3 sentences framing what this debate is fundamentally about — the values, tensions, and stakes at the heart of it. Neutral.>"
    },
    {
      "title": "The Case For",
      "body": "<2-3 sentences narrating the strongest arguments in favour — what motivates people who support this, what evidence they marshal. Sympathetic, not advocacy.>"
    },
    {
      "title": "The Case Against",
      "body": "<2-3 sentences narrating the strongest arguments against — what motivates opponents, their evidence and concerns. Equally sympathetic.>"
    },
    {
      "title": "Where Things Stand",
      "body": "<2-3 sentences about the current state: the vote split, what the numbers reveal about the community's disposition, and what would need to shift for consensus to form.>"
    }
  ],
  "verdict": "<A single sentence summary: what does this debate ultimately come down to? The core trade-off in plain language. Max 25 words.>"
}

Rules:
- Be strictly neutral. Do not imply which side is correct.
- Write like a journalist, not an analyst. Use vivid, concrete language.
- Reference specific arguments when they illuminate the human stakes.
- Avoid bureaucratic or academic language.
- No preamble. Return ONLY the JSON object.`

  const client = new Anthropic()

  let parsed: { lede: string; chapters: NarrativeChapter[]; verdict: string }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No text')

    const raw = textBlock.text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')
    parsed = JSON.parse(jsonMatch[0])

    if (!parsed.lede || !Array.isArray(parsed.chapters) || !parsed.verdict) {
      throw new Error('Malformed response')
    }
  } catch (err) {
    console.error('[narrative] Claude error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 502 })
  }

  const response: NarrativeResponse = {
    topic_id: topic.id,
    statement: topic.statement,
    category: topic.category ?? null,
    status: topic.status,
    blue_pct: topic.blue_pct ?? 50,
    total_votes: topic.total_votes ?? 0,
    argument_count: argCount,
    chapters: parsed.chapters,
    lede: parsed.lede,
    verdict: parsed.verdict,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
