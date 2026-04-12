import { Coins, Megaphone, TrendingUp, Users, Zap } from 'lucide-react'
import type {
  CloutTransaction,
  Coalition,
  Lobby,
  Profile,
} from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

type LobbyWithCreator = Lobby & {
  creator?: Pick<
    Profile,
    'id' | 'username' | 'display_name' | 'avatar_url' | 'role'
  > | null
}

type TransactionWithUser = CloutTransaction & {
  user?: Pick<Profile, 'id' | 'username' | 'display_name' | 'role'> | null
}

interface InfluenceMarketProps {
  trendingLobbies: LobbyWithCreator[]
  topCoalitions: Coalition[]
  recentTransactions: TransactionWithUser[]
  stats: {
    totalLobbies: number
    totalLobbyMembers: number
    totalCoalitions: number
    totalCloutInCirculation: number
  }
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'gold',
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  tone?: 'gold' | 'emerald' | 'purple' | 'for'
}) {
  const toneMap = {
    gold: 'text-gold bg-gold/10 border-gold/30',
    emerald: 'text-emerald bg-emerald/10 border-emerald/30',
    purple: 'text-purple bg-purple/10 border-purple/30',
    for: 'text-for-400 bg-for-500/10 border-for-500/30',
  }
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg border',
            toneMap[tone]
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-surface-500">
          {label}
        </span>
      </div>
      <div className="mt-2 font-mono text-2xl font-bold text-white tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  )
}

export function InfluenceMarket({
  trendingLobbies,
  topCoalitions,
  recentTransactions,
  stats,
}: InfluenceMarketProps) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Active Lobbies"
          value={stats.totalLobbies}
          icon={Megaphone}
          tone="gold"
        />
        <StatCard
          label="Joined Members"
          value={stats.totalLobbyMembers}
          icon={Users}
          tone="for"
        />
        <StatCard
          label="Coalitions"
          value={stats.totalCoalitions}
          icon={Users}
          tone="purple"
        />
        <StatCard
          label="Clout Circulating"
          value={stats.totalCloutInCirculation}
          icon={Coins}
          tone="emerald"
        />
      </div>

      <section>
        <h3 className="flex items-center gap-2 font-mono text-sm font-semibold text-white mb-3">
          <TrendingUp className="h-4 w-4 text-gold" />
          Trending Campaigns
        </h3>
        {trendingLobbies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-300 bg-surface-100 p-6 text-center font-mono text-xs text-surface-500">
            No active campaigns yet
          </div>
        ) : (
          <div className="space-y-2">
            {trendingLobbies.slice(0, 5).map((lobby, idx) => (
              <div
                key={lobby.id}
                className="flex items-center gap-3 rounded-xl border border-surface-300 bg-surface-100 px-4 py-3"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-200 font-mono text-[11px] font-bold text-gold flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs font-semibold text-white truncate">
                    {lobby.name}
                  </div>
                  <div className="font-mono text-[10px] text-surface-500 truncate">
                    {lobby.campaign_statement}
                  </div>
                </div>
                <div
                  className={cn(
                    'rounded-md px-2 py-0.5 font-mono text-[9px] font-bold',
                    lobby.position === 'for'
                      ? 'bg-for-500/10 text-for-400'
                      : 'bg-against-500/10 text-against-400'
                  )}
                >
                  {lobby.position === 'for' ? 'FOR' : 'AGAINST'}
                </div>
                <div className="hidden sm:flex items-center gap-1 font-mono text-[11px] text-surface-500">
                  <Users className="h-3 w-3" />
                  <span>{lobby.member_count}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="flex items-center gap-2 font-mono text-sm font-semibold text-white mb-3">
          <Zap className="h-4 w-4 text-purple" />
          Top Coalitions
        </h3>
        {topCoalitions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-300 bg-surface-100 p-6 text-center font-mono text-xs text-surface-500">
            No coalitions yet
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {topCoalitions.slice(0, 6).map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-surface-300 bg-surface-100 px-4 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple/10 border border-purple/30 text-purple flex-shrink-0">
                  <Users className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs font-semibold text-white truncate">
                    {c.name}
                  </div>
                  <div className="font-mono text-[10px] text-surface-500">
                    {c.member_count} members ·{' '}
                    {Math.round(c.coalition_influence)} influence
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="flex items-center gap-2 font-mono text-sm font-semibold text-white mb-3">
          <Coins className="h-4 w-4 text-emerald" />
          Recent Clout Activity
        </h3>
        {recentTransactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-300 bg-surface-100 p-6 text-center font-mono text-xs text-surface-500">
            No recent transactions
          </div>
        ) : (
          <div className="rounded-xl border border-surface-300 bg-surface-100 divide-y divide-surface-300/60">
            {recentTransactions.slice(0, 8).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 px-4 py-3 font-mono text-xs"
              >
                <span className="text-surface-500 min-w-0 truncate">
                  @{tx.user?.username ?? 'unknown'}
                </span>
                <span className="text-surface-700 truncate flex-1">
                  {tx.reason}
                </span>
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums flex-shrink-0',
                    tx.amount >= 0 ? 'text-emerald' : 'text-against-400'
                  )}
                >
                  {tx.amount >= 0 ? '+' : ''}
                  {tx.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
