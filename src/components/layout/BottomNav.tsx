'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Flame, Zap, Landmark, PlusCircle, User } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const tabs = [
  { href: '/', label: 'Home', icon: Flame },
  { href: '/spark', label: 'Spark', icon: Zap },
  { href: '/floor', label: 'Floor', icon: Landmark },
  { href: '/topic/create', label: 'Create', icon: PlusCircle },
  { href: '/profile', label: 'Profile', icon: User },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-surface-100 border-t border-surface-300 h-16 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-full px-2">
        {tabs.map((tab) => {
          const isActive =
            tab.href === '/'
              ? pathname === '/'
              : pathname.startsWith(tab.href)
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full',
                'text-xs transition-colors',
                isActive
                  ? 'text-for-500'
                  : 'text-surface-500 hover:text-surface-700'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'fill-for-500/20')} />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
