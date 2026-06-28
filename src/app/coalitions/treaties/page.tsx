'use client'

/**
 * /coalitions/treaties — Global Coalition Diplomatic Registry
 *
 * A public record of all inter-coalition treaties across the platform.
 * Shows active alliances, non-aggression pacts, and research exchanges,
 * making coalition diplomacy transparent to all citizens.
 *
 * Three sections:
 *   Active    — currently in-force treaties
 *   Pending   — proposals awaiting acceptance
 *   Archive   — expired, rejected, or broken treaties
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Clock,
  FileText,
  Handshake,
  RefreshCw,
  Shield,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TreatyRow, TreatiesResponse } from '@/app/api/coalitions/treaties/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'active' | 'pending' | 'archive'
type TreatyType = 'alliance' | 'non_aggression' | 'research_exchange'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TREATY_TYPE_CONFIG: Record<TreatyType, { label: string; icon: typeof Handshake; color: string; bg: string }> = {
  alliance: {
    label: 'Alliance',
    icon: Handshake,
    color: 'text-for-400',
    bg: 'bg-for-500/10 border-for-500/20',
  },
  non_aggression: {
    label: 'Non-Aggression Pact',
    icon: Shield,
    color: 'text-gold',
    bg: 'bg-gold/10 border-gold/20',
  },
  research_exchange: {
    label: 'Research Exchange',
    icon: BookOpen,
    color: 'text-purple',
    bg: 'bg-purple/10 border-purple/20',
  },
}

function timeUntilExpiry(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  if (d >= 2) return `${d}d left`
  if (d === 1) return '1d left'
  if (h >= 1) return `${h}h left`
  return 'Expiring soon'
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Treaty row ───────────────────────────────────────────────────────────────

function TreatyItem({ treaty }: { treaty: TreatyRow }) {
  const cfg = TREATY_TYPE_CONFIG[treaty.treaty_type as TreatyType] ?? TREATY_TYPE_CONFIG.alliance
  const Icon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-100 border border-surface-300 rounded-2xl p-4 hover:border-surface-400 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-xl border shrink-0', cfg.bg)}>
          <Icon className={cn('h-4 w-4', cfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-surface-900 text-sm leading-tight">{treaty.title}</span>
            <span className="text-xs font-mono text-surface-500">{cfg.label}</span>
          </div>

          {/* Coalition pair */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Link
              href={`/coalitions/${treaty.proposer.id}`}
              className="text-xs font-semibold text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
            >
              <Users className="h-3 w-3" />
              {treaty.proposer.name}
            </Link>
            <Handshake className="h-3 w-3 text-surface-500" />
            <Link
              href={`/coalitions/${treaty.recipient.id}`}
              className="text-xs font-semibold text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
            >
              <Users className="h-3 w-3" />
              {treaty.recipient.name}
            </Link>
          </div>

          {treaty.terms && (
            <p className="text-xs text-surface-600 mt-1.5 leading-relaxed line-clamp-2">{treaty.terms}</p>
          )}

          <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-surface-500 font-mono">
            <span>{relativeTime(treaty.proposed_at)}</span>
            {treaty.expires_at && treaty.status === 'accepted' && (
              <span className="text-for-400 font-semibold">{timeUntilExpiry(treaty.expires_at)}</span>
            )}
            {treaty.status === 'pending' && (
              <span className="text-gold">Awaiting response</span>
            )}
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1">
          <Link
            href={`/coalitions/${treaty.proposer.id}/treaties`}
            className="text-surface-500 hover:text-for-400 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

function ItemSkeleton() {
  return (
    <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="h-9 w-9 rounded-xl bg-surface-300 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-2/3 rounded bg-surface-300" />
          <div className="h-3 w-1/2 rounded bg-surface-300" />
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GlobalTreatiesPage() {
  const [tab, setTab] = useState<Tab>('active')
  const [data, setData] = useState<TreatiesResponse>({ active: [], pending: [], recent: [] })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/coalitions/treaties')
      if (res.ok) {
        const json = await res.json() as TreatiesResponse
        setData(json)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const displayed =
    tab === 'active' ? data.active : tab === 'pending' ? data.pending : data.recent

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'active', label: 'Active', count: data.active.length },
    { id: 'pending', label: 'Pending', count: data.pending.length },
    { id: 'archive', label: 'Archive', count: data.recent.length },
  ]

  return (
    <div className="min-h-screen bg-surface-50 pb-20">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/coalitions" className="text-surface-500 hover:text-surface-300 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-surface-900 flex items-center gap-2">
              <Handshake className="h-5 w-5 text-for-400" />
              Coalition Diplomatic Registry
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              All inter-coalition treaties, alliances, and pacts across the Lobby
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 text-surface-500 hover:text-surface-300 transition-colors"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Active Treaties', value: data.active.length, icon: Handshake, color: 'text-for-400' },
            { label: 'Alliances', value: data.active.filter((t) => t.treaty_type === 'alliance').length, icon: Zap, color: 'text-for-400' },
            { label: 'Pacts', value: data.active.filter((t) => t.treaty_type === 'non_aggression').length, icon: Shield, color: 'text-gold' },
          ].map((s) => {
            const Icon = s.icon
            return (
              <div key={s.label} className="bg-surface-100 border border-surface-300 rounded-2xl p-3 text-center">
                <Icon className={cn('h-4 w-4 mx-auto mb-1', s.color)} />
                <p className="text-lg font-bold text-surface-900 font-mono">{s.value}</p>
                <p className="text-[10px] text-surface-500 leading-tight">{s.label}</p>
              </div>
            )
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-200/50 rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5',
                tab === t.id
                  ? 'bg-surface-100 text-surface-900 shadow-sm'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              {t.label}
              {t.count > 0 && (
                <span className={cn(
                  'px-1.5 py-0.5 rounded-full font-mono text-[10px]',
                  tab === t.id ? 'bg-for-500/20 text-for-400' : 'bg-surface-300 text-surface-500'
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <ItemSkeleton key={i} />)}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={tab === 'active' ? Handshake : tab === 'pending' ? Clock : FileText}
            title={
              tab === 'active'
                ? 'No active treaties'
                : tab === 'pending'
                ? 'No pending proposals'
                : 'No treaty archive'
            }
            description={
              tab === 'active'
                ? 'No coalitions currently have active diplomatic agreements.'
                : tab === 'pending'
                ? 'No treaties are waiting to be accepted or rejected.'
                : 'Resolved treaties will appear here over time.'
            }
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {displayed.map((treaty) => (
                <TreatyItem key={treaty.id} treaty={treaty} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Treaty type legend */}
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 space-y-2">
          <h3 className="text-xs font-semibold text-surface-600 uppercase tracking-widest">Treaty Types</h3>
          <div className="space-y-2">
            {(Object.entries(TREATY_TYPE_CONFIG) as [TreatyType, typeof TREATY_TYPE_CONFIG[TreatyType]][]).map(([type, cfg]) => {
              const Icon = cfg.icon
              return (
                <div key={type} className="flex items-start gap-2.5">
                  <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', cfg.color)} />
                  <div>
                    <span className="text-xs font-semibold text-surface-800">{cfg.label}</span>
                    <p className="text-xs text-surface-500">
                      {type === 'alliance' && 'Coalitions coordinate votes on shared-stance topics.'}
                      {type === 'non_aggression' && 'Both coalitions agree not to challenge each other.'}
                      {type === 'research_exchange' && 'Members share sources and civic evidence.'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
