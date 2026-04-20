'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Activity, BarChart2, BookOpen, Coins, Compass, FileText, Flame, Gavel, HelpCircle, LayoutGrid, LogOut, Network, Scale, Search, Plus, Settings, Sparkles, Swords, Target, TrendingUp, User, Zap, ArrowUpRight, Globe } from 'lucide-react'
import { NotificationBell } from '@/components/profile/NotificationBell'
import { Avatar } from '@/components/ui/Avatar'
import { openCommandPalette } from '@/lib/hooks/useCommandPalette'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'

// ─── Mini profile type ────────────────────────────────────────────────────────

interface MiniProfile {
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  vote_streak: number
}

// ─── Role label helper ────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  person: { label: 'Citizen', color: 'text-surface-500' },
  debator: { label: 'Debator', color: 'text-for-400' },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald' },
  elder: { label: 'Elder', color: 'text-gold' },
}

export function TopBar() {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [profile, setProfile] = useState<MiniProfile | null>(null)

  // Fetch current user profile for personalization
  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url, role, clout, vote_streak')
        .eq('id', user.id)
        .maybeSingle()
      if (data) setProfile(data as MiniProfile)
    }
    loadProfile()
  }, [])

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  async function handleSignOut() {
    setMenuOpen(false)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const roleInfo = profile ? (ROLE_LABELS[profile.role] ?? ROLE_LABELS.person) : null

  return (
    <header className="sticky top-0 z-50 h-14 bg-surface-100 border-b border-surface-300 flex items-center px-4 gap-4">
      {/* Left: Logo */}
      <Link href="/" aria-label="Lobby Market — home" className="flex-shrink-0 flex flex-col items-center">
        <span className="text-white font-bold text-lg tracking-wider">LOBBY</span>
        <div className="flex h-0.5 w-full mt-0.5">
          <div className="flex-1 bg-for-500 rounded-l-full" />
          <div className="flex-1 bg-against-500 rounded-r-full" />
        </div>
      </Link>

      {/* Center: Command palette trigger (desktop) */}
      <div className="flex-1 max-w-md mx-auto hidden sm:block">
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="Open command palette (⌘K)"
          className={cn(
            'w-full h-9 pl-3 pr-3 rounded-lg flex items-center gap-2',
            'bg-surface-200 border border-surface-300',
            'text-sm text-surface-500',
            'hover:border-surface-400 hover:text-surface-700 transition-colors',
            'cursor-pointer'
          )}
        >
          <Search className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span className="flex-1 text-left">Search topics, laws, people…</span>
          <kbd className="flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface-300 border border-surface-400 text-[10px] font-mono text-surface-500">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Mobile: search / command palette icon */}
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="Open command palette"
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-lg sm:hidden',
            'bg-surface-200 text-surface-500',
            'hover:bg-surface-300 hover:text-white transition-colors'
          )}
        >
          <Search className="h-4 w-4" />
        </button>

        <Link
          href="/topic/create"
          aria-label="Create a new topic"
          className={cn(
            'flex items-center gap-1.5 h-8 px-3 rounded-lg',
            'bg-for-600 text-white text-sm font-medium',
            'hover:bg-for-700 transition-colors'
          )}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Create Topic</span>
        </Link>

        {/* Streak indicator — only shown when user has an active streak */}
        {profile && profile.vote_streak > 0 && (
          <Link
            href="/challenge"
            aria-label={`Vote streak: ${profile.vote_streak} days — keep it alive`}
            className={cn(
              'flex items-center gap-1 h-8 px-2.5 rounded-lg',
              'border transition-all',
              profile.vote_streak >= 30
                ? 'bg-gold/10 border-gold/40 text-gold hover:bg-gold/20'
                : profile.vote_streak >= 7
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white'
            )}
          >
            <Zap
              className={cn(
                'h-3.5 w-3.5 flex-shrink-0',
                profile.vote_streak >= 7 && 'animate-pulse'
              )}
              aria-hidden="true"
            />
            <span className="text-xs font-mono font-semibold tabular-nums">
              {profile.vote_streak}
            </span>
          </Link>
        )}

        <NotificationBell />

        {/* User dropdown */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(
              'flex items-center justify-center rounded-full overflow-hidden',
              'ring-2 ring-transparent transition-all',
              menuOpen ? 'ring-for-500/50' : 'hover:ring-surface-400/50',
              profile?.avatar_url ? 'h-8 w-8' : 'h-8 w-8 bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-surface-700'
            )}
            aria-label={profile ? `User menu — ${profile.display_name ?? profile.username}` : 'User menu'}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            {profile ? (
              <Avatar
                src={profile.avatar_url}
                fallback={profile.display_name ?? profile.username}
                size="sm"
                className="h-8 w-8"
              />
            ) : (
              <User className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label="User menu"
              className="absolute right-0 top-10 w-56 rounded-xl bg-surface-100 border border-surface-300 shadow-xl shadow-black/40 overflow-hidden z-[60]"
            >
              {/* Profile header — shows who is logged in */}
              {profile && (
                <Link
                  href="/profile/me"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 bg-surface-200/60 hover:bg-surface-200 border-b border-surface-300 transition-colors"
                >
                  <Avatar
                    src={profile.avatar_url}
                    fallback={profile.display_name ?? profile.username}
                    size="md"
                    className="flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate leading-tight">
                      {profile.display_name ?? profile.username}
                    </p>
                    <p className="text-[11px] text-surface-500 font-mono truncate leading-tight">
                      @{profile.username}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {roleInfo && (
                        <span className={cn('text-[10px] font-mono font-semibold', roleInfo.color)}>
                          {roleInfo.label}
                        </span>
                      )}
                      <span className="flex items-center gap-0.5 text-[10px] font-mono text-gold">
                        <Coins className="h-2.5 w-2.5" aria-hidden="true" />
                        {profile.clout.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </Link>
              )}
              <Link
                href="/profile/me"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <User className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                My Profile
              </Link>
              <Link
                href="/positions"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <Scale className="h-3.5 w-3.5 flex-shrink-0 text-for-400" aria-hidden="true" />
                My Positions
              </Link>
              <Link
                href="/challenge"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <Flame className="h-3.5 w-3.5 flex-shrink-0 text-for-400" aria-hidden="true" />
                Daily Quorum
              </Link>
              <Link
                href="/rapid"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <Zap className="h-3.5 w-3.5 flex-shrink-0 text-gold" aria-hidden="true" />
                Rapid Fire
              </Link>
              <Link
                href="/predictions"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <Target className="h-3.5 w-3.5 flex-shrink-0 text-purple" aria-hidden="true" />
                Predictions
              </Link>
              <Link
                href="/verdicts"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <Gavel className="h-3.5 w-3.5 flex-shrink-0 text-emerald" aria-hidden="true" />
                The Verdicts
              </Link>
              <Link
                href="/analytics"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                Analytics
              </Link>
              <Link
                href="/compass"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <Compass className="h-3.5 w-3.5 flex-shrink-0 text-purple" aria-hidden="true" />
                Civic Compass
              </Link>
              <Link
                href="/recommended"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-for-400" aria-hidden="true" />
                For You
              </Link>
              <Link
                href="/live"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <Activity className="h-3.5 w-3.5 flex-shrink-0 text-against-400" aria-hidden="true" />
                Live Arguments
              </Link>
              <Link
                href="/pulse"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <Zap className="h-3.5 w-3.5 flex-shrink-0 text-gold" aria-hidden="true" />
                Community Pulse
              </Link>
              <Link
                href="/momentum"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 text-against-400" aria-hidden="true" />
                Momentum
              </Link>
              <Link
                href="/categories"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <LayoutGrid className="h-3.5 w-3.5 flex-shrink-0 text-purple" aria-hidden="true" />
                Browse Categories
              </Link>
              <Link
                href="/activity"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <Activity className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                Activity
              </Link>
              <Link
                href="/network"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <Network className="h-3.5 w-3.5 flex-shrink-0 text-for-400" aria-hidden="true" />
                Your Network
              </Link>
              <Link
                href="/arena"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <Swords className="h-3.5 w-3.5 flex-shrink-0 text-gold" aria-hidden="true" />
                Coalition Arena
              </Link>
              <Link
                href="/discover"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <Globe className="h-3.5 w-3.5 flex-shrink-0 text-for-300" aria-hidden="true" />
                Discover
              </Link>
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <Settings className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                Settings
              </Link>
              <Link
                href="/stats"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                State of the Lobby
              </Link>
              <Link
                href="/heatmap"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                Lobby Heatmap
              </Link>
              <div className="border-t border-surface-300" role="separator" />
              <Link
                href="/about"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                About
              </Link>
              <Link
                href="/help"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <HelpCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                Help & FAQ
              </Link>
              <Link
                href="/developers"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <FileText className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                Developer API
              </Link>
              <Link
                href="/widget"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <Network className="h-3.5 w-3.5 flex-shrink-0 text-for-400" aria-hidden="true" />
                Widget Builder
              </Link>
              <div className="border-t border-surface-300" role="separator" />
              <button
                role="menuitem"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-against-400 hover:bg-against-950/40 hover:text-against-300 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
