import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bell, BellOff, Compass, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { TopicSubscribeButton } from '@/components/topic/TopicSubscribeButton'
import type { Topic } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Following · Lobby Market',
  description: 'Debates you are following — get notified when they activate, enter voting, or become law.',
  openGraph: {
    title: 'Following · Lobby Market',
    description: 'Track the debates you care about most.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Following topic row ──────────────────────────────────────────────────────

function FollowingTopicRow({
  topic,
  followedAt,
}: {
  topic: Topic
  followedAt: string
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
        <div className="absolute inset-0 bg-for-500" style={{ height: `${forPct}%` }} />
        <div className="absolute bottom-0 inset-x-0 bg-against-500" style={{ height: `${againstPct}%` }} />
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
          <span>Following since {relativeTime(followedAt)}</span>
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

      {/* Unsubscribe toggle */}
      <div className="flex-shrink-0">
        <TopicSubscribeButton topicId={topic.id} size="sm" />
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function FollowingEmptyState() {
  return (
    <EmptyState
      icon={BellOff}
      iconColor="text-for-400/60"
      iconBg="bg-for-600/10"
      iconBorder="border-for-500/20"
      title="Not following any debates yet"
      description="Tap the bell icon on any topic to follow it. You'll get notified when it activates, enters voting, or becomes law."
      actions={[
        { label: 'Browse the Feed', href: '/', icon: Compass },
        { label: 'Trending Now', href: '/trending', icon: TrendingUp, variant: 'secondary' },
      ]}
      size="lg"
    />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FollowingPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch subscription rows
  const { data: subRows } = await supabase
    .from('topic_subscriptions')
    .select('topic_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const rows = subRows ?? []
  const topicIds = rows.map((r) => r.topic_id)

  // Fetch topic details
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

  const items: Array<{ topic: Topic; followedAt: string }> = rows
    .filter((r) => topicMap[r.topic_id] !== undefined)
    .map((r) => ({ topic: topicMap[r.topic_id], followedAt: r.created_at }))

  // Separate active/voting topics from completed ones for better UX
  const active = items.filter((i) => ['proposed', 'active', 'voting'].includes(i.topic.status))
  const completed = items.filter((i) => ['law', 'failed', 'continued', 'archived'].includes(i.topic.status))

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-600/10 border border-for-500/20">
              <Bell className="h-5 w-5 text-for-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Following
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {items.length > 0
                  ? `${items.length} debate${items.length === 1 ? '' : 's'} followed`
                  : 'Follow debates to track them here'}
              </p>
            </div>
          </div>

          <Link
            href="/saved"
            className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            Saved →
          </Link>
        </div>

        {items.length === 0 ? (
          <FollowingEmptyState />
        ) : (
          <div className="space-y-6">
            {/* Active debates */}
            {active.length > 0 && (
              <section>
                {completed.length > 0 && (
                  <h2 className="text-xs font-mono uppercase tracking-widest text-surface-500 mb-3 pl-1">
                    Active debates
                  </h2>
                )}
                <div className="space-y-3">
                  {active.map(({ topic, followedAt }) => (
                    <FollowingTopicRow key={topic.id} topic={topic} followedAt={followedAt} />
                  ))}
                </div>
              </section>
            )}

            {/* Completed debates */}
            {completed.length > 0 && (
              <section>
                <h2 className="text-xs font-mono uppercase tracking-widest text-surface-500 mb-3 pl-1">
                  Resolved
                </h2>
                <div className="space-y-3">
                  {completed.map(({ topic, followedAt }) => (
                    <FollowingTopicRow key={topic.id} topic={topic} followedAt={followedAt} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
