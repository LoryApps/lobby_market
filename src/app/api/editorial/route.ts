import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EditorialTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  top_for_arg: string | null
  top_against_arg: string | null
}

export interface EditorialResponse {
  headline: string
  lede: string
  body: string
  topics: EditorialTopic[]
  generated_at: string
  date_key: string
  unavailable?: boolean
}

// ─── GET /api/editorial ───────────────────────────────────────────────────────
// Returns today's editorial (and generates it if it doesn't exist yet).

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const today = new Date().toISOString().slice(0, 10)

  // Return cached editorial if one exists for today
  const { data: cached } = await supabase
    .from('daily_editorials')
    .select('headline, lede, body, topics_json, generated_at, date_key')
    .eq('date_key', today)
    .maybeSingle()

  if (cached) {
    return NextResponse.json({
      headline: cached.headline,
      lede: cached.lede,
      body: cached.body,
      topics: (cached.topics_json as EditorialTopic[]) ?? [],
      generated_at: cached.generated_at,
      date_key: cached.date_key,
    } satisfies EditorialResponse)
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      headline: 'Editorial Unavailable',
      lede: 'The AI editorial requires an Anthropic API key to be configured.',
      body: '',
      topics: [],
      generated_at: new Date().toISOString(),
      date_key: today,
      unavailable: true,
    } satisfies EditorialResponse)
  }

  // Fetch the 5 most-debated active topics
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['active', 'voting'])
    .order('total_votes', { ascending: false })
    .limit(5)

  // Fall back to recently-proposed topics when there are no active debates
  const rows = topicRows && topicRows.length > 0
    ? topicRows
    : await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes')
        .order('created_at', { ascending: false })
        .limit(5)
        .then(({ data }) => data ?? [])

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      headline: 'The Lobby is Quiet Today',
      lede: 'No active debates are underway right now — be the first to propose a topic.',
      body: 'The chamber awaits. Every law begins with a single voice. Propose a topic that matters to you and watch the community weigh in.',
      topics: [],
      generated_at: new Date().toISOString(),
      date_key: today,
    } satisfies EditorialResponse)
  }

  // Enrich each topic with its top FOR and AGAINST argument
  const topicsWithArgs: EditorialTopic[] = []

  for (const topic of rows) {
    const [{ data: forArgs }, { data: againstArgs }] = await Promise.all([
      supabase
        .from('topic_arguments')
        .select('content')
        .eq('topic_id', topic.id)
        .eq('side', 'blue')
        .order('upvotes', { ascending: false })
        .limit(1),
      supabase
        .from('topic_arguments')
        .select('content')
        .eq('topic_id', topic.id)
        .eq('side', 'red')
        .order('upvotes', { ascending: false })
        .limit(1),
    ])

    topicsWithArgs.push({
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct,
      total_votes: topic.total_votes,
      top_for_arg: forArgs?.[0]?.content?.slice(0, 280) ?? null,
      top_against_arg: againstArgs?.[0]?.content?.slice(0, 280) ?? null,
    })
  }

  // Build the prompt for Claude
  const topicsText = topicsWithArgs
    .map(
      (t, i) => `
Topic ${i + 1}: "${t.statement}"
Category: ${t.category ?? 'General'} | Status: ${t.status}
Community verdict: ${Math.round(t.blue_pct)}% FOR / ${100 - Math.round(t.blue_pct)}% AGAINST (${t.total_votes.toLocaleString()} votes cast)
Strongest FOR argument: ${t.top_for_arg ? `"${t.top_for_arg}"` : '(none yet)'}
Strongest AGAINST argument: ${t.top_against_arg ? `"${t.top_against_arg}"` : '(none yet)'}`
    )
    .join('\n')

  const prompt = `You are the editorial writer for Lobby Market, a civic debate platform where citizens vote on policy topics and the best arguments become law. Today is ${today}.

Here are the top debates currently active on the platform:
${topicsText}

Write a civic editorial (NOT a news summary) analysing what these debates collectively reveal about where society is heading, where consensus is forming or fracturing, and what civic tensions these votes expose. You must:

1. Write a punchy HEADLINE (maximum 10 words) that captures the civic moment — not a list of topics, but a theme.
2. Write a one-sentence LEDE that hooks the reader into why this moment matters (maximum 30 words).
3. Write 3 paragraphs of editorial BODY prose. Reference specific topics by name but look for cross-cutting themes, contradictions, and what the vote splits reveal. Be intellectually curious and neutral — no partisan bias.

Respond ONLY with valid JSON in this exact format:
{
  "headline": "...",
  "lede": "...",
  "body": "paragraph one here\n\nparagraph two here\n\nparagraph three here"
}`

  let headline = 'Civic Voices Shape the Lobby'
  let lede = 'The community is debating the issues that matter most.'
  let body = topicsWithArgs
    .map((t) => `The debate over "${t.statement}" continues to draw votes.`)
    .join('\n\n')

  try {
    const client = new Anthropic()
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (textBlock && textBlock.type === 'text') {
      const raw = textBlock.text.trim()
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>
        headline = parsed.headline ?? headline
        lede = parsed.lede ?? lede
        body = parsed.body ?? body
      }
    }
  } catch (err) {
    console.error('[editorial] Claude generation error:', err)
  }

  const now = new Date().toISOString()

  // Cache in DB (upsert in case of a race condition)
  await supabase.from('daily_editorials').upsert(
    {
      date_key: today,
      headline,
      lede,
      body,
      topics_json: topicsWithArgs,
      model: 'claude-sonnet-4-6',
      generated_at: now,
    },
    { onConflict: 'date_key' }
  )

  return NextResponse.json({
    headline,
    lede,
    body,
    topics: topicsWithArgs,
    generated_at: now,
    date_key: today,
  } satisfies EditorialResponse)
}
