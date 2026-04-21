import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bell, Bookmark, BookmarkX, Compass, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { BookmarkButton } from '@/components/ui/BookmarkButton'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Topic } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Saved Topics · Lobby Market',
  description: 'Topics you have bookmarked for later.',
  openGraph: {
    title: 'Saved Topics · Lobby Market',
    description: 'Your bookmarked debates and laws in the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
  continued: 'Continued',
  archived: 'Archived',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'proposed',
  archived: 'proposed',
}

// ─── Saved topic row ──────────────────────────────────────────────────────────

function SavedTopicRow({
  topic,
  savedAt,
}: {
  topic: Topic
  savedAt: string
}) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <div className="group relative flex items-start gap-4 rounded-2xl border border-surface-300 bg-surface-100 p-5 hover:border-surface-400 transition-colors">
      {/* Vote bar — left edge accent */}
      <div
        className="absolute left-0 top-4 bottom-4 w-1 rounded-full overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 bg-for-500"
          style={{ height: `${forPct}%` }}
        />
        <div
          className="absolute bottom-0 inset-x-0 bg-against-500"
          style={{ height: `${againstPct}%` }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pl-2">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
            {STATUS_LABEL[topic.status] ?? topic.status}
          </Badge>
          {topic.category && (
            <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
              {topic.category}
            </span>
          )}
        </div>

        <Link
          href={`/topic/${topic.id}`}
          className="block text-base font-semibold text-white leading-snug hover:text-for-300 transition-colors line-clamp-3"
        >
          {topic.statement}
        </Link>

        <div className="mt-3 flex items-center gap-4 text-xs text-surface-500 font-mono flex-wrap">
          {/* Vote split */}
          <span className="flex items-center gap-1.5">
            <span className="text-for-400 font-semibold">{forPct}%</span>
            <span className="text-surface-600">FOR</span>
            <span className="text-surface-600 mx-0.5">·</span>
            <span className="text-against-400 font-semibold">{againstPct}%</span>
            <span className="text-surface-600">AGAINST</span>
          </span>

          {topic.total_votes > 0 && (
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {topic.total_votes.toLocaleString()} votes
            </span>
          )}

          <span>Saved {relativeTime(savedAt)}</span>
        </div>

        {/* Inline vote bar */}
        <div className="mt-3 h-1.5 rounded-full overflow-hidden bg-surface-300" aria-hidden="true">
          <div
            className="h-full bg-gradient-to-r from-for-600 to-for-400 float-left rounded-l-full"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="h-full bg-against-500 float-left rounded-r-full"
            style={{ width: `${againstPct}%` }}
          />
        </div>
      </div>

      {/* Bookmark toggle — remove from saved */}
      <div className="flex-shrink-0">
        <BookmarkButton topicId={topic.id} size="sm" />
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function SavedEmptyState() {
  return (
    <EmptyState
      icon={BookmarkX}
      iconColor="text-gold/60"
      iconBg="bg-gold/10"
      iconBorder="border-gold/20"
      title="No saved topics yet"
      description="Tap the bookmark icon on any topic to save it here. Come back to track how it progresses toward becoming law."
      actions={[
        { label: 'Browse the Feed', href: '/', icon: Compass },
        { label: 'Trending Now', href: '/trending', icon: TrendingUp, variant: 'secondary' },
      ]}
      size="lg"
    />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SavedTopicsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Step 1: fetch bookmark rows (ordered by save time)
  const { data: bookmarkRows } = await supabase
    .from('topic_bookmarks')
    .select('topic_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const savedRows = bookmarkRows ?? []
  const topicIds = savedRows.map((r) => r.topic_id)

  // Step 2: fetch topics by IDs (only if there are any bookmarks)
  const topicMap: Record<string, Topic> = {}
  if (topicIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('*')
      .in('id', topicIds)
    for (const t of topicRows ?? []) {
      topicMap[t.id] = t as Topic
    }
  }

  // Build ordered list preserving bookmark creation order
  const items: Array<{ topic: Topic; savedAt: string }> = savedRows
    .filter((r) => topicMap[r.topic_id] !== undefined)
    .map((r) => ({ topic: topicMap[r.topic_id], savedAt: r.created_at }))

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/20">
              <Bookmark className="h-5 w-5 text-gold" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Saved Topics
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {items.length > 0
                  ? `${items.length} topic${items.length === 1 ? '' : 's'} saved`
                  : 'Bookmark topics to track them here'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/watchlist"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-300 transition-colors"
            >
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              Watchlist
            </Link>
            <Link
              href="/following"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-300 transition-colors"
            >
              Following
            </Link>
          </div>
        </div>

        {items.length === 0 ? (
          <SavedEmptyState />
        ) : (
          <div className="space-y-3">
            {items.map(({ topic, savedAt }) => (
              <SavedTopicRow key={topic.id} topic={topic} savedAt={savedAt} />
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
