import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AlignedThesis {
  thesis_id: string
  thesis_statement: string
  thesis_rationale: string | null
  thesis_agree_count: number
  thesis_disagree_count: number
  thesis_agree_pct: number
  thesis_status: string
  thesis_category: string
  thesis_created_at: string
  thesis_resolution_date: string | null
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  }
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  /** How closely thesis community agreement tracks topic vote support.
   *  Range 0–100. High = thesis agree % ≈ topic blue_pct.
   */
  alignment_score: number
  /** "aligned" | "diverging" | "neutral" */
  alignment_label: 'aligned' | 'diverging' | 'neutral'
}

export interface AlignmentResponse {
  entries: AlignedThesis[]
  stats: {
    total_linked: number
    avg_alignment: number
    most_aligned_category: string | null
    generated_at: string
  }
}

const VALID_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const VALID_SORT = ['alignment', 'divergence', 'newest', 'most_votes'] as const
type SortMode = typeof VALID_SORT[number]

/**
 * GET /api/thesis/alignment
 *
 * Returns active civic theses that are linked to a topic, showing how
 * community agreement on each thesis tracks the actual vote outcome on
 * the linked topic.
 *
 * Query params:
 *   category  — filter by category
 *   sort      — "alignment" | "divergence" | "newest" | "most_votes"  (default: alignment)
 *   limit     — 1–30 (default: 20)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawCategory = searchParams.get('category') ?? ''
  const rawSort = searchParams.get('sort') ?? 'alignment'
  const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10)

  const category = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : ''
  const sort: SortMode = VALID_SORT.includes(rawSort as SortMode) ? (rawSort as SortMode) : 'alignment'
  const limit = Math.min(30, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit))

  const supabase = await createClient()

  // Fetch active theses that have a related topic
  let thesesQuery = supabase
    .from('civic_theses')
    .select('id, user_id, statement, rationale, category, status, agree_count, disagree_count, related_topic_id, created_at, resolution_date')
    .eq('status', 'active')
    .eq('is_public', true)
    .not('related_topic_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200)

  if (category) thesesQuery = thesesQuery.eq('category', category.toLowerCase())

  const { data: theses, error: thesesError } = await thesesQuery

  if (thesesError || !theses || theses.length === 0) {
    return NextResponse.json<AlignmentResponse>({
      entries: [],
      stats: { total_linked: 0, avg_alignment: 0, most_aligned_category: null, generated_at: new Date().toISOString() },
    })
  }

  const topicIds = [...new Set(theses.map((t) => t.related_topic_id as string))]
  const userIds  = [...new Set(theses.map((t) => t.user_id))]

  // Batch-fetch topics and profiles
  const [topicsRes, profilesRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', topicIds),
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', userIds),
  ])

  const topicMap = new Map((topicsRes.data ?? []).map((t) => [t.id, t]))
  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]))

  // Build enriched entries
  const entries: AlignedThesis[] = []

  for (const thesis of theses) {
    const topic = topicMap.get(thesis.related_topic_id as string)
    const author = profileMap.get(thesis.user_id)
    if (!topic || !author) continue

    const totalThesisVotes = thesis.agree_count + thesis.disagree_count
    const thesisAgreePct = totalThesisVotes > 0 ? Math.round((thesis.agree_count / totalThesisVotes) * 100) : 50

    // Alignment: how close is thesis_agree_pct to topic_blue_pct?
    // Both represent "support" for the thesis/topic proposition.
    const alignmentScore = 100 - Math.abs(thesisAgreePct - topic.blue_pct)

    let alignmentLabel: AlignedThesis['alignment_label']
    if (alignmentScore >= 75) alignmentLabel = 'aligned'
    else if (alignmentScore <= 40) alignmentLabel = 'diverging'
    else alignmentLabel = 'neutral'

    entries.push({
      thesis_id: thesis.id,
      thesis_statement: thesis.statement,
      thesis_rationale: thesis.rationale,
      thesis_agree_count: thesis.agree_count,
      thesis_disagree_count: thesis.disagree_count,
      thesis_agree_pct: thesisAgreePct,
      thesis_status: thesis.status,
      thesis_category: thesis.category,
      thesis_created_at: thesis.created_at,
      thesis_resolution_date: thesis.resolution_date,
      author: {
        id: author.id,
        username: author.username,
        display_name: author.display_name,
        avatar_url: author.avatar_url,
        role: author.role,
      },
      topic: {
        id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status,
        blue_pct: topic.blue_pct,
        total_votes: topic.total_votes,
      },
      alignment_score: alignmentScore,
      alignment_label: alignmentLabel,
    })
  }

  // Sort
  if (sort === 'alignment') {
    entries.sort((a, b) => b.alignment_score - a.alignment_score)
  } else if (sort === 'divergence') {
    entries.sort((a, b) => a.alignment_score - b.alignment_score)
  } else if (sort === 'most_votes') {
    entries.sort((a, b) => b.topic.total_votes - a.topic.total_votes)
  }
  // 'newest' is already sorted by created_at desc from DB

  const sliced = entries.slice(0, limit)

  // Stats
  const avgAlignment = entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + e.alignment_score, 0) / entries.length)
    : 0

  const catCounts: Record<string, number> = {}
  for (const e of entries.filter((e) => e.alignment_label === 'aligned')) {
    catCounts[e.thesis_category] = (catCounts[e.thesis_category] ?? 0) + 1
  }
  const mostAlignedCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return NextResponse.json<AlignmentResponse>({
    entries: sliced,
    stats: {
      total_linked: entries.length,
      avg_alignment: avgAlignment,
      most_aligned_category: mostAlignedCategory,
      generated_at: new Date().toISOString(),
    },
  })
}
