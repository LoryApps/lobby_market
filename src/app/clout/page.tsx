import { redirect } from 'next/navigation'
import { Coins, Megaphone, Network, Shield, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { CloutBalance } from '@/components/clout/CloutBalance'
import { CloutLedger } from '@/components/clout/CloutLedger'
import { InfluenceMarket } from '@/components/lobby/InfluenceMarket'
import type {
  CloutTransaction,
  Coalition,
  Lobby,
  Profile,
} from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

export const metadata = {
  title: 'Clout · Lobby Market',
  description:
    'Public ledger of the Clout economy — earn, spend, gift, and see who is moving the market.',
}

export const dynamic = 'force-dynamic'

export default async function CloutPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [
    { data: profile },
    { data: myTransactions },
    { data: publicLedger },
    { data: trendingLobbyRows },
    { data: topCoalitionRows },
    { count: lobbyCount },
    { count: coalitionCount },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('clout_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('clout_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('lobbies')
      .select('*')
      .eq('is_active', true)
      .order('member_count', { ascending: false })
      .limit(5),
    supabase
      .from('coalitions')
      .select('*')
      .eq('is_public', true)
      .order('coalition_influence', { ascending: false })
      .limit(6),
    supabase
      .from('lobbies')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('coalitions')
      .select('id', { count: 'exact', head: true })
      .eq('is_public', true),
  ])

  const balance = profile?.clout ?? 0
  const myTxs = (myTransactions as CloutTransaction[] | null) ?? []
  const ledgerRows = (publicLedger as CloutTransaction[] | null) ?? []
  const trendingLobbies = (trendingLobbyRows as Lobby[] | null) ?? []
  const topCoalitions = (topCoalitionRows as Coalition[] | null) ?? []

  // Enrich public ledger with user profiles.
  const ledgerUserIds = Array.from(new Set(ledgerRows.map((r) => r.user_id)))
  const lobbyCreatorIds = Array.from(
    new Set(trendingLobbies.map((l) => l.creator_id))
  )
  const allProfileIds = Array.from(
    new Set([...ledgerUserIds, ...lobbyCreatorIds])
  )
  const { data: extraProfiles } = allProfileIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', allProfileIds)
    : { data: [] as Profile[] }
  const profileMap = new Map<string, Profile>()
  for (const p of extraProfiles ?? []) {
    profileMap.set(p.id, p as Profile)
  }

  const ledgerWithUsers = ledgerRows.map((r) => ({
    ...r,
    user: profileMap.get(r.user_id) ?? null,
  }))
  const trendingWithCreators = trendingLobbies.map((l) => ({
    ...l,
    creator: profileMap.get(l.creator_id) ?? null,
  }))

  // Clout-in-circulation: sum positive ledger entries in the most recent slice.
  const circulating = ledgerRows
    .filter((r) => r.amount > 0)
    .reduce((sum, r) => sum + r.amount, 0)

  const totalLobbyMembers = trendingLobbies.reduce(
    (sum, l) => sum + l.member_count,
    0
  )

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-8">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gold/10 border border-gold/30">
              <Coins className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-3xl font-bold text-white">
                Clout Economy
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Public ledger · radical transparency
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          <div className="lg:col-span-1">
            <CloutBalance
              initialBalance={balance}
              initialTransactions={myTxs}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6">
              <h3 className="font-mono text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gold" />
                Spend Your Clout
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SpendOption
                  icon={Megaphone}
                  title="Start a Lobby"
                  blurb="Rally members around your campaign"
                  href="/lobby/create"
                />
                <SpendOption
                  icon={Network}
                  title="Forge a Coalition"
                  blurb="Build a persistent alliance"
                  href="/coalitions/create"
                />
                <SpendOption
                  icon={Shield}
                  title="Moderation"
                  blurb="Train to become a Troll Catcher"
                  href="/moderation/training"
                />
              </div>
            </div>
          </div>
        </div>

        <section className="mb-12">
          <h2 className="font-mono text-sm font-semibold text-white uppercase tracking-wider mb-4">
            Your Transactions
          </h2>
          <CloutLedger initialTransactions={myTxs} userId={user.id} />
        </section>

        <section className="mb-12">
          <h2 className="font-mono text-sm font-semibold text-white uppercase tracking-wider mb-4">
            Public Ledger
          </h2>
          <CloutLedger initialTransactions={ledgerWithUsers} />
        </section>

        <section>
          <h2 className="font-mono text-sm font-semibold text-white uppercase tracking-wider mb-4">
            Influence Market
          </h2>
          <InfluenceMarket
            trendingLobbies={trendingWithCreators}
            topCoalitions={topCoalitions}
            recentTransactions={ledgerWithUsers}
            stats={{
              totalLobbies: lobbyCount ?? 0,
              totalLobbyMembers,
              totalCoalitions: coalitionCount ?? 0,
              totalCloutInCirculation: circulating,
            }}
          />
        </section>
      </main>

      <BottomNav />
    </div>
  )
}

function SpendOption({
  icon: Icon,
  title,
  blurb,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  blurb: string
  href: string
}) {
  return (
    <a
      href={href}
      className={cn(
        'block rounded-xl border border-surface-300 bg-surface-200 p-4',
        'hover:border-gold/40 hover:bg-gold/5 transition-colors group'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10 text-gold border border-gold/30">
          <Icon className="h-4 w-4" />
        </div>
        <span className="font-mono text-xs font-semibold text-white group-hover:text-gold transition-colors">
          {title}
        </span>
      </div>
      <p className="font-mono text-[11px] text-surface-500 leading-relaxed">
        {blurb}
      </p>
    </a>
  )
}
