import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SpeakerAnalysis {
  username: string
  display_name: string | null
  side: 'for' | 'against'
  rhetorical_style: string
  strongest_argument: string
  main_weakness: string
  persuasion_score: number // 1–10
}

export interface KeyExchange {
  description: string
}

export interface FallacyDetected {
  type: string
  by: string // username
  example: string
}

export interface DebateAnalysis {
  overall_quality: number // 1–10
  quality_label: string // 'Outstanding' | 'Strong' | 'Solid' | 'Mixed' | 'Weak'
  verdict_analysis: string
  key_turning_point: string
  for_speaker: SpeakerAnalysis | null
  against_speaker: SpeakerAnalysis | null
  fallacies: FallacyDetected[]
  key_exchanges: KeyExchange[]
  audience_takeaway: string
  intellectual_honesty: string // overall assessment of the debate's epistemic quality
  unavailable?: boolean
}

export interface DebateAnalysisResponse {
  debate: {
    id: string
    title: string
    type: string
    status: string
    blue_sway: number
    red_sway: number
    started_at: string | null
    ended_at: string | null
    topic: {
      id: string
      statement: string
      category: string | null
    } | null
    blue_speaker: {
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
    } | null
    red_speaker: {
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
    } | null
  }
  analysis: DebateAnalysis
  cached: boolean
  winner_poll: { blue: number; red: number; tie: number; total: number } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const QUALITY_LABELS: Record<number, string> = {
  9: 'Outstanding',
  8: 'Excellent',
  7: 'Strong',
  6: 'Solid',
  5: 'Competent',
  4: 'Mixed',
  3: 'Weak',
  2: 'Poor',
  1: 'Very Poor',
}

function qualityLabel(score: number): string {
  const clamped = Math.min(10, Math.max(1, Math.round(score)))
  return QUALITY_LABELS[clamped] ?? QUALITY_LABELS[Math.round(clamped / 2) * 2] ?? 'Competent'
}

function buildAnalysisPrompt(
  topicStatement: string,
  category: string | null,
  blueName: string,
  redName: string,
  blueSway: number,
  redSway: number,
  topMessages: Array<{ content: string; side: string | null; author: string; upvotes: number }>,
  winnerPoll: { blue: number; red: number; tie: number } | null,
): string {
  const topMsgs = topMessages
    .slice(0, 20)
    .map((m) => `[${m.side === 'blue' ? 'FOR' : m.side === 'red' ? 'AGAINST' : 'NEUTRAL'} — ${m.author}] (${m.upvotes} upvotes): ${m.content.slice(0, 200)}`)
    .join('\n')

  const pollSummary = winnerPoll
    ? `Audience winner poll: FOR ${winnerPoll.blue}, AGAINST ${winnerPoll.red}, Tie ${winnerPoll.tie}`
    : 'No audience poll data.'

  return `You are an expert debate analyst and rhetorical critic. Analyse the following civic debate and return a JSON object.

TOPIC: "${topicStatement}"
CATEGORY: ${category ?? 'General'}
FOR side speaker: ${blueName} (sway contribution: ${blueSway > 0 ? `+${blueSway}` : blueSway}pp)
AGAINST side speaker: ${redName} (sway contribution: ${redSway > 0 ? `+${redSway}` : redSway}pp)
${pollSummary}

TOP MESSAGES FROM DEBATE:
${topMsgs || 'No messages recorded.'}

Return ONLY a valid JSON object with this exact structure (no markdown fences):
{
  "overall_quality": <integer 1-10>,
  "verdict_analysis": "<2-3 sentences explaining who won and why>",
  "key_turning_point": "<1-2 sentences describing the decisive moment>",
  "for_speaker": {
    "rhetorical_style": "<one descriptive phrase, e.g. 'Evidence-driven pragmatist'>",
    "strongest_argument": "<quote or paraphrase of their best point, max 100 chars>",
    "main_weakness": "<one sentence describing their biggest flaw>",
    "persuasion_score": <integer 1-10>
  },
  "against_speaker": {
    "rhetorical_style": "<one descriptive phrase>",
    "strongest_argument": "<quote or paraphrase of their best point, max 100 chars>",
    "main_weakness": "<one sentence>",
    "persuasion_score": <integer 1-10>
  },
  "fallacies": [
    { "type": "<fallacy name>", "by": "<speaker name>", "example": "<brief example, max 80 chars>" }
  ],
  "key_exchanges": [
    { "description": "<one sentence describing a notable exchange>" }
  ],
  "audience_takeaway": "<one sentence: what a thoughtful observer should walk away believing>",
  "intellectual_honesty": "<one sentence: overall epistemic quality of the debate>"
}

Limit fallacies to 3 max. Limit key_exchanges to 3 max. Be honest and critical.`
}

function fallbackAnalysis(blueName: string, redName: string, blueSway: number, redSway: number): DebateAnalysis {
  const forWon = blueSway >= redSway
  return {
    overall_quality: 6,
    quality_label: 'Solid',
    verdict_analysis: `${forWon ? blueName : redName} appeared to have the stronger performance based on sway metrics, though a full assessment requires reviewing the transcript.`,
    key_turning_point: 'Key moments can be found in the Highlights tab.',
    for_speaker: {
      username: blueName,
      display_name: null,
      side: 'for',
      rhetorical_style: 'Civic advocate',
      strongest_argument: 'See highlights for top arguments.',
      main_weakness: 'Analysis unavailable — check back later.',
      persuasion_score: blueSway > 0 ? 7 : 5,
    },
    against_speaker: {
      username: redName,
      display_name: null,
      side: 'against',
      rhetorical_style: 'Critical challenger',
      strongest_argument: 'See highlights for top arguments.',
      main_weakness: 'Analysis unavailable — check back later.',
      persuasion_score: redSway > 0 ? 7 : 5,
    },
    fallacies: [],
    key_exchanges: [{ description: 'Review the transcript for detailed exchange analysis.' }],
    audience_takeaway: 'This debate offered perspectives from both sides. Form your own view.',
    intellectual_honesty: 'Analysis generation is temporarily unavailable.',
    unavailable: true,
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { id } = params

  // 1. Check cache
  const { data: cached } = await supabase
    .from('debate_analyses')
    .select('analysis, generated_at')
    .eq('debate_id', id)
    .maybeSingle()

  // 2. Fetch debate + participants
  const { data: debate } = await supabase
    .from('debates')
    .select(`
      id, title, type, status, blue_sway, red_sway, started_at, ended_at, topic_id, viewer_count,
      blue_speaker:profiles!debates_blue_speaker_id_fkey(id, username, display_name, avatar_url),
      red_speaker:profiles!debates_red_speaker_id_fkey(id, username, display_name, avatar_url)
    `)
    .eq('id', id)
    .single()

  if (!debate) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
  }

  // 3. Fetch topic
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category')
    .eq('id', debate.topic_id)
    .maybeSingle()

  // 4. Winner poll
  const { data: pollRows } = await supabase
    .from('debate_winner_polls')
    .select('winner')
    .eq('debate_id', id)

  const winnerPoll = pollRows
    ? pollRows.reduce(
        (acc, r) => {
          const w = r.winner as 'blue' | 'red' | 'tie'
          acc[w] = (acc[w] ?? 0) + 1
          return acc
        },
        { blue: 0, red: 0, tie: 0, total: 0 } as { blue: number; red: number; tie: number; total: number },
      )
    : null

  if (winnerPoll) {
    winnerPoll.total = (winnerPoll.blue ?? 0) + (winnerPoll.red ?? 0) + (winnerPoll.tie ?? 0)
  }

  // Build response base
  const blueSpeaker = Array.isArray(debate.blue_speaker) ? debate.blue_speaker[0] ?? null : (debate.blue_speaker ?? null)
  const redSpeaker = Array.isArray(debate.red_speaker) ? debate.red_speaker[0] ?? null : (debate.red_speaker ?? null)

  const debateBase = {
    id: debate.id,
    title: debate.title,
    type: debate.type,
    status: debate.status,
    blue_sway: debate.blue_sway ?? 0,
    red_sway: debate.red_sway ?? 0,
    started_at: debate.started_at,
    ended_at: debate.ended_at,
    topic: topic ?? null,
    blue_speaker: blueSpeaker as { id: string; username: string; display_name: string | null; avatar_url: string | null } | null,
    red_speaker: redSpeaker as { id: string; username: string; display_name: string | null; avatar_url: string | null } | null,
  }

  // Return cache if fresh (< 7 days old)
  if (cached) {
    const analysis = cached.analysis as DebateAnalysis
    if (!analysis.quality_label) {
      analysis.quality_label = qualityLabel(analysis.overall_quality)
    }
    if (analysis.for_speaker) {
      analysis.for_speaker.username = blueSpeaker?.username ?? 'FOR'
      analysis.for_speaker.display_name = blueSpeaker?.display_name ?? null
    }
    if (analysis.against_speaker) {
      analysis.against_speaker.username = redSpeaker?.username ?? 'AGAINST'
      analysis.against_speaker.display_name = redSpeaker?.display_name ?? null
    }

    return NextResponse.json({
      debate: debateBase,
      analysis,
      cached: true,
      winner_poll: winnerPoll,
    } satisfies DebateAnalysisResponse)
  }

  // 5. Only generate for ended debates
  if (debate.status !== 'ended') {
    const fallback = fallbackAnalysis(
      blueSpeaker?.username ?? 'FOR',
      redSpeaker?.username ?? 'AGAINST',
      debate.blue_sway ?? 0,
      debate.red_sway ?? 0,
    )
    fallback.verdict_analysis = 'Analysis is available after the debate concludes.'
    fallback.unavailable = true
    return NextResponse.json({
      debate: debateBase,
      analysis: fallback,
      cached: false,
      winner_poll: winnerPoll,
    } satisfies DebateAnalysisResponse)
  }

  // 6. Fetch top messages for AI analysis
  const { data: messages } = await supabase
    .from('debate_messages')
    .select('content, side, upvotes, author:profiles(username)')
    .eq('debate_id', id)
    .order('upvotes', { ascending: false })
    .limit(25)

  const topMessages = (messages ?? []).map((m) => ({
    content: m.content,
    side: m.side,
    author: (Array.isArray(m.author) ? m.author[0]?.username : (m.author as { username?: string } | null)?.username) ?? 'anonymous',
    upvotes: m.upvotes ?? 0,
  }))

  // 7. Generate AI analysis
  let analysis: DebateAnalysis

  if (process.env.ANTHROPIC_API_KEY && topic) {
    try {
      const client = new Anthropic()
      const prompt = buildAnalysisPrompt(
        topic.statement,
        topic.category,
        blueSpeaker?.username ?? 'FOR Speaker',
        redSpeaker?.username ?? 'AGAINST Speaker',
        debate.blue_sway ?? 0,
        debate.red_sway ?? 0,
        topMessages,
        winnerPoll,
      )

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 900,
        messages: [{ role: 'user', content: prompt }],
      })

      const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in response')

      const parsed = JSON.parse(jsonMatch[0]) as Partial<DebateAnalysis>
      analysis = {
        overall_quality: Number(parsed.overall_quality) || 6,
        quality_label: qualityLabel(Number(parsed.overall_quality) || 6),
        verdict_analysis: parsed.verdict_analysis ?? '',
        key_turning_point: parsed.key_turning_point ?? '',
        for_speaker: parsed.for_speaker
          ? {
              ...parsed.for_speaker,
              username: blueSpeaker?.username ?? 'FOR',
              display_name: blueSpeaker?.display_name ?? null,
              side: 'for',
              persuasion_score: Number(parsed.for_speaker.persuasion_score) || 6,
            }
          : null,
        against_speaker: parsed.against_speaker
          ? {
              ...parsed.against_speaker,
              username: redSpeaker?.username ?? 'AGAINST',
              display_name: redSpeaker?.display_name ?? null,
              side: 'against',
              persuasion_score: Number(parsed.against_speaker.persuasion_score) || 6,
            }
          : null,
        fallacies: Array.isArray(parsed.fallacies) ? parsed.fallacies.slice(0, 3) : [],
        key_exchanges: Array.isArray(parsed.key_exchanges) ? parsed.key_exchanges.slice(0, 3) : [],
        audience_takeaway: parsed.audience_takeaway ?? '',
        intellectual_honesty: parsed.intellectual_honesty ?? '',
      }

      // Cache the result
      await supabase
        .from('debate_analyses')
        .upsert({ debate_id: id, analysis, generated_at: new Date().toISOString() })
    } catch {
      analysis = fallbackAnalysis(
        blueSpeaker?.username ?? 'FOR',
        redSpeaker?.username ?? 'AGAINST',
        debate.blue_sway ?? 0,
        debate.red_sway ?? 0,
      )
    }
  } else {
    analysis = fallbackAnalysis(
      blueSpeaker?.username ?? 'FOR',
      redSpeaker?.username ?? 'AGAINST',
      debate.blue_sway ?? 0,
      debate.red_sway ?? 0,
    )
  }

  return NextResponse.json({
    debate: debateBase,
    analysis,
    cached: false,
    winner_poll: winnerPoll,
  } satisfies DebateAnalysisResponse)
}
