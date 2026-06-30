'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function WikiHistoryError() {
  const params = useParams()
  const topicId = params?.id as string | undefined

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 mx-auto">
            <AlertCircle className="h-6 w-6 text-against-400" />
          </div>
          <p className="font-mono font-bold text-white text-lg">Couldn&apos;t load wiki history</p>
          <p className="font-mono text-surface-500 text-sm">Something went wrong fetching this page&apos;s edit log.</p>
          {topicId && (
            <Link
              href={`/topic/${topicId}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
            >
              Back to topic
            </Link>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
