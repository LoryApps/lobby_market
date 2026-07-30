'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Gavel,
  GitMerge,
  Mic,
  Network,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { LawConnectionsResponse, ConnectionCoalition, ConnectionTopic, ConnectionLaw, ConnectionDebate } from '@/app/api/laws/[id]/connections/route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d < 1) return 'today'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return `${Math.floor(d / 30)}mo ago`
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function futureTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `in ${d}d`
  if (h > 0) return `in ${h}h`
  return `in ${m}m`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  label,
  count,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  color: string
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={cn('h-4 w-4', color)} />
      <h2 className="text-sm font-semibold text-white">{label}</h2>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-surface-500 font-mono ml-auto">{count}</span>
      )}
    </div>
  )
}

// ── Coalition card ────────────────────────────────────────────────────────────

function CoalitionCard({ coalition }: { coalition: ConnectionCoalition }) {
  const stanceIcon =
    coalition.stance === 'for' ? ThumbsUp :
    coalition.stance === 'against' ? ThumbsDown : Scale
  const stanceColor =
    coalition.stance === 'for' ? 'text-for-400' :
    coalition.stance === 'against' ? 'text-against-400' : 'text-surface-500'
  const stanceBg =
    coalition.stance === 'for' ? 'bg-for-500/10 border-for-500/30' :
    coalition.stance === 'against' ? 'bg-against-500/10 border-against-500/30' :
    'bg-surface-300/50 border-surface-400/30'
  const StanceIcon = stanceIcon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-xl border p-3.5', stanceBg)}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-surface-200/60 border border-surface-300/60 flex items-center justify-center">
          <Shield className="h-4 w-4 text-surface-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Link
              href={`/coalitions/${coalition.coalition_id}`}
              className="text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
            >
              {coalition.name}
            </Link>
            <span className={cn('flex items-center gap-1 text-xs font-mono ml-auto flex-shrink-0', stanceColor)}>
              <StanceIcon className="h-3 w-3" />
              {coalition.stance.toUpperCase()}
            </span>
          </div>
          <p className="text-[11px] text-surface-500 mb-1">
            {fmt(coalition.member_count)} members · {relTime(coalition.declared_at)}
          </p>
          {coalition.statement && (
            <p className="text-xs text-surface-400 leading-relaxed line-clamp-2">
              &ldquo;{coalition.statement}&rdquo;
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Sister debate card ────────────────────────────────────────────────────────

function SisterDebateCard({ topic }: { topic: ConnectionTopic }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const isVoting = topic.status === 'voting'

  return (
    <Link href={`/topic/${topic.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-surface-300/60 bg-surface-200/60 p-3.5 hover:border-surface-400/80 hover:bg-surface-200/80 transition-all"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <p className="text-sm text-white leading-snug line-clamp-2 flex-1">{topic.statement}</p>
          <Zap className={cn('h-3.5 w-3.5 flex-shrink-0 mt-0.5', isVoting ? 'text-purple' : 'text-for-400')} />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-surface-400/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400"
              style={{ width: `${forPct}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-for-400">{forPct}%</span>
          <span className="text-[11px] text-surface-500">{fmt(topic.total_votes ?? 0)} votes</span>
        </div>
      </motion.div>
    </Link>
  )
}

// ── Related law card ─────────────────────────────────────────────────────────

function RelatedLawCard({ law }: { law: ConnectionLaw }) {
  const forPct = Math.round(law.blue_pct ?? 50)

  return (
    <Link href={`/law/${law.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-gold/20 bg-gold/5 p-3.5 hover:border-gold/40 hover:bg-gold/10 transition-all"
      >
        <div className="flex items-start gap-3">
          <Gavel className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white leading-snug line-clamp-2 mb-1.5">{law.statement}</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-surface-400/40 overflow-hidden max-w-24">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold/60 to-gold"
                  style={{ width: `${forPct}%` }}
                />
              </div>
              <span className="text-[11px] font-mono text-gold">{forPct}%</span>
              <span className="text-[11px] text-surface-500">{fmt(law.total_votes ?? 0)} votes</span>
              <span className="text-[11px] text-surface-600 ml-auto">{relTime(law.established_at)}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

// ── Debate card ───────────────────────────────────────────────────────────────

const DEBATE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Upcoming', color: 'text-for-400' },
  live: { label: 'Live Now', color: 'text-emerald' },
  ended: { label: 'Ended', color: 'text-surface-500' },
  cancelled: { label: 'Cancelled', color: 'text-against-400' },
}

const DEBATE_TYPE_LABEL: Record<string, string> = {
  oxford: 'Oxford',
  town_hall: 'Town Hall',
  rapid_fire: 'Rapid Fire',
  panel: 'Panel',
  quick: 'Quick',
  grand: 'Grand',
  tribunal: 'Tribunal',
}

function DebateCard({ debate }: { debate: ConnectionDebate }) {
  const cfg = DEBATE_STATUS_CONFIG[debate.status] ?? { label: debate.status, color: 'text-surface-500' }
  const upcoming = debate.status === 'scheduled' && debate.scheduled_at

  return (
    <Link href={`/debate/${debate.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-purple/20 bg-purple/5 p-3.5 hover:border-purple/40 hover:bg-purple/10 transition-all"
      >
        <div className="flex items-start gap-3">
          <Mic className="h-4 w-4 text-purple flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white leading-snug line-clamp-2 mb-1">{debate.title}</p>
            <div className="flex items-center gap-3 text-[11px]">
              <span className={cn('font-mono', cfg.color)}>{cfg.label}</span>
              {DEBATE_TYPE_LABEL[debate.type] && (
                <span className="text-surface-500">{DEBATE_TYPE_LABEL[debate.type]}</span>
              )}
              {upcoming && debate.scheduled_at && (
                <span className="text-surface-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {futureTime(debate.scheduled_at)}
                </span>
              )}
              {(debate.viewer_count ?? 0) > 0 && (
                <span className="text-surface-500 ml-auto flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {fmt(debate.viewer_count)}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConnectionsClient({ lawId }: { lawId: string }) {
  const [data, setData] = useState<LawConnectionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/connections`)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as LawConnectionsResponse
      setData(json)
    } catch {
      setError('Could not load connections')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full max-w-md" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-3xl mx-auto px-4 py-12 text-center">
          <XCircle className="h-10 w-10 text-against-400 mx-auto mb-4" />
          <p className="text-surface-400 text-sm">{error ?? 'Unknown error'}</p>
          <button onClick={load} className="mt-4 text-sm text-for-400 hover:text-for-300 underline">
            Retry
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  const { law, coalitions, activeSisterDebates, relatedLaws, debates } = data
  const forPct = Math.round(law.blue_pct ?? 50)
  const hasAnyContent =
    coalitions.total > 0 ||
    activeSisterDebates.length > 0 ||
    relatedLaws.length > 0 ||
    debates.length > 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Back + header */}
        <div className="mb-6">
          <Link
            href={`/law/${law.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to law
          </Link>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
              <Network className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-snug">Legal Connections</h1>
              <p className="text-sm text-surface-500 mt-0.5 line-clamp-2">{law.statement}</p>
            </div>
          </div>

          {/* Law meta strip */}
          <div className="mt-4 flex items-center gap-4 text-xs text-surface-500">
            <span className="flex items-center gap-1 text-for-400 font-mono font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {forPct}% FOR
            </span>
            <span>{fmt(law.total_votes)} votes</span>
            {law.category && (
              <Badge variant="category" size="sm">{law.category}</Badge>
            )}
            <span className="ml-auto">{relTime(law.established_at)}</span>
          </div>
        </div>

        {!hasAnyContent && (
          <EmptyState
            icon={Network}
            title="No connections yet"
            description="This law has no recorded coalition stances, active sister debates, or related laws yet."
          />
        )}

        <div className="space-y-8">

          {/* Coalition positions */}
          {coalitions.total > 0 && (
            <section>
              <SectionHeader
                icon={Shield}
                label="Coalition Positions"
                count={coalitions.total}
                color="text-purple"
              />
              <div className="space-y-2.5">
                {[...coalitions.for, ...coalitions.against, ...coalitions.neutral].map((c) => (
                  <CoalitionCard key={c.coalition_id} coalition={c} />
                ))}
              </div>
              {coalitions.total > 0 && (
                <div className="mt-2 flex items-center gap-4 text-xs text-surface-500 pl-1">
                  {coalitions.for.length > 0 && (
                    <span className="flex items-center gap-1 text-for-400">
                      <ThumbsUp className="h-3 w-3" /> {coalitions.for.length} FOR
                    </span>
                  )}
                  {coalitions.against.length > 0 && (
                    <span className="flex items-center gap-1 text-against-400">
                      <ThumbsDown className="h-3 w-3" /> {coalitions.against.length} AGAINST
                    </span>
                  )}
                  {coalitions.neutral.length > 0 && (
                    <span className="flex items-center gap-1 text-surface-500">
                      <Scale className="h-3 w-3" /> {coalitions.neutral.length} NEUTRAL
                    </span>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Active sister debates */}
          {activeSisterDebates.length > 0 && (
            <section>
              <SectionHeader
                icon={Zap}
                label="Active Sister Debates"
                count={activeSisterDebates.length}
                color="text-for-400"
              />
              <div className="space-y-2">
                {activeSisterDebates.map((topic) => (
                  <SisterDebateCard key={topic.id} topic={topic} />
                ))}
              </div>
              {law.category && (
                <Link
                  href={`/categories/${law.category}`}
                  className="inline-flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 mt-3"
                >
                  All {law.category} debates <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </section>
          )}

          {/* Related laws */}
          {relatedLaws.length > 0 && (
            <section>
              <SectionHeader
                icon={GitMerge}
                label="Related Laws"
                count={relatedLaws.length}
                color="text-gold"
              />
              <div className="space-y-2">
                {relatedLaws.map((l) => (
                  <RelatedLawCard key={l.id} law={l} />
                ))}
              </div>
              <Link
                href="/laws"
                className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-gold/80 mt-3"
              >
                Browse all laws <ArrowRight className="h-3 w-3" />
              </Link>
            </section>
          )}

          {/* Debates */}
          {debates.length > 0 && (
            <section>
              <SectionHeader
                icon={Mic}
                label="Recorded Debates"
                count={debates.length}
                color="text-purple"
              />
              <div className="space-y-2">
                {debates.map((d) => (
                  <DebateCard key={d.id} debate={d} />
                ))}
              </div>
            </section>
          )}

          {/* Explore more */}
          <section className="mt-6">
            <div className="rounded-xl border border-surface-300/40 bg-surface-200/40 p-4">
              <p className="text-xs text-surface-500 font-semibold uppercase tracking-wide mb-3">Explore This Law</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: `/law/${law.id}/similar`, label: 'Similar Laws', icon: GitMerge },
                  { href: `/law/${law.id}/parallels`, label: 'Global Precedents', icon: ExternalLink },
                  { href: `/law/${law.id}/community`, label: 'Community Hub', icon: Users },
                  { href: `/law/${law.id}/frames`, label: 'Ideological Frames', icon: Scale },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-300/40 border border-surface-400/30 hover:border-surface-400/60 hover:bg-surface-300/60 transition-all text-xs text-surface-400 hover:text-white"
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
