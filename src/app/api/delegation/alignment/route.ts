import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface CategoryAlignment {
  category: string
  total: number
  matches: number
  pct: number
}

export interface AlignmentResponse {
  delegate_id: string
  topics_in_common: number
  alignment_pct: number
  categories: CategoryAlignment[]
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const delegateId = searchParams.get('delegate_id')?.trim()
  if (!delegateId) return NextResponse.json({ error: 'delegate_id required' }, { status: 400 })
  if (delegateId === user.id) return NextResponse.json({ error: 'Cannot compare with yourself' }, { status: 400 })

  // Fetch both users' votes in parallel
  const [myVotesRes, theirVotesRes] = await Promise.all([
    supabase
      .from('votes')
      .select('topic_id, side')
      .eq('user_id', user.id),
    supabase
      .from('votes')
      .select('topic_id, side')
      .eq('user_id', delegateId),
  ])

  const myVotes = myVotesRes.data ?? []
  const theirVotes = theirVotesRes.data ?? []

  if (myVotes.length === 0 || theirVotes.length === 0) {
    return NextResponse.json({
      delegate_id: delegateId,
      topics_in_common: 0,
      alignment_pct: 0,
      categories: [],
    } satisfies AlignmentResponse)
  }

  // Build lookup maps
  const myMap = new Map<string, string>()
  for (const v of myVotes) myMap.set(v.topic_id, v.side)
  const theirMap = new Map<string, string>()
  for (const v of theirVotes) theirMap.set(v.topic_id, v.side)

  // Find overlap
  const commonTopicIds: string[] = []
  for (const [topicId] of myMap) {
    if (theirMap.has(topicId)) commonTopicIds.push(topicId)
  }

  if (commonTopicIds.length === 0) {
    return NextResponse.json({
      delegate_id: delegateId,
      topics_in_common: 0,
      alignment_pct: 0,
      categories: [],
    } satisfies AlignmentResponse)
  }

  // Fetch topics for category breakdown (limit to 200 to avoid huge queries)
  const sample = commonTopicIds.slice(0, 200)
  const { data: topicsData } = await supabase
    .from('topics')
    .select('id, category')
    .in('id', sample)

  const topicCategoryMap = new Map<string, string | null>()
  for (const t of topicsData ?? []) topicCategoryMap.set(t.id, t.category)

  // Count matches and per-category breakdown
  let totalMatches = 0
  const catStats: Record<string, { total: number; matches: number }> = {}

  for (const topicId of sample) {
    const mySide = myMap.get(topicId)
    const theirSide = theirMap.get(topicId)
    if (!mySide || !theirSide) continue

    const match = mySide === theirSide
    if (match) totalMatches++

    const cat = topicCategoryMap.get(topicId) ?? 'Uncategorised'
    if (!catStats[cat]) catStats[cat] = { total: 0, matches: 0 }
    catStats[cat].total++
    if (match) catStats[cat].matches++
  }

  const alignmentPct = sample.length > 0
    ? Math.round((totalMatches / sample.length) * 100)
    : 0

  const categories: CategoryAlignment[] = Object.entries(catStats)
    .filter(([, s]) => s.total >= 3)
    .map(([category, s]) => ({
      category,
      total: s.total,
      matches: s.matches,
      pct: Math.round((s.matches / s.total) * 100),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  return NextResponse.json({
    delegate_id: delegateId,
    topics_in_common: commonTopicIds.length,
    alignment_pct: alignmentPct,
    categories,
  } satisfies AlignmentResponse)
}
