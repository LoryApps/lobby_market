'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  GitCompare,
  Heart,
  RefreshCw,
  Swords,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TwinProfile, TwinsResponse } from '@/app/api/users/twins/route'

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

const ROLE_BADGE: Record<string, 'person' | 'debator' | 'troll_catcher' | 'elder'> = {
  person: 'person',
  debator: 'debator',
  troll_catcher: 'troll_catcher',
  elder: 'elder',
}

// ─── Agreement ring ───────────────────────────────────────────────────────────

function AgreementRing({ pct }: { pct: number }) {
  const r = 20
  const circumference = 2 * Math.PI * r
  const filled = (pct / 100) * circumference
  const color =
    pct >= 80 ? '#10b981' : // emerald — high agreement
    pct >= 60 ? '#60a5fa' : // for-400 — moderate
    pct >= 40 ? '#f59e0b' : // gold — mixed
               '#f87171'   // against — low agreement

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 52, height: 52 }}>
      <svg width="52" height="52" className="-rotate-90" aria-hidden="true">
        {/* Background ring */}
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-surface-300"
          strokeWidth="3"
        />
        {/* Filled arc */}
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - filled}
          strokeLinecap="round"
        />
      </svg>
      {/* Percentage text */}
      <span
        className="absolute font-mono font-bold text-[11px] leading-none"
        style={{ color }}
        aria-label={`${pct}% agreement`}
      >
        {pct}%
      </span>
    </div>
  )
}

// ─── Affinity label ───────────────────────────────────────────────────────────

function AffinityLabel({ pct }: { pct: number }) {
  if (pct >= 90) return <span className="text-[10px] font-mono font-semibold text-emerald">Ideological twin</span>
  if (pct >= 75) return <span className="text-[10px] font-mono font-semibold text-for-400">Strong ally</span>
  if (pct >= 60) return <span className="text-[10px] font-mono font-semibold text-for-300">Fellow traveller</span>
  if (pct >= 45) return <span className="text-[10px] font-mono font-semibold text-gold">Mixed views</span>
  if (pct >= 30) return <span className="text-[10px] font-mono font-semibold text-surface-500">Frequent rival</span>
  return <span className="text-[10px] font-mono font-semibold text-against-400">Ideological opposite</span>
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function TwinSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl border border-surface-300/40 bg-surface-100 animate-pulse">
      <div className="flex-shrink-0 h-[52px] w-[52px] rounded-full bg-surface-300/50" />
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="h-10 w-10 rounded-full bg-surface-300/50 flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-8 w-20 rounded-lg flex-shrink-0" />
    </div>
  )
}

// ─── Twin card ────────────────────────────────────────────────────────────────

function TwinCard({
  twin,
  myUsername,
  rank,
}: {
  twin: TwinProfile
  myUsername: string
  rank: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04, duration: 0.25 }}
    >
      <div className="flex items-center gap-3 p-4 rounded-2xl border border-surface-300/40 bg-surface-100 hover:border-surface-400/60 hover:bg-surface-200/60 transition-colors group">
        {/* Agreement ring */}
        <AgreementRing pct={twin.agreement_pct} />

        {/* Profile info */}
        <Link
          href={`/profile/${twin.username}`}
          className="flex items-center gap-3 flex-1 min-w-0"
        >
          <Avatar
            src={twin.avatar_url}
            fallback={twin.display_name || twin.username}
            size="md"
            className="flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className="font-semibold text-white text-sm truncate">
                {twin.display_name || twin.username}
              </span>
              <Badge variant={ROLE_BADGE[twin.role] ?? 'person'} className="text-[10px] px-1.5 py-0">
                {ROLE_LABEL[twin.role] ?? twin.role}
              </Badge>
            </div>
            <p className="text-[11px] font-mono text-surface-500 mb-1">
              @{twin.username}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <AffinityLabel pct={twin.agreement_pct} />
              <span className="text-[10px] font-mono text-surface-600">
                {twin.shared_votes} shared votes
              </span>
              <span className="text-[10px] font-mono text-surface-600">
                {twin.agree_count} agree · {twin.disagree_count} differ
              </span>
            </div>
          </div>
        </Link>

        {/* Compare CTA */}
        <Link
          href={`/compare-users?a=${encodeURIComponent(myUsername)}&b=${encodeURIComponent(twin.username)}`}
          className={cn(
            'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl',
            'text-xs font-mono font-semibold',
            'bg-for-600/20 border border-for-600/30 text-for-400',
            'hover:bg-for-600/40 hover:border-for-500/50 transition-all',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
          )}
          aria-label={`Compare your votes with @${twin.username}`}
        >
          <GitCompare className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="hidden sm:block">Compare</span>
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortMode = 'agreement' | 'shared'

