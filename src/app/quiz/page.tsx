import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { QuizClient } from './QuizClient'
import type { QuizTopic } from './QuizClient'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Civic Quiz · Lobby Market',
  description:
    'Take a position on real civic debates and see how you compare to the community. No login required.',
  openGraph: {
    title: 'Civic Quiz · Lobby Market',
    description:
      'Answer 8 real debates and discover your civic alignment score. Where do you stand?',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Quiz · Lobby Market',
    description:
      'Test your civic alignment on real debates — no login required.',
  },
}

// ─── Topic selection ──────────────────────────────────────────────────────────

const CATEGORIES = [
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
] as const

function selectDiverseTopics(
  rows: QuizTopic[],
  count: number
): QuizTopic[] {
  // Prefer one topic per category (the most-voted in that category)
  const byCategory = new Map<string, QuizTopic>()
  for (const cat of CATEGORIES) {
    const candidate = rows
      .filter((r) => r.category === cat)
      .sort((a, b) => b.total_votes - a.total_votes)[0]
    if (candidate) byCategory.set(cat, candidate)
  }

  const selected: QuizTopic[] = Array.from(byCategory.values())
  const selectedIds = new Set(selected.map((t) => t.id))

  // Fill remaining slots from the highest-voted remaining topics
  // that have an interesting split (not too one-sided)
  const remaining = rows
    .filter((r) => !selectedIds.has(r.id))
    .filter((r) => r.blue_pct >= 20 && r.blue_pct <= 80) // avoid trivially obvious
    .sort((a, b) => b.total_votes - a.total_votes)

  for (const topic of remaining) {
    if (selected.length >= count) break
    selected.push(topic)
    selectedIds.add(topic.id)
  }

  // Shuffle so categories aren't predictably ordered
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[selected[i], selected[j]] = [selected[j], selected[i]]
  }

  return selected.slice(0, count)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CivicQuizPage() {
  const supabase = await createClient()

  // Fetch a pool of real topics to quiz on
  const { data } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['active', 'voting', 'law'])
    .gte('total_votes', 3)
    .gte('blue_pct', 5)
    .lte('blue_pct', 95)
    .order('total_votes', { ascending: false })
    .limit(80)

  const pool = (data ?? []) as QuizTopic[]
  const topics = selectDiverseTopics(pool, 8)

  // Fallback: if DB has very few topics, use whatever we have (min 4)
  if (topics.length < 4) {
    const { data: fallback } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['active', 'voting', 'law', 'proposed'])
      .order('total_votes', { ascending: false })
      .limit(8)
    return <QuizClient topics={(fallback ?? []) as QuizTopic[]} />
  }

  return <QuizClient topics={topics} />
}
