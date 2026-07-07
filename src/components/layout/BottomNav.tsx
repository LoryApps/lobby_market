'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Flame, Building2, Plus, Mic, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { haptics } from '@/lib/hooks/useHaptics'
import { QuickCreateSheet } from './QuickCreateSheet'

const LEFT_TABS = [
  { href: '/', label: 'Home', icon: Flame },
  { href: '/city', label: 'City', icon: Building2 },
] as const

const RIGHT_TABS = [
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
        'animate-pulse',
      )}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}

// ─── Tab item ─────────────────────────────────────────────────────────────────

function TabItem({
  href,
  label,
  icon: Icon,
  isActive,
  badge,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  isActive: boolean
  badge?: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      aria-label={label}
      className={cn(
        'relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full',
        'text-xs transition-colors',
        isActive ? 'text-for-500' : 'text-surface-500 hover:text-surface-700',
      )}
    >
      <span className="relative inline-flex">
        <Icon className={cn('h-5 w-5', isActive && 'fill-for-500/20')} aria-hidden="true" />
        {badge}
      </span>
      <span>{label}</span>
    </Link>
  )
}

// ─── FAB ─────────────────────────────────────────────────────────────────────

function CreateFAB({ onOpen, isOpen }: { onOpen: () => void; isOpen: boolean }) {
  return (
    <div className="relative flex flex-col items-center justify-center flex-1 h-full">
      <motion.button
        onClick={() => {
          haptics.medium()
          onOpen()
        }}
        aria-label="Quick create"
        aria-expanded={isOpen}
        whileTap={{ scale: 0.88 }}
        className={cn(
          'flex items-center justify-center',
          'h-12 w-12 rounded-2xl',
          'shadow-lg shadow-for-600/30',
          'transition-all duration-200',
          isOpen
            ? 'bg-surface-300'
            : 'bg-gradient-to-br from-for-600 to-for-500',
        )}
      >
        <Plus
          className={cn(
            'h-6 w-6 text-white transition-transform duration-200',
            isOpen && 'rotate-45',
          )}
          aria-hidden="true"
        />
      </motion.button>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BottomNav() {
  const pathname = usePathname()
  const [liveDebates, setLiveDebates] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)

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
    const interval = setInterval(fetchLiveCount, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <>
      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-surface-100 border-t border-surface-300 h-16 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center h-full px-2">
          {/* Left tabs */}
          {LEFT_TABS.map((tab) => {
            const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
            return (
              <TabItem
                key={tab.href}
                href={tab.href}
                label={tab.label}
                icon={tab.icon}
                isActive={isActive}
              />
            )
          })}

          {/* Centre FAB */}
          <CreateFAB onOpen={() => setSheetOpen(true)} isOpen={sheetOpen} />

          {/* Right tabs */}
          {RIGHT_TABS.map((tab) => {
            const isActive = pathname.startsWith(tab.href)
            const showBadge = tab.href === '/debate' && liveDebates > 0
            return (
              <TabItem
                key={tab.href}
                href={tab.href}
                label={tab.label}
                icon={tab.icon}
                isActive={isActive}
                badge={showBadge ? <LiveBadge count={liveDebates} /> : undefined}
              />
            )
          })}
        </div>
      </nav>

      {/* Quick create action sheet */}
      <QuickCreateSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  )
}
