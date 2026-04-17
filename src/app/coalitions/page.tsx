import Link from 'next/link'
import { Plus, Users, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { CoalitionCard } from '@/components/lobby/CoalitionCard'
import { RecommendedCoalitions } from '@/components/lobby/RecommendedCoalitions'
import type { Coalition, CoalitionInvite, Profile } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

export const metadata = {
  title: 'Coalitions · Lobby Market',
  description: 'Persistent alliances running campaigns across topics.',
}

export const dynamic = 'force-dynamic'

export default async function CoalitionsIndexPage() {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  // Run all fetches in parallel
  const [coalitionsRes, invitesRes] = await Promise.all([
    supabase
      .from('coalitions')
      .select('*')
      .eq('is_public', true)
      .order('coalition_influence', { ascending: false })
      .order('member_count', { ascending: false })
      .limit(60),
    authUser
      ? supabase
          .from('coalition_invites')
          .select('*')
          .eq('invitee_id', authUser.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] as CoalitionInvite[] }),
  ])

  const coalitions = (coalitionsRes.data as Coalition[] | null) ?? []
  const rawInvites = (invitesRes.data as CoalitionInvite[] | null) ?? []

  // Enrich coalitions with creator profiles
  const creatorIds = Array.from(new Set(coalitions.map((c) => c.creator_id)))
  const { data: creators } = creatorIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', creatorIds)
    : { data: [] as Profile[] }

  const creatorMap = new Map<string, Profile>()
  for (const c of creators ?? []) creatorMap.set(c.id, c as Profile)

  const enriched = coalitions.map((c) => ({
    ...c,
    creator: creatorMap.get(c.creator_id) ?? null,
  }))

  // Enrich invites with coalition names
  const inviteCoalitionIds = rawInvites.map((i) => i.coalition_id)
  const { data: inviteCoalitions } = inviteCoalitionIds.length
    ? await supabase
        .from('coalitions')
        .select('id, name')
        .in('id', inviteCoalitionIds)
    : { data: [] as Pick<Coalition, 'id' | 'name'>[] }

  const inviteCoalitionMap = new Map(
    (inviteCoalitions ?? []).map((c) => [c.id, c])
  )

  const invitesEnriched = rawInvites.map((inv) => ({
    ...inv,
    coalition: inviteCoalitionMap.get(inv.coalition_id) ?? null,
  }))

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-8">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple/10 border border-purple/30">
              <Users className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-3xl font-bold text-white">
                Coalitions
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {enriched.length} persistent alliances
              </p>
            </div>
            <div className="ml-auto">
              <Link
                href="/coalitions/create"
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-lg',
                  'bg-purple/10 border border-purple/30 text-purple',
                  'hover:bg-purple/20 hover:border-purple/50',
                  'text-xs font-mono font-medium transition-colors'
                )}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Forge Coalition</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Pending Invites Banner ──────────────────────────────────── */}
        {invitesEnriched.length > 0 && (
          <div className="mb-6 rounded-xl border border-purple/30 bg-purple/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="h-4 w-4 text-purple" />
              <span className="font-mono text-xs font-semibold text-purple">
                {invitesEnriched.length === 1
                  ? 'You have 1 coalition invitation'
                  : `You have ${invitesEnriched.length} coalition invitations`}
              </span>
            </div>
            <div className="space-y-2">
              {invitesEnriched.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/coalitions/${inv.coalition_id}`}
                  className={cn(
                    'flex items-center justify-between rounded-lg bg-surface-100 border border-surface-300 px-3 py-2',
                    'hover:border-purple/40 transition-colors group'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-purple/10 flex-shrink-0">
                      <Users className="h-3.5 w-3.5 text-purple" />
                    </div>
                    <span className="font-mono text-xs text-white truncate">
                      {inv.coalition?.name ?? 'Coalition'}
                    </span>
                    {inv.message && (
                      <span className="font-mono text-[10px] text-surface-500 truncate hidden sm:block">
                        — {inv.message}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[10px] text-purple shrink-0 ml-2 group-hover:underline">
                    View →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Recommended (client-side, only for auth users) ──────────── */}
        {authUser && <RecommendedCoalitions />}

        {/* ── Coalition Grid ──────────────────────────────────────────── */}
        {enriched.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Users className="h-12 w-12 text-surface-500 mb-4" />
            <h2 className="font-mono text-lg text-white mb-2">
              No coalitions yet
            </h2>
            <p className="text-sm font-mono text-surface-500 max-w-md">
              Forge the first alliance and start recruiting members.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {enriched.map((coalition) => (
              <CoalitionCard key={coalition.id} coalition={coalition} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
