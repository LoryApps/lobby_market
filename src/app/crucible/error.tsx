'use client'

import Link from 'next/link'
import { Flame } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function CrucibleError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        <ErrorCard
          title="The Crucible is cooling down"
          message={error.message || 'Failed to load the daily argument competition.'}
          onReset={reset}
        />
        <div className="mt-4 text-center">
          <Link
            href="/pulse"
            className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-white font-mono transition-colors"
          >
            <Flame className="h-4 w-4" />
            Try Community Pulse instead
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
