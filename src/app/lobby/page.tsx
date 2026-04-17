import Link from 'next/link'
import { Megaphone, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { LobbyCard } from '@/components/lobby/LobbyCard'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Lobby, Profile, Topic } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

export const metadata = {
  title: 'Lobbies · Lobby Market',
  description: 'Active campaigns rallying FOR and AGAINST topics.',
}

export const dynamic = 'force-dynamic'

export default async function LobbyIndexPage() {
  const supabase = await createClient()

  const { data: lobbyRows } = await supabase
    .from('lobbies')
    .select('*')
    .eq('is_active', true)
    .order('member_count', { ascending: false })
    .order('influence_score', { ascending: false })
    .limit(60)

  const lobbies = (lobbyRows as Lobby[] | null) ?? []

  // Fetch creator profiles and topic headers for enrichment.
  const creatorIds = Array.from(new Set(lobbies.map((l) => l.creator_id)))
  const topicIds = Array.from(new Set(lobbies.map((l) => l.topic_id)))

  const [{ data: creators }, { data: topics }] = await Promise.all([
    creatorIds.length
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .in('id', creatorIds)
      : Promise.resolve({ data: [] as Profile[] }),
    topicIds.length
      ? supabase.from('topics').select('id, statement').in('id', topicIds)
      : Promise.resolve({ data: [] as Pick<Topic, 'id' | 'statement'>[] }),
  ])

  const creatorMap = new Map<string, Profile>()
  for (const c of creators ?? []) {
    creatorMap.set(c.id, c as Profile)
  }
  const topicMap = new Map<string, string>()
  for (const t of topics ?? []) {
    topicMap.set(t.id, (t as { id: string; statement: string }).statement)
  }

  const enriched = lobbies.map((l) => ({
    ...l,
    creator: creatorMap.get(l.creator_id) ?? null,
    topicStatement: topicMap.get(l.topic_id) ?? null,
  }))

  const forJoiners = enriched
    .filter((l) => l.position === 'for')
    .reduce((sum, l) => sum + l.member_count, 0)
  const againstJoiners = enriched
    .filter((l) => l.position === 'against')
    .reduce((sum, l) => sum + l.member_count, 0)
  const totalJoiners = forJoiners + againstJoiners
  const forPct = totalJoiners > 0 ? (forJoiners / totalJoiners) * 100 : 50

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gold/10 border border-gold/30">
              <Megaphone className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-3xl font-bold text-white">
                Lobbies
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {enriched.length} active campaigns
              </p>
            </div>
            <div className="ml-auto">
              <Link
                href="/lobby/create"
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-lg',
                  'bg-gold/10 border border-gold/30 text-gold',
                  'hover:bg-gold/20 hover:border-gold/50',
                  'text-xs font-mono font-medium transition-colors'
                )}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Start a Lobby</span>
              </Link>
            </div>
          </div>

          {/* Balance bar */}
          <div className="mt-6 rounded-xl border border-surface-300 bg-surface-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[11px] font-semibold text-for-400 uppercase tracking-wider">
                {forJoiners.toLocaleString()} FOR
              </span>
              <span className="font-mono text-[11px] font-semibold text-against-400 uppercase tracking-wider">
                AGAINST {againstJoiners.toLocaleString()}
              </span>
            </div>
            <div className="h-2 w-full rounded-full overflow-hidden bg-surface-300">
              <div className="flex h-full">
                <div
                  className="bg-for-500 transition-all duration-500"
                  style={{ width: `${forPct}%` }}
                />
                <div className="flex-1 bg-against-500 transition-all duration-500" />
              </div>
            </div>
          </div>
        </div>

        {enriched.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/20"
            title="No active lobbies"
            description="Start the first campaign rallying FOR or AGAINST a topic."
            actions={[
              { label: 'Start a Lobby', href: '/lobby/create', icon: Plus },
              { label: 'Browse topics', href: '/', variant: 'secondary' },
            ]}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {enriched.map((lobby) => (
              <LobbyCard
                key={lobby.id}
                lobby={lobby}
                showTopicLink
                topicLabel={lobby.topicStatement}
              />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
