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

// ─── Algorithmic fallback (no API key) ────────────────────────────────────────

async function algorithmicAdvice(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<AdvisorResponse> {
  const [profileRes, votedRes, hotRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, role, total_votes, blue_vote_count, vote_streak, category_preferences, civic_archetype, reputation_score, total_arguments')
      .eq('id', userId)
      .maybeSingle(),
    supabase.from('votes').select('topic_id, side, topic:topics(category)').eq('user_id', userId).limit(100),
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, feed_score')
      .in('status', ['active', 'voting', 'proposed'])
      .order('feed_score', { ascending: false })
      .limit(40),
  ])

  const profile = profileRes.data
  const votedRows = votedRes.data ?? []
  const allTopics = hotRes.data ?? []

  const votedSet = new Set(votedRows.map((v) => v.topic_id as string))
  const unvoted: TopicRow[] = allTopics.filter((t) => !votedSet.has(t.id))

  // Build category affinity from past votes
  const catCounts: Record<string, number> = {}
  for (const v of votedRows) {
    const cat = (Array.isArray(v.topic) ? v.topic[0] : v.topic)?.category
    if (cat) catCounts[cat] = (catCounts[cat] ?? 0) + 1
  }
  const preferredCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 3)
  const prefSet = new Set(preferredCats.length > 0 ? preferredCats : (profile?.category_preferences ?? []))

  // Score topics: preferred category +3, near law +2 (≥62%), voting status +2, high votes +1
  const scored = unvoted.map((t) => {
    let score = 0
    if (t.category && prefSet.has(t.category)) score += 3
    if ((t.blue_pct ?? 50) >= 62) score += 2
    if (t.status === 'voting') score += 2
    if (t.total_votes > 20) score += 1
    score += (t.feed_score ?? 0) / 100
    return { t, score }
  })
  scored.sort((a, b) => b.score - a.score)
  const top5 = scored.slice(0, 5).map(({ t }) => t)

  const totalVotes = profile?.total_votes ?? 0
  const blueCount = profile?.blue_vote_count ?? 0
  const forPct = totalVotes > 0 ? Math.round((blueCount / totalVotes) * 100) : 50
  const streak = profile?.vote_streak ?? 0
  const totalArgs = profile?.total_arguments ?? 0
  const role = profile?.role ?? 'person'
  const archetype = profile?.civic_archetype ?? null

  const roleLabel: Record<string, string> = { person: 'Citizen', debator: 'Debator', troll_catcher: 'Troll Catcher', elder: 'Elder', lawmaker: 'Lawmaker', senator: 'Senator' }
  const label = roleLabel[role] ?? 'Citizen'

  const summary =
    totalVotes === 0
      ? "Welcome to the Lobby! Here are the most active debates to get you started. Cast your first vote to calibrate your civic profile."
      : `You've cast ${totalVotes} votes (${forPct}% FOR). Here are the topics most worth your attention right now.`

  const civic_strength = archetype
    ? `${archetype} · ${label} · ${totalVotes} votes, ${totalArgs} arguments`
    : `${label} · ${totalVotes} votes cast${streak > 1 ? `, ${streak}-day streak` : ''}`

  const focus_area = preferredCats[0] ?? (top5[0]?.category ?? 'General')

  const recommendations: AdvisorTopic[] = top5.map((t) => {
    const forPctT = Math.round(t.blue_pct ?? 50)
    const isClose = forPctT >= 45 && forPctT <= 65
    const nearLaw = forPctT >= 62

    let reason: string
    let action: AdvisorTopic['action'] = 'vote'
    let priority: AdvisorTopic['priority'] = 'medium'
    let suggested_side: AdvisorTopic['suggested_side'] = null

    if (t.status === 'voting') {
      reason = `Final voting is open — your vote counts extra weight right now.`
      action = 'vote'
      priority = 'high'
    } else if (nearLaw) {
      reason = `${forPctT}% FOR — close to becoming law. A few more votes could tip it.`
      action = 'vote'
      priority = 'high'
      suggested_side = 'for'
    } else if (isClose) {
      reason = `Contested at ${forPctT}% FOR — genuinely close debate that needs more voices.`
      action = totalArgs > 0 ? 'argue' : 'vote'
      priority = 'high'
    } else if (t.category && prefSet.has(t.category)) {
      reason = `${t.category} is one of your top categories — you have relevant context here.`
      action = 'vote'
      priority = 'medium'
    } else {
      reason = `Currently trending with ${t.total_votes} votes — a key debate to have on your radar.`
      action = 'watch'
      priority = 'medium'
    }

    if (forPct > 60 && !suggested_side) suggested_side = 'for'
    else if (forPct < 40 && !suggested_side) suggested_side = 'against'

    return {
      topic_id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: forPctT,
      total_votes: t.total_votes,
      reason,
      suggested_side,
      priority,
      action,
    }
  })

  return { recommendations, summary, civic_strength, focus_area }
}

// ─── POST /api/advisor ────────────────────────────────────────────────────────

export async function POST() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Algorithmic fallback when no API key ───────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await algorithmicAdvice(supabase, user.id)
      return NextResponse.json(result)
    } catch (err) {
      console.error('[advisor:fallback]', err)
      return NextResponse.json(
        { unavailable: true } satisfies Partial<AdvisorResponse>,
        { status: 200 }
      )
    }
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
