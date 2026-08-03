import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LawNarrativeChapter {
  title: string
  body: string
}

export interface LawNarrativeResponse {
  law_id: string
  topic_id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  argument_count: number
  established_at: string
  chapters: LawNarrativeChapter[]
  lede: string
  legacy: string
  generated_at: string
  unavailable?: boolean
  insufficient_data?: boolean
}

const MIN_ARGS = 3

// ─── GET /api/laws/[id]/narrative ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const lawId = params.id

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { unavailable: true } as Partial<LawNarrativeResponse>,
      { status: 200 }
    )
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, full_statement, category, established_at, blue_pct, total_votes, topic_id')
    .eq('id', lawId)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const topicId = law.topic_id

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
      { insufficient_data: true } as Partial<LawNarrativeResponse>,
      { status: 422 }
    )
  }

  const forArgs = args.filter((a) => a.side === 'blue').slice(0, 8)
  const againstArgs = args.filter((a) => a.side === 'red').slice(0, 8)
  const forPct = Math.round(law.blue_pct ?? 50)
  const againstPct = 100 - forPct

  const establishedDate = new Date(law.established_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const prompt = `You are a civic journalist writing for Lobby Market — a democratic consensus platform where citizens debate real policy questions and vote them into law.

This debate has CONCLUDED. The community reached consensus and voted this into law. Your task is to write the authoritative story of HOW this became law — the origin, the debate, the moment of consensus, and what it means going forward.

Write as if covering this for The Atlantic or The Economist: authoritative, engaging, humane. Tell the STORY of this law's birth.

---
LAW: "${law.statement}"
CATEGORY: ${law.category ?? 'General'}
ESTABLISHED: ${establishedDate}
FINAL VOTE: ${forPct}% FOR / ${againstPct}% AGAINST
TOTAL VOTES CAST: ${(law.total_votes ?? 0).toLocaleString()}
TOTAL ARGUMENTS IN ORIGINAL DEBATE: ${argCount}

TOP ARGUMENTS THAT SUPPORTED THIS LAW (sorted by community upvotes):
${forArgs.map((a, i) => `${i + 1}. [${a.upvotes ?? 0} upvotes${a.ai_grade ? `, grade ${a.ai_grade}` : ''}] "${a.content}"`).join('\n')}

TOP ARGUMENTS THAT OPPOSED THIS LAW (sorted by community upvotes):
${againstArgs.map((a, i) => `${i + 1}. [${a.upvotes ?? 0} upvotes${a.ai_grade ? `, grade ${a.ai_grade}` : ''}] "${a.content}"`).join('\n')}
---

Write the narrative as a JSON object with EXACTLY these fields:
{
  "lede": "<One powerful opening sentence — the declarative fact of what happened and why it matters. Max 30 words.>",
  "chapters": [
    {
      "title": "The Original Question",
      "body": "<2-3 sentences framing what was being debated — the fundamental civic question citizens were asked to answer, and why it mattered.>"
    },
    {
      "title": "The Debate",
      "body": "<2-3 sentences narrating the debate itself — the strongest arguments on both sides, the tensions that emerged, what citizens were ultimately weighing.>"
    },
    {
      "title": "How Consensus Formed",
      "body": "<2-3 sentences about the path to consensus: what swayed the community, what the ${forPct}% majority represents, and what it took for agreement to crystallise.>"
    },
    {
      "title": "What This Law Means",
      "body": "<2-3 sentences about the significance and implications of this established consensus — what changes, what it signals about community values, and what it requires going forward.>"
    }
  ],
  "legacy": "<A single sentence capturing the lasting significance of this law. What will it be remembered for? Max 25 words.>"
}

Rules:
- This is a RETROSPECTIVE. The debate is over. Write in the past tense where appropriate.
- Be respectful of the democratic process. This represents genuine community consensus.
- Reference specific arguments when they illuminate the human stakes.
- Write like a journalist, not an analyst. Vivid, concrete language.
- Acknowledge the minority view (${againstPct}%) with respect — they participated in the democratic process.
- No preamble. Return ONLY the JSON object.`

  const client = new Anthropic()

  let parsed: { lede: string; chapters: LawNarrativeChapter[]; legacy: string }

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

    if (!parsed.lede || !Array.isArray(parsed.chapters) || !parsed.legacy) {
      throw new Error('Malformed response')
    }
  } catch (err) {
    console.error('[law/narrative] Claude error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 502 })
  }

  const response: LawNarrativeResponse = {
    law_id: law.id,
    topic_id: topicId,
    statement: law.statement,
    category: law.category ?? null,
    blue_pct: law.blue_pct ?? 50,
    total_votes: law.total_votes ?? 0,
    argument_count: argCount,
    established_at: law.established_at,
    chapters: parsed.chapters,
    lede: parsed.lede,
    legacy: parsed.legacy,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
