'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BarChart2, BookOpen, HelpCircle, LogOut, Search, Plus, Settings, User } from 'lucide-react'
import { NotificationBell } from '@/components/profile/NotificationBell'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'

export function TopBar() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  async function handleSignOut() {
    setMenuOpen(false)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q.length > 0) {
      router.push(`/search?q=${encodeURIComponent(q)}`)
    } else {
      router.push('/search')
    }
    inputRef.current?.blur()
  }

  return (
    <header className="sticky top-0 z-50 h-14 bg-surface-100 border-b border-surface-300 flex items-center px-4 gap-4">
      {/* Left: Logo */}
      <Link href="/" className="flex-shrink-0 flex flex-col items-center">
        <span className="text-white font-bold text-lg tracking-wider">LOBBY</span>
        <div className="flex h-0.5 w-full mt-0.5">
          <div className="flex-1 bg-for-500 rounded-l-full" />
          <div className="flex-1 bg-against-500 rounded-r-full" />
        </div>
      </Link>

      {/* Center: Search */}
      <div className="flex-1 max-w-md mx-auto hidden sm:block">
        <form onSubmit={handleSubmit} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (query.trim().length === 0) router.prefetch('/search')
            }}
            placeholder="Search topics, laws, people..."
            className={cn(
              'w-full h-9 pl-9 pr-4 rounded-lg',
              'bg-surface-200 border border-surface-300',
              'text-sm text-white placeholder:text-surface-500',
              'focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/20',
              'transition-colors cursor-text'
            )}
          />
        </form>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Mobile: search icon */}
        <Link
          href="/search"
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-lg sm:hidden',
            'bg-surface-200 text-surface-500',
            'hover:bg-surface-300 hover:text-white transition-colors'
          )}
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </Link>

        <Link
          href="/topic/create"
          className={cn(
            'flex items-center gap-1.5 h-8 px-3 rounded-lg',
            'bg-for-600 text-white text-sm font-medium',
            'hover:bg-for-700 transition-colors'
          )}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create Topic</span>
        </Link>

        <NotificationBell />

        {/* User dropdown */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded-full',
              'bg-surface-200 text-surface-500',
              'hover:bg-surface-300 hover:text-surface-700 transition-colors',
              menuOpen && 'bg-surface-300 text-white'
            )}
            aria-label="User menu"
            aria-expanded={menuOpen}
          >
            <User className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 w-48 rounded-xl bg-surface-100 border border-surface-300 shadow-xl shadow-black/40 overflow-hidden z-[60]">
              <Link
                href="/profile/me"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <User className="h-3.5 w-3.5 flex-shrink-0" />
                My Profile
              </Link>
              <Link
                href="/analytics"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5 flex-shrink-0" />
                Analytics
              </Link>
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <Settings className="h-3.5 w-3.5 flex-shrink-0" />
                Settings
              </Link>
              <div className="border-t border-surface-300" />
              <Link
                href="/about"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
                About
              </Link>
              <Link
                href="/help"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-200 hover:text-white transition-colors"
              >
                <HelpCircle className="h-3.5 w-3.5 flex-shrink-0" />
                Help & FAQ
              </Link>
              <div className="border-t border-surface-300" />
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-against-400 hover:bg-against-950/40 hover:text-against-300 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
