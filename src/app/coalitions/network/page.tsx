import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Network } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { CoalitionNetworkView } from './CoalitionNetworkView'
import type { CoalitionNode, TreatyEdge } from './CoalitionNetworkGraph'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Coalition Alliance Network · Lobby Market',
  description:
    'An interactive network graph of all active coalition treaties — see which coalitions are allied, have non-aggression pacts, or share research. The diplomatic map of the Lobby.',
  openGraph: {
    title: 'Coalition Alliance Network · Lobby Market',
    description: 'Which coalitions are allied? Explore the full diplomatic network of the Lobby.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Coalition Alliance Network · Lobby Market',
    description: 'Interactive map of coalition alliances, non-aggression pacts, and research exchanges.',
  },
}

export default async function CoalitionNetworkPage() {
  const supabase = await createClient()

  // Fetch all coalitions (public ones for the graph)
  const { data: rawCoalitions } = await supabase
    .from('coalitions')
    .select(
      'id, name, tag, coalition_influence, member_count, wins, losses, banner_color, is_public',
    )
    .eq('is_public', true)
    .order('coalition_influence', { ascending: false })
    .limit(200)

  // Fetch all active treaties with their coalition pairs
  const { data: rawTreaties } = await supabase
    .from('coalition_treaties')
    .select('id, proposer_id, recipient_id, treaty_type, title, expires_at, status')
    .eq('status', 'accepted')
    .order('accepted_at', { ascending: false })

  const coalitions: CoalitionNode[] = (rawCoalitions ?? []).map((c) => ({
    id: c.id,
    name: c.name ?? 'Unnamed',
    tag: c.tag ?? '??',
    coalition_influence: c.coalition_influence ?? 0,
    member_count: c.member_count ?? 0,
    wins: c.wins ?? 0,
    losses: c.losses ?? 0,
    banner_color: c.banner_color ?? null,
    is_public: c.is_public ?? true,
  }))

  // Filter to coalitions that are in valid treaty pairs
  const coalitionIds = new Set(coalitions.map((c) => c.id))

  const treaties: TreatyEdge[] = (rawTreaties ?? [])
    .filter(
      (t) =>
        coalitionIds.has(t.proposer_id) &&
        coalitionIds.has(t.recipient_id) &&
        // Validate that expires_at is still in the future (or null)
        (!t.expires_at || new Date(t.expires_at) > new Date()),
    )
    .map((t) => ({
      id: t.id,
      source: t.proposer_id,
      target: t.recipient_id,
      treaty_type: t.treaty_type as TreatyEdge['treaty_type'],
      title: t.title,
      expires_at: t.expires_at ?? null,
    }))

  // Only include coalitions that have at least one active treaty
  const alliancedIds = new Set<string>()
  for (const t of treaties) {
    alliancedIds.add(t.source)
    alliancedIds.add(t.target)
  }

  // Include all coalitions in the graph — isolated nodes are hidden by the graph,
  // but listed in the stats so users know the full scope.
  const filteredCoalitions = coalitions.filter((c) => alliancedIds.has(c.id))

  // Counts by treaty type
  const allianceCount = treaties.filter((t) => t.treaty_type === 'alliance').length
  const nonAggressionCount = treaties.filter((t) => t.treaty_type === 'non_aggression').length
  const researchCount = treaties.filter((t) => t.treaty_type === 'research_exchange').length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back */}
        <div className="mb-5">
          <Link
            href="/coalitions"
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Coalitions
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Network className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Alliance Network</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Diplomatic map of coalition treaties
              </p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-3 flex-wrap">
            {allianceCount > 0 && (
              <div className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
                'bg-for-500/10 border border-for-500/30 text-for-400',
              )}>
                {allianceCount} alliance{allianceCount !== 1 ? 's' : ''}
              </div>
            )}
            {nonAggressionCount > 0 && (
              <div className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
                'bg-gold/10 border border-gold/30 text-gold',
              )}>
                {nonAggressionCount} pact{nonAggressionCount !== 1 ? 's' : ''}
              </div>
            )}
            {researchCount > 0 && (
              <div className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
                'bg-purple/10 border border-purple/30 text-purple',
              )}>
                {researchCount} research exchange{researchCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* How to use hint */}
        <div className="mb-4 text-xs font-mono text-surface-500 flex flex-wrap gap-x-4 gap-y-1">
          <span>Drag to pan · Scroll to zoom · Click a node to open coalition</span>
          <span>Node size = influence · Green arc = win rate</span>
        </div>

        {/* Main content */}
        {filteredCoalitions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Network className="h-12 w-12 text-surface-400 mb-4" />
            <h2 className="font-mono text-lg font-semibold text-white mb-2">
              No active treaties yet
            </h2>
            <p className="text-sm font-mono text-surface-500 max-w-xs">
              Coalitions can propose treaties from their management panel.
              Be the first to establish a diplomatic agreement.
            </p>
            <Link
              href="/coalitions"
              className="mt-6 px-4 py-2 rounded-lg text-sm font-mono bg-for-500/20 border border-for-500/40 text-for-300 hover:bg-for-500/30 transition-colors"
            >
              Browse Coalitions
            </Link>
          </div>
        ) : (
          <CoalitionNetworkView
            coalitions={filteredCoalitions}
            treaties={treaties}
          />
        )}
      </main>
      <BottomNav />
    </div>
  )
}
