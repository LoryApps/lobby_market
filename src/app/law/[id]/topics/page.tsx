import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopicsClient } from './TopicsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Active Debates · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const title = `Active Debates: ${short} · Lobby Market`
  const description =
    `See what citizens are actively debating that relates to this established law — ` +
    `live topics in the same category and with overlapping civic themes. ` +
    `${(law.total_votes ?? 0).toLocaleString()} votes in the original referendum.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/law/${params.id}`, width: 1200, height: 630, alt: stmt }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: { canonical: `https://lobby.market/law/${params.id}/topics` },
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LawMeta {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
  topic_id: string
}

export interface RelatedTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  feed_score: number
  created_at: string
  match_type: 'same_category' | 'keyword'
  relevance_score: number
}

// ── Stopwords shared with /topic/[id]/laws ───────────────────────────────────

const STOPWORDS = new Set([
  'should', 'would', 'could', 'their', 'there', 'these', 'those', 'which',
  'that', 'this', 'with', 'from', 'have', 'will', 'been', 'were', 'being',
  'more', 'than', 'about', 'into', 'over', 'also', 'what', 'when', 'where',
  'then', 'them', 'they', 'some', 'such', 'upon', 'made', 'make', 'must',
])

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function LawTopicsPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  const l = law as LawMeta

  // ── 1. Active topics in the same category ────────────────────────────────────
  const sameCatPromise = l.category
    ? supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, feed_score, created_at')
        .eq('category', l.category)
        .neq('id', l.topic_id)
        .in('status', ['proposed', 'active', 'voting'])
        .order('feed_score', { ascending: false })
        .limit(12)
    : Promise.resolve({ data: [] })

  // ── 2. Topics with keyword overlap ──────────────────────────────────────────
  const words = l.statement
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
    .slice(0, 6)

  const keywordPromise = words.length > 0
    ? supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, feed_score, created_at')
        .neq('id', l.topic_id)
        .in('status', ['proposed', 'active', 'voting'])
        .ilike('statement', `%${words[0]}%`)
        .order('feed_score', { ascending: false })
        .limit(20)
    : Promise.resolve({ data: [] })

  const [sameCatResult, keywordResult] = await Promise.all([sameCatPromise, keywordPromise])

  const sameCatTopics = ((sameCatResult as { data: unknown[] | null }).data ?? []) as RelatedTopic[]
  const rawKeywordTopics = ((keywordResult as { data: unknown[] | null }).data ?? []) as RelatedTopic[]

  // Score keyword topics by how many keywords they match
  const sameCatIds = new Set(sameCatTopics.map((t) => t.id))

  const keywordTopics: RelatedTopic[] = rawKeywordTopics
    .filter((t) => !sameCatIds.has(t.id))
    .map((t) => {
      const lowerStmt = t.statement.toLowerCase()
      const hits = words.filter((w) => lowerStmt.includes(w)).length
      return { ...t, match_type: 'keyword' as const, relevance_score: hits }
    })
    .filter((t) => t.relevance_score >= 1)
    .sort((a, b) => b.relevance_score - a.relevance_score || b.feed_score - a.feed_score)
    .slice(0, 8)

  const annotatedSameCat: RelatedTopic[] = sameCatTopics.map((t) => ({
    ...t,
    match_type: 'same_category' as const,
    relevance_score: 10,
  }))

  return (
    <TopicsClient
      lawId={params.id}
      law={l}
      sameCategoryTopics={annotatedSameCat}
      keywordTopics={keywordTopics}
    />
  )
}
