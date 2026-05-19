import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MentorDimension {
  name: string
  score: number
  observation: string
  tip: string
}

export interface MentorBestArgument {
  content: string
  topic_statement: string
  category: string | null
  upvotes: number
  ai_score: number | null
  why: string
}

export interface MentorReport {
  overall_grade: string
  overall_score: number
  style_archetype: string
  style_archetype_desc: string
  signature_strength: string
  signature_weakness: string
  dimensions: MentorDimension[]
  best_argument: MentorBestArgument | null
  improvement_plan: string[]
  personal_note: string
  stats: {
    total_arguments: number
    categories_covered: number
    avg_upvotes: number
    cited_pct: number
    for_pct: number
    avg_ai_score: number | null
  }
  generated_at: string
  unavailable?: boolean
  insufficient_data?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampStr(s: unknown, max: number, fallback: string): string {
  if (typeof s !== 'string' || !s.trim()) return fallback
  return s.slice(0, max)
}

function ensureDimensions(val: unknown): MentorDimension[] {
  if (!Array.isArray(val)) return []
  return val
    .filter(
      (d): d is Record<string, unknown> =>
        d !== null && typeof d === 'object'
    )
    .slice(0, 5)
    .map((d) => ({
      name: clampStr(d.name, 40, 'Dimension'),
      score: typeof d.score === 'number' ? Math.max(0, Math.min(100, Math.round(d.score))) : 50,
      observation: clampStr(d.observation, 200, ''),
      tip: clampStr(d.tip, 200, ''),
    }))
}

function ensureStrings(val: unknown, max: number, limit: number): string[] {
  if (!Array.isArray(val)) return []
  return val
    .filter((s): s is string => typeof s === 'string')
    .slice(0, limit)
    .map((s) => s.slice(0, max))
}

// ─── POST /api/analytics/mentor ──────────────────────────────────────────────

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { unavailable: true } satisfies Partial<MentorReport>,
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

