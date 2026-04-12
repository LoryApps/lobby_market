'use client'

import Link from 'next/link'
import { Search, Plus, User } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export function TopBar() {
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
          <input
            type="text"
            placeholder="Search topics, laws..."
            className={cn(
              'w-full h-9 pl-9 pr-4 rounded-lg',
              'bg-surface-200 border border-surface-300',
              'text-sm text-surface-700 placeholder:text-surface-500',
              'focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/20',
              'transition-colors'
            )}
            readOnly
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3 flex-shrink-0">
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

        <Link
          href="/login"
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-full',
            'bg-surface-200 text-surface-500',
            'hover:bg-surface-300 hover:text-surface-700 transition-colors'
          )}
        >
          <User className="h-4 w-4" />
        </Link>
      </div>
    </header>
  )
}
