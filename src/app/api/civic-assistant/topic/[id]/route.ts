import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  message: string
  history?: Message[]
}

async function fetchTopicContext(topicId: string) {
  const supabase = await createClient()

  const [topicRes, argsRes, relatedRes, debatesRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, description, category, scope, status, blue_pct, red_votes, blue_votes, total_votes, created_at, tags')
      .eq('id', topicId)
      .single(),

    supabase
      .from('topic_arguments')
      .select('content, side, upvotes, ai_grade, ai_score')
      .eq('topic_id', topicId)
      .order('upvotes', { ascending: false })
      .limit(12),

    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .neq('id', topicId)
      .not('status', 'eq', 'archived')
      .order('total_votes', { ascending: false })
      .limit(6),

    supabase
      .from('debates')
      .select('title, scheduled_at, status, type')
      .eq('topic_id', topicId)
      .order('scheduled_at', { ascending: false })
      .limit(3),
  ])

  return {
    topic: topicRes.data,
    args: argsRes.data ?? [],
    related: relatedRes.data ?? [],
    debates: (debatesRes.data ?? []) as Array<{
      title: string
      scheduled_at: string | null
      status: string
      type: string
    }>,
  }
}

function buildTopicSystemPrompt(
  ctx: Awaited<ReturnType<typeof fetchTopicContext>>,
): string {
  const { topic, args, related, debates } = ctx

  if (!topic) {
    return `You are the Civic Counsel for Lobby Market — a civic debate platform. The requested topic could not be found. Help the user navigate the platform.`
  }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const statusLabel: Record<string, string> = {
    proposed: 'Proposed (gathering support)',
    active: 'Active (open for arguments and votes)',
    voting: 'In Final Voting Phase',
    law: 'Established Law',
    failed: 'Failed to pass',
  }

  const forArgs = args.filter((a) => a.side === 'blue')
  const againstArgs = args.filter((a) => a.side === 'red')

  const argBlock = (items: typeof args, label: string) => {
    if (items.length === 0) return `  No ${label} arguments yet.`
    return items
      .slice(0, 5)
      .map(
        (a) =>
          `  • "${a.content.slice(0, 200)}${a.content.length > 200 ? '…' : ''}" (${a.upvotes ?? 0} upvotes${a.ai_grade ? `, AI grade: ${a.ai_grade}` : ''})`,
      )
      .join('\n')
  }

  const debateBlock =
    debates.length > 0
      ? debates
          .map(
            (d) =>
              `  • ${d.title} [${d.status}] — ${d.type} format`,
          )
          .join('\n')
      : '  No debates scheduled.'

  const relatedBlock =
    related.length > 0
      ? related
          .slice(0, 5)
          .map(
            (r) =>
              `  • "${r.statement}" [${r.status}] — ${Math.round(r.blue_pct ?? 50)}% FOR`,
          )
          .join('\n')
      : '  No related topics found.'

  return `You are the Civic Counsel for Lobby Market — a civic debate and consensus platform. You are a SPECIALIST ADVISOR for a single specific debate topic. Every answer you give must reference this topic's data directly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE TOPIC YOU ARE ADVISING ON:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Statement: "${topic.statement}"
Status: ${statusLabel[topic.status] ?? topic.status}
Category: ${topic.category ?? 'General'}
Scope: ${topic.scope ?? 'Global'}
Vote Split: ${forPct}% FOR (${topic.blue_votes ?? 0} votes) vs ${againstPct}% AGAINST (${topic.red_votes ?? 0} votes)
Total Votes Cast: ${(topic.total_votes ?? 0).toLocaleString()}
${topic.description ? `\nDescription: "${topic.description}"` : ''}
${topic.tags && topic.tags.length > 0 ? `Tags: ${topic.tags.join(', ')}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOP ARGUMENTS FOR (${forArgs.length} total):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${argBlock(forArgs, 'FOR')}

TOP ARGUMENTS AGAINST (${againstArgs.length} total):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${argBlock(againstArgs, 'AGAINST')}

DEBATES ABOUT THIS TOPIC:
━━━━━━━━━━━━━━━━━━━━━━━━━
${debateBlock}

RELATED TOPICS ON THE PLATFORM:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${relatedBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR ROLE AS TOPIC COUNSEL:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• You are a neutral, expert advisor SPECIFICALLY for this debate
• Explain the strongest case on BOTH sides, citing the actual arguments above
• Help users understand the implications, trade-offs, and nuances
• Reference actual vote percentages and argument quality scores
• When a user asks "what do supporters say?" — use the FOR arguments
• When a user asks "what do opponents say?" — use the AGAINST arguments
• You can discuss real-world analogues, historical precedents, and policy impacts
• Keep responses focused: 150-300 words unless the user needs depth
• Be intellectually rigorous but accessible — this is civic discourse
• Do NOT take a personal position; present both sides fairly
• If asked to steelman an argument, give the best charitable version
• Always invite the user to engage: share their view, vote, or write an argument`
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI features are not configured for this deployment.' },
      { status: 503 },
    )
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { message, history = [] } = body

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
  }

  if (message.trim().length > 1000) {
    return NextResponse.json({ error: 'Message too long.' }, { status: 400 })
  }

  const ctx = await fetchTopicContext(params.id)
  const systemPrompt = buildTopicSystemPrompt(ctx)

  const conversationHistory: Anthropic.MessageParam[] = [
    ...history.slice(-8).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: message.trim() },
  ]

  const client = new Anthropic({ apiKey })

  try {
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const stream = client.messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 700,
            system: systemPrompt,
            messages: conversationHistory,
          })

          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text))
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'AI unavailable'
          controller.enqueue(
            encoder.encode(`\n\n[Counsel temporarily unavailable: ${msg}]`),
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: `AI service error: ${msg}` },
      { status: 500 },
    )
  }
}
