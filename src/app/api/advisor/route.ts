import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdvisorTopic {
  topic_id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  reason: string
  suggested_side: 'for' | 'against' | null
  priority: 'high' | 'medium'
  action: 'vote' | 'argue' | 'debate' | 'watch'
}

export interface AdvisorResponse {
  recommendations: AdvisorTopic[]
  summary: string
  civic_strength: string
  focus_area: string
  unavailable?: boolean
}

interface TopicRow {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number | null
  total_votes: number
  feed_score: number | null
}

// ─── POST /api/advisor ────────────────────────────────────────────────────────

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { unavailable: true } satisfies Partial<AdvisorResponse>,
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

  // ── Fetch user profile ─────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'display_name, role, total_votes, blue_vote_count, red_vote_count, vote_streak, category_preferences, civic_archetype, reputation_score, total_arguments'
    )
    .eq('id', user.id)
    .maybeSingle()

  // ── Fetch user's recent votes for category context ─────────────────────────
  const { data: recentVotes } = await supabase
    .from('votes')
    .select('side, topic:topics(statement, category, status)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // ── Fetch current hot topics (not yet voted on by user) ───────────────────
  const { data: userVotedIds } = await supabase
    .from('votes')
    .select('topic_id')
    .eq('user_id', user.id)

  const votedSet = new Set((userVotedIds ?? []).map((v) => v.topic_id as string))

  const { data: hotTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, feed_score')
    .in('status', ['active', 'voting', 'proposed'])
    .order('feed_score', { ascending: false })
    .limit(30)

  const unvotedTopics: TopicRow[] = (hotTopics ?? []).filter(
    (t) => !votedSet.has(t.id)
  )

  // Build context for Claude
  const totalVotes = profile?.total_votes ?? 0
  const blueCount = profile?.blue_vote_count ?? 0
  const forPct = totalVotes > 0 ? Math.round((blueCount / totalVotes) * 100) : 50
  const preferredCategories = (profile?.category_preferences ?? []).slice(0, 5)
  const archetype = profile?.civic_archetype ?? null
  const streak = profile?.vote_streak ?? 0
  const totalArgs = profile?.total_arguments ?? 0

  const recentVoteContext = (recentVotes ?? [])
    .slice(0, 10)
    .map((v) => {
      const t = Array.isArray(v.topic) ? v.topic[0] : v.topic
      if (!t) return null
      const topic = t as { statement?: string; category?: string; status?: string }
      return `[${v.side === 'blue' ? 'FOR' : 'AGAINST'}] ${topic.statement ?? ''} (${topic.category ?? 'general'})`
    })
    .filter(Boolean)
    .join('\n')

  const candidateTopics = unvotedTopics.slice(0, 15).map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category ?? 'General',
    status: t.status,
    blue_pct: Math.round(t.blue_pct ?? 50),
    total_votes: t.total_votes,
  }))

  const prompt = `You are the Civic Advisor for Lobby Market, a democratic consensus platform where citizens vote on policy topics and the winning side shapes legislation.

CITIZEN PROFILE:
- Total votes cast: ${totalVotes}
- Vote alignment: ${forPct}% FOR / ${100 - forPct}% AGAINST overall
- Vote streak: ${streak} days
- Arguments written: ${totalArgs}
- Preferred categories: ${preferredCategories.length > 0 ? preferredCategories.join(', ') : 'Not calibrated yet'}
- Civic archetype: ${archetype ?? 'Unknown'}

RECENT VOTING HISTORY (last 10 votes):
${recentVoteContext || 'No voting history yet — this is a new citizen.'}

AVAILABLE TOPICS TO ENGAGE WITH (not yet voted on):
${JSON.stringify(candidateTopics, null, 2)}

Based on this citizen's profile, interests, and current platform activity, select the 4-5 most important topics for them to engage with right now. Consider:
1. Their preferred categories and historical engagement
2. Topics where their vote could have maximum impact (close races)
3. Topics where their argument skill (if any) would help
4. A mix of easy wins and challenging debates
5. Topics ending soon (voting status) vs. building momentum (active/proposed)

Respond with ONLY valid JSON in this exact format:
{
  "summary": "A 1-2 sentence personalized greeting and summary of what the citizen should focus on today",
  "civic_strength": "One-line description of the citizen's civic strength (e.g., 'Progressive pragmatist with 47 votes cast')",
  "focus_area": "The main category or theme they should engage with today (one phrase)",
  "recommendations": [
    {
      "topic_id": "<id from candidates>",
      "statement": "<verbatim from candidates>",
      "category": "<category>",
      "status": "<status>",
      "blue_pct": <number>,
      "total_votes": <number>,
      "reason": "Why this citizen specifically should engage with this topic (1 sentence, personal and specific)",
      "suggested_side": "for" | "against" | null,
      "priority": "high" | "medium",
      "action": "vote" | "argue" | "debate" | "watch"
    }
  ]
}`

  try {
    const client = new Anthropic()
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') throw new Error('No text block')

    const raw = textBlock.text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')

    const parsed = JSON.parse(raw) as AdvisorResponse

    if (!Array.isArray(parsed.recommendations)) throw new Error('Invalid shape')

    return NextResponse.json({
      recommendations: parsed.recommendations.slice(0, 5),
      summary: parsed.summary ?? '',
      civic_strength: parsed.civic_strength ?? '',
      focus_area: parsed.focus_area ?? '',
    } satisfies AdvisorResponse)
  } catch (err) {
    console.error('[advisor] Claude error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
