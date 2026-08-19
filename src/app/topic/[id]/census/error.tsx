'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function CensusError({ error }: { error: Error }) {
  const params = useParams<{ id: string }>()
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-20 pb-28 flex flex-col items-center gap-4 text-center">
        <div className="h-12 w-12 rounded-full bg-against-500/10 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-against-400" />
        </div>
        <h1 className="font-mono text-lg font-bold text-white">Census unavailable</h1>
        <p className="text-sm text-surface-500 max-w-sm">
          {error?.message ?? 'Failed to load the voter census. Please try again.'}
        </p>
        <Link
          href={`/topic/${params.id}`}
          className="px-4 py-2 rounded-lg bg-surface-200 text-white text-sm font-mono hover:bg-surface-300 transition-colors"
        >
          Back to topic
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
