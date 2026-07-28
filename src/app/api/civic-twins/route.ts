import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface TwinProfile {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  common_topics: number
  agreement_pct: number
  strongest_category: string | null
  strongest_category_pct: number
}

export interface CivicTwinsResponse {
  twins: TwinProfile[]
  my_vote_count: number
  fingerprint: { category: string; for_pct: number; total: number }[]
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. Fetch my votes (up to 150 most recent)
  const { data: myVotesRaw } = await supabase
    .from('votes')
    .select('topic_id, side')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(150)

  const myVotes = myVotesRaw ?? []
  if (myVotes.length < 3) {
    return NextResponse.json({
      twins: [],
      my_vote_count: myVotes.length,
      fingerprint: [],
    } satisfies CivicTwinsResponse)
  }

  const myTopicIds = myVotes.map((v) => v.topic_id)
  const myMap = new Map<string, string>()
  for (const v of myVotes) myMap.set(v.topic_id, v.side)

  // 2. Fetch categories for my voted topics
  const { data: myTopicsData } = await supabase
    .from('topics')
    .select('id, category')
    .in('id', myTopicIds)

  const topicCategoryMap = new Map<string, string>()
  for (const t of myTopicsData ?? []) {
    topicCategoryMap.set(t.id, t.category ?? 'Other')
  }

  // Build my civic fingerprint per category
  const catStats: Record<string, { for: number; against: number }> = {}
  for (const v of myVotes) {
    const cat = topicCategoryMap.get(v.topic_id) ?? 'Other'
    if (!catStats[cat]) catStats[cat] = { for: 0, against: 0 }
    if (v.side === 'for' || v.side === 'blue') catStats[cat].for++
    else catStats[cat].against++
  }

  const fingerprint = Object.entries(catStats)
    .filter(([, s]) => s.for + s.against >= 2)
    .map(([category, s]) => {
      const total = s.for + s.against
      return { category, for_pct: Math.round((s.for / total) * 100), total }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  // 3. Fetch all other users' votes on the same topics (cap at 3000 rows)
  const { data: othersRaw } = await supabase
    .from('votes')
    .select('user_id, topic_id, side')
    .in('topic_id', myTopicIds)
    .neq('user_id', user.id)
    .limit(3000)

  const others = othersRaw ?? []
  if (others.length === 0) {
    return NextResponse.json({
      twins: [],
      my_vote_count: myVotes.length,
      fingerprint,
    } satisfies CivicTwinsResponse)
  }

  // 4. Group by user and compute similarity
  type UserStats = {
    total: number
    matches: number
    catTotals: Record<string, { total: number; matches: number }>
  }

  const userStats = new Map<string, UserStats>()
  for (const v of others) {
    const mySide = myMap.get(v.topic_id)
    if (!mySide) continue

    if (!userStats.has(v.user_id)) {
      userStats.set(v.user_id, { total: 0, matches: 0, catTotals: {} })
    }
    const s = userStats.get(v.user_id)!
    s.total++
    const match = mySide === v.side
    if (match) s.matches++

    const cat = topicCategoryMap.get(v.topic_id) ?? 'Other'
    if (!s.catTotals[cat]) s.catTotals[cat] = { total: 0, matches: 0 }
    s.catTotals[cat].total++
    if (match) s.catTotals[cat].matches++
  }

  // Filter to users with at least 5 topics in common, sort by agreement %
  const candidates = Array.from(userStats.entries())
    .filter(([, s]) => s.total >= 5)
    .map(([uid, s]) => {
      const agreementPct = Math.round((s.matches / s.total) * 100)
      const strongestCategory = Object.entries(s.catTotals)
        .filter(([, cs]) => cs.total >= 3)
        .sort((a, b) => b[1].matches / b[1].total - a[1].matches / a[1].total)
        .at(0)
      return {
        user_id: uid,
        agreement_pct: agreementPct,
        common_topics: s.total,
        strongest_category: strongestCategory?.[0] ?? null,
        strongest_category_pct: strongestCategory
          ? Math.round((strongestCategory[1].matches / strongestCategory[1].total) * 100)
          : 0,
      }
    })
    .sort((a, b) => b.agreement_pct - a.agreement_pct)
    .slice(0, 20)

  if (candidates.length === 0) {
    return NextResponse.json({
      twins: [],
      my_vote_count: myVotes.length,
      fingerprint,
    } satisfies CivicTwinsResponse)
  }

  // 5. Fetch profiles for top candidates
  const topIds = candidates.map((c) => c.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', topIds)

  const profileMap = new Map<string, (typeof profiles)[0]>()
  for (const p of profiles ?? []) profileMap.set(p.id, p)

  const twins: TwinProfile[] = candidates
    .map((c) => {
      const profile = profileMap.get(c.user_id)
      if (!profile) return null
      return {
        user_id: c.user_id,
        username: profile.username ?? '',
        display_name: profile.display_name ?? null,
        avatar_url: profile.avatar_url ?? null,
        role: profile.role ?? 'person',
        common_topics: c.common_topics,
        agreement_pct: c.agreement_pct,
        strongest_category: c.strongest_category,
        strongest_category_pct: c.strongest_category_pct,
      }
    })
    .filter(Boolean) as TwinProfile[]

  return NextResponse.json({
    twins,
    my_vote_count: myVotes.length,
    fingerprint,
  } satisfies CivicTwinsResponse)
}
