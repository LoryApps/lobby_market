'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Error({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-4 pb-24">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30 mx-auto">
            <AlertTriangle className="h-7 w-7 text-against-400" />
          </div>
          <div>
            <p className="font-mono text-base font-semibold text-white mb-1">Failed to load reviews</p>
            <p className="text-xs font-mono text-surface-500">Could not fetch review data for this law.</p>
          </div>
          <div className="flex justify-center gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-xs font-mono px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
            <Link
              href={`/law/${id}`}
              className="inline-flex items-center gap-1.5 text-xs font-mono px-4 py-2 rounded-xl bg-for-600 text-white hover:bg-for-500 transition-colors"
            >
              Back to law
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
