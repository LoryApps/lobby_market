'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function BriefError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  const params = useParams<{ id: string }>()

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-8 pb-28 flex flex-col items-center justify-center text-center gap-4">
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30">
          <AlertTriangle className="h-6 w-6 text-against-400" />
        </div>
        <div>
          <p className="font-mono font-semibold text-white">Couldn&apos;t load brief</p>
          <p className="text-sm text-surface-500 mt-1">{error.message}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
          >
            Try again
          </button>
          {params?.id && (
            <Link
              href={`/topic/${params.id}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to topic
            </Link>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
