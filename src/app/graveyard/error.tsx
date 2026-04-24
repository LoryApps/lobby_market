'use client'

import { useEffect } from 'react'
import { Skull } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'

export default function GraveyardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GraveyardPage]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center text-center gap-4">
        <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-surface-200 border border-surface-300">
          <Skull className="h-7 w-7 text-surface-500" />
        </div>
        <h1 className="font-mono text-xl font-bold text-white">Even the Graveyard is broken</h1>
        <p className="text-sm text-surface-500 max-w-xs">
          Something went wrong loading the failed topics. The irony is not lost on us.
        </p>
        <Button onClick={reset} variant="default" size="sm">
          Try again
        </Button>
      </main>
      <BottomNav />
    </div>
  )
}
