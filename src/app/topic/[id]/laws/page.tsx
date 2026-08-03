import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawsClient } from './LawsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Related Laws · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const title = `Related Laws: ${short} · Lobby Market`
  const description =
    `See what laws already exist on the books related to "${stmt}" — ` +
    `established laws in the same category and with similar civic themes. ` +
    `${(topic.total_votes ?? 0).toLocaleString()} votes on this topic.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/topic/${params.id}`, width: 1200, height: 630, alt: stmt }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export interface TopicMeta {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export interface RelatedLaw {
  id: string
  statement: string
  full_statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
  match_type: 'same_category' | 'keyword'
  relevance_score: number
}

export default async function TopicLawsPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  const t = topic as TopicMeta

  // ── 1. Laws in the same category ───────────────────────────────────────────
  const sameCatPromise = t.category
    ? supabase
        .from('laws')
        .select('id, statement, full_statement, category, blue_pct, total_votes, established_at')
        .eq('is_active', true)
        .eq('category', t.category)
        .neq('topic_id', params.id)
        .order('total_votes', { ascending: false })
        .limit(12)
    : Promise.resolve({ data: [] })

  // ── 2. Laws with keyword overlap (word-by-word ILIKE scan on top words) ────
  // Extract meaningful words from the topic statement (4+ chars, skip stopwords)
  const STOPWORDS = new Set([
    'should', 'would', 'could', 'their', 'there', 'these', 'those', 'which',
    'that', 'this', 'with', 'from', 'have', 'will', 'been', 'were', 'being',
    'more', 'than', 'about', 'into', 'over', 'also', 'what', 'when', 'where',
    'then', 'them', 'they', 'some', 'such', 'upon', 'made', 'make', 'must',
  ])
  const words = t.statement
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
    .slice(0, 6)

  const keywordLawsPromise = words.length > 0
    ? supabase
        .from('laws')
        .select('id, statement, full_statement, category, blue_pct, total_votes, established_at')
        .eq('is_active', true)
        .neq('topic_id', params.id)
        .ilike('statement', `%${words[0]}%`)
        .order('total_votes', { ascending: false })
        .limit(20)
    : Promise.resolve({ data: [] })

  const [sameCatResult, keywordResult] = await Promise.all([sameCatPromise, keywordLawsPromise])

  const sameCatLaws = ((sameCatResult as { data: unknown[] | null }).data ?? []) as RelatedLaw[]
  const rawKeywordLaws = ((keywordResult as { data: unknown[] | null }).data ?? []) as RelatedLaw[]

  // Score keyword laws by how many keywords they contain
  const sameCatIds = new Set(sameCatLaws.map((l) => l.id))

  const keywordLaws: RelatedLaw[] = rawKeywordLaws
    .filter((l) => !sameCatIds.has(l.id))
    .map((l) => {
      const lowerStmt = (l.statement + ' ' + l.full_statement).toLowerCase()
      const hits = words.filter((w) => lowerStmt.includes(w)).length
      return { ...l, match_type: 'keyword' as const, relevance_score: hits }
    })
    .filter((l) => l.relevance_score >= 1)
    .sort((a, b) => b.relevance_score - a.relevance_score || b.total_votes - a.total_votes)
    .slice(0, 8)

  // Annotate same-category laws
  const annotatedSameCat: RelatedLaw[] = sameCatLaws.map((l) => ({
    ...l,
    match_type: 'same_category' as const,
    relevance_score: 10,
  }))

  return (
    <LawsClient
      topicId={params.id}
      topic={t}
      sameCategoryLaws={annotatedSameCat}
      keywordLaws={keywordLaws}
    />
  )
}
