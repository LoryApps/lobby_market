import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface StyleArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  ai_grade: string | null
  ai_score: number | null
  created_at: string
  topic_statement: string | null
  topic_category: string | null
  source_url: string | null
}

export interface CategoryArgCount {
  category: string
  count: number
  for: number
  against: number
}

export interface GradeCount {
  grade: string
  count: number
}

export interface HourBucket {
  label: string   // 'Dawn', 'Morning', 'Afternoon', 'Evening', 'Night'
  count: number
}

export interface StyleProfile {
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface ArgumentStyleResponse {
  profile: StyleProfile
  totalArguments: number
  avgLength: number
  avgUpvotes: number
  totalUpvotes: number
  citationRate: number         // % of args with source_url
  forPct: number               // % of arguments that are FOR
  againstPct: number
  avgAiScore: number | null
  gradeDistribution: GradeCount[]
  categoryDistribution: CategoryArgCount[]
  hourDistribution: HourBucket[]
  topArguments: StyleArgument[]
  longestArgument: StyleArgument | null
  recentArguments: StyleArgument[]
  consistencyScore: number     // 0–100; how often they pick the same side
  verbosityLabel: string       // 'Concise', 'Balanced', 'Detailed'
  qualityLabel: string         // 'Rising Star', 'Reliable', 'Sharp', 'Expert'
  styleArchetype: string       // e.g. 'The Analyst', 'The Advocate', etc.
}

// ─── Hour bucket helpers ───────────────────────────────────────────────────────

const HOUR_BUCKETS: { label: string; hours: number[] }[] = [
  { label: 'Dawn',      hours: [4, 5, 6, 7] },
  { label: 'Morning',   hours: [8, 9, 10, 11] },
  { label: 'Afternoon', hours: [12, 13, 14, 15, 16] },
  { label: 'Evening',   hours: [17, 18, 19, 20] },
  { label: 'Night',     hours: [21, 22, 23, 0, 1, 2, 3] },
]

function getBucket(hour: number): string {
  for (const b of HOUR_BUCKETS) {
    if (b.hours.includes(hour)) return b.label
  }
  return 'Night'
}

// ─── Quality label helpers ─────────────────────────────────────────────────────

function verbosityLabel(avgLen: number): string {
  if (avgLen < 120) return 'Concise'
  if (avgLen < 250) return 'Balanced'
  return 'Detailed'
}

function qualityLabel(avgScore: number | null, avgUpvotes: number): string {
  const score = avgScore ?? 0
  if (score >= 8 || avgUpvotes >= 10) return 'Expert'
  if (score >= 6 || avgUpvotes >= 5)  return 'Sharp'
  if (score >= 4 || avgUpvotes >= 2)  return 'Reliable'
  return 'Rising Star'
}

function styleArchetype(forPct: number, avgLen: number, citationRate: number): string {
  if (citationRate > 0.5) return 'The Researcher'
  if (forPct > 75) return 'The Advocate'
  if (forPct < 25) return 'The Dissenter'
  if (avgLen > 350) return 'The Essayist'
  if (avgLen < 120) return 'The Sharpshooter'
  return 'The Analyst'
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { username: string } }
) {
  const supabase = await createClient()

  // Fetch the target profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Fetch all arguments by this user with topic join
  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select(`
      id,
      content,
      side,
      upvotes,
      ai_grade,
      ai_score,
      source_url,
      created_at,
      topics!topic_arguments_topic_id_fkey (
        statement,
        category
      )
    `)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (!argsRaw || argsRaw.length === 0) {
    return NextResponse.json({
      profile: {
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
      },
      totalArguments: 0,
      avgLength: 0,
      avgUpvotes: 0,
      totalUpvotes: 0,
      citationRate: 0,
      forPct: 0,
      againstPct: 0,
      avgAiScore: null,
      gradeDistribution: [],
      categoryDistribution: [],
      hourDistribution: [],
      topArguments: [],
      longestArgument: null,
      recentArguments: [],
      consistencyScore: 0,
      verbosityLabel: 'Concise',
      qualityLabel: 'Rising Star',
      styleArchetype: 'The Analyst',
    } satisfies ArgumentStyleResponse)
  }

  // Normalize rows (cast to unknown first to satisfy TypeScript on join fields)
  const args: StyleArgument[] = (argsRaw as unknown as Record<string, unknown>[]).map((r) => {
    const topicRaw = r.topics as { statement?: string; category?: string | null } | { statement?: string; category?: string | null }[] | null
    const topic = Array.isArray(topicRaw) ? topicRaw[0] : topicRaw
    return {
      id: r.id as string,
      content: r.content as string,
      side: r.side as 'blue' | 'red',
      upvotes: (r.upvotes as number) ?? 0,
      ai_grade: (r.ai_grade as string | null) ?? null,
      ai_score: (r.ai_score as number | null) ?? null,
      created_at: r.created_at as string,
      topic_statement: topic?.statement ?? null,
      topic_category: topic?.category ?? null,
      source_url: (r.source_url as string | null) ?? null,
    }
  })

  const total = args.length
  const totalLen = args.reduce((s, a) => s + a.content.length, 0)
  const avgLength = total > 0 ? Math.round(totalLen / total) : 0
  const totalUpvotes = args.reduce((s, a) => s + a.upvotes, 0)
  const avgUpvotes = total > 0 ? parseFloat((totalUpvotes / total).toFixed(1)) : 0
  const withCitation = args.filter((a) => a.source_url).length
  const citationRate = total > 0 ? parseFloat((withCitation / total).toFixed(2)) : 0

  const forCount = args.filter((a) => a.side === 'blue').length
  const againstCount = total - forCount
  const forPct = total > 0 ? Math.round((forCount / total) * 100) : 0
  const againstPct = 100 - forPct

  // Consistency: how often they pick the "same" side as the majority of their votes
  const consistencyScore = Math.abs(forPct - 50) * 2  // 0 if 50/50, 100 if always same side

  // AI score average (only graded args)
  const gradedArgs = args.filter((a) => a.ai_score !== null)
  const avgAiScore =
    gradedArgs.length > 0
      ? parseFloat((gradedArgs.reduce((s, a) => s + (a.ai_score ?? 0), 0) / gradedArgs.length).toFixed(1))
      : null

  // Grade distribution
  const gradeMap: Record<string, number> = {}
  for (const a of args) {
    if (a.ai_grade) {
      gradeMap[a.ai_grade] = (gradeMap[a.ai_grade] ?? 0) + 1
    }
  }
  const gradeDistribution: GradeCount[] = ['A', 'B', 'C', 'D', 'F']
    .map((g) => ({ grade: g, count: gradeMap[g] ?? 0 }))
    .filter((g) => g.count > 0)

  // Category distribution
  const catMap: Record<string, { count: number; for: number; against: number }> = {}
  for (const a of args) {
    const cat = a.topic_category ?? 'Other'
    if (!catMap[cat]) catMap[cat] = { count: 0, for: 0, against: 0 }
    catMap[cat].count++
    if (a.side === 'blue') catMap[cat].for++
    else catMap[cat].against++
  }
  const categoryDistribution: CategoryArgCount[] = Object.entries(catMap)
    .map(([category, v]) => ({ category, count: v.count, for: v.for, against: v.against }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // Hour distribution
  const hourMap: Record<string, number> = {}
  for (const a of args) {
    const hour = new Date(a.created_at).getUTCHours()
    const bucket = getBucket(hour)
    hourMap[bucket] = (hourMap[bucket] ?? 0) + 1
  }
  const hourDistribution: HourBucket[] = HOUR_BUCKETS.map((b) => ({
    label: b.label,
    count: hourMap[b.label] ?? 0,
  }))

  // Top 3 by upvotes
  const topArguments = [...args].sort((a, b) => b.upvotes - a.upvotes).slice(0, 3)

  // Longest argument
  const longestArgument = args.reduce<StyleArgument | null>(
    (best, a) => (!best || a.content.length > best.content.length ? a : best),
    null
  )

  // 5 most recent
  const recentArguments = args.slice(0, 5)

  return NextResponse.json({
    profile: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
    },
    totalArguments: total,
    avgLength,
    avgUpvotes,
    totalUpvotes,
    citationRate,
    forPct,
    againstPct,
    avgAiScore,
    gradeDistribution,
    categoryDistribution,
    hourDistribution,
    topArguments,
    longestArgument,
    recentArguments,
    consistencyScore,
    verbosityLabel: verbosityLabel(avgLength),
    qualityLabel: qualityLabel(avgAiScore, avgUpvotes),
    styleArchetype: styleArchetype(forPct, avgLength, citationRate),
  } satisfies ArgumentStyleResponse)
}
