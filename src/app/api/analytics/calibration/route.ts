import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryCalibration {
  category: string
  total: number
  correct: number
  accuracy: number
  contrarian: number    // voted against majority (≤ 40% on your side) and won
  consensus: number     // voted with majority (≥ 60% on your side) and won
}

export interface BucketPoint {
  label: string         // e.g. "10–20%"
  predicted: number     // midpoint pct the platform showed when topic resolved
  actual: number        // fraction that actually passed (1 or 0 each vote)
  count: number
}

export interface CalibrationData {
  totalResolved: number
  correct: number
  accuracy: number              // 0–100
  brierScore: number            // 0–1, lower is better (0 = perfect)
  contrarian: { correct: number; total: number; accuracy: number }
  consensus:  { correct: number; total: number; accuracy: number }
  byCategory: CategoryCalibration[]
  curve: BucketPoint[]          // for the calibration chart
  bestCategory:  string | null
  worstCategory: string | null
  majorityBias: number          // +ve = echo-chamber, –ve = contrarian tendency
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F'
  gradeColor: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toGrade(accuracy: number, total: number): CalibrationData['grade'] {
  if (total < 3) return 'F'        // not enough data
  if (accuracy >= 75) return 'S'
  if (accuracy >= 65) return 'A'
  if (accuracy >= 55) return 'B'
  if (accuracy >= 45) return 'C'
  if (accuracy >= 35) return 'D'
  return 'F'
}

const GRADE_COLOR: Record<CalibrationData['grade'], string> = {
  S: '#f59e0b',   // gold
  A: '#34d399',   // emerald
  B: '#60a5fa',   // blue
  C: '#a78bfa',   // purple
  D: '#f87171',   // red
  F: '#6b7280',   // gray
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch user's votes with resolved topic data
  const { data: voteRows, error: voteErr } = await supabase
    .from('votes')
    .select('side, topic_id')
    .eq('user_id', user.id)

  if (voteErr || !voteRows || voteRows.length === 0) {
    const empty: CalibrationData = {
      totalResolved: 0, correct: 0, accuracy: 0, brierScore: 0.25,
      contrarian: { correct: 0, total: 0, accuracy: 0 },
      consensus:  { correct: 0, total: 0, accuracy: 0 },
      byCategory: [], curve: [],
      bestCategory: null, worstCategory: null,
      majorityBias: 0, grade: 'F', gradeColor: GRADE_COLOR['F'],
    }
    return NextResponse.json(empty)
  }

  const topicIds = voteRows.map((v) => v.topic_id)

  // 2. Fetch the resolved topics in one query
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, category, status, blue_pct')
    .in('id', topicIds)
    .in('status', ['law', 'failed', 'archived', 'continued'])

  if (!topicRows || topicRows.length === 0) {
    const empty: CalibrationData = {
      totalResolved: 0, correct: 0, accuracy: 0, brierScore: 0.25,
      contrarian: { correct: 0, total: 0, accuracy: 0 },
      consensus:  { correct: 0, total: 0, accuracy: 0 },
      byCategory: [], curve: [],
      bestCategory: null, worstCategory: null,
      majorityBias: 0, grade: 'F', gradeColor: GRADE_COLOR['F'],
    }
    return NextResponse.json(empty)
  }

  // Build topic lookup
  const topicMap = new Map(topicRows.map((t) => [t.id, t]))

  // 3. Join votes to topics
  type VoteWithTopic = {
    side: 'blue' | 'red'
    category: string
    status: string
    bluePct: number
    won: boolean   // true if user's vote side prevailed
    inMajority: boolean  // true if user voted with the majority
  }

  const joined: VoteWithTopic[] = []

  for (const vote of voteRows) {
    const t = topicMap.get(vote.topic_id)
    if (!t) continue

    const bluePct = t.blue_pct ?? 50
    const passed = t.status === 'law' || t.status === 'continued'

    // The winning side: blue if topic passed, red if topic failed
    const winningSide: 'blue' | 'red' = passed ? 'blue' : 'red'
    const won = vote.side === winningSide

    // Majority at resolution: blue majority if blue_pct > 50
    const majorSide: 'blue' | 'red' = bluePct >= 50 ? 'blue' : 'red'
    const inMajority = vote.side === majorSide

    joined.push({
      side: vote.side,
      category: t.category ?? 'Uncategorized',
      status: t.status,
      bluePct,
      won,
      inMajority,
    })
  }

  const total = joined.length
  if (total === 0) {
    const empty: CalibrationData = {
      totalResolved: 0, correct: 0, accuracy: 0, brierScore: 0.25,
      contrarian: { correct: 0, total: 0, accuracy: 0 },
      consensus:  { correct: 0, total: 0, accuracy: 0 },
      byCategory: [], curve: [],
      bestCategory: null, worstCategory: null,
      majorityBias: 0, grade: 'F', gradeColor: GRADE_COLOR['F'],
    }
    return NextResponse.json(empty)
  }

  // 4. Overall accuracy
  const correct = joined.filter((v) => v.won).length
  const accuracy = Math.round((correct / total) * 100)

  // 5. Contrarian / consensus split
  const contrVotes = joined.filter((v) => !v.inMajority)
  const consVotes  = joined.filter((v) => v.inMajority)

  const contrCorrect = contrVotes.filter((v) => v.won).length
  const consCorrect  = consVotes.filter((v) => v.won).length

  const contrarian = {
    total: contrVotes.length,
    correct: contrCorrect,
    accuracy: contrVotes.length > 0 ? Math.round((contrCorrect / contrVotes.length) * 100) : 0,
  }
  const consensus = {
    total: consVotes.length,
    correct: consCorrect,
    accuracy: consVotes.length > 0 ? Math.round((consCorrect / consVotes.length) * 100) : 0,
  }

  // majorityBias: positive means user votes with majority more often → echo-chamber tendency
  const majorityBias = Math.round(((consVotes.length - contrVotes.length) / total) * 100)

  // 6. Brier score: (forecast – outcome)²
  let brierSum = 0
  for (const v of joined) {
    const forecast = v.side === 'blue' ? v.bluePct / 100 : (100 - v.bluePct) / 100
    const outcome = v.won ? 1 : 0
    brierSum += (forecast - outcome) ** 2
  }
  const brierScore = Math.round((brierSum / total) * 1000) / 1000

  // 7. By-category breakdown
  const catMap = new Map<string, { correct: number; total: number; contrarian: number; consensus: number }>()
  for (const v of joined) {
    const c = catMap.get(v.category) ?? { correct: 0, total: 0, contrarian: 0, consensus: 0 }
    c.total++
    if (v.won) c.correct++
    if (!v.inMajority && v.won) c.contrarian++
    if (v.inMajority && v.won) c.consensus++
    catMap.set(v.category, c)
  }

  const byCategory: CategoryCalibration[] = [...catMap.entries()]
    .filter(([, d]) => d.total >= 1)
    .map(([category, d]) => ({
      category,
      total: d.total,
      correct: d.correct,
      accuracy: Math.round((d.correct / d.total) * 100),
      contrarian: d.contrarian,
      consensus: d.consensus,
    }))
    .sort((a, b) => b.total - a.total)

  // Best / worst category (min 2 votes)
  const rankedCats = byCategory.filter((c) => c.total >= 2).sort((a, b) => b.accuracy - a.accuracy)
  const bestCategory  = rankedCats.length > 0 ? rankedCats[0].category : null
  const worstCategory = rankedCats.length > 1 ? rankedCats[rankedCats.length - 1].category : null

  // 8. Calibration curve bins
  const bins: { pctSum: number; wins: number; count: number }[] = Array.from({ length: 10 }, () => ({
    pctSum: 0, wins: 0, count: 0,
  }))
  for (const v of joined) {
    const sidePct = v.side === 'blue' ? v.bluePct : 100 - v.bluePct
    const bin = Math.min(9, Math.floor(sidePct / 10))
    bins[bin].pctSum += sidePct
    bins[bin].wins += v.won ? 1 : 0
    bins[bin].count++
  }
  const curve: BucketPoint[] = bins.map((b, i) => ({
    label: `${i * 10}–${i * 10 + 10}%`,
    predicted: b.count > 0 ? Math.round(b.pctSum / b.count) : i * 10 + 5,
    actual: b.count > 0 ? Math.round((b.wins / b.count) * 100) : 0,
    count: b.count,
  }))

  const grade = toGrade(accuracy, total)

  const result: CalibrationData = {
    totalResolved: total,
    correct,
    accuracy,
    brierScore,
    contrarian,
    consensus,
    byCategory,
    curve,
    bestCategory,
    worstCategory,
    majorityBias,
    grade,
    gradeColor: GRADE_COLOR[grade],
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
  })
}
