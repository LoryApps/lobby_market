'use client'

import Link from 'next/link'
import { BookOpen, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function EditorialError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 flex items-center justify-center px-4 pb-20">
        <div className="text-center max-w-sm space-y-4">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 mx-auto">
            <BookOpen className="h-6 w-6 text-surface-500" />
          </div>
          <p className="font-mono font-bold text-white text-lg">Editorial unavailable</p>
          <p className="text-sm text-surface-500 font-mono leading-relaxed">
            Something went wrong loading today&apos;s editorial.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white text-sm font-mono transition-colors"
            >
              Go home
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
