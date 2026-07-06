'use client'

import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function ExpertProfileError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/20 mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-against-400" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white mb-2">Expert not found</h1>
        <p className="text-sm font-mono text-surface-500 mb-6">
          This expert profile doesn&apos;t exist or couldn&apos;t be loaded.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-white hover:bg-surface-300 transition-colors text-sm font-mono"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </button>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-for-600 text-white hover:bg-for-500 transition-colors text-sm font-mono"
          >
            Try again
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