const SORT_OPTIONS: { id: SortMode; label: string; icon: typeof Heart }[] = [
  { id: 'agreement', label: 'Most aligned', icon: Heart },
  { id: 'shared', label: 'Most shared votes', icon: Zap },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TwinsPage() {
  const [data, setData] = useState<TwinsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortMode>('agreement')
  const [filterMin, setFilterMin] = useState<number>(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/users/twins')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 401) {
          setError('Sign in to find your political twins.')
        } else {
          setError(body.error ?? 'Failed to load twins.')
        }
        return
      }
      const json = await res.json() as TwinsResponse
      setData(json)
    } catch {
      setError('Unable to connect. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Sort + filter logic applied client-side
  const displayedTwins: TwinProfile[] = data
    ? [...data.twins]
        .filter((t) => t.agreement_pct >= filterMin)
        .sort((a, b) => {
          if (sort === 'agreement') {
            if (a.agreement_pct !== b.agreement_pct) return b.agreement_pct - a.agreement_pct
            return b.shared_votes - a.shared_votes
          }
          // sort === 'shared'
          if (a.shared_votes !== b.shared_votes) return b.shared_votes - a.shared_votes
          return b.agreement_pct - a.agreement_pct
        })
    : []

  // Bucket into allies and rivals
  const allies = displayedTwins.filter((t) => t.agreement_pct >= 50)
  const rivals = displayedTwins.filter((t) => t.agreement_pct < 50)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30">
              <Users className="h-5 w-5 text-emerald" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Vote Twins
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Citizens who voted most like you
              </p>
            </div>
          </div>
          <p className="text-sm text-surface-500 leading-relaxed max-w-xl">
            Based on how you both voted on shared topics. High agreement means
            your political instincts align — low agreement means you see the
            world differently.
          </p>
        </div>

        {/* ── Controls ───────────────────────────────────────────────────── */}
        {!loading && data && data.twins.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {/* Sort toggle */}
            <div className="flex items-center gap-0.5 bg-surface-200/80 border border-surface-300 rounded-lg p-0.5 backdrop-blur-sm">
              {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSort(id)}
                  aria-pressed={sort === id}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all',
                    sort === id
                      ? 'bg-for-600 text-white shadow-sm'
                      : 'text-surface-500 hover:text-surface-300'
                  )}
                >
                  <Icon className="h-3 w-3 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </div>

            {/* Min agreement filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-surface-500">Min alignment:</span>
              {[0, 50, 60, 75].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setFilterMin(pct)}
                  aria-pressed={filterMin === pct}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all',
                    filterMin === pct
                      ? 'bg-emerald/20 text-emerald border-emerald/40'
                      : 'bg-transparent text-surface-500 border-surface-500/30 hover:text-surface-300 hover:border-surface-400'
                  )}
                >
                  {pct === 0 ? 'All' : `${pct}%+`}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={load}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white border border-surface-300/40 hover:border-surface-400 transition-all"
              aria-label="Refresh twins"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>
        )}

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <TwinSkeleton key={i} />
            ))}
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {!loading && error && (
          <EmptyState
            icon={Users}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Couldn't load twins"
            description={error}
            actions={
              error.includes('Sign in')
                ? [{ label: 'Sign in', href: '/login', variant: 'primary', icon: ArrowRight }]
                : [{ label: 'Try again', onClick: load, variant: 'primary', icon: RefreshCw }]
            }
          />
        )}

        {/* ── Empty — not enough votes ──────────────────────────────────── */}
        {!loading && !error && data && data.twins.length === 0 && (
          <EmptyState
            icon={Users}
            iconColor="text-surface-500"
            iconBg="bg-surface-300/20"
            iconBorder="border-surface-400/20"
            title="No twins found yet"
            description={
              data.my_total_votes < 3
                ? `You've cast ${data.my_total_votes} vote${data.my_total_votes === 1 ? '' : 's'}. Cast at least 3 to start finding your political matches.`
                : "No one has voted on enough of the same topics yet. Keep voting and check back as the community grows."
            }
            actions={[{ label: 'Cast your votes', href: '/', variant: 'primary', icon: Zap }]}
          />
        )}

        {/* ── Empty after filter ────────────────────────────────────────── */}
        {!loading && !error && data && data.twins.length > 0 && displayedTwins.length === 0 && (
          <EmptyState
            icon={Users}
            iconColor="text-surface-500"
            iconBg="bg-surface-300/20"
            iconBorder="border-surface-400/20"
            title="No matches at this alignment level"
            description="Try lowering the minimum alignment filter."
            actions={[{ label: 'Show all', onClick: () => setFilterMin(0), variant: 'primary' }]}
          />
        )}

        {/* ── Results ──────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {!loading && !error && displayedTwins.length > 0 && (
            <motion.div
              key={`${sort}-${filterMin}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-8"
            >
              {/* Allies section */}
              {allies.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Heart className="h-4 w-4 text-emerald" aria-hidden="true" />
                    <h2 className="font-mono text-sm font-semibold text-surface-400">
                      Allies
                      <span className="ml-2 text-surface-600 font-normal">
                        ≥ 50% agreement
                      </span>
                    </h2>
                  </div>
                  <div className="space-y-2">
                    {allies.map((twin, i) => (
                      <TwinCard
                        key={twin.id}
                        twin={twin}
                        myUsername={data!.my_username}
                        rank={i}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Rivals section */}
              {rivals.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Swords className="h-4 w-4 text-against-400" aria-hidden="true" />
                    <h2 className="font-mono text-sm font-semibold text-surface-400">
                      Ideological rivals
                      <span className="ml-2 text-surface-600 font-normal">
                        &lt; 50% agreement
                      </span>
                    </h2>
                  </div>
                  <div className="space-y-2">
                    {rivals.map((twin, i) => (
                      <TwinCard
                        key={twin.id}
                        twin={twin}
                        myUsername={data!.my_username}
                        rank={allies.length + i}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Stats footer */}
              {data && (
                <div className="pt-2 text-center">
                  <p className="text-[11px] font-mono text-surface-600">
                    Based on your {Math.min(data.my_total_votes, 200).toLocaleString()} most recent votes
                    · {displayedTwins.length} match{displayedTwins.length !== 1 ? 'es' : ''} found
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      <BottomNav />
    </div>
  )
}
