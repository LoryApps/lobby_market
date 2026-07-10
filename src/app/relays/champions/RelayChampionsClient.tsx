'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  Crown,
  Link2,
  Loader2,
  Star,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { RelayChampion, RelayChampionsResponse } from '@/app/api/relays/champions/route'

// ─── Tab config ───────────────────────────────────────────────────────────────

type Tab = 'overall' | 'starters' | 'contributors'

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overall',      label: 'Overall',     icon: Trophy },
  { id: 'starters',     label: 'Top Starters',icon: Zap },
  { id: 'contributors', label: 'Top Legs',    icon: Star },
]

// ─── Rank medal ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gold/10 border border-gold/40 text-gold text-sm font-bold">
      <Crown className="h-4 w-4" />
    </div>
  )
  if (rank === 2) return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-surface-300/40 border border-surface-400/40 text-surface-400 text-xs font-bold">
      2
    </div>
  )
  if (rank === 3) return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-against-500/10 border border-against-500/30 text-against-400 text-xs font-bold">
      3
    </div>
  )
  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center text-surface-500 text-xs font-mono">
      {rank}
    </div>
  )
}

// ─── Champion card ────────────────────────────────────────────────────────────

function ChampionCard({
  champion,
  rank,
  tab,
}: {
  champion: RelayChampion
  rank: number
  tab: Tab
}) {
  const isTop3 = rank <= 3

  const primaryStat =
    tab === 'starters'
      ? { label: 'Compelling', value: champion.compelling_started }
      : tab === 'contributors'
      ? { label: 'Stars', value: champion.leg_stars_received }
      : { label: 'Score', value: champion.champion_score }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (rank - 1) * 0.04 }}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
        isTop3
          ? 'border-surface-300 bg-surface-100/80'
          : 'border-surface-200/60 bg-surface-100/40'
      )}
    >
      {/* Rank */}
      <RankBadge rank={rank} />

      {/* Avatar */}
      <Link href={`/profile/${champion.username}`} className="flex-shrink-0">
        <Avatar
          src={champion.avatar_url}
          fallback={champion.display_name || champion.username}
          size="sm"
        />
      </Link>

      {/* Name + stats */}
      <div className="min-w-0 flex-1">
        <Link
          href={`/profile/${champion.username}`}
          className="block text-sm font-medium text-white hover:text-for-300 transition-colors truncate"
        >
          {champion.display_name || `@${champion.username}`}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
          {tab !== 'contributors' && champion.relays_started > 0 && (
            <span className="text-[11px] text-surface-500 font-mono">
              <span className="text-surface-400">{champion.relays_started}</span> started
            </span>
          )}
          {champion.compelling_rate_started !== null && (
            <span className="text-[11px] text-surface-500 font-mono">
              <span className="text-emerald">{champion.compelling_rate_started}%</span> compelling
            </span>
          )}
          {tab !== 'starters' && champion.legs_contributed > 0 && (
            <span className="text-[11px] text-surface-500 font-mono">
              <span className="text-surface-400">{champion.legs_contributed}</span> leg{champion.legs_contributed !== 1 ? 's' : ''}
            </span>
          )}
          {tab === 'contributors' && champion.relays_contributed_to > 0 && (
            <span className="text-[11px] text-surface-500 font-mono">
              in <span className="text-surface-400">{champion.relays_contributed_to}</span> relays
            </span>
          )}
        </div>
      </div>

      {/* Primary stat */}
      <div className="flex-shrink-0 text-right">
        <div className={cn(
          'text-sm font-bold font-mono',
          tab === 'starters' ? 'text-emerald' :
          tab === 'contributors' ? 'text-gold' :
          'text-purple'
        )}>
          {primaryStat.value}
        </div>
        <div className="text-[10px] text-surface-600 uppercase tracking-wide">{primaryStat.label}</div>
      </div>

      {/* Role badge */}
      {champion.role !== 'person' && (
        <Badge variant={champion.role as 'senator' | 'council' | 'moderator' | 'person'} size="xs" className="hidden sm:flex flex-shrink-0" />
      )}
    </motion.div>
  )
}

