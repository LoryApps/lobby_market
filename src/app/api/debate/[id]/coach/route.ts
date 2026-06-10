import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoachArgument {
  id: string
  content: string
  upvotes: number
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface OpponentProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  total_votes: number
  total_debates: number
  reputation_score: number
}

export interface CoachBrief {
  opening_hook: string
  core_points: string[]
  anticipate: string[]
  closing_line: string
  strategy_tip: string
  unavailable?: boolean
}

export interface CoachResponse {
  debate: {
    id: string
    title: string
    type: string
    status: string
    scheduled_at: string
    topic: {
      id: string
      statement: string
      description: string | null
      category: string | null
      blue_pct: number
      total_votes: number
    }
  }
  user_side: 'blue' | 'red'
  opponent: OpponentProfile | null
  your_arguments: CoachArgument[]
  their_arguments: CoachArgument[]
  brief: CoachBrief | null
  consensus_note: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  quick: 'Quick Debate (15 min)',
  grand: 'Grand Debate (45 min)',
  tribunal: 'Tribunal (60 min)',
  oxford: 'Oxford-Style',
  town_hall: 'Town Hall',
  rapid_fire: 'Rapid Fire',
  panel: 'Panel',
}

function buildBriefPrompt(
  topicStatement: string,
  category: string | null,
  side: 'blue' | 'red',
  debateType: string,
  yourArgs: CoachArgument[],
  theirArgs: CoachArgument[],
  forPct: number,
  opponentName: string | null,
): string {
  const sideLabel = side === 'blue' ? 'FOR (in favour of)' : 'AGAINST'
  const typeLabel = TYPE_LABEL[debateType] ?? debateType

  const topYours = yourArgs
    .slice(0, 3)
    .map((a, i) => `${i + 1}. "${a.content.slice(0, 200)}"`)
    .join('\n')

  const topTheirs = theirArgs
    .slice(0, 3)
    .map((a, i) => `${i + 1}. "${a.content.slice(0, 200)}"`)
    .join('\n')

  const opponentLine = opponentName
    ? `Your opponent is ${opponentName}.`
    : 'Your opponent has not yet been identified.'

  return `You are preparing a civic debater for a live ${typeLabel} on Lobby Market.

Debate topic: "${topicStatement}"${category ? ` (Category: ${category})` : ''}
Your side: ${sideLabel}
Current platform vote: ${forPct}% FOR / ${100 - forPct}% AGAINST
${opponentLine}

Top arguments supporting YOUR side:
${topYours || 'No arguments posted yet.'}

Top arguments from the OPPOSING side:
${topTheirs || 'No opposing arguments posted yet.'}

Write a compact debate coaching brief. Return ONLY valid JSON:
{
  "opening_hook": "A single punchy sentence to open with — memorable, specific, confident",
  "core_points": ["point 1 (max 20 words)", "point 2 (max 20 words)", "point 3 (max 20 words)"],
  "anticipate": ["their likely attack 1 — and your counter (max 25 words)", "their likely attack 2 — and your counter (max 25 words)"],
  "closing_line": "A single sentence to close on — leave the audience thinking",
  "strategy_tip": "One tactical insight for this specific debate format and topic (max 30 words)"
}`
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Fetch debate ──────────────────────────────────────────────────────────
  const { data: debate } = await supabase
    .from('debates')
    .select('id, title, type, status, scheduled_at, topic_id')
    .eq('id', params.id)
    .single()

  if (!debate) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
  }

  // ── Fetch topic ───────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, description, category, blue_pct, total_votes')
    .eq('id', debate.topic_id)
    .single()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // ── Determine user's side ─────────────────────────────────────────────────
  const { data: myParticipant } = await supabase
    .from('debate_participants')
    .select('side')
    .eq('debate_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  const userSide: 'blue' | 'red' =
    myParticipant?.side === 'red' ? 'red' : 'blue'
  const opponentSide: 'blue' | 'red' = userSide === 'blue' ? 'red' : 'blue'

  // ── Fetch opponent ────────────────────────────────────────────────────────
  const { data: opponentParticipant } = await supabase
    .from('debate_participants')
    .select('user_id')
    .eq('debate_id', params.id)
    .eq('side', opponentSide)
    .neq('user_id', user.id)
    .maybeSingle()

  let opponent: OpponentProfile | null = null
  if (opponentParticipant?.user_id) {
    const { data: opProfile } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, total_votes, reputation_score')
      .eq('id', opponentParticipant.user_id)
      .maybeSingle()

    if (opProfile) {
      // Count debate wins/losses from participation history
      const { count: winsCount } = await supabase
        .from('debate_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', opponentParticipant.user_id)
        .eq('is_speaker', true)

      opponent = {
        id: opProfile.id,
        username: opProfile.username,
        display_name: opProfile.display_name ?? null,
        avatar_url: opProfile.avatar_url ?? null,
        role: opProfile.role ?? 'person',
        clout: opProfile.clout ?? 0,
        total_votes: opProfile.total_votes ?? 0,
        total_debates: winsCount ?? 0,
        reputation_score: opProfile.reputation_score ?? 0,
      }
    }
  }

  // ── Fetch top arguments for both sides ────────────────────────────────────
  const argSideFilter: Record<'blue' | 'red', string> = {
    blue: 'blue',
    red: 'red',
  }

  const { data: yourArgRows } = await supabase
    .from('topic_arguments')
    .select('id, content, upvotes, user_id')
    .eq('topic_id', topic.id)
    .eq('side', argSideFilter[userSide])
    .order('upvotes', { ascending: false })
    .limit(5)

  const { data: theirArgRows } = await supabase
    .from('topic_arguments')
    .select('id, content, upvotes, user_id')
    .eq('topic_id', topic.id)
    .eq('side', argSideFilter[opponentSide])
    .order('upvotes', { ascending: false })
    .limit(5)

  // Hydrate authors
  async function hydrateArgs(
    rows: Array<{ id: string; content: string; upvotes: number; user_id: string }> | null
  ): Promise<CoachArgument[]> {
    if (!rows?.length) return []
    const ids = rows.map((r) => r.user_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', ids)
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
    return rows.map((r) => ({
      id: r.id,
      content: r.content,
      upvotes: r.upvotes ?? 0,
      author: profileMap.get(r.user_id) ?? null,
    }))
  }

  const [yourArguments, theirArguments] = await Promise.all([
    hydrateArgs(yourArgRows ?? []),
    hydrateArgs(theirArgRows ?? []),
  ])

  // ── Consensus note ────────────────────────────────────────────────────────
  const forPct = Math.round(topic.blue_pct ?? 50)
  let consensusNote = ''
  if (userSide === 'blue') {
    consensusNote =
      forPct >= 60
        ? `The platform leans FOR (${forPct}%) — you're defending the majority view.`
        : forPct <= 40
        ? `Only ${forPct}% are FOR — you're swimming upstream. Make every word count.`
        : `The platform is evenly split (${forPct}% FOR). You have a real chance to sway the result.`
  } else {
    consensusNote =
      forPct <= 40
        ? `The platform leans AGAINST (${100 - forPct}%) — you're defending the majority view.`
        : forPct >= 60
        ? `You're arguing against the grain — only ${100 - forPct}% AGAINST. Bold move.`
        : `The platform is evenly split (${100 - forPct}% AGAINST). High stakes.`
  }

  // ── AI brief ──────────────────────────────────────────────────────────────
  let brief: CoachBrief | null = null

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic()
      const prompt = buildBriefPrompt(
        topic.statement,
        topic.category ?? null,
        userSide,
        debate.type,
        yourArguments,
        theirArguments,
        forPct,
        opponent?.display_name ?? opponent?.username ?? null,
      )

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      })

      const raw =
        message.content[0].type === 'text' ? message.content[0].text.trim() : ''
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Partial<CoachBrief>
        brief = {
          opening_hook: parsed.opening_hook ?? '',
          core_points: parsed.core_points ?? [],
          anticipate: parsed.anticipate ?? [],
          closing_line: parsed.closing_line ?? '',
          strategy_tip: parsed.strategy_tip ?? '',
        }
      }
    } catch {
      // graceful degradation
    }
  }

  if (!brief) {
    brief = {
      opening_hook: '',
      core_points: [],
      anticipate: [],
      closing_line: '',
      strategy_tip: '',
      unavailable: true,
    }
  }

  const response: CoachResponse = {
    debate: {
      id: debate.id,
      title: debate.title,
      type: debate.type,
      status: debate.status,
      scheduled_at: debate.scheduled_at,
      topic: {
        id: topic.id,
        statement: topic.statement,
        description: (topic as { description?: string | null }).description ?? null,
        category: topic.category ?? null,
        blue_pct: forPct,
        total_votes: topic.total_votes ?? 0,
      },
    },
    user_side: userSide,
    opponent,
    your_arguments: yourArguments,
    their_arguments: theirArguments,
    brief,
    consensus_note: consensusNote,
  }

  return NextResponse.json(response)
}
