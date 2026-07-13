'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Check,
  ChevronRight,
  Crown,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  ScrollText,
  Shield,
  Sparkles,
  Star,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  RoyalAssentData,
  AwaitingAssentLaw,
  AssentRecord,
  AssentGranter,
} from '@/app/api/royal-assent/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function elderTitle(clout: number): string {
  if (clout >= 2000) return 'Sovereign'
  if (clout >= 1500) return 'Grand Elder'
  if (clout >= 1000) return 'High Elder'
  return 'Elder'
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:    'text-gold',
  Politics:     'text-for-400',
  Technology:   'text-purple',
  Science:      'text-emerald',
  Ethics:       'text-against-400',
  Philosophy:   'text-purple',
  Culture:      'text-gold',
  Health:       'text-emerald',
  Environment:  'text-emerald',
  Education:    'text-for-300',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AwaitingCard({
  law,
  isElder,
  onGrantAssent,
}: {
  law: AwaitingAssentLaw
  isElder: boolean
  onGrantAssent: (lawId: string) => void
}) {
  const forPct = Math.round(law.blue_pct ?? 50)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-100 border border-surface-200/80 rounded-2xl p-5 hover:border-gold/30 transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
          <ScrollText className="w-5 h-5 text-gold" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <Link
              href={`/law/${law.id}`}
              className="text-sm font-semibold text-white line-clamp-2 hover:text-gold transition-colors"
            >
              {law.statement}
            </Link>
            {law.category && (
              <span className={cn('text-xs font-medium flex-shrink-0', CATEGORY_COLOR[law.category] ?? 'text-surface-400')}>
                {law.category}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-surface-500 mb-3">
            <span className="flex items-center gap-1">
              <Gavel className="w-3 h-3 text-gold" />
              Law · {formatDate(law.established_at)}
            </span>
            <span>·</span>
            <span>{forPct}% For</span>
            {law.total_lords_reviews > 0 && (
              <>
                <span>·</span>
                <span className="text-for-400">
                  {law.ratify_count}/{law.total_lords_reviews} Lords ratified
                </span>
              </>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-1 rounded-full bg-surface-300 overflow-hidden mb-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400"
              style={{ width: `${forPct}%` }}
            />
          </div>

          {isElder && (
            <button
              onClick={() => onGrantAssent(law.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold/10 border border-gold/30 text-gold text-xs font-semibold hover:bg-gold/20 transition-colors"
            >
              <Crown className="w-3.5 h-3.5" />
              Grant Royal Assent
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function AssentCard({ record }: { record: AssentRecord }) {
  const forPct = Math.round(record.blue_pct ?? 50)
  const title = elderTitle(record.granter_clout)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-100 border border-gold/25 rounded-2xl p-5 relative overflow-hidden"
    >
      {/* Gold shimmer accent */}
      <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-bl from-gold/8 to-transparent rounded-2xl" />
      </div>

      {/* Royal Seal badge */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/15 border border-gold/35">
        <Star className="w-3 h-3 text-gold fill-gold" />
        <span className="text-[10px] font-bold text-gold tracking-wider">ROYAL SEAL</span>
      </div>

      <div className="flex items-start gap-4 pr-28">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center">
          <Crown className="w-5 h-5 text-gold" />
        </div>

        <div className="flex-1 min-w-0">
          <Link
            href={`/law/${record.law_id}`}
            className="text-sm font-semibold text-white hover:text-gold transition-colors line-clamp-2 mb-1.5"
          >
            {record.statement}
          </Link>

          <div className="flex items-center gap-2 text-xs text-surface-500 mb-2.5">
            {record.category && (
              <span className={cn('font-medium', CATEGORY_COLOR[record.category] ?? 'text-surface-400')}>
                {record.category}
              </span>
            )}
            <span>·</span>
            <span>{forPct}% For</span>
            <span>·</span>
            <span>{relativeTime(record.granted_at)}</span>
          </div>

          {/* Progress bar */}
          <div className="h-1 rounded-full bg-surface-300 overflow-hidden mb-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold/60 to-gold"
              style={{ width: `${forPct}%` }}
            />
          </div>

          {record.proclamation && (
            <blockquote className="text-xs text-surface-400 italic border-l-2 border-gold/30 pl-3 mb-3 line-clamp-2">
              "{record.proclamation}"
            </blockquote>
          )}

          {/* Granter */}
          <div className="flex items-center gap-2">
            <Avatar
              src={record.granter_avatar_url}
              username={record.granter_username}
              size="xs"
            />
            <span className="text-xs text-surface-400">
              Proclaimed by{' '}
              <Link
                href={`/profile/${record.granter_username}`}
                className="text-gold font-medium hover:underline"
              >
                {record.granter_display_name ?? record.granter_username}
              </Link>
              {' '}· {title}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Grant Assent Modal ───────────────────────────────────────────────────────

function GrantAssentModal({
  law,
  onClose,
  onConfirm,
}: {
  law: AwaitingAssentLaw
  onClose: () => void
  onConfirm: (proclamation: string) => Promise<void>
}) {
  const [proclamation, setProclamation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm(proclamation)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-surface-100 border border-gold/30 rounded-2xl p-6 shadow-2xl"
      >
        {/* Gold glow */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-b from-gold/5 to-transparent" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-surface-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center">
            <Crown className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h3 className="font-bold text-white">Grant Royal Assent</h3>
            <p className="text-xs text-surface-400">This law will receive the Royal Seal</p>
          </div>
        </div>

        <div className="bg-surface-200/60 border border-surface-300/50 rounded-xl p-3.5 mb-4">
          <p className="text-sm font-medium text-white line-clamp-2">{law.statement}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-surface-500">
            <Gavel className="w-3 h-3 text-gold" />
            <span>Established {formatDate(law.established_at)}</span>
            {law.total_lords_reviews > 0 && (
              <>
                <span>·</span>
                <span className="text-for-400">{law.ratify_count}/{law.total_lords_reviews} Lords ratified</span>
              </>
            )}
          </div>
        </div>

        <label className="block mb-4">
          <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2 block">
            Proclamation <span className="text-surface-600 font-normal normal-case">(optional · max 400 chars)</span>
          </span>
          <textarea
            value={proclamation}
            onChange={(e) => setProclamation(e.target.value)}
            maxLength={400}
            rows={3}
            placeholder="Add a ceremonial proclamation…"
            className="w-full bg-surface-200/60 border border-surface-300/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-surface-500 outline-none resize-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-colors"
          />
          <p className="text-right text-xs text-surface-600 mt-1">{proclamation.length}/400</p>
        </label>

        {error && (
          <p className="text-xs text-against-400 bg-against-500/10 border border-against-500/20 rounded-xl px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gold text-surface-50 font-semibold text-sm hover:bg-gold/90 disabled:opacity-60 transition-colors"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Crown className="w-4 h-4" />
              Proclaim Royal Assent
            </>
          )}
        </button>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'awaiting' | 'sealed' | 'elders'

export function RoyalAssentClient() {
  const [data, setData] = useState<RoyalAssentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('sealed')
  const [grantingFor, setGrantingFor] = useState<AwaitingAssentLaw | null>(null)
  const [justGranted, setJustGranted] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/royal-assent', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as RoyalAssentData
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleGrant = useCallback(async (proclamation: string) => {
    if (!grantingFor) return
    const res = await fetch('/api/royal-assent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ law_id: grantingFor.id, proclamation }),
    })
    const json = await res.json() as { ok?: boolean; error?: string }
    if (!res.ok) throw new Error(json.error ?? 'Failed to grant assent')
    setJustGranted((prev) => new Set([...prev, grantingFor.id]))
    setGrantingFor(null)
    // Reload after short delay
    setTimeout(() => { load(); setJustGranted(new Set()) }, 1500)
  }, [grantingFor, load])

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'sealed', label: 'Royal Seals', count: data?.total_assented ?? undefined },
    { id: 'awaiting', label: 'Awaiting Assent', count: data?.awaiting.length },
    { id: 'elders', label: 'Elders', count: data?.granters.length },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center">
              <Crown className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Royal Assent</h1>
              <p className="text-sm text-surface-400">The final seal of the Civic Codex</p>
            </div>
          </div>

          <p className="text-sm text-surface-400 leading-relaxed max-w-2xl mt-3">
            After a law passes through the Commons and is reviewed by the House of Lords,
            distinguished Elders grant Royal Assent — the ceremonial proclamation that cements
            the law into the Lobby&apos;s permanent Civic Record.
          </p>

          {/* Stats row */}
          {data && (
            <div className="flex items-center gap-4 mt-4 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gold/10 border border-gold/20">
                <Star className="w-3.5 h-3.5 text-gold fill-gold" />
                <span className="text-sm font-semibold text-gold">{data.total_assented}</span>
                <span className="text-xs text-gold/70">laws sealed</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-200 border border-surface-300/60">
                <Crown className="w-3.5 h-3.5 text-surface-400" />
                <span className="text-sm font-semibold text-white">{data.granters.length}</span>
                <span className="text-xs text-surface-500">Elders</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-200 border border-surface-300/60">
                <ScrollText className="w-3.5 h-3.5 text-surface-400" />
                <span className="text-sm font-semibold text-white">{data.awaiting.length}</span>
                <span className="text-xs text-surface-500">awaiting</span>
              </div>

              {/* Elder status */}
              {data.is_elder ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald/10 border border-emerald/30 ml-auto">
                  <Shield className="w-3.5 h-3.5 text-emerald" />
                  <span className="text-xs font-semibold text-emerald">
                    {elderTitle(data.user_clout)} · {data.user_clout} clout
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-200 border border-surface-300/60 ml-auto">
                  <Shield className="w-3.5 h-3.5 text-surface-500" />
                  <span className="text-xs text-surface-400">
                    {data.elder_threshold - data.user_clout} more clout to become an Elder
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-surface-200/60 overflow-x-auto scrollbar-none">
          {tabs.map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                tab === id
                  ? 'border-gold text-gold'
                  : 'border-transparent text-surface-400 hover:text-white'
              )}
            >
              {label}
              {count !== undefined && (
                <span className={cn(
                  'text-xs rounded-full px-1.5 py-0.5 font-mono',
                  tab === id ? 'bg-gold/20 text-gold' : 'bg-surface-200 text-surface-500'
                )}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-surface-400 mb-4">{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl bg-surface-200 text-white text-sm hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            {/* Sealed laws tab */}
            {tab === 'sealed' && (
              <motion.div key="sealed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {data.recent.length === 0 ? (
                  <EmptyState
                    icon={Crown}
                    iconColor="text-gold"
                    title="No laws sealed yet"
                    description="Be the first Elder to grant Royal Assent to an established law."
                  />
                ) : (
                  <div className="space-y-4">
                    {data.recent.map((record) => (
                      <AssentCard key={record.assent_id} record={record} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Awaiting assent tab */}
            {tab === 'awaiting' && (
              <motion.div key="awaiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {!data.is_elder && (
                  <div className="flex items-start gap-3 p-4 bg-gold/5 border border-gold/20 rounded-2xl mb-4">
                    <Sparkles className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-surface-400">
                      Reach <span className="text-gold font-semibold">{data.elder_threshold} clout</span> to
                      unlock the ability to grant Royal Assent. You currently have{' '}
                      <span className="text-white font-semibold">{data.user_clout} clout</span>.
                    </p>
                  </div>
                )}

                {data.awaiting.length === 0 ? (
                  <EmptyState
                    icon={ScrollText}
                    title="No laws awaiting assent"
                    description="All established laws have received Royal Assent, or none are ready yet."
                    action={{ label: 'Browse the Law Codex', href: '/law' }}
                  />
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence>
                      {data.awaiting.map((law) =>
                        justGranted.has(law.id) ? (
                          <motion.div
                            key={law.id}
                            initial={{ opacity: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex items-center justify-center gap-2 py-4 bg-gold/10 border border-gold/30 rounded-2xl"
                          >
                            <Check className="w-5 h-5 text-gold" />
                            <span className="text-gold font-medium text-sm">Royal Assent Granted</span>
                          </motion.div>
                        ) : (
                          <AwaitingCard
                            key={law.id}
                            law={law}
                            isElder={data.is_elder}
                            onGrantAssent={() => setGrantingFor(law)}
                          />
                        )
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}

            {/* Elders tab */}
            {tab === 'elders' && (
              <motion.div key="elders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {data.granters.length === 0 ? (
                  <EmptyState
                    icon={Crown}
                    iconColor="text-gold"
                    title="No Elders yet"
                    description={`Earn ${data.elder_threshold} clout to become an Elder and appear in this register.`}
                  />
                ) : (
                  <>
                    <p className="text-xs text-surface-500 mb-4">
                      Citizens who have granted Royal Assent, ranked by civic standing.
                    </p>
                    <div className="space-y-2">
                      {data.granters.map((elder: AssentGranter, idx) => (
                        <motion.div
                          key={elder.user_id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="flex items-center gap-4 p-4 bg-surface-100 border border-surface-200/60 rounded-2xl hover:border-gold/25 transition-colors"
                        >
                          <span className="w-7 text-center text-sm font-mono text-surface-500">
                            {idx + 1}
                          </span>
                          <Avatar
                            src={elder.avatar_url}
                            username={elder.username}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/profile/${elder.username}`}
                              className="text-sm font-semibold text-white hover:text-gold transition-colors"
                            >
                              {elder.display_name ?? elder.username}
                            </Link>
                            <p className="text-xs text-surface-500">@{elder.username}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant="active" className="text-xs">
                              {elder.title}
                            </Badge>
                            <p className="text-xs text-gold mt-1">{elder.clout.toLocaleString()} clout</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-surface-500 flex-shrink-0" />
                        </motion.div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* How it works */}
        <div className="mt-10 pt-6 border-t border-surface-200/60">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Scale className="w-4 h-4 text-surface-400" />
            How Royal Assent Works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { num: '1', title: 'Commons passes', desc: 'A topic reaches consensus and becomes an established law in the Civic Codex.' },
              { num: '2', title: 'Lords review', desc: 'House of Lords members vote to ratify, send back, or abstain. The record is preserved.' },
              { num: '3', title: 'Royal Assent', desc: 'An Elder formally proclaims the law, sealing it with the Royal Seal and making it permanent.' },
            ].map(({ num, title, desc }) => (
              <div key={num} className="bg-surface-100 border border-surface-200/60 rounded-xl p-4">
                <div className="w-6 h-6 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center mb-3">
                  <span className="text-xs font-bold text-gold">{num}</span>
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">{title}</h4>
                <p className="text-xs text-surface-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-4">
            <Link
              href="/lords"
              className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-white transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              House of Lords
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Link
              href="/law"
              className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-white transition-colors"
            >
              <Gavel className="w-3.5 h-3.5" />
              Law Codex
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Link
              href="/parliament"
              className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-white transition-colors"
            >
              <Crown className="w-3.5 h-3.5" />
              Parliament
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </main>

      <BottomNav />

      {/* Grant Assent Modal */}
      <AnimatePresence>
        {grantingFor && (
          <GrantAssentModal
            law={grantingFor}
            onClose={() => setGrantingFor(null)}
            onConfirm={handleGrant}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
