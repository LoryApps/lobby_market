import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { MoodKind } from '@/app/api/mood/route'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MoodVoteCorrelation {
  mood: MoodKind
  blue_count: number
  red_count: number
  total: number
  blue_pct: number
  red_pct: number
  bias: 'for' | 'against' | 'neutral'
  strength: 'strong' | 'moderate' | 'weak'
}

export interface MoodVotesResponse {
  correlations: MoodVoteCorrelation[]
  total_matched: number
  platform_blue_pct: number
  most_for_mood: MoodKind
  most_against_mood: MoodKind
  generated_at: string
}

const ALL_MOODS: MoodKind[] = [
  'hopeful', 'inspired', 'proud', 'determined',
  'frustrated', 'worried', 'angry', 'relieved',
]

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch recent mood entries (cap for performance)
    const { data: moodRows, error: moodErr } = await supabase
      .from('civic_topic_moods')
      .select('user_id, topic_id, mood')
      .limit(15000)

    if (moodErr) throw moodErr

    const moods = moodRows ?? []
    if (moods.length === 0) {
      return NextResponse.json({
        correlations: ALL_MOODS.map(m => ({
          mood: m, blue_count: 0, red_count: 0, total: 0,
          blue_pct: 50, red_pct: 50, bias: 'neutral', strength: 'weak',
        })),
        total_matched: 0,
        platform_blue_pct: 50,
        most_for_mood: 'hopeful',
        most_against_mood: 'frustrated',
        generated_at: new Date().toISOString(),
      } satisfies MoodVotesResponse)
    }

    // Collect unique topic IDs to fetch votes for
    const topicIds = [...new Set(moods.map(m => m.topic_id))]

    // Fetch votes only for topics that have mood entries — chunk if needed
    const CHUNK = 200
    const voteChunks: Array<{ user_id: string; topic_id: string; side: string }> = []
    for (let i = 0; i < topicIds.length; i += CHUNK) {
      const chunk = topicIds.slice(i, i + CHUNK)
      const { data } = await supabase
        .from('votes')
        .select('user_id, topic_id, side')
        .in('topic_id', chunk)
      if (data) voteChunks.push(...data)
    }

    // Build a lookup: "userId:topicId" → side
    const voteMap = new Map<string, string>()
    for (const v of voteChunks) {
      voteMap.set(`${v.user_id}:${v.topic_id}`, v.side)
    }

    // Aggregate per mood
    const stats: Record<string, { blue: number; red: number }> = {}
    for (const m of moods) {
      const side = voteMap.get(`${m.user_id}:${m.topic_id}`)
      if (!side) continue
      if (!stats[m.mood]) stats[m.mood] = { blue: 0, red: 0 }
      if (side === 'blue') stats[m.mood].blue++
      else stats[m.mood].red++
    }

    // Build correlations for all 8 moods
    let totalMatched = 0
    let totalBlue = 0

    const correlations: MoodVoteCorrelation[] = ALL_MOODS.map(mood => {
      const s = stats[mood] ?? { blue: 0, red: 0 }
      const total = s.blue + s.red
      const blue_pct = total > 0 ? (s.blue / total) * 100 : 50
      const red_pct = 100 - blue_pct

      totalMatched += total
      totalBlue += s.blue

      const absDiff = Math.abs(blue_pct - 50)
      const strength: MoodVoteCorrelation['strength'] =
        absDiff >= 15 ? 'strong' : absDiff >= 7 ? 'moderate' : 'weak'
      const bias: MoodVoteCorrelation['bias'] =
        blue_pct >= 53 ? 'for' : blue_pct <= 47 ? 'against' : 'neutral'

      return {
        mood,
        blue_count: s.blue,
        red_count: s.red,
        total,
        blue_pct: Math.round(blue_pct * 10) / 10,
        red_pct: Math.round(red_pct * 10) / 10,
        bias,
        strength,
      }
    })

    const platform_blue_pct =
      totalMatched > 0 ? Math.round((totalBlue / totalMatched) * 1000) / 10 : 50

    // Find most for/against moods (with enough data — at least 20 matched votes)
    const sortable = correlations.filter(c => c.total >= 20)
    const most_for_mood =
      sortable.length > 0
        ? sortable.reduce((a, b) => (b.blue_pct > a.blue_pct ? b : a)).mood
        : 'hopeful'
    const most_against_mood =
      sortable.length > 0
        ? sortable.reduce((a, b) => (b.red_pct > a.red_pct ? b : a)).mood
        : 'frustrated'

    return NextResponse.json({
      correlations,
      total_matched: totalMatched,
      platform_blue_pct,
      most_for_mood,
      most_against_mood,
      generated_at: new Date().toISOString(),
    } satisfies MoodVotesResponse)
  } catch (err) {
    console.error('[mood/vs-votes]', err)
    return NextResponse.json({ error: 'Failed to compute correlations' }, { status: 500 })
  }
}
