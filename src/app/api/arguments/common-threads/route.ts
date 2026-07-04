import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Thread definitions ───────────────────────────────────────────────────────
// Each thread is a civic theme with keywords that trigger matching.
// We search argument content using ILIKE across all topic_arguments.

interface ThreadDef {
  id: string
  label: string
  description: string
  color: string
  bg: string
  border: string
  keywords: string[]
}

const THREADS: ThreadDef[] = [
  {
    id: 'individual_freedom',
    label: 'Individual Freedom',
    description: 'Arguments centred on personal rights, autonomy, and limiting state power',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    keywords: ['freedom', 'liberty', 'autonomy', 'rights', 'choice', 'individual', 'personal'],
  },
  {
    id: 'collective_good',
    label: 'Collective Good',
    description: 'Arguments emphasising shared benefits, community welfare, and social cohesion',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    keywords: ['collective', 'community', 'society', 'common good', 'public', 'shared', 'together'],
  },
  {
    id: 'economic_impact',
    label: 'Economic Impact',
    description: 'Arguments driven by financial costs, market forces, and economic consequences',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    keywords: ['cost', 'economic', 'market', 'money', 'financial', 'price', 'GDP', 'growth', 'jobs'],
  },
  {
    id: 'evidence_data',
    label: 'Evidence & Data',
    description: 'Arguments backed by studies, statistics, and empirical evidence',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    keywords: ['study', 'research', 'data', 'evidence', 'statistics', 'proven', 'science', 'according to'],
  },
  {
    id: 'moral_ethics',
    label: 'Moral & Ethics',
    description: 'Arguments grounded in ethical principles, justice, and moral reasoning',
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    keywords: ['moral', 'ethical', 'justice', 'right', 'wrong', 'fair', 'unfair', 'dignity', 'harm'],
  },
  {
    id: 'government_role',
    label: 'Role of Government',
    description: 'Arguments about what the state should or should not regulate',
    color: 'text-for-300',
    bg: 'bg-for-400/10',
    border: 'border-for-400/30',
    keywords: ['government', 'regulate', 'policy', 'law', 'state', 'legislation', 'federal', 'mandate'],
  },
  {
    id: 'future_generations',
    label: 'Future Generations',
    description: 'Arguments invoking long-term consequences and our duty to those who come after',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    keywords: ['future', 'generations', 'children', 'long-term', 'legacy', 'sustainable', 'next'],
  },
  {
    id: 'inequality',
    label: 'Inequality & Power',
    description: 'Arguments about disparities in wealth, power, access, and representation',
    color: 'text-against-400',
    bg: 'bg-against-600/10',
    border: 'border-against-600/30',
    keywords: ['inequality', 'privilege', 'power', 'wealth gap', 'discrimination', 'access', 'disparity'],
  },
]

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThreadArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  created_at: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  topic_blue_pct: number
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
}

export interface CommonThread {
  id: string
  label: string
  description: string
  color: string
  bg: string
  border: string
  arguments: ThreadArgument[]
  topic_count: number
}

export interface CommonThreadsResponse {
  threads: CommonThread[]
  cached_at: string
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const threadId = searchParams.get('thread') // optional filter
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '5', 10), 8)

  const supabase = await createClient()

  // Which threads to fetch
  const targetThreads = threadId
    ? THREADS.filter((t) => t.id === threadId)
    : THREADS

  const results: CommonThread[] = []

  for (const thread of targetThreads) {
    // Build OR condition for keyword matching across content
    // We want arguments from at least 2 different topics
    const keywordPattern = thread.keywords[0] // use primary keyword for DB query
    const allKeywords = thread.keywords

    // Fetch candidates using the primary keyword, then filter client-side
    const { data: rawArgs } = await supabase
      .from('topic_arguments')
      .select(`
        id,
        content,
        side,
        upvotes,
        created_at,
        topic_id,
        topics!topic_arguments_topic_id_fkey(
          statement,
          category,
          status,
          blue_pct
        ),
        profiles!topic_arguments_user_id_fkey(
          username,
          display_name,
          avatar_url
        )
      `)
      .ilike('content', `%${keywordPattern}%`)
      .gte('upvotes', 1)
      .order('upvotes', { ascending: false })
      .limit(60)

    if (!rawArgs || rawArgs.length === 0) {
      results.push({ ...thread, arguments: [], topic_count: 0 })
      continue
    }

    // Filter: argument must match at least one keyword (broader check)
    // and come from an active/law/voting topic
    type RawArg = {
      id: string
      content: string
      side: 'blue' | 'red'
      upvotes: number
      created_at: string
      topic_id: string
      topics: { statement: string; category: string | null; status: string; blue_pct: number } | null
      profiles: { username: string | null; display_name: string | null; avatar_url: string | null } | null
    }

    const validStatuses = new Set(['active', 'voting', 'law', 'proposed'])

    const filtered: ThreadArgument[] = (rawArgs as unknown as RawArg[])
      .filter((a) => {
        if (!a.topics || !validStatuses.has(a.topics.status)) return false
        const lower = a.content.toLowerCase()
        return allKeywords.some((kw) => lower.includes(kw.toLowerCase()))
      })
      .slice(0, limit * 3) // fetch extra, dedupe by topic below
      .reduce<{ seen: Set<string>; items: ThreadArgument[] }>(
        (acc, a) => {
          if (!a.topics) return acc
          // Max 2 arguments per topic for diversity
          const topicArgs = acc.items.filter((x) => x.topic_id === a.topic_id)
          if (topicArgs.length >= 2) return acc
          acc.seen.add(a.topic_id)
          acc.items.push({
            id: a.id,
            content: a.content,
            side: a.side,
            upvotes: a.upvotes,
            created_at: a.created_at,
            topic_id: a.topic_id,
            topic_statement: a.topics.statement,
            topic_category: a.topics.category,
            topic_status: a.topics.status,
            topic_blue_pct: a.topics.blue_pct,
            author_username: a.profiles?.username ?? null,
            author_display_name: a.profiles?.display_name ?? null,
            author_avatar_url: a.profiles?.avatar_url ?? null,
          })
          return acc
        },
        { seen: new Set(), items: [] }
      )

    const finalArgs = filtered.items.slice(0, limit)
    const uniqueTopics = new Set(finalArgs.map((a) => a.topic_id))

    results.push({
      ...thread,
      arguments: finalArgs,
      topic_count: uniqueTopics.size,
    })
  }

  // Sort threads by argument count (most populated first)
  results.sort((a, b) => b.arguments.length - a.arguments.length)

  return NextResponse.json({
    threads: results,
    cached_at: new Date().toISOString(),
  } satisfies CommonThreadsResponse)
}
