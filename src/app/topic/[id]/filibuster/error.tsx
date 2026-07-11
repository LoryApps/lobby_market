'use client'

import { AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function TopicFilibusterError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter()
  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />
      <main className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4 pb-24">
        <AlertTriangle className="h-10 w-10 text-against-400" />
        <div>
          <h2 className="text-base font-semibold text-white mb-1">Something went wrong</h2>
          <p className="text-sm text-surface-400">Could not load the filibuster page.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300/60 text-sm text-surface-400 hover:text-white transition-colors"
          >
            Go back
          </button>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300/60 text-sm text-white hover:bg-surface-300/50 transition-colors"
          >
            Try again
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
