'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Newspaper,
  TrendingUp,
  Landmark,
  Scale,
  Swords,
  Trophy,
  UserCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const navItems = [
  { href: '/', label: 'Feed', icon: Newspaper },
  { href: '/trending', label: 'Trending', icon: TrendingUp },
  { href: '/floor', label: 'The Floor', icon: Landmark },
  { href: '/law', label: 'Codex', icon: Scale },
  { href: '/debates', label: 'Debates', icon: Swords },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/profile', label: 'My Profile', icon: UserCircle },
] as const

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex flex-col w-56 bg-surface-100 border-r border-surface-300 min-h-screen sticky top-14">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <Link href="/" className="flex flex-col items-start">
          <span className="text-white font-bold text-xl tracking-wider">LOBBY</span>
          <div className="flex h-0.5 w-12 mt-1">
            <div className="flex-1 bg-for-500 rounded-l-full" />
            <div className="flex-1 bg-against-500 rounded-r-full" />
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)
            const Icon = item.icon

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'text-for-500 bg-for-500/10 border-l-2 border-for-500'
                      : 'text-surface-500 hover:text-surface-700 hover:bg-surface-200'
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