// ─── Platform stat pill ───────────────────────────────────────────────────────

function StatPill({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-surface-300 bg-surface-100 px-3 py-2">
      <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
      <div>
        <div className={cn('text-sm font-bold font-mono leading-none', color)}>{value}</div>
        <div className="text-[10px] text-surface-500 uppercase tracking-wide mt-0.5">{label}</div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function RelayChampionsClient() {
  const [data, setData] = useState<RelayChampionsResponse | null>(null)
  const [tab, setTab] = useState<Tab>('overall')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (t: Tab) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/relays/champions?tab=${t}&limit=30`)
      if (!res.ok) throw new Error('Failed to load champions')
      const json: RelayChampionsResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load relay champions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(tab)
  }, [load, tab])

  function switchTab(t: Tab) {
    setTab(t)
    load(t)
  }

  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/relays"
            className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Relays
          </Link>

          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gold/10 border border-gold/30">
              <Award className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Relay Champions</h1>
              <p className="text-sm text-surface-500 mt-0.5">
                Citizens who build the most compelling argument chains
              </p>
            </div>
          </div>

          {/* Platform stats */}
          {data && (
            <div className="mt-4 flex flex-wrap gap-2">
              <StatPill icon={Link2} label="Total Relays" value={data.total_relays} color="text-for-400" />
              <StatPill icon={BarChart2} label="Total Legs" value={data.total_legs} color="text-purple" />
              <StatPill icon={Users} label="Champions" value={data.champions.length} color="text-gold" />
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                tab === id
                  ? 'border-gold/50 bg-gold/10 text-gold'
                  : 'border-surface-300 bg-surface-200/60 text-surface-400 hover:text-white hover:border-surface-400'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab description */}
        <p className="text-xs text-surface-600 mb-5 font-mono">
          {tab === 'overall' && 'Composite score: compelling relays (×3) + legs contributed + stars received (×2)'}
          {tab === 'starters' && 'Ranked by number of compelling relay chains started (min. 3 votes cast on relay)'}
          {tab === 'contributors' && 'Ranked by total star upvotes received across all relay leg contributions'}
        </p>

        {/* Content */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-surface-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading champions…</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/5 px-5 py-4 text-sm text-against-400">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {data.champions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-200 border border-surface-300">
                  <Trophy className="h-7 w-7 text-surface-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">No champions yet</p>
                  <p className="text-xs text-surface-500 mt-1">
                    Start or contribute to relay chains to appear here.
                  </p>
                </div>
                <Link
                  href="/relays"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-for-500/50 bg-for-500/10 px-4 py-2 text-xs text-for-300 hover:bg-for-500/20 transition-colors"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Browse Relays
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {data.champions.map((champion, i) => (
                  <ChampionCard
                    key={champion.user_id}
                    champion={champion}
                    rank={i + 1}
                    tab={tab}
                  />
                ))}
              </div>
            )}

            {/* Footer nav */}
            <div className="mt-8 flex flex-wrap gap-3 text-xs text-surface-500">
              <Link href="/relays" className="hover:text-white transition-colors flex items-center gap-1">
                <Link2 className="h-3.5 w-3.5" />
                All Relays
              </Link>
              <span className="text-surface-700">·</span>
              <Link href="/relays/stats" className="hover:text-white transition-colors flex items-center gap-1">
                <BarChart2 className="h-3.5 w-3.5" />
                Relay Stats
              </Link>
              <span className="text-surface-700">·</span>
              <Link href="/relays/showdown" className="hover:text-white transition-colors flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5" />
                Showdown
              </Link>
              <span className="text-surface-700">·</span>
              <Link href="/relays/mine" className="hover:text-white transition-colors flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                My Relays
              </Link>
              <span className="text-surface-700">·</span>
              <Link href="/relays/top-legs" className="hover:text-gold transition-colors flex items-center gap-1">
                <Star className="h-3.5 w-3.5" />
                Top Legs
              </Link>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
