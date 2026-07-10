'use client'

/**
 * RelaySpotlightCard
 *
 * An interstitial feed card that surfaces an open relay chain needing
 * more leg contributions. Shown after every 12th topic card in the
 * home feed. Clicking "Add Your Leg" takes the user directly to the
 * relay detail page where they can post a leg.
 *
 * Data is fetched once per session and cached in module state to avoid
 * hammering the API on every scroll.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ChevronRight,
  Link2,
  Loader2,
  Quote,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { SpotlightRelay } from '@/app/api/relays/spotlight/route'

// ─── Module-level cache ───────────────────────────────────────────────────────

let _cached: SpotlightRelay | null | undefined = undefined // undefined = not yet fetched
let _fetchedAt = 0
const CACHE_TTL_MS = 3 * 60 * 1000 // 3 minutes

async function fetchSpotlight(): Promise<SpotlightRelay | null> {
  const now = Date.now()
  if (_cached !== undefined && now - _fetchedAt < CACHE_TTL_MS) return _cached
  try {
    const res = await fetch('/api/relays/spotlight', { cache: 'no-store' })
    if (!res.ok) { _cached = null; return null }
    const json = (await res.json()) as { relay: SpotlightRelay | null }
    _cached = json.relay
    _fetchedAt = now
    return _cached
  } catch {
    return null
  }
}

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

function catColor(cat: string | null) {
  return CAT_COLOR[cat ?? ''] ?? 'text-surface-400'
}

// ─── Side config ──────────────────────────────────────────────────────────────

const SIDE_CONFIG = {
  for: {
    label: 'FOR',
    icon: ThumbsUp,
    text: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    dot: 'bg-for-400',
    pill: 'bg-for-600/20 text-for-300 border-for-500/40',
  },
  against: {
    label: 'AGAINST',
    icon: ThumbsDown,
    text: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    dot: 'bg-against-400',
    pill: 'bg-against-600/20 text-against-300 border-against-500/40',
  },
}

// ─── Leg progress dots ────────────────────────────────────────────────────────

function LegProgress({ filled, total, side }: { filled: number; total: number; side: 'for' | 'against' }) {
  const { dot } = SIDE_CONFIG[side]
  return (
    <div className="flex items-center gap-1" aria-label={`${filled} of ${total} legs contributed`}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full transition-colors',
            i < filled ? dot : 'bg-surface-400/50'
          )}
        />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RelaySpotlightCard() {
  const [relay, setRelay] = useState<SpotlightRelay | null | undefined>(undefined)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    fetchSpotlight().then((r) => {
      if (mountedRef.current) setRelay(r)
    })
    return () => { mountedRef.current = false }
  }, [])

  // Don't show anything while loading or if no relay available
  if (relay === undefined) {
    return (
      <div className="mx-4 my-2 rounded-2xl bg-surface-100 border border-surface-300 px-4 py-3 flex items-center justify-center h-14">
        <Loader2 className="h-4 w-4 text-surface-500 animate-spin" />
      </div>
    )
  }

  if (relay === null) return null

  const cfg = SIDE_CONFIG[relay.side]
  const SideIcon = cfg.icon
  const spotsLeft = relay.max_legs - relay.leg_count
  const legLabel = spotsLeft === 1 ? '1 spot left' : `${spotsLeft} spots left`

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-4 my-2"
    >
      <Link href={`/relays/${relay.id}`} className="block group">
        <div
          className={cn(
            'rounded-2xl border bg-surface-100 p-4 transition-all duration-200',
            'group-hover:border-surface-400 group-hover:bg-surface-200/60',
            cfg.border
          )}
        >
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Relay badge */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-300/60 border border-surface-400/40 text-[10px] font-mono font-semibold text-surface-500">
                <Link2 className="h-2.5 w-2.5" />
                RELAY
              </span>
              {/* Side pill */}
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold',
                  cfg.pill
                )}
              >
                <SideIcon className="h-2.5 w-2.5" />
                {cfg.label}
              </span>
              {/* Category */}
              {relay.topic_category && (
                <span className={cn('text-[10px] font-mono font-semibold', catColor(relay.topic_category))}>
                  {relay.topic_category}
                </span>
              )}
            </div>

            {/* Spots left indicator */}
            <span className="flex-shrink-0 text-[10px] font-mono text-gold border border-gold/30 bg-gold/10 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Zap className="h-2.5 w-2.5" />
              {legLabel}
            </span>
          </div>

          {/* Topic statement */}
          {relay.topic_statement && (
            <p className="text-xs font-semibold text-surface-600 mb-2 line-clamp-2 leading-relaxed">
              {relay.topic_statement}
            </p>
          )}

          {/* Latest leg preview */}
          {relay.latest_leg ? (
            <div className={cn('rounded-xl border p-3 mb-3', cfg.bg, cfg.border)}>
              <div className="flex items-start gap-2">
                <Quote className={cn('h-3 w-3 mt-0.5 flex-shrink-0', cfg.text)} />
                <p className="text-xs text-surface-700 line-clamp-2 leading-relaxed">
                  {relay.latest_leg.content.slice(0, 140)}
                  {relay.latest_leg.content.length > 140 ? '…' : ''}
                </p>
              </div>
              {/* Leg author */}
              <div className="flex items-center gap-1.5 mt-2">
                <Avatar
                  src={relay.latest_leg.author_avatar_url}
                  fallback={relay.latest_leg.author_display_name ?? relay.latest_leg.author_username}
                  size="xs"
                />
                <span className="text-[10px] text-surface-500">
                  Leg {relay.latest_leg.leg_number} ·{' '}
                  <span className="text-surface-600">
                    {relay.latest_leg.author_display_name ?? `@${relay.latest_leg.author_username}`}
                  </span>
                </span>
              </div>
            </div>
          ) : (
            /* No legs yet — just started */
            <div className={cn('rounded-xl border p-3 mb-3 flex items-center gap-2', cfg.bg, cfg.border)}>
              <Users className={cn('h-3.5 w-3.5 flex-shrink-0', cfg.text)} />
              <p className="text-xs text-surface-600">
                Started by{' '}
                <span className="text-white font-semibold">
                  {relay.starter_display_name ?? `@${relay.starter_username}`}
                </span>
                {' '}— be the first to add a leg!
              </p>
            </div>
          )}

          {/* Footer: progress + CTA */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <LegProgress filled={relay.leg_count} total={relay.max_legs} side={relay.side} />
              <span className="text-[10px] font-mono text-surface-500">
                {relay.leg_count}/{relay.max_legs} legs
              </span>
            </div>

            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs font-mono font-semibold transition-colors',
                cfg.text,
                'group-hover:underline'
              )}
            >
              Add Your Leg
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Link>

      {/* Subtle "Browse all relays" link */}
      <div className="flex justify-end mt-1 pr-1">
        <Link
          href="/relays"
          className="text-[10px] font-mono text-surface-500 hover:text-surface-700 transition-colors flex items-center gap-0.5"
          tabIndex={-1}
        >
          Browse relays
          <ArrowRight className="h-2.5 w-2.5" />
        </Link>
      </div>
    </motion.div>
  )
}
