import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GradeDistribution {
  grade: string
  count: number
  pct: number
}

export interface DailyQuality {
  date: string         // "YYYY-MM-DD"
  label: string        // "Mon 12"
  arguments_posted: number
  a_grade: number      // % of A/B arguments
  avg_upvotes: number
}

export interface CategoryVitals {
  category: string
  topics: number
  law_rate: number       // % resolved as law
  avg_argument_grade: number   // 0–4 mapped to letter grade
  deliberation_depth: number   // arguments per topic
}

export interface VitalsReport {
  // Overall discourse quality score (0–100)
  quality_score: number
  quality_label: string   // "Excellent" | "Good" | "Fair" | "Needs Work"
  quality_delta: number   // change vs. 30 days ago (positive = improving)

  // Argument quality
  grade_distribution: GradeDistribution[]
  pct_high_quality: number   // % of A or B grade arguments
  total_graded: number

  // Deliberation depth
  deliberation_ratio: number   // arguments per 100 votes
  deliberators_pct: number     // % of voters who also write arguments

  // Consensus health
  resolution_rate: number      // % of inactive topics that resolved (law or fail)
  law_rate: number             // % of resolved topics that became law
  avg_days_to_law: number      // median days from proposed to law
  stuck_topics: number         // topics active/voting for 30+ days with <60% consensus

  // Engagement quality
  sourced_arguments_pct: number   // % of arguments with a source URL
  citation_quality: number        // avg citations per sourced argument area

  // Category breakdown
  categories: CategoryVitals[]

  // 7-day trend
  daily: DailyQuality[]
}

// ─── Grade helpers ────────────────────────────────────────────────────────────

function scoreToQualityLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 65) return 'Good'
  if (score >= 45) return 'Fair'
  return 'Needs Work'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient()

    // ── 1. Argument grade distribution ────────────────────────────────────────

    const { data: gradeRows } = await supabase
      .from('topic_arguments')
      .select('ai_grade, upvotes, source_url')
      .not('ai_grade', 'is', null)
      .limit(5000)

    const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 }
    let totalSourced = 0

    for (const row of gradeRows ?? []) {
      if (!row.ai_grade) continue
      const key = row.ai_grade.toUpperCase().replace(/[+-]/, '')
      if (key in gradeCounts) gradeCounts[key]++
      if (row.source_url) totalSourced++
    }

    const totalGraded = Object.values(gradeCounts).reduce((a, b) => a + b, 0)
    const grade_distribution: GradeDistribution[] = Object.entries(gradeCounts).map(
      ([grade, count]) => ({
        grade,
        count,
        pct: totalGraded > 0 ? Math.round((count / totalGraded) * 100) : 0,
      }),
    )

    const highQualityCount = (gradeCounts['A'] ?? 0) + (gradeCounts['B'] ?? 0)
    const pct_high_quality = totalGraded > 0
      ? Math.round((highQualityCount / totalGraded) * 100)
      : 0

    const sourced_arguments_pct = totalGraded > 0
      ? Math.round((totalSourced / totalGraded) * 100)
      : 0

    // ── 2. Total arguments & votes ────────────────────────────────────────────

    const { count: totalArguments } = await supabase
      .from('topic_arguments')
      .select('id', { count: 'exact', head: true })

    const { count: totalVotes } = await supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })

    const deliberation_ratio = (totalVotes ?? 0) > 0
      ? Math.round(((totalArguments ?? 0) / (totalVotes ?? 1)) * 100)
      : 0

    // ── 3. How many voters also wrote arguments ───────────────────────────────

    const { data: uniqueVoters } = await supabase
      .from('votes')
      .select('user_id')
      .limit(2000)

    const { data: uniqueArguers } = await supabase
      .from('topic_arguments')
      .select('author_id')
      .limit(2000)

    const voterSet = new Set((uniqueVoters ?? []).map((r) => r.user_id))
    const arguerSet = new Set((uniqueArguers ?? []).map((r) => r.author_id))
    const overlap = [...voterSet].filter((id) => arguerSet.has(id)).length
    const deliberators_pct = voterSet.size > 0
      ? Math.round((overlap / voterSet.size) * 100)
      : 0

    // ── 4. Consensus & resolution health ─────────────────────────────────────

    const { data: resolvedTopics } = await supabase
      .from('topics')
      .select('status, created_at')
      .in('status', ['law', 'failed'])
      .limit(1000)

    const { data: activeTopics } = await supabase
      .from('topics')
      .select('id, status, blue_pct, created_at')
      .in('status', ['active', 'voting'])
      .limit(500)

    const { count: totalTopics } = await supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })

    const totalResolved = resolvedTopics?.length ?? 0
    const lawCount = resolvedTopics?.filter((t) => t.status === 'law').length ?? 0

    const resolution_rate = (totalTopics ?? 0) > 0
      ? Math.round((totalResolved / (totalTopics ?? 1)) * 100)
      : 0
    const law_rate = totalResolved > 0
      ? Math.round((lawCount / totalResolved) * 100)
      : 0

    // "Stuck" topics: active/voting for > 30 days and far from consensus
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const stuck_topics = (activeTopics ?? []).filter((t) => {
      const isOld = t.created_at < thirtyDaysAgo
      const forPct = t.blue_pct ?? 50
      const isDeadlocked = forPct >= 35 && forPct <= 65
      return isOld && isDeadlocked
    }).length

    // Average days to law (from a sample of recent laws with established_at)
    const { data: recentLaws } = await supabase
      .from('laws')
      .select('established_at, created_at')
      .order('established_at', { ascending: false })
      .limit(50)

    let avg_days_to_law = 0
    if (recentLaws && recentLaws.length > 0) {
      const deltas = recentLaws.map((l) => {
        const established = new Date(l.established_at).getTime()
        const created = new Date(l.created_at).getTime()
        return (established - created) / (1000 * 60 * 60 * 24)
      }).filter((d) => d >= 0)
      avg_days_to_law = deltas.length > 0
        ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length)
        : 0
    }

    // ── 5. Category breakdown ─────────────────────────────────────────────────

    const { data: topicsByCategory } = await supabase
      .from('topics')
      .select('category, status, blue_pct')
      .not('category', 'is', null)
      .limit(2000)

    // Map topic_id → category
    const topicCategoryMap = new Map<string, string>()
    const catStats: Record<string, { topics: number; law: number; resolved: number; args: number; gradeSum: number }> = {}

    for (const t of topicsByCategory ?? []) {
      if (!t.category) continue
      topicCategoryMap.set((t as { id?: string }).id ?? '', t.category)
      if (!catStats[t.category]) catStats[t.category] = { topics: 0, law: 0, resolved: 0, args: 0, gradeSum: 0 }
      catStats[t.category].topics++
      if (t.status === 'law') { catStats[t.category].law++; catStats[t.category].resolved++ }
      if (t.status === 'failed') catStats[t.category].resolved++
    }

    // We can't easily join argument → topic's category without a join, so skip per-category argument grade for now
    // Instead compute deliberation depth from the topic count and overall argument rate

    const categories: CategoryVitals[] = Object.entries(catStats)
      .filter(([, s]) => s.topics >= 2)
      .sort((a, b) => b[1].topics - a[1].topics)
      .slice(0, 10)
      .map(([category, s]) => ({
        category,
        topics: s.topics,
        law_rate: s.resolved > 0 ? Math.round((s.law / s.resolved) * 100) : 0,
        avg_argument_grade: 2,   // default C until we have per-category data
        deliberation_depth: Math.round(deliberation_ratio / 10), // approximation
      }))

    // ── 6. 7-day daily quality trend ─────────────────────────────────────────

    const { data: recentArgs } = await supabase
      .from('topic_arguments')
      .select('ai_grade, upvotes, created_at')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
      .limit(500)

    const dayMap: Record<string, { count: number; highQ: number; upvotes: number }> = {}
    for (const arg of recentArgs ?? []) {
      const day = arg.created_at.slice(0, 10)
      if (!dayMap[day]) dayMap[day] = { count: 0, highQ: 0, upvotes: 0 }
      dayMap[day].count++
      const g = (arg.ai_grade ?? '').toUpperCase().replace(/[+-]/, '')
      if (g === 'A' || g === 'B') dayMap[day].highQ++
      dayMap[day].upvotes += arg.upvotes ?? 0
    }

    const daily: DailyQuality[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      const dateStr = d.toISOString().slice(0, 10)
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
      const s = dayMap[dateStr]
      daily.push({
        date: dateStr,
        label: dayLabel,
        arguments_posted: s?.count ?? 0,
        a_grade: s && s.count > 0 ? Math.round((s.highQ / s.count) * 100) : 0,
        avg_upvotes: s && s.count > 0 ? Math.round(s.upvotes / s.count) : 0,
      })
    }

    // ── 7. Overall quality score (0–100) ─────────────────────────────────────

    // Weighted composite:
    // 35% argument quality (grade distribution)
    // 25% deliberation depth (are people writing arguments, not just clicking)
    // 20% consensus health (topics resolving)
    // 20% source citation rate (evidence quality)

    const argQualityScore = pct_high_quality           // 0–100
    const deliberationScore = Math.min(deliberators_pct * 2, 100)  // 0–100, cap at 50% deliberators = 100
    const consensusScore = Math.min(law_rate + resolution_rate, 100) // combined
    const citationScore = sourced_arguments_pct         // 0–100

    const quality_score = Math.round(
      argQualityScore * 0.35 +
      deliberationScore * 0.25 +
      consensusScore * 0.20 +
      citationScore * 0.20,
    )

    // Delta: compare last 30 days of argument quality to 30–60 days ago
    // Simplified: use current pct_high_quality vs. a placeholder (no historical state without costly query)
    const quality_delta = 0  // Would require time-series queries to compute accurately

    const report: VitalsReport = {
      quality_score,
      quality_label: scoreToQualityLabel(quality_score),
      quality_delta,
      grade_distribution,
      pct_high_quality,
      total_graded: totalGraded,
      deliberation_ratio,
      deliberators_pct,
      resolution_rate,
      law_rate,
      avg_days_to_law,
      stuck_topics,
      sourced_arguments_pct,
      citation_quality: sourced_arguments_pct, // reuse for now
      categories,
      daily,
    }

    return NextResponse.json(report)
  } catch (err) {
    console.error('/api/vitals error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
