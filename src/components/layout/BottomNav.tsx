'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Flame, Building2, Landmark, Mic, User } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const BASE_TABS = [
  { href: '/', label: 'Home', icon: Flame },
  { href: '/city', label: 'City', icon: Building2 },
  { href: '/floor', label: 'Floor', icon: Landmark },
  { href: '/debate', label: 'Debates', icon: Mic },
  { href: '/profile/me', label: 'Profile', icon: User },
] as const

// ─── Live debate count badge ──────────────────────────────────────────────────

function LiveBadge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span
      aria-label={`${count} live debate${count === 1 ? '' : 's'}`}
      className={cn(
        'absolute -top-0.5 -right-0.5 flex items-center justify-center',
        'min-w-[14px] h-[14px] px-0.5 rounded-full',
        'bg-against-500 text-white text-[9px] font-mono font-bold leading-none',
        'ring-1 ring-surface-100',
        // Subtle pulse to indicate "live"
        'animate-pulse'
      )}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BottomNav() {
  const pathname = usePathname()
  const [liveDebates, setLiveDebates] = useState(0)

  // Fetch live debate count — lightweight, low priority
  useEffect(() => {
    let cancelled = false

    async function fetchLiveCount() {
      try {
        const res = await fetch('/api/debates/live-count', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const { count } = (await res.json()) as { count: number }
        if (!cancelled) setLiveDebates(count ?? 0)
      } catch {
        // Non-critical — don't surface errors
      }
    }

    fetchLiveCount()
    // Refresh every 60 s so the badge stays current
    const interval = setInterval(fetchLiveCount, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-surface-100 border-t border-surface-300 h-16 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around h-full px-2">
        {BASE_TABS.map((tab) => {
          const isActive =
            tab.href === '/'
              ? pathname === '/'
              : pathname.startsWith(tab.href)
          const Icon = tab.icon
          const showBadge = tab.href === '/debate' && liveDebates > 0

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              aria-label={
                showBadge
                  ? `${tab.label} — ${liveDebates} live`
                  : tab.label
              }
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full',
                'text-xs transition-colors',
                isActive
                  ? 'text-for-500'
                  : 'text-surface-500 hover:text-surface-700'
              )}
            >
              <span className="relative inline-flex">
                <Icon className={cn('h-5 w-5', isActive && 'fill-for-500/20')} aria-hidden="true" />
                {showBadge && <LiveBadge count={liveDebates} />}
              </span>
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
