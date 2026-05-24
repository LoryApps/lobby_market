import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { TopicIndexClient } from './TopicIndexClient'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Civic Index · Lobby Market',
  description:
    'A complete A–Z reference index of every civic debate on Lobby Market — browse alphabetically, filter by status or category, and find any topic at a glance.',
  openGraph: {
    title: 'Civic Index · Lobby Market',
    description:
      'Browse every debate topic alphabetically — the encyclopedic reference for the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Index · Lobby Market',
    description: 'A–Z index of every civic debate topic on the platform.',
  },
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface IndexTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export interface LetterGroup {
  letter: string
  topics: IndexTopic[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function firstLetter(statement: string): string {
  const s = statement.trim()
  // Skip leading quotes / common articles to sort on meaningful word
  const stripped = s.replace(/^["'""''«»]/, '').replace(/^(the |a |an )/i, '')
  const ch = stripped[0]?.toUpperCase() ?? '#'
  return /[A-Z]/.test(ch) ? ch : '#'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TopicIndexPage() {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['proposed', 'active', 'voting', 'law', 'failed'])
    .order('statement', { ascending: true })

  const topics: IndexTopic[] = (rows ?? []) as IndexTopic[]

  // Group by first letter
  const letterMap = new Map<string, IndexTopic[]>()
  for (const topic of topics) {
    const letter = firstLetter(topic.statement)
    if (!letterMap.has(letter)) letterMap.set(letter, [])
    letterMap.get(letter)!.push(topic)
  }

  // Sort groups: A-Z first, then '#' at the end
  const groups: LetterGroup[] = Array.from(letterMap.entries())
    .sort(([a], [b]) => {
      if (a === '#') return 1
      if (b === '#') return -1
      return a.localeCompare(b)
    })
    .map(([letter, groupTopics]) => ({ letter, topics: groupTopics }))

  // Stats by status
  const counts = {
    total: topics.length,
    active: topics.filter((t) => t.status === 'active').length,
    voting: topics.filter((t) => t.status === 'voting').length,
    law: topics.filter((t) => t.status === 'law').length,
    proposed: topics.filter((t) => t.status === 'proposed').length,
    failed: topics.filter((t) => t.status === 'failed').length,
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-12">
        <TopicIndexClient groups={groups} counts={counts} />
      </main>
      <BottomNav />
    </div>
  )
}
