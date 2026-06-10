'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, BarChart2 } from 'lucide-react'
import { useParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function DebatePerformanceError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  const params = useParams()
  const debateId = params?.id as string | undefined

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24">
        {debateId && (
          <Link
            href={`/debate/${debateId}/recap`}
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to recap
          </Link>
        )}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-12 text-center">
          <BarChart2 className="h-10 w-10 text-surface-500 mx-auto mb-4" />
          <p className="text-base font-semibold text-white mb-1">Could not load performance data</p>
          <p className="text-sm font-mono text-surface-500 mb-6">
            {error.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-sm font-medium text-white transition-colors"
          >
            Try again
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
