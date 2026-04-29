import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OracleTopic {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  voting_ends_at: string | null
  passage_score: number
  confidence: 'high' | 'moderate' | 'low'
  hours_remaining: number | null
  verdict: 'pass' | 'contested' | 'fail'
  prophecy: string | null
}

export interface OracleStats {
  total_voting: number
  avg_blue_pct: number
  most_voted_id: string | null
}

export interface OracleResponse {
  likely_pass: OracleTopic[]
  contested: OracleTopic[]
  likely_fail: OracleTopic[]
  stats: OracleStats
  generated_at: string
  unavailable?: boolean
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function computePassageScore(
  blue_pct: number,
  total_votes: number,
  hours_remaining: number | null,
): number {
  // Volume confidence: low vote counts pull the score toward 50
  const volumeWeight = Math.min(1, total_votes / 80)
  let score = 50 + (blue_pct - 50) * volumeWeight

  // Time pressure: as deadline approaches, extreme leads become more decisive
  if (hours_remaining !== null && hours_remaining > 0 && hours_remaining < 48) {
    const urgency = 1 - hours_remaining / 48
    const extremity = Math.abs(score - 50) / 50
    const boost = urgency * extremity * 8
    score = score > 50 ? score + boost : score - boost
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

function confidenceLevel(total_votes: number): 'high' | 'moderate' | 'low' {
  if (total_votes >= 100) return 'high'
  if (total_votes >= 30) return 'moderate'
  return 'low'
}

function verdict(passage_score: number): OracleTopic['verdict'] {
  if (passage_score >= 58) return 'pass'
  if (passage_score <= 42) return 'fail'
  return 'contested'
}

// ─── GET /api/oracle ──────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, voting_ends_at')
    .eq('status', 'voting')
    .order('total_votes', { ascending: false })
    .limit(60)

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      likely_pass: [],
      contested: [],
      likely_fail: [],
      stats: { total_voting: 0, avg_blue_pct: 0, most_voted_id: null },
      generated_at: new Date().toISOString(),
    } satisfies OracleResponse)
  }

  // Score every topic
  const now = Date.now()
  const scored: OracleTopic[] = rows.map((r) => {
    const hrs = r.voting_ends_at
      ? Math.max(0, (new Date(r.voting_ends_at).getTime() - now) / 3_600_000)
      : null
    const ps = computePassageScore(r.blue_pct ?? 50, r.total_votes ?? 0, hrs)
    return {
      id: r.id,
      statement: r.statement,
      category: r.category,
      blue_pct: r.blue_pct ?? 50,
      total_votes: r.total_votes ?? 0,
      voting_ends_at: r.voting_ends_at,
      passage_score: ps,
      confidence: confidenceLevel(r.total_votes ?? 0),
      hours_remaining: hrs !== null ? Math.round(hrs) : null,
      verdict: verdict(ps),
      prophecy: null,
    }
  })

  const likely_pass = scored.filter((t) => t.verdict === 'pass').slice(0, 8)
  const contested = scored.filter((t) => t.verdict === 'contested').slice(0, 8)
  const likely_fail = scored.filter((t) => t.verdict === 'fail').slice(0, 8)

  const stats: OracleStats = {
    total_voting: rows.length,
    avg_blue_pct: Math.round(rows.reduce((s, r) => s + (r.blue_pct ?? 50), 0) / rows.length),
    most_voted_id: rows[0]?.id ?? null,
  }

  // ── Optional Claude prophecies ─────────────────────────────────────────────
  // Generates a 1-sentence prophecy for the 3 most interesting topics:
  // one strong passer, one contested, one strong failure.

  const prophecyTargets: OracleTopic[] = [
    likely_pass.find((t) => t.confidence !== 'low') ?? likely_pass[0],
    contested.sort((a, b) => b.total_votes - a.total_votes)[0],
    likely_fail.find((t) => t.confidence !== 'low') ?? likely_fail[0],
  ].filter(Boolean) as OracleTopic[]

  if (process.env.ANTHROPIC_API_KEY && prophecyTargets.length > 0) {
    try {
      const client = new Anthropic()
      const topicList = prophecyTargets
        .map(
          (t, i) =>
            `${i + 1}. [${t.verdict.toUpperCase()}] "${t.statement}" — ${t.blue_pct}% FOR, ${t.total_votes} votes`,
        )
        .join('\n')

      const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: `You are the Oracle of the Lobby — a civic seer who pronounces brief, insightful prophecies about how democratic debates will resolve. Each prophecy is exactly one sentence (15–25 words). Tone: authoritative, slightly dramatic, politically neutral. No emojis. Output ONLY a JSON array of strings in the same order as the input.`,
        messages: [
          {
            role: 'user',
            content: `Write one oracle prophecy for each of the following ${prophecyTargets.length} voting topic(s):\n\n${topicList}\n\nReturn a JSON array of strings, one per topic, same order.`,
          },
        ],
      })

      const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const prophecies: unknown[] = JSON.parse(jsonMatch[0])
        prophecyTargets.forEach((t, i) => {
          const p = prophecies[i]
          if (typeof p === 'string' && p.length > 0) {
            t.prophecy = p.slice(0, 200)
          }
        })
      }
    } catch {
      // Claude unavailable — continue without prophecies
    }
  }

  return NextResponse.json({
    likely_pass,
    contested,
    likely_fail,
    stats,
    generated_at: new Date().toISOString(),
  } satisfies OracleResponse)
}
