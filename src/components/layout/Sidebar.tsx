'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bookmark,
  Newspaper,
  TrendingUp,
  Landmark,
  Scale,
  Mic,
  Trophy,
  UserCircle,
  Megaphone,
  Users,
  Shield,
  Coins,
  Building2,
  BookOpen,
  HelpCircle,
  GitFork,
  Gavel,
  Vote,
  Zap,
  Target,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/supabase/types'
import type { QuickStats } from '@/app/api/stats/quick/route'

type NavItem = {
  href: string
  label: string
  icon: typeof Newspaper
  moderatorOnly?: boolean
}

const navItems: NavItem[] = [
  { href: '/', label: 'Feed', icon: Newspaper },
  { href: '/predictions', label: 'Predictions', icon: Target },
  { href: '/trending', label: 'Trending', icon: TrendingUp },
  { href: '/split', label: 'The Split', icon: GitFork },
  { href: '/floor', label: 'The Floor', icon: Landmark },
  { href: '/law', label: 'Codex', icon: Scale },
  { href: '/debate', label: 'Debates', icon: Mic },
  { href: '/lobby', label: 'Lobbies', icon: Megaphone },
  { href: '/coalitions', label: 'Coalitions', icon: Users },
  { href: '/city', label: 'The City', icon: Building2 },
  { href: '/clout', label: 'Clout', icon: Coins },
  {
    href: '/moderation',
    label: 'Moderation',
    icon: Shield,
    moderatorOnly: true,
  },
  { href: '/saved', label: 'Saved', icon: Bookmark },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/profile/me', label: 'My Profile', icon: UserCircle },
]

// ─── Platform stats mini-widget ───────────────────────────────────────────────

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function SidebarStats() {
  const [stats, setStats] = useState<QuickStats | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const res = await fetch('/api/stats/quick')
        if (!res.ok || !mounted) return
        const data = (await res.json()) as QuickStats
        if (mounted) setStats(data)
      } catch {
        // best-effort — widget is non-critical
      }
    }

    load()

    // Refresh every 5 minutes
    const interval = setInterval(load, 5 * 60 * 1000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  if (!stats) return null

  const items: { icon: typeof Zap; label: string; value: string; color: string }[] = [
    {
      icon: Zap,
      label: 'Active',
      value: formatCompact(stats.activeTopics),
      color: 'text-for-400',
    },
    {
      icon: Vote,
      label: 'Votes',
      value: formatCompact(stats.totalVotes),
      color: 'text-purple',
    },
    {
      icon: Gavel,
      label: 'Laws',
      value: formatCompact(stats.lawsEstablished),
      color: 'text-gold',
    },
  ]

  return (
    <div className="mx-3 mb-3 rounded-xl border border-surface-300/60 bg-surface-200/50 p-3">
      <p className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2.5">
        Platform
      </p>
      <div className="space-y-1.5">
        {items.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Icon className={cn('h-3 w-3', color)} aria-hidden />
              <span className="text-[11px] text-surface-500 font-mono">{label}</span>
            </div>
            <span className={cn('text-[11px] font-mono font-semibold tabular-nums', color)}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()
  const [role, setRole] = useState<UserRole | null>(null)

  // Lazy-load the viewer's role so the Moderation entry conditionally renders.
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      setRole((profile?.role as UserRole | undefined) ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const canModerate = role === 'troll_catcher' || role === 'elder'
  const visibleItems = navItems.filter(
    (item) => !item.moderatorOnly || canModerate
  )

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
          {visibleItems.map((item) => {
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

      {/* Live platform stats */}
      <SidebarStats />

      {/* Footer links */}
      <div className="px-3 py-3 border-t border-surface-300 space-y-0.5">
        {[
          { href: '/about', label: 'About', icon: BookOpen },
          { href: '/help', label: 'Help & FAQ', icon: HelpCircle },
          { href: '/guidelines', label: 'Guidelines', icon: Shield },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors',
              pathname.startsWith(href)
                ? 'text-surface-700 bg-surface-200'
                : 'text-surface-400 hover:text-surface-600 hover:bg-surface-200'
            )}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </aside>
  )
}
