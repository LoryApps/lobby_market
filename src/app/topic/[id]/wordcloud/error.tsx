'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

export default function Error({ reset }: { reset: () => void }) {
  const params = useParams<{ id: string }>()

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <div className="max-w-5xl mx-auto px-4 pt-20 pb-24 flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="h-10 w-10 text-against-400" aria-hidden />
        <p className="text-surface-400 text-sm font-mono">Could not load argument vocabulary.</p>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-surface-200 text-white text-xs font-mono hover:bg-surface-300 transition-colors"
          >
            Try again
          </button>
          <Link
            href={params?.id ? `/topic/${params.id}` : '/'}
            className="px-4 py-2 rounded-lg bg-surface-200 text-surface-400 text-xs font-mono hover:bg-surface-300 hover:text-white transition-colors"
          >
            Back to topic
          </Link>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
