'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Error() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-20 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400 mx-auto mb-4" />
        <h1 className="font-mono text-lg font-bold text-white mb-2">
          Couldn&apos;t load verdict
        </h1>
        <p className="font-mono text-sm text-surface-500 mb-6">
          Something went wrong fetching the debate verdict.
        </p>
        <Link
          href={`/debate/${id}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 font-mono text-sm text-white hover:bg-surface-300 transition-colors"
        >
          Back to debate
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
