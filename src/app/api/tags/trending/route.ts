import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export interface TrendingTag {
  tag: string
  topic_count: number
  law_count: number
  active_count: number
  total_votes: number
}

export interface TrendingTagsResponse {
  tags: TrendingTag[]
}

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topics')
    .select('tags, status, total_votes')
    .not('tags', 'eq', '{}')
    .in('status', ['proposed', 'active', 'voting', 'law'])
    .limit(1000)

  if (error) {
    console.error('[tags/trending]', error)
    return NextResponse.json({ tags: [] } satisfies TrendingTagsResponse)
  }

  const tagMap = new Map<
    string,
    { topic_count: number; law_count: number; active_count: number; total_votes: number }
  >()

  for (const row of data ?? []) {
    const tags: string[] = row.tags ?? []
    for (const tag of tags) {
      if (!tag) continue
      const existing = tagMap.get(tag) ?? {
        topic_count: 0,
        law_count: 0,
        active_count: 0,
        total_votes: 0,
      }
      existing.topic_count++
      existing.total_votes += row.total_votes ?? 0
      if (row.status === 'law') existing.law_count++
      if (row.status === 'active' || row.status === 'voting') existing.active_count++
      tagMap.set(tag, existing)
    }
  }

  const tags: TrendingTag[] = Array.from(tagMap.entries())
    .map(([tag, stats]) => ({ tag, ...stats }))
    .filter((t) => t.topic_count >= 1)
    .sort((a, b) => b.topic_count - a.topic_count || b.total_votes - a.total_votes)
    .slice(0, 60)

  return NextResponse.json({ tags } satisfies TrendingTagsResponse)
}
