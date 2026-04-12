import Link from 'next/link'
import { Home, Search } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 pb-24 md:pb-12">
        <div className="max-w-sm w-full text-center space-y-8">
          {/* Visual */}
          <div className="relative mx-auto w-32 h-32">
            {/* Ambient glow */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-for-600/20 to-against-600/20 blur-xl" />
            <div className="relative flex items-center justify-center w-32 h-32 rounded-3xl bg-surface-100 border border-surface-300 shadow-xl">
              {/* Split screen icon — FOR/AGAINST */}
              <div className="flex items-center gap-0 overflow-hidden rounded-xl h-14 w-24">
                <div className="flex-1 h-full bg-for-500/20 flex items-center justify-center">
                  <span className="font-mono text-xs font-bold text-for-400">4</span>
                </div>
                <div className="w-px h-full bg-surface-300" />
                <div className="flex-1 h-full bg-against-500/20 flex items-center justify-center">
                  <span className="font-mono text-xs font-bold text-against-400">04</span>
                </div>
              </div>
            </div>
          </div>

          {/* Copy */}
          <div className="space-y-3">
            <h1 className="font-mono text-3xl font-bold text-white tracking-tight">
              404
            </h1>
            <p className="text-base font-semibold text-surface-700">
              Page not found
            </p>
            <p className="text-sm text-surface-500 leading-relaxed max-w-xs mx-auto">
              This page doesn&apos;t exist or was removed. The Lobby awaits you elsewhere.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50"
            >
              <Home className="h-4 w-4" />
              Go to Feed
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 text-white text-sm font-mono font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50"
            >
              <Search className="h-4 w-4" />
              Search
            </Link>
          </div>

          {/* Quick links */}
          <nav aria-label="Quick navigation">
            <p className="text-xs font-mono text-surface-600 uppercase tracking-widest mb-3">
              Popular destinations
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                { href: '/topic/categories', label: 'Browse Topics' },
                { href: '/law', label: 'Law Codex' },
                { href: '/leaderboard', label: 'Leaderboard' },
                { href: '/debate', label: 'Debates' },
                { href: '/floor', label: 'The Floor' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="px-3 py-1 rounded-lg bg-surface-200 border border-surface-300 text-xs text-surface-500 hover:text-white hover:border-surface-400 transition-colors font-mono"
                >
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
