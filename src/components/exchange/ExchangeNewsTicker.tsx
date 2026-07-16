'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Gavel, Scale, Zap, X, Activity, Clock, AlertTriangle, Radio } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { NewsEvent } from '@/app/api/exchange/news/route'

// ─── Icon map ─────────────────────────────────────────────────────────────────

const EVENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  became_law:      Gavel,
  entered_voting:  Scale,
  activated:       Zap,
  failed:          X,
  price_milestone: Activity,
  volume_surge:    Zap,
  closing_soon:    Clock,
  new_consensus_high: Activity,
  deadlocked:      AlertTriangle,
}

const EVENT_COLOR: Record<string, string> = {
  became_law:      'text-gold',
  entered_voting:  'text-purple',
  activated:       'text-for-400',
  failed:          'text-against-400',
  price_milestone: 'text-emerald',
  volume_surge:    'text-for-300',
  closing_soon:    'text-against-300',
  new_consensus_high: 'text-emerald',
  deadlocked:      'text-gold',
}

// ─── Ticker item ──────────────────────────────────────────────────────────────

function TickerItem({ event }: { event: NewsEvent }) {
  const Icon = EVENT_ICON[event.type] ?? Zap
  const color = EVENT_COLOR[event.type] ?? 'text-surface-400'

  return (
    <Link
      href={`/exchange/${event.topic_id}`}
      className="flex-shrink-0 inline-flex items-center gap-2 px-4 border-r border-surface-300/60 hover:bg-surface-300/30 transition-colors h-full"
    >
      {event.is_breaking && (
        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-against-400 animate-pulse" />
      )}
      <Icon className={cn('flex-shrink-0 h-3 w-3', color)} aria-hidden="true" />
      <span className={cn('text-[11px] font-mono font-semibold', color)}>
        {event.headline}
      </span>
      <span className="text-[11px] font-mono text-surface-500 max-w-[200px] truncate">
        {event.statement.length > 50
          ? event.statement.slice(0, 50) + '…'
          : event.statement}
      </span>
      <span className="text-[11px] font-mono font-bold text-surface-600 flex-shrink-0">
        {event.price}¢
      </span>
    </Link>
  )
}

// ─── Main ticker ──────────────────────────────────────────────────────────────

export function ExchangeNewsTicker() {
  const [events, setEvents] = useState<NewsEvent[]>([])
  const [loaded, setLoaded] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/exchange/news?window=6', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.events?.length) setEvents(d.events.slice(0, 12))
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  // Refresh every 90 seconds
  useEffect(() => {
    if (!loaded) return
    const id = setInterval(() => {
      fetch('/api/exchange/news?window=6', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.events?.length) setEvents(d.events.slice(0, 12)) })
        .catch(() => {})
    }, 90_000)
    return () => clearInterval(id)
  }, [loaded])

  if (!loaded || events.length === 0) return null

  // Duplicate events for seamless infinite scroll
  const items = [...events, ...events]

  return (
    <div className="relative flex items-center h-8 bg-surface-100 border-b border-surface-300/60 overflow-hidden">
      {/* Live indicator */}
      <div className="flex-shrink-0 flex items-center gap-1.5 px-3 border-r border-surface-300/60 h-full bg-surface-100 z-10">
        <Radio className="h-3 w-3 text-against-400" aria-hidden="true" />
        <span className="text-[10px] font-mono font-bold text-against-300 uppercase tracking-wider">
          Live
        </span>
      </div>

      {/* Scrolling track */}
      <div className="flex-1 overflow-hidden">
        <div
          ref={trackRef}
          className="flex items-center h-8 animate-exchange-ticker"
          style={{ width: 'max-content' }}
          aria-label="Exchange market news ticker"
          aria-live="off"
        >
          {items.map((event, i) => (
            <TickerItem key={`${event.id}-${i}`} event={event} />
          ))}
        </div>
      </div>

      {/* Fade-out edges */}
      <div
        className="absolute left-[72px] top-0 bottom-0 w-8 pointer-events-none z-10"
        style={{ background: 'linear-gradient(to right, rgb(var(--color-surface-100, 24 24 27)), transparent)' }}
        aria-hidden="true"
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none z-10"
        style={{ background: 'linear-gradient(to left, rgb(var(--color-surface-100, 24 24 27)), transparent)' }}
        aria-hidden="true"
      />

      {/* All news link */}
      <Link
        href="/exchange/news"
        className="flex-shrink-0 px-3 border-l border-surface-300/60 h-full flex items-center text-[10px] font-mono text-surface-500 hover:text-white transition-colors bg-surface-100 z-10"
        aria-label="View all market news"
      >
        All →
      </Link>
    </div>
  )
}
