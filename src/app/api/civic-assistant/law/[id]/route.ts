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

async function fetchLawContext(lawId: string) {
  const supabase = await createClient()

  const [lawRes, revisionsRes, linksOutRes, linksInRes, reviewsRes] = await Promise.all([
    supabase
      .from('laws')
      .select('id, statement, full_statement, category, blue_pct, total_votes, established_at, is_active, topic_id')
      .eq('id', lawId)
      .single(),

    // Revision history
    supabase
      .from('law_revisions')
      .select('id, summary, proposed_at, status')
      .eq('law_id', lawId)
      .order('proposed_at', { ascending: false })
      .limit(5),

    // Outgoing law links (laws this one references)
    supabase
      .from('law_links')
      .select('target_law_id')
      .eq('source_law_id', lawId)
      .limit(8),

    // Incoming law links (laws that reference this one)
    supabase
      .from('law_links')
      .select('source_law_id')
      .eq('target_law_id', lawId)
      .limit(8),

    // Community reviews
    supabase
      .from('law_reviews')
      .select('content, rating, created_at')
      .eq('law_id', lawId)
      .order('created_at', { ascending: false })
      .limit(4),
  ])

  const law = lawRes.data

  // Fetch linked law statements if we have IDs
  let outgoingLaws: Array<{ id: string; statement: string; category: string | null }> = []
  let incomingLaws: Array<{ id: string; statement: string; category: string | null }> = []

  if (law) {
    const outIds = (linksOutRes.data ?? []).map((r) => r.target_law_id)
    const inIds = (linksInRes.data ?? []).map((r) => r.source_law_id)

    const [outLaws, inLaws] = await Promise.all([
      outIds.length > 0
        ? supabase
            .from('laws')
            .select('id, statement, category')
            .in('id', outIds)
        : { data: [] },
      inIds.length > 0
        ? supabase
            .from('laws')
            .select('id, statement, category')
            .in('id', inIds)
        : { data: [] },
    ])
    outgoingLaws = (outLaws.data ?? []) as typeof outgoingLaws
    incomingLaws = (inLaws.data ?? []) as typeof incomingLaws

    // Also fetch top arguments from the originating topic
    if (law.topic_id) {
      const { data: args } = await supabase
        .from('topic_arguments')
        .select('content, side, upvotes, ai_grade')
        .eq('topic_id', law.topic_id)
        .order('upvotes', { ascending: false })
        .limit(10)

      return {
        law,
        revisions: revisionsRes.data ?? [],
        outgoingLaws,
        incomingLaws,
        reviews: reviewsRes.data ?? [],
        args: args ?? [],
      }
    }
  }

  return {
    law,
    revisions: revisionsRes.data ?? [],
    outgoingLaws,
    incomingLaws,
    reviews: reviewsRes.data ?? [],
    args: [],
  }
}

function buildLawSystemPrompt(
  ctx: Awaited<ReturnType<typeof fetchLawContext>>,
): string {
  const { law, revisions, outgoingLaws, incomingLaws, reviews, args } = ctx

  if (!law) {
    return `You are the Civic Counsel for Lobby Market — a civic debate and consensus platform. The requested law could not be found. Help the user understand how laws are established on the platform.`
  }

  const forPct = Math.round(law.blue_pct ?? 50)
  const establishedDate = law.established_at
    ? new Date(law.established_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown date'

  const forArgs = args.filter((a: { side: string }) => a.side === 'blue')
  const againstArgs = args.filter((a: { side: string }) => a.side === 'red')

  const argBlock = (items: typeof args, label: string) => {
    if (items.length === 0) return `  No ${label} arguments on record.`
    return items
      .slice(0, 4)
      .map(
        (a: { content: string; upvotes: number; ai_grade?: string }) =>
          `  • "${a.content.slice(0, 200)}${a.content.length > 200 ? '…' : ''}" (${a.upvotes ?? 0} upvotes${a.ai_grade ? `, AI grade: ${a.ai_grade}` : ''})`,
      )
      .join('\n')
  }

  const revisionsBlock =
    revisions.length > 0
      ? revisions
          .map(
            (r: { summary?: string; status: string; proposed_at: string }) =>
              `  • [${r.status}] "${(r.summary ?? 'No summary').slice(0, 120)}" — ${new Date(r.proposed_at).toLocaleDateString()}`,
          )
          .join('\n')
      : '  No revisions proposed yet.'

  const relatedBlock = [
    ...outgoingLaws.map((l) => `  → ${l.statement.slice(0, 100)} (${l.category ?? 'General'})`),
    ...incomingLaws.map((l) => `  ← ${l.statement.slice(0, 100)} (${l.category ?? 'General'})`),
  ].join('\n') || '  No linked laws in the Codex.'

  const reviewsBlock =
    reviews.length > 0
      ? reviews
          .map(
            (r: { content?: string; rating?: number }) =>
              `  • ${r.rating ? `[${r.rating}/5] ` : ''}${(r.content ?? '').slice(0, 150)}`,
          )
          .join('\n')
      : '  No community reviews yet.'

  return `You are the Civic Counsel for Lobby Market — a civic debate and consensus platform. You are a SPECIALIST ADVISOR for a SPECIFIC ESTABLISHED LAW in the Lobby Market Codex. Every answer you give must reference this law's data directly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LAW: "${law.statement}"

CATEGORY: ${law.category ?? 'Uncategorized'}
STATUS: ${law.is_active ? 'Active Law — currently in effect' : 'Inactive — may have been superseded'}
ESTABLISHED: ${establishedDate}
ORIGINAL VOTE: ${forPct}% FOR, ${100 - forPct}% AGAINST (${(law.total_votes ?? 0).toLocaleString()} total votes)

FULL TEXT:
${law.full_statement ? law.full_statement.slice(0, 800) : 'No extended text — law is stated in the title above.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TOP ARGUMENTS THAT HELPED ESTABLISH THIS LAW:

FOR arguments:
${argBlock(forArgs, 'FOR')}

AGAINST arguments (minority position):
${argBlock(againstArgs, 'AGAINST')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REVISION HISTORY:
${revisionsBlock}

RELATED LAWS IN THE CODEX (→ references, ← referenced by):
${relatedBlock}

COMMUNITY REVIEWS:
${reviewsBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INSTRUCTIONS:
• You are an expert analyst on this specific law. Answer questions about its origins, implications, and civic context.
• Reference actual vote percentages, established date, and revision history in your answers.
• When asked about the law's impact, reason from the arguments that were made during the debate.
• You can discuss real-world analogues, historical precedents, and how similar policies work elsewhere.
• For questions about proposing amendments or revisions, guide users to the platform's amendment process.
• Keep responses focused: 150-300 words unless the user needs depth.
• Be intellectually rigorous but accessible — this is civic discourse.
• Do NOT take a personal position on whether the law was right or wrong; present context fairly.
• If asked to critique the law, give a balanced analysis of its strengths and weaknesses.
• Always invite the user to engage: read the full codex, propose a revision, or check related laws.`
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

  const ctx = await fetchLawContext(params.id)
  const systemPrompt = buildLawSystemPrompt(ctx)

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
