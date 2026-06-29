'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function JourneyError() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-16 pb-24 text-center">
        <div className="flex justify-center mb-4">
          <AlertTriangle className="h-10 w-10 text-against-400" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white mb-2">
          Couldn&rsquo;t load your journey
        </h1>
        <p className="text-sm text-surface-500 mb-6">
          Something went wrong fetching your civic history for this topic.
        </p>
        <Link
          href={`/topic/${id}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-white text-sm font-mono hover:bg-surface-300 transition-colors"
        >
          Back to topic
        </Link>
      </main>
      <BottomNav />
    </div>
  )
}
