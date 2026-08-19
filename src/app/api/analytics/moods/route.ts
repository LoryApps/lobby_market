import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MoodKind =
  | 'hopeful'
  | 'inspired'
  | 'proud'
  | 'determined'
  | 'frustrated'
  | 'worried'
  | 'angry'
  | 'relieved'

export interface MoodEntry {
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  topic_blue_pct: number
  topic_total_votes: number
  mood: MoodKind
  set_at: string
}

export interface CategoryMoodBreakdown {
  category: string
  moods: { mood: MoodKind; count: number }[]
  dominant_mood: MoodKind | null
  positive_count: number
  anxious_count: number
  total: number
}

export interface MoodOutcomeCorrelation {
  mood: MoodKind
  total_set: number
  topics_became_law: number
  topics_failed: number
  topics_active: number
  law_rate: number
}

export interface MoodAnalyticsResponse {
  total_moods_set: number
  dominant_mood: MoodKind | null
  positive_pct: number
  anxious_pct: number
  mood_counts: { mood: MoodKind; count: number; pct: number }[]
  recent_moods: MoodEntry[]
  category_breakdown: CategoryMoodBreakdown[]
  outcome_correlation: MoodOutcomeCorrelation[]
  // Outcome-linked highlights
  hopeful_and_law: MoodEntry[]
  worried_and_law: MoodEntry[]
}

const ALL_MOODS: MoodKind[] = [
  'hopeful', 'inspired', 'proud', 'determined',
  'frustrated', 'worried', 'angry', 'relieved',
]
const POSITIVE_MOODS = new Set<MoodKind>(['hopeful', 'inspired', 'proud', 'determined'])
const ANXIOUS_MOODS = new Set<MoodKind>(['frustrated', 'worried', 'angry'])