  // ── 1. Fetch user's arguments with topic and AI score ─────────────────────
  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select(`
      id,
      content,
      side,
      upvotes,
      source_url,
      created_at,
      topic_id,
      topics:topic_id (
        statement,
        category
      )
    `)
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })
    .limit(80)

  const args = (argsRaw ?? []) as Array<{
    id: string
    content: string
    side: string
    upvotes: number
    source_url: string | null
    created_at: string
    topic_id: string
    topics: { statement: string; category: string | null } | null
  }>

  if (args.length < 3) {
    return NextResponse.json(
      { insufficient_data: true } satisfies Partial<MentorReport>,
      { status: 422 }
    )
  }

  // ── 2. Fetch AI scores for these arguments ────────────────────────────────
  const argIds = args.map((a) => a.id)
  const { data: scoresRaw } = await supabase
    .from('argument_ai_scores')
    .select('argument_id, score, grade')
    .in('argument_id', argIds)

  const scoreMap = new Map(
    (scoresRaw ?? []).map((s) => [s.argument_id, { score: s.score as number, grade: s.grade as string }])
  )

  // ── 3. Compute stats ──────────────────────────────────────────────────────
  const categories = new Set(args.map((a) => a.topics?.category ?? 'Other'))
  const totalUpvotes = args.reduce((sum, a) => sum + (a.upvotes ?? 0), 0)
  const avgUpvotes = Math.round((totalUpvotes / args.length) * 10) / 10
  const citedCount = args.filter((a) => a.source_url).length
  const citedPct = Math.round((citedCount / args.length) * 100)
  const forCount = args.filter((a) => a.side === 'for').length
  const forPct = Math.round((forCount / args.length) * 100)

  const aiScores = args
    .map((a) => scoreMap.get(a.id)?.score)
    .filter((s): s is number => typeof s === 'number')
  const avgAiScore =
    aiScores.length > 0
      ? Math.round(aiScores.reduce((s, n) => s + n, 0) / aiScores.length)
      : null

  // ── 4. Pick best argument (highest upvotes + ai_score combo) ─────────────
  const scoredArgs = args.map((a) => {
    const ai = scoreMap.get(a.id)?.score ?? 0
    const composite = (a.upvotes ?? 0) * 2 + ai
    return { ...a, composite }
  })
  const bestArg = scoredArgs.sort((a, b) => b.composite - a.composite)[0]

  // ── 5. Build sample for Claude (up to 25 arguments) ──────────────────────
  const sample = args.slice(0, 25).map((a) => ({
    category: a.topics?.category ?? 'Other',
    topic: a.topics?.statement?.slice(0, 100) ?? 'Unknown topic',
    side: a.side === 'for' ? 'FOR' : 'AGAINST',
    content: a.content.slice(0, 300),
    upvotes: a.upvotes ?? 0,
    cited: !!a.source_url,
    ai_grade: scoreMap.get(a.id)?.grade ?? null,
  }))

  // ── 6. Generate coaching report with Claude ───────────────────────────────
  const client = new Anthropic()

  const prompt = `You are an expert debate coach and civic engagement mentor analysing a Lobby Market user's argument writing history.

Platform context: Lobby Market is a civic consensus platform where users write FOR/AGAINST arguments on policy topics. Good arguments are clear, evidence-based, logically sound, and persuasive. Arguments can be cited (linked to sources).

User stats:
- Total arguments analysed: ${args.length}
- Average upvotes per argument: ${avgUpvotes}
- % arguments with citations: ${citedPct}%
- % FOR arguments (vs AGAINST): ${forPct}%
- Categories covered: ${Array.from(categories).join(', ')}
- Average AI quality score (0-100): ${avgAiScore ?? 'not yet graded'}

Sample of their recent arguments:
${sample
  .map(
    (a, i) =>
      `${i + 1}. [${a.category}] ${a.side}: "${a.content}"${a.cited ? ' [CITED]' : ''} — ${a.upvotes} upvotes${a.ai_grade ? `, AI grade: ${a.ai_grade}` : ''}`
  )
  .join('\n')}

Analyse this user's argument writing style and patterns. Provide a personalised coaching report.

Return ONLY valid JSON with exactly this shape:
{
  "overall_score": <integer 0-100>,
  "overall_grade": <"A"|"B"|"C"|"D"|"F">,
  "style_archetype": "<2-4 word label e.g. 'The Policy Analyst', 'The Moral Philosopher', 'The Pragmatic Realist'>",
  "style_archetype_desc": "<1 sentence describing what makes this archetype distinctive>",
  "signature_strength": "<1 sentence: what they consistently do well>",
  "signature_weakness": "<1 sentence: what they most need to improve>",
  "dimensions": [
    {
      "name": "<dimension name e.g. 'Clarity', 'Evidence', 'Logic', 'Persuasion', 'Originality'>",
      "score": <integer 0-100>,
      "observation": "<what you observe in their arguments about this dimension (max 150 chars)>",
      "tip": "<specific actionable improvement tip for this dimension (max 150 chars)>"
    }
  ],
  "improvement_plan": [
    "<specific action item 1 (max 120 chars)>",
    "<specific action item 2 (max 120 chars)>",
    "<specific action item 3 (max 120 chars)>"
  ],
  "personal_note": "<an encouraging, personalised paragraph (max 300 chars) acknowledging what makes their civic voice distinctive>"
}

Include exactly 5 dimensions. Be honest but constructive. Base everything on the actual evidence from their arguments.`

  let raw: string
  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })
    raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  } catch {
    return NextResponse.json(
      { unavailable: true } satisfies Partial<MentorReport>,
      { status: 200 }
    )
  }

  // ── 7. Parse Claude response ──────────────────────────────────────────────
  let parsed: Record<string, unknown>
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as Record<string, unknown>) : {}
  } catch {
    parsed = {}
  }

  const overallScore =
    typeof parsed.overall_score === 'number'
      ? Math.max(0, Math.min(100, Math.round(parsed.overall_score)))
      : 50

  const grade = ['A', 'B', 'C', 'D', 'F'].includes(String(parsed.overall_grade))
    ? String(parsed.overall_grade)
    : overallScore >= 90 ? 'A' : overallScore >= 75 ? 'B' : overallScore >= 60 ? 'C' : overallScore >= 45 ? 'D' : 'F'

  const mentorBest: MentorBestArgument | null = bestArg
    ? {
        content: bestArg.content.slice(0, 400),
        topic_statement: bestArg.topics?.statement?.slice(0, 120) ?? 'Unknown topic',
        category: bestArg.topics?.category ?? null,
        upvotes: bestArg.upvotes ?? 0,
        ai_score: scoreMap.get(bestArg.id)?.score ?? null,
        why: 'Highest combined upvotes and AI quality score from your recent arguments.',
      }
    : null

  const report: MentorReport = {
    overall_grade: grade,
    overall_score: overallScore,
    style_archetype: clampStr(parsed.style_archetype, 50, 'The Civic Voice'),
    style_archetype_desc: clampStr(parsed.style_archetype_desc, 200, ''),
    signature_strength: clampStr(parsed.signature_strength, 200, ''),
    signature_weakness: clampStr(parsed.signature_weakness, 200, ''),
    dimensions: ensureDimensions(parsed.dimensions),
    best_argument: mentorBest,
    improvement_plan: ensureStrings(parsed.improvement_plan, 120, 5),
    personal_note: clampStr(parsed.personal_note, 300, ''),
    stats: {
      total_arguments: args.length,
      categories_covered: categories.size,
      avg_upvotes: avgUpvotes,
      cited_pct: citedPct,
      for_pct: forPct,
      avg_ai_score: avgAiScore,
    },
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(report)
}
