'use client'

import { useEffect } from 'react'
import { Crown } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ErrorCard } from '@/components/ui/ErrorCard'

export default function LoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[LoreError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-8 pb-24 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-gold/10 border border-gold/30">
            <Crown className="h-6 w-6 text-gold" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">Civic Lore</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">Platform records &amp; legends</p>
          </div>
        </div>
        <ErrorCard
          title="Couldn't load the Civic Lore"
          message="The chronicles are temporarily unavailable. Please try again."
          onReset={reset}
        />
      </main>
      <BottomNav />
    </div>
  )
}
