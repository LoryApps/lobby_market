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

// ─── Context fetcher ─────────────────────────────────────────────────────────

async function fetchCivicContext(query: string) {
  const supabase = await createClient()

  // Search for relevant topics using full-text or ILIKE
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6)

  const [topicsRes, lawsRes, statsRes, argsRes] = await Promise.all([
    // Relevant topics (full-text search approximation)
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .or(keywords.map((k) => `statement.ilike.%${k}%`).join(','))
      .not('status', 'eq', 'archived')
      .order('total_votes', { ascending: false })
      .limit(8),

    // Recent laws
    supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes')
      .eq('status', 'law')
      .order('updated_at', { ascending: false })
      .limit(6),

    // Platform stats
    supabase
      .from('topics')
      .select('status', { count: 'exact' })
      .in('status', ['active', 'voting', 'law', 'proposed', 'failed']),

    // Top arguments for relevant topics
    supabase
      .from('topic_arguments')
      .select('content, side, upvotes, topic_id')
      .or(keywords.map((k) => `content.ilike.%${k}%`).join(','))
      .order('upvotes', { ascending: false })
      .limit(6),
  ])

  // Count stats
  const topics = topicsRes.data ?? []
  const laws = lawsRes.data ?? []
  const args = argsRes.data ?? []

  // Build a richer context from topic counts
  const allTopics = statsRes.data ?? []

  return { topics, laws, args, totalTopics: allTopics.length }
}

// ─── System prompt builder ───────────────────────────────────────────────────

function buildSystemPrompt(
  context: Awaited<ReturnType<typeof fetchCivicContext>>,
): string {
  const { topics, laws, args, totalTopics } = context

  const topicContext =
    topics.length > 0
      ? topics
          .map(
            (t) =>
              `• "${t.statement}" [${t.status.toUpperCase()}] — ${Math.round(t.blue_pct ?? 50)}% FOR, ${t.total_votes ?? 0} votes, ${t.category ?? 'General'}`,
          )
          .join('\n')
      : 'No directly relevant topics found.'

  const lawContext =
    laws.length > 0
      ? laws
          .map(
            (l) =>
              `• "${l.statement}" — ${Math.round(l.blue_pct ?? 50)}% FOR majority`,
          )
          .join('\n')
      : 'No recent laws.'

  const argContext =
    args.length > 0
      ? args
          .map(
            (a) =>
              `• [${a.side.toUpperCase()}] "${a.content.slice(0, 120)}${a.content.length > 120 ? '…' : ''}" (${a.upvotes ?? 0} upvotes)`,
          )
          .join('\n')
      : 'No relevant arguments found.'

  return `You are the Civic Counsel — the AI assistant for Lobby Market, a civic debate and consensus platform. Users vote FOR or AGAINST policy topics, write arguments, participate in debates, and topics can become established laws when they reach supermajority consensus.

PLATFORM OVERVIEW:
• Total active topics: ${totalTopics}
• Users vote FOR (blue) or AGAINST (red) on policy proposals
• Topics progress: proposed → active → voting → law (or failed)
• A topic becomes law at 60%+ FOR with sufficient votes
• The community can write arguments, participate in live debates, and predict outcomes

RELEVANT TOPICS FROM THE LOBBY:
${topicContext}

RECENT ESTABLISHED LAWS:
${lawContext}

RELEVANT ARGUMENTS FROM DEBATES:
${argContext}

YOUR ROLE:
- Answer questions about civic debates on the platform accurately
- Reference actual topics, laws, and arguments from the context above
- Be balanced — represent both FOR and AGAINST perspectives fairly
- When mentioning topics, format their names in quotes and note their status
- Suggest related topics users might want to vote on or argue about
- Keep answers focused and under 300 words unless depth is needed
- Cite approximate vote percentages when available
- Be genuinely helpful — this is a democratic deliberation platform
- Do NOT fabricate topics, laws, or statistics not shown in the context
- If asked about something not in context, say so and offer what you do know

Always end with a relevant prompt to engage further: a question, a suggested topic, or an invitation to share their view.`
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
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

  // Fetch relevant civic context based on the question
  const context = await fetchCivicContext(message)
  const systemPrompt = buildSystemPrompt(context)

  // Build conversation history for Claude
  const conversationHistory: Anthropic.MessageParam[] = [
    ...history.slice(-8).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: message.trim() },
  ]

  // Stream the response from Claude
  const client = new Anthropic({ apiKey })

  try {
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const stream = client.messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 600,
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
