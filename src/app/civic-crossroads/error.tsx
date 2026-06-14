'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex items-center justify-center px-4 pb-24">
        <div className="text-center space-y-4 max-w-sm">
          <AlertTriangle className="h-10 w-10 text-against-400 mx-auto" />
          <p className="text-surface-600 text-sm">Couldn&apos;t load this week&apos;s Crossroads.</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 text-white text-sm hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-surface-200 text-surface-500 text-sm hover:bg-surface-300 transition-colors"
            >
              Home
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
