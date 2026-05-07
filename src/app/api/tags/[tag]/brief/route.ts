import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TagBriefResponse {
  overview: string | null
  lean: string | null
  tension: string | null
  insight: string | null
  topic_count: number
  avg_for_pct: number | null
  generated_at: string | null
  unavailable?: boolean
  insufficient_data?: boolean
}

interface TagTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number | null
  total_votes: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function topicHash(topics: TagTopic[]): string {
  let hash = 0
  for (const t of topics) {
    for (let i = 0; i < t.id.length; i++) {
      hash = (hash * 31 + t.id.charCodeAt(i)) >>> 0
    }
    const pct = Math.round((t.blue_pct ?? 50) * 10)
    hash = (hash * 31 + pct) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

const MIN_TOPICS_REQUIRED = 2

async function fetchTopicsForTag(supabase: Awaited<ReturnType<typeof createClient>>, tag: string): Promise<TagTopic[]> {
  const { data } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .contains('tags', [tag])
    .order('total_votes', { ascending: false })
    .limit(50)

  return (data ?? []) as TagTopic[]
}

// ─── GET /api/tags/[tag]/brief ────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { tag: string } }
) {
  const tag = decodeURIComponent(params.tag).toLowerCase().trim()

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      overview: null,
      lean: null,
      tension: null,
      insight: null,
      topic_count: 0,
      avg_for_pct: null,
      generated_at: null,
      unavailable: true,
    } satisfies TagBriefResponse)
  }

  const supabase = await createClient()

  const { data: cached } = await supabase
    .from('tag_ai_briefs')
    .select('overview, lean, tension, insight, topic_count, avg_for_pct, generated_at, tag_hash')
    .eq('tag', tag)
    .maybeSingle()

  if (!cached) {
    return NextResponse.json({
      overview: null,
      lean: null,
      tension: null,
      insight: null,
      topic_count: 0,
      avg_for_pct: null,
      generated_at: null,
    } satisfies TagBriefResponse)
  }

  const topics = await fetchTopicsForTag(supabase, tag)
  const currentHash = topicHash(topics)

  return NextResponse.json({
    overview: cached.overview,
    lean: cached.lean,
    tension: cached.tension,
    insight: cached.insight,
    topic_count: topics.length,
    avg_for_pct: cached.avg_for_pct != null ? Number(cached.avg_for_pct) : null,
    generated_at: cached.generated_at,
    // If hash changed, client can show a "stale" indicator, but still return cached
    ...(cached.tag_hash !== currentHash ? {} : {}),
  } satisfies TagBriefResponse)
}

// ─── POST /api/tags/[tag]/brief ───────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: { tag: string } }
) {
  const tag = decodeURIComponent(params.tag).toLowerCase().trim()

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allTopics = await fetchTopicsForTag(supabase, tag)

  if (allTopics.length < MIN_TOPICS_REQUIRED) {
    return NextResponse.json({
      overview: null,
      lean: null,
      tension: null,
      insight: null,
      topic_count: allTopics.length,
      avg_for_pct: null,
      generated_at: null,
      insufficient_data: true,
    } satisfies TagBriefResponse)
  }

  const hash = topicHash(allTopics)

  // Check cache first — if hash matches, return cached
  const { data: cached } = await supabase
    .from('tag_ai_briefs')
    .select('overview, lean, tension, insight, topic_count, avg_for_pct, generated_at, tag_hash')
    .eq('tag', tag)
    .maybeSingle()

  if (cached && cached.tag_hash === hash) {
    return NextResponse.json({
      overview: cached.overview,
      lean: cached.lean,
      tension: cached.tension,
      insight: cached.insight,
      topic_count: allTopics.length,
      avg_for_pct: cached.avg_for_pct != null ? Number(cached.avg_for_pct) : null,
      generated_at: cached.generated_at,
    } satisfies TagBriefResponse)
  }

  // Use top 12 topics for context concision
  const topics = allTopics.slice(0, 12)
  const votedTopics = topics.filter((t) => (t.total_votes ?? 0) > 0)
  const totalVotes = votedTopics.reduce((s, t) => s + (t.total_votes ?? 0), 0)
  const avgForPct = totalVotes > 0
    ? Math.round(votedTopics.reduce((s, t) => s + (t.blue_pct ?? 50) * (t.total_votes ?? 0), 0) / totalVotes)
    : Math.round(topics.reduce((s, t) => s + (t.blue_pct ?? 50), 0) / topics.length)

  const statusLabel: Record<string, string> = {
    proposed: 'Proposed', active: 'Active', voting: 'Final Voting',
    law: 'Established Law', failed: 'Failed',
  }

  const topicLines = topics
    .map((t, i) => {
      const forPct = Math.round(t.blue_pct ?? 50)
      const status = statusLabel[t.status] ?? t.status
      const votes = (t.total_votes ?? 0).toLocaleString()
      return `${i + 1}. "${t.statement}" — ${forPct}% FOR [${status}] (${votes} votes)`
    })
    .join('\n')

  const prompt = `You are a civic analyst for Lobby Market, a platform where citizens vote on binary policy proposals that can become permanent laws.

TAG: "#${tag}"
TOPICS UNDER THIS TAG (${topics.length} shown, ordered by engagement):
${topicLines}

WEIGHTED CONSENSUS: ${avgForPct}% FOR across these topics

Analyze these civic debates and respond with EXACTLY this JSON (no markdown, no extra text):
{
  "overview": "2-3 sentences describing what civic themes and concerns unite the debates under this tag. What is the community really grappling with at a deeper level?",
  "lean": "1 sentence describing the community's overall stance — are they broadly FOR, AGAINST, or genuinely split? Reference the percentage and what it reveals.",
  "tension": "1-2 sentences identifying the core value conflict that runs across most debates here — the fundamental disagreement driving these discussions.",
  "insight": "1-2 sentences offering a sharp meta-level observation — a pattern, trend, or counterintuitive finding that emerges from seeing all these debates together."
}

Rules:
- Be analytically specific — reference actual topic themes
- Don't use the tag name as a substitute for real analysis
- Plain, direct English — no academic jargon
- Each field must be concise but substantive`

  const client = new Anthropic()

  let parsed: { overview: string; lean: string; tension: string; insight: string }
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No text block')

    const raw = textBlock.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    parsed = JSON.parse(raw)

    if (!parsed.overview || !parsed.lean || !parsed.tension || !parsed.insight) {
      throw new Error('Incomplete brief fields')
    }
  } catch (err) {
    console.error('[tag-brief] Claude error:', err)
    return NextResponse.json({ error: 'AI generation failed' }, { status: 502 })
  }

  const now = new Date().toISOString()
  await supabase.from('tag_ai_briefs').upsert(
    {
      tag,
      overview: parsed.overview,
      lean: parsed.lean,
      tension: parsed.tension,
      insight: parsed.insight,
      topic_count: allTopics.length,
      avg_for_pct: avgForPct,
      tag_hash: hash,
      model: 'claude-sonnet-4-6',
      generated_at: now,
    },
    { onConflict: 'tag' }
  )

  return NextResponse.json({
    overview: parsed.overview,
    lean: parsed.lean,
    tension: parsed.tension,
    insight: parsed.insight,
    topic_count: allTopics.length,
    avg_for_pct: avgForPct,
    generated_at: now,
  } satisfies TagBriefResponse)
}