// ─── GET /api/analytics/moods ─────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all moods the user has set, joined with topic data
    const { data: moodRows, error } = await supabase
      .from('civic_topic_moods')
      .select(`
        topic_id,
        mood,
        updated_at,
        topics (
          id,
          statement,
          category,
          status,
          blue_pct,
          total_votes
        )
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) throw error

    const rows = (moodRows ?? []).filter((r) => r.topics)

    const total = rows.length

    // ── Aggregate mood counts ────────────────────────────────────────────────
    const countMap: Record<string, number> = {}
    for (const row of rows) {
      countMap[row.mood] = (countMap[row.mood] ?? 0) + 1
    }

    const mood_counts = ALL_MOODS.map((m) => ({
      mood: m,
      count: countMap[m] ?? 0,
      pct: total > 0 ? Math.round(((countMap[m] ?? 0) / total) * 100) : 0,
    })).sort((a, b) => b.count - a.count)

    const dominant_mood: MoodKind | null =
      mood_counts[0]?.count > 0 ? mood_counts[0].mood : null

    const positive_count = Array.from(POSITIVE_MOODS).reduce(
      (s, m) => s + (countMap[m] ?? 0), 0
    )
    const anxious_count = Array.from(ANXIOUS_MOODS).reduce(
      (s, m) => s + (countMap[m] ?? 0), 0
    )
    const positive_pct = total > 0 ? Math.round((positive_count / total) * 100) : 0
    const anxious_pct = total > 0 ? Math.round((anxious_count / total) * 100) : 0

    // ── Recent moods (latest 20) ──────────────────────────────────────────────
    const recent_moods: MoodEntry[] = rows.slice(0, 20).map((r) => {
      const t = r.topics as {
        id: string
        statement: string
        category: string | null
        status: string
        blue_pct: number
        total_votes: number
      }
      return {
        topic_id: t.id,
        topic_statement: t.statement,
        topic_category: t.category,
        topic_status: t.status,
        topic_blue_pct: t.blue_pct ?? 50,
        topic_total_votes: t.total_votes ?? 0,
        mood: r.mood as MoodKind,
        set_at: r.updated_at,
      }
    })

    // ── Category breakdown ────────────────────────────────────────────────────
    const catMap: Record<string, { moods: Record<string, number>; positive: number; anxious: number; total: number }> = {}
    for (const row of rows) {
      const t = row.topics as { category: string | null }
      const cat = t.category ?? 'Uncategorized'
      if (!catMap[cat]) catMap[cat] = { moods: {}, positive: 0, anxious: 0, total: 0 }
      catMap[cat].moods[row.mood] = (catMap[cat].moods[row.mood] ?? 0) + 1
      catMap[cat].total++
      if (POSITIVE_MOODS.has(row.mood as MoodKind)) catMap[cat].positive++
      if (ANXIOUS_MOODS.has(row.mood as MoodKind)) catMap[cat].anxious++
    }

    const category_breakdown: CategoryMoodBreakdown[] = Object.entries(catMap)
      .map(([category, data]) => {
        const moodList = ALL_MOODS.map((m) => ({
          mood: m,
          count: data.moods[m] ?? 0,
        })).sort((a, b) => b.count - a.count)
        const dominant_mood = moodList[0]?.count > 0 ? (moodList[0].mood as MoodKind) : null
        return {
          category,
          moods: moodList,
          dominant_mood,
          positive_count: data.positive,
          anxious_count: data.anxious,
          total: data.total,
        }
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)

    // ── Outcome correlation ───────────────────────────────────────────────────
    const outcomeMap: Record<string, { total: number; law: number; failed: number; active: number }> = {}
    for (const row of rows) {
      const t = row.topics as { status: string }
      if (!outcomeMap[row.mood]) {
        outcomeMap[row.mood] = { total: 0, law: 0, failed: 0, active: 0 }
      }
      outcomeMap[row.mood].total++
      if (t.status === 'law') outcomeMap[row.mood].law++
      else if (t.status === 'failed') outcomeMap[row.mood].failed++
      else outcomeMap[row.mood].active++
    }

    const outcome_correlation: MoodOutcomeCorrelation[] = ALL_MOODS
      .filter((m) => (outcomeMap[m]?.total ?? 0) > 0)
      .map((m) => ({
        mood: m,
        total_set: outcomeMap[m]?.total ?? 0,
        topics_became_law: outcomeMap[m]?.law ?? 0,
        topics_failed: outcomeMap[m]?.failed ?? 0,
        topics_active: outcomeMap[m]?.active ?? 0,
        law_rate:
          (outcomeMap[m]?.total ?? 0) > 0
            ? Math.round(((outcomeMap[m]?.law ?? 0) / outcomeMap[m].total) * 100)
            : 0,
      }))
      .sort((a, b) => b.total_set - a.total_set)

    // ── Outcome-linked highlights ─────────────────────────────────────────────
    const allEntries: MoodEntry[] = rows.map((r) => {
      const t = r.topics as {
        id: string
        statement: string
        category: string | null
        status: string
        blue_pct: number
        total_votes: number
      }
      return {
        topic_id: t.id,
        topic_statement: t.statement,
        topic_category: t.category,
        topic_status: t.status,
        topic_blue_pct: t.blue_pct ?? 50,
        topic_total_votes: t.total_votes ?? 0,
        mood: r.mood as MoodKind,
        set_at: r.updated_at,
      }
    })

    const hopeful_and_law = allEntries
      .filter((e) => e.mood === 'hopeful' && e.topic_status === 'law')
      .slice(0, 5)

    const worried_and_law = allEntries
      .filter((e) => e.mood === 'worried' && e.topic_status === 'law')
      .slice(0, 5)

    const response: MoodAnalyticsResponse = {
      total_moods_set: total,
      dominant_mood,
      positive_pct,
      anxious_pct,
      mood_counts,
      recent_moods,
      category_breakdown,
      outcome_correlation,
      hopeful_and_law,
      worried_and_law,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[api/analytics/moods]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
