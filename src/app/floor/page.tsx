import { createClient } from '@/lib/supabase/server'
import { TheFloor } from '@/components/floor/TheFloor'
import type { Topic } from '@/lib/supabase/types'

export const metadata = {
  title: 'The Floor · Lobby',
  description:
    'Watch consensus forming in real-time in the Lobby parliamentary chamber.',
}

export const dynamic = 'force-dynamic'

export default async function FloorPage() {
  const supabase = await createClient()

  // Grab the top 10 most-active topics currently on the floor.
  // Priority: active/voting first, ordered by feed_score.
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .in('status', ['active', 'voting'])
    .order('feed_score', { ascending: false })
    .limit(10)

  let topics: Topic[] = data ?? []

  // If no active topics, fall back to most recent topics of any status so
  // the chamber has something to show.
  if (!error && topics.length === 0) {
    const { data: fallback } = await supabase
      .from('topics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    topics = fallback ?? []
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-surface-0">
      <TheFloor topics={topics} />
    </div>
  )
}
